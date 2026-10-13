#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL_ID="${OLLAMA_MODEL_ID:-llama3.2:3b}"
OLLAMA_ALLOWED_BASE_URLS="${OLLAMA_ALLOWED_BASE_URLS:-http://127.0.0.1:11434,http://localhost:11434}"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/speclens-ollama-smoke.XXXXXX")"
WEB_PID=""

cleanup() {
  local status=$?
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; wait "$WEB_PID" 2>/dev/null || true; fi
  rm -rf "$TEMP_DIR"
  exit "$status"
}
trap cleanup EXIT INT TERM

command -v node >/dev/null || { echo 'ERRO: Node.js ausente.' >&2; exit 1; }
command -v curl >/dev/null || { echo 'ERRO: curl ausente.' >&2; exit 1; }
command -v pnpm >/dev/null || { echo 'ERRO: pnpm ausente.' >&2; exit 1; }
[ -d "$ROOT_DIR/node_modules" ] || { echo 'ERRO: dependências não instaladas; o smoke não instala nem baixa dependências.' >&2; exit 1; }
[ -f "$ROOT_DIR/apps/web/node_modules/next/dist/bin/next" ] || { echo 'ERRO: Next.js não está instalado no workspace web.' >&2; exit 1; }

node --input-type=module - "$OLLAMA_BASE_URL" "$OLLAMA_ALLOWED_BASE_URLS" <<'NODE'
const [url, allowedValue] = process.argv.slice(2);
let parsed;
try { parsed = new URL(url); } catch { throw new Error('OLLAMA_BASE_URL inválida.'); }
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const allowed = allowedValue.split(',').map((value) => value.trim()).filter(Boolean);
if (parsed.protocol !== 'http:' || !loopback.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/*$/.test(parsed.pathname) || !allowed.includes(url)) {
  throw new Error('O smoke só aceita origem HTTP loopback explicitamente allowlisted, sem path, credenciais ou query.');
}
NODE

MODEL_TAGS="$(curl --silent --show-error --fail --max-time 5 "$OLLAMA_BASE_URL/api/tags")" || { echo 'ERRO: Ollama local indisponível; smoke encerrado sem pull.' >&2; exit 1; }
node --input-type=module - "$MODEL_TAGS" "$OLLAMA_MODEL_ID" <<'NODE'
const [raw, selected] = process.argv.slice(2);
let data;
try { data = JSON.parse(raw); } catch { throw new Error('Resposta inválida de /api/tags.'); }
const normalize = (name) => name.includes(':') ? name : `${name}:latest`;
const model = data.models?.find((entry) => normalize(entry.name).toLowerCase() === normalize(selected).toLowerCase());
if (!model) throw new Error(`Modelo '${selected}' ausente no Ollama local; nenhum download foi iniciado.`);
if (model.remote_host || model.details?.remote_host || /^\s*(cloud|remote|openai|anthropic|claude|gemini|azure|bedrock|cohere|mistral-cloud)\//i.test(model.name)) {
  throw new Error(`Modelo '${selected}' tem metadata cloud/proxy e foi rejeitado em Private Mode.`);
}
NODE

WEB_PORT="$(node -e 'const s=require("node:net").createServer(); s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})')"
BASE_URL="http://127.0.0.1:$WEB_PORT"
export OLLAMA_BASE_URL OLLAMA_ALLOWED_BASE_URLS OLLAMA_MODEL_ID
export SPECLENS_DB_PATH="$TEMP_DIR/speclens.sqlite"
node "$ROOT_DIR/apps/web/node_modules/next/dist/bin/next" dev "$ROOT_DIR/apps/web" --hostname 127.0.0.1 --port "$WEB_PORT" >"$TEMP_DIR/web.log" 2>&1 &
WEB_PID=$!

READY=0
for _ in $(seq 1 120); do
  if curl --silent --fail --max-time 1 "$BASE_URL/api/health" >/dev/null 2>&1; then READY=1; break; fi
  kill -0 "$WEB_PID" 2>/dev/null || { cat "$TEMP_DIR/web.log" >&2; echo 'ERRO: SpecLens encerrou antes de ficar pronto.' >&2; exit 1; }
  sleep 0.25
done
[ "$READY" -eq 1 ] || { cat "$TEMP_DIR/web.log" >&2; echo 'ERRO: timeout aguardando SpecLens.' >&2; exit 1; }

cat >"$TEMP_DIR/fixture.yaml" <<'YAML'
openapi: 3.0.3
info:
  title: SpecLens Local Smoke Fixture
  version: 1.0.0
paths:
  /smoke-products:
    get:
      operationId: listSmokeProducts
      summary: List locally provisioned smoke products
      responses:
        '200':
          description: Synthetic smoke response
YAML

IMPORT_RESULT="$(curl --silent --show-error --fail --max-time 30 -F "workspaceId=default" -F "file=@$TEMP_DIR/fixture.yaml;type=application/yaml" "$BASE_URL/api/specifications")" || { echo 'ERRO: fixture sintética não foi importada.' >&2; exit 1; }
printf '%s' "$IMPORT_RESULT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.specification&&!r.spec)return process.exit(1)})' || {
  # Older route versions return a list/job wrapper; an HTTP 2xx import is still
  # checked by confirming the operation is present in the workspace API.
  curl --silent --show-error --fail --max-time 10 "$BASE_URL/api/specifications?workspaceId=default" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!JSON.stringify(r).includes("SpecLens Local Smoke Fixture"))process.exit(1)})' || { echo 'ERRO: import da fixture não aparece no workspace.' >&2; exit 1; }
}

curl --silent --show-error --fail --max-time 10 -X PATCH "$BASE_URL/api/settings" \
  -H 'Content-Type: application/json' \
  --data "$(node -e 'process.stdout.write(JSON.stringify({workspaceId:"default",settings:{schemaVersion:1,workspaceId:"default",privateMode:true,embedding:{providerId:"transformers-local",modelId:"Xenova/all-MiniLM-L6-v2",revision:"main"},decision:{providerId:"laya-local",modelId:"configured-laya-checkpoint"},llm:{providerId:"ollama-local",modelId:process.argv[1]},retrieval:{lexicalEnabled:true,vectorEnabled:true,topK:5}}}))' "$OLLAMA_MODEL_ID")" >"$TEMP_DIR/settings.json"

curl --silent --show-error --fail --no-buffer --max-time 120 -X POST "$BASE_URL/api/chat" \
  -H 'Content-Type: application/json' \
  --data '{"workspaceId":"default","query":"How do I list the synthetic smoke products?"}' >"$TEMP_DIR/chat.sse"
node --input-type=module - "$TEMP_DIR/chat.sse" <<'NODE'
import { readFileSync } from 'node:fs';
const text = readFileSync(process.argv[2], 'utf8');
const events = text.split(/\n\n/).map((block) => block.split('\n').find((line) => line.startsWith('data: '))).filter(Boolean).map((line) => JSON.parse(line.slice(6)));
const tokens = events.filter((event) => event.type === 'token');
const final = events.findLast((event) => event.type === 'final');
if (!tokens.some((event) => typeof event.token === 'string' && event.token.trim())) throw new Error('O smoke não recebeu tokens de explicação do Ollama.');
if (!final?.envelope || !Array.isArray(final.envelope.sources) || !final.envelope.sources.some((source) => source.path === '/smoke-products')) throw new Error('O chat não retornou envelope final validado com a fonte sintética esperada.');
if (!Array.isArray(final.envelope.snippets)) throw new Error('Envelope final sem snippets contratuais.');
console.log(`PASS: ${tokens.length} evento(s) de token e final com ${final.envelope.sources.length} fonte(s) e ${final.envelope.snippets.length} snippet(s).`);
NODE
