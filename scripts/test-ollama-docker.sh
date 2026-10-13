#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
IMAGE="${OLLAMA_IMAGE:-ollama/ollama:latest}"
WEB_IMAGE="${SPECLENS_WEB_IMAGE:-speclens-web}"
MODEL_ID="${OLLAMA_MODEL_ID:-llama3.2:3b}"
PROJECT="speclens-oll06-${$}-${RANDOM}"
SOURCE_DIR="${OLLAMA_SOURCE_DIR:-$ROOT_DIR/models/ollama}"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/speclens-oll06.XXXXXX")"
TEST_OLLAMA_DIR="$TEST_DIR/ollama"

STARTED=0
# Every Compose command, including teardown, resolves the same isolated config.
export OLLAMA_IMAGE="$IMAGE" SPECLENS_WEB_IMAGE="$WEB_IMAGE" OLLAMA_MODEL_ID="$MODEL_ID"
export SPECLENS_DATA_PATH="$TEST_DIR/data" SPECLENS_MODELS_PATH="$TEST_DIR/models"
export SPECLENS_OLLAMA_MODELS_PATH="$TEST_OLLAMA_DIR" SPECLENS_WEB_PORT=0

cleanup() {
  status=$?
  trap - EXIT
  if [ "$STARTED" -eq 1 ]; then
    if ! docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" down --volumes --remove-orphans; then
      printf 'OLL-06: teardown falhou; mounts preservados em %s\n' "$TEST_DIR" >&2
      exit 1
    fi
    local remaining
    remaining="$(docker ps --all --quiet --filter "label=com.docker.compose.project=$PROJECT")" || exit 1
    [ -z "$remaining" ] || { printf 'OLL-06: containers temporários restantes\n' >&2; exit 1; }
    remaining="$(docker network ls --quiet --filter "label=com.docker.compose.project=$PROJECT")" || exit 1
    [ -z "$remaining" ] || { printf 'OLL-06: rede temporária restante\n' >&2; exit 1; }
  fi
  rm -rf "$TEST_DIR"
  if [ "$status" -eq 0 ]; then printf 'OLL-06 Docker smoke: PASS (inferência, egress e teardown)\n'; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() { printf 'OLL-06 Docker smoke: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail 'Docker CLI não encontrado.'
docker info >/dev/null 2>&1 || fail 'daemon Docker indisponível.'
docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "imagem $IMAGE não está local; smoke não baixa imagens."
docker image inspect "$WEB_IMAGE" >/dev/null 2>&1 || fail "imagem da aplicação $WEB_IMAGE não está local; smoke não executa build."
[ -d "$SOURCE_DIR" ] || fail "diretório-fonte $SOURCE_DIR não existe; provisionamento Ollama precisa ocorrer antes do smoke."
mkdir -p "$TEST_OLLAMA_DIR" "$TEST_DIR/data" "$TEST_DIR/models"

# Copy only the pre-provisioned model files into unique temporary bind mounts.
# Compose teardown never receives a path to the user's source directory.
cp -a "$SOURCE_DIR/." "$TEST_OLLAMA_DIR/"

cd "$ROOT_DIR"
STARTED=1
  docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" \
  up --detach --pull never --no-build

WEB_CID="$(docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" ps --quiet web)"
[ -n "$WEB_CID" ] || fail 'container web não iniciou.'

# Confirm the Docker network stays internal for the full lifetime of the
# fictitious inference. A controlled external connection is checked below.
NETWORK_ID="$(docker network ls --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.network=private" --quiet)"
[ -n "$NETWORK_ID" ] || fail 'rede privada do projeto não foi criada.'
INTERNAL="$(docker network inspect --format '{{.Internal}}' "$NETWORK_ID")"
[ "$INTERNAL" = true ] || fail 'a rede Compose não está marcada internal=true.'

# The query and operation are synthetic. No OpenAPI or user workspace content is used.
docker exec -e OLLAMA_MODEL_ID="$MODEL_ID" "$WEB_CID" node --input-type=module -e '
const model = process.env.OLLAMA_MODEL_ID;
let tagsResponse;
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  try {
    tagsResponse = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (tagsResponse.ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!tagsResponse?.ok) throw new Error("Ollama não ficou pronto dentro de 60 segundos.");
const tags = await tagsResponse.json();
if (!tags.models?.some((entry) => entry.name === model)) {
  throw new Error(`modelo pré-provisionado não encontrado: ${model}`);
}
const { readFileSync } = await import("node:fs");
const transmitted = () => Object.fromEntries(readFileSync("/proc/net/dev", "utf8").trim().split("\n").slice(2).map((line) => {
  const [name, counters] = line.split(":");
  return [name.trim(), Number(counters.trim().split(/\s+/)[8])];
}).filter(([name]) => name !== "lo"));
const routes = () => readFileSync("/proc/net/route", "utf8").trim().split("\n").slice(1).map((line) => {
  const [iface, destination, , flags] = line.trim().split(/\s+/);
  return { iface, destination, active: (Number.parseInt(flags, 16) & 1) === 1 };
}).filter((route) => route.active);
const routeSnapshot = routes();
if (routeSnapshot.some((route) => route.destination === "00000000")) {
  throw new Error(`rota default inesperada na rede privada: ${JSON.stringify(routeSnapshot)}`);
}
const internalInterfaces = new Set(routeSnapshot.filter((route) => route.destination !== "00000000").map((route) => route.iface));
if (!internalInterfaces.size) throw new Error("nenhuma rota privada foi encontrada para monitorar");
const before = transmitted();
if (!Object.keys(before).length) throw new Error("monitor sem interface externa ao loopback");
const response = await fetch("http://127.0.0.1:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    stream: false,
    messages: [
      { role: "system", content: "Responda em uma frase curta." },
      { role: "user", content: "Consulta fictícia OLL-06: explique que /fake aceita POST." }
    ]
  }),
  signal: AbortSignal.timeout(120000)
});
if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
const body = await response.json();
if (body.done !== true || typeof body.message?.content !== "string" || !body.message.content.trim()) {
  throw new Error("Ollama não concluiu geração local de texto.");
}
const after = transmitted();
const changed = Object.entries(after).filter(([iface, bytes]) => bytes !== before[iface]);
const outsidePrivateNetwork = changed.filter(([iface]) => !internalInterfaces.has(iface));
if (outsidePrivateNetwork.length) {
  throw new Error(`delta TX em interface fora da rede privada: ${JSON.stringify(outsidePrivateNetwork)}`);
}
if (JSON.stringify(routeSnapshot) !== JSON.stringify(routes())) throw new Error("rotas mudaram durante a inferência");
console.log(`geração local concluída para ${model}; sem rota default; delta TX restrito às interfaces da rede interna: ${JSON.stringify(changed)}`);
' || fail 'geração local falhou; sem fallback de rede.'

# Probe external egress while the isolated project is still running after the
# synthetic inference. A timeout is inconclusive and fails closed.
docker exec "$WEB_CID" node --input-type=module -e '
const { Socket } = await import("node:net");
const socket = new Socket();
try {
  await new Promise((resolve, reject) => {
    socket.setTimeout(2500, () => reject(new Error("tentativa de egress expirou sem prova de bloqueio")));
    socket.once("connect", resolve);
    socket.once("error", reject);
    socket.connect(80, "1.1.1.1");
  });
  throw new Error("egress externo inesperadamente alcançável");
} catch (error) {
  if (error instanceof Error && error.message === "egress externo inesperadamente alcançável") throw error;
  if (!["ENETUNREACH", "EHOSTUNREACH"].includes(error.code)) throw error;
  console.log(`consulta fictícia concluída; rede internal=true; tentativa controlada de egress bloqueada (${error.code})`);
} finally {
  socket.destroy();
}
' || fail 'tentativa controlada de egress não foi bloqueada.'


# Stop only the isolated test project's Ollama service. The web container keeps
# the shared network namespace, so its readiness endpoint must report the local
# Ollama failure and must not substitute another provider or remote destination.
docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" stop ollama
docker exec "$WEB_CID" node --input-type=module -e '
const response = await fetch("http://127.0.0.1:3000/api/providers?workspaceId=default", {
  signal: AbortSignal.timeout(10000)
});
if (!response.ok) throw new Error(`readiness endpoint HTTP ${response.status}`);
const body = await response.json();
const llm = body.providers?.find((provider) => provider.kind === "llm");
if (llm?.id !== "ollama-local" || llm.ready !== false || !/Failed to connect to Ollama runtime/.test(llm.reason ?? "")) {
  throw new Error(`falha Ollama não retornou diagnóstico local específico: ${JSON.stringify(llm)}`);
}
if (body.providers.some((provider) => provider.executionLocation === "remote" || provider.requiresNetwork)) {
  throw new Error("readiness selecionou provider com execução/rede remota");
}
console.log("Ollama indisponível: readiness reportou erro específico, sem fallback remoto");
' || fail 'falha do Ollama não produziu diagnóstico específico no isolamento.'

