#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/speclens-ollama-e2e.XXXXXX")"
FAKE_PID=""
WEB_PID=""
cleanup() {
  local status=$?
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; wait "$WEB_PID" 2>/dev/null || true; fi
  if [ -n "$FAKE_PID" ]; then kill "$FAKE_PID" 2>/dev/null || true; wait "$FAKE_PID" 2>/dev/null || true; fi
  rm -rf "$TEMP_DIR"
  exit "$status"
}
trap cleanup EXIT INT TERM

export SPECLENS_FAKE_OLLAMA_READY_FILE="$TEMP_DIR/fake-ready.json"
node "$ROOT_DIR/scripts/ollama-e2e-fake.mjs" >"$TEMP_DIR/fake.log" 2>&1 &
FAKE_PID=$!
for _ in $(seq 1 100); do
  [ -s "$SPECLENS_FAKE_OLLAMA_READY_FILE" ] && break
  kill -0 "$FAKE_PID" 2>/dev/null || { cat "$TEMP_DIR/fake.log"; exit 1; }
  sleep 0.05
done
[ -s "$SPECLENS_FAKE_OLLAMA_READY_FILE" ] || { echo 'ERRO: servidor Ollama falso não iniciou.' >&2; exit 1; }
FAKE_PORT="$(node -e 'process.stdout.write(String(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).port))' "$SPECLENS_FAKE_OLLAMA_READY_FILE")"

WEB_PORT="$(node -e 'const s=require("node:net").createServer(); s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})')"
export SPECLENS_E2E_PORT="$WEB_PORT"
export SPECLENS_E2E_BASE_URL="http://127.0.0.1:$WEB_PORT"
export OLLAMA_BASE_URL="http://127.0.0.1:$FAKE_PORT"
export OLLAMA_ALLOWED_BASE_URLS="$OLLAMA_BASE_URL"
export OLLAMA_MODEL_ID='speclens-e2e-a:latest'
export SPECLENS_DB_PATH="$TEMP_DIR/e2e.sqlite"
export SPECLENS_FAKE_OLLAMA_URL="$OLLAMA_BASE_URL"

pnpm --filter web exec playwright test ollama-settings.spec.ts
