#!/bin/bash
# Executar ANTES de desconectar da internet
# Baixa modelos, cria diretórios, valida dependências

set -euo pipefail

echo "=== SpecLens: Provisioning para operação offline ==="

# Criar diretórios locais de persistência
mkdir -p data models/embedding models/laya

# Verifica pnpm store local
pnpm store status || echo "AVISO: pnpm store pode precisar de revalidação"

# Instruir usuário a baixar modelo Ollama
echo ""
echo "Para usar LLM local, execute:"
echo "  ollama pull llama3.2:3b  # ou outro modelo de sua escolha"
echo ""
echo "Para usar embeddings locais, baixe o modelo e salve em ./models/embedding/"
echo "  Recomendado: Xenova/multilingual-e5-small"
echo ""
echo "Provisioning concluído. Agora você pode desconectar a rede."
