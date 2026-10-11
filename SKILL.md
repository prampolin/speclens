---
name: speclens-implementation
description: Implementar e validar incrementalmente o SpecLens, um RAG privado para OpenAPI com embeddings locais, Laya e Ollama.
---

# Skill — Implementação guiada do SpecLens

## Quando aplicar
Use esta skill ao planejar, implementar, revisar, testar ou documentar funcionalidades do SpecLens.

## Início obrigatório
1. Ler `spec.md` (requisitos normativos), `plan.md` (estado e ordem), `AGENTS.md` (políticas) e `specs/README.md`.
2. Abrir apenas o arquivo `specs/NN-*.md` da fase corrente e checar dependências e critérios de aceite.
3. Identificar a menor tarefa pendente; listar arquivos e testes afetados.
4. Executar e registrar o resultado; não marcar conclusão se teste não executou.

## Workflow padrão
**Inspecionar → Planejar microtarefa → Implementar → Testar → Verificar privacidade → Registrar evidência → Atualizar checklists.**

## Padrões obrigatórios
- TypeScript `strict`, contratos independentes para embeddings, classificação, LLM e índice vetorial.
- SQLite e FTS5 locais; versões de modelos e índices persistidas.
- `privateMode=true` é regra do backend e exige operação real sem egress após provisioning.
- JSON validado com Zod; nenhum snippet inventado; todos rastreáveis a operação e versão de spec.
- Ao trocar embeddings, preservar índice anterior até rebuild validado e switch atômico.
- Usar Laya local por padrão, com fallback local por regras e sem fallback de rede.
- Não enviar conteúdo a Groq/OpenAI ou qualquer serviço cloud quando privado.

## Template de relatório por microtarefa

```text
Fase / tarefa:
Arquivos alterados:
Decisões:
Testes executados e resultado:
Checagens de privacidade:
Pendências / bloqueios:
Próxima tarefa (não iniciada):
```

## Parada
Parar ao concluir os critérios de uma fase e solicitar nova execução para a seguinte; não declarar sucesso sem evidências de teste.
