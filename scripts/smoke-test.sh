#!/bin/bash
# Teste de fumaça: verifica que o app inicializa e passa health check
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

echo "=== SpecLens Smoke Test ==="

# Health check
RESPONSE=$(curl -sf "$BASE_URL/api/health" || echo 'FAILED')
if echo "$RESPONSE" | grep -q '"status"'; then
  echo "✅ /api/health OK"
else
  echo "❌ /api/health FALHOU: $RESPONSE"
  exit 1
fi

# Verifica providers endpoint
RESPONSE=$(curl -sf "$BASE_URL/api/providers" || echo 'FAILED')
if echo "$RESPONSE" | grep -q 'providers'; then
  echo "✅ /api/providers OK"
else
  echo "❌ /api/providers FALHOU"
  exit 1
fi

echo ""
echo "✅ Smoke test passou! SpecLens está funcionando localmente."
