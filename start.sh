#!/usr/bin/env bash
# First run provisions locked dependencies and the default local model after a
# visible confirmation. Subsequent starts run without registry access.
set -uo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL_ID="${OLLAMA_MODEL_ID:-llama3.2:3b}"
OLLAMA_PID=""
STARTUP_ATTEMPTS="${SPECLENS_OLLAMA_STARTUP_ATTEMPTS:-10}"

log() { printf '%s\n' "$*"; }

confirm_provision() {
  local prompt="$1"
  if [ "${SPECLENS_AUTO_PROVISION:-0}" = 1 ]; then
    return 0
  fi
  if [ ! -t 0 ]; then
    log "AVISO: execução sem terminal interativo; provisionamento automático desativado."
    log "       Para permitir downloads explicitamente em automação, defina SPECLENS_AUTO_PROVISION=1."
    return 1
  fi
  printf '%s [y/N] ' "$prompt"
  local answer
  read -r answer
  [[ "$answer" =~ ^([yY]|[yY][eE][sS]|[sS]|[sS][iI][mM])$ ]]
}

cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [ -n "$OLLAMA_PID" ]; then
    log "Encerrando apenas o Ollama iniciado por este script (PID $OLLAMA_PID)."
    kill "$OLLAMA_PID" 2>/dev/null || true
    wait "$OLLAMA_PID" 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! command -v node >/dev/null 2>&1; then
  log "ERRO: Node.js v20+ não encontrado. Instale-o antes de iniciar o SpecLens."
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  log "ERRO: pnpm não encontrado. Execute o provisionamento local e instale pnpm antes de iniciar."
  exit 1
fi
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  log "Primeira execução: será necessário instalar as dependências travadas pelo pnpm-lock.yaml."
  if ! confirm_provision "Instalar dependências agora? Isso acessará o registry npm/pnpm."; then
    log "ERRO: dependências ausentes. Execute 'bash scripts/provision-offline.sh' ou aceite o provisionamento inicial."
    exit 1
  fi
  if ! pnpm install --frozen-lockfile; then
    log "ERRO: não foi possível instalar as dependências."
    exit 1
  fi
fi

# Match the backend's Private Mode allowlist before making a local readiness request.
case "$OLLAMA_BASE_URL" in
  http://127.0.0.1:11434|http://127.0.0.1:11434/|http://localhost:11434|http://localhost:11434/)
    OLLAMA_BASE_URL="${OLLAMA_BASE_URL%/}"
    ;;
  *)
    log "ERRO: OLLAMA_BASE_URL fora da allowlist privada (http://127.0.0.1:11434 ou http://localhost:11434)."
    exit 1
    ;;
esac
if [ -z "$OLLAMA_MODEL_ID" ]; then
  log "ERRO: OLLAMA_MODEL_ID não pode ser vazio."
  exit 1
fi
if ! [[ "$STARTUP_ATTEMPTS" =~ ^[0-9]+$ ]] || [ "$STARTUP_ATTEMPTS" -lt 1 ] || [ "$STARTUP_ATTEMPTS" -gt 60 ]; then
  log "ERRO: SPECLENS_OLLAMA_STARTUP_ATTEMPTS deve ser um inteiro entre 1 e 60."
  exit 1
fi

MODEL_TO_CHECK="$OLLAMA_MODEL_ID"
case "${MODEL_TO_CHECK##*/}" in
  *:*) ;;
  *) MODEL_TO_CHECK="${MODEL_TO_CHECK}:latest" ;;
esac

OLLAMA_READY=0
OLLAMA_TAGS=""
HAS_CURL=0
if command -v curl >/dev/null 2>&1; then
  HAS_CURL=1
  if OLLAMA_TAGS="$(curl --silent --show-error --fail --max-time 1 "$OLLAMA_BASE_URL/api/tags" 2>/dev/null)"; then
    OLLAMA_READY=1
  fi
else
  log "AVISO: curl não encontrado; não será possível verificar o serviço Ollama."
fi

if [ "$OLLAMA_READY" -eq 0 ] && [ "$HAS_CURL" -eq 1 ]; then
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama não responde em $OLLAMA_BASE_URL; iniciando serviço local."
    # Ollama reads OLLAMA_HOST when serving. Preserve the selected loopback host.
    OLLAMA_HOST="${OLLAMA_BASE_URL#http://}"
    OLLAMA_MODELS="${OLLAMA_MODELS:-$ROOT_DIR/models/ollama/models}"
    export OLLAMA_HOST OLLAMA_MODELS
    mkdir -p "$OLLAMA_MODELS"
    ollama serve >/dev/null 2>&1 &
    OLLAMA_PID=$!

    attempts=0
    while [ "$attempts" -lt "$STARTUP_ATTEMPTS" ]; do
      if OLLAMA_TAGS="$(curl --silent --show-error --fail --max-time 1 "$OLLAMA_BASE_URL/api/tags" 2>/dev/null)"; then
        OLLAMA_READY=1
        break
      fi
      attempts=$((attempts + 1))
      sleep 1
    done
    if [ "$OLLAMA_READY" -eq 0 ]; then
      log "AVISO: Ollama não ficou pronto após ${STARTUP_ATTEMPTS}s. SpecLens será iniciado em modo degradado."
    fi
  else
    log "AVISO: Ollama não responde em $OLLAMA_BASE_URL e o CLI 'ollama' não está no PATH."
    log "       SpecLens será iniciado em modo degradado; nenhuma instalação ou conexão a registry será feita."
  fi
elif [ "$OLLAMA_READY" -eq 0 ] && [ "$HAS_CURL" -eq 0 ]; then
  log "AVISO: sem curl, não foi possível detectar se Ollama já está ativo; o serviço não será iniciado às cegas."
  log "       SpecLens será iniciado em modo degradado."
fi

if [ "$OLLAMA_READY" -eq 1 ]; then
  model_is_installed() {
    printf '%s' "$1" | node --input-type=module -e '
    let body = "";
    for await (const chunk of process.stdin) body += chunk;
    const target = process.argv[1].toLowerCase();
    let parsed;
    try { parsed = JSON.parse(body); } catch { process.exit(2); }
    const models = Array.isArray(parsed?.models) ? parsed.models : [];
    const matches = models.some((model) => {
      const name = typeof model?.name === "string" ? model.name : "";
      const normalized = name.includes(":") ? name : `${name}:latest`;
      return normalized.toLowerCase() === target;
    });
    process.exit(matches ? 0 : 1);
  ' "$MODEL_TO_CHECK"
  }
  if ! model_is_installed "$OLLAMA_TAGS"; then
    log "Ollama está ativo, mas o modelo bootstrap '$OLLAMA_MODEL_ID' não está instalado."
    if command -v ollama >/dev/null 2>&1 && confirm_provision "Baixar '$OLLAMA_MODEL_ID' do registry oficial do Ollama? Os documentos do SpecLens não serão enviados."; then
      if OLLAMA_HOST="${OLLAMA_BASE_URL#http://}" ollama pull "$OLLAMA_MODEL_ID"; then
        if OLLAMA_TAGS="$(curl --silent --show-error --fail --max-time 10 "$OLLAMA_BASE_URL/api/tags" 2>/dev/null)" && model_is_installed "$OLLAMA_TAGS"; then
          log "Modelo '$OLLAMA_MODEL_ID' provisionado e verificado."
        else
          log "AVISO: o pull terminou, mas o modelo ainda não aparece em /api/tags; SpecLens iniciará em modo degradado."
        fi
      else
        log "AVISO: pull do modelo falhou; SpecLens iniciará em modo degradado."
      fi
    else
      log "       Modelo não baixado; SpecLens iniciará em modo degradado. Provisione-o antes de consultar o LLM."
    fi
  else
    log "Ollama pronto em $OLLAMA_BASE_URL com o modelo bootstrap '$OLLAMA_MODEL_ID'."
  fi
fi

log "Iniciando SpecLens em http://127.0.0.1:3000"
pnpm dev
