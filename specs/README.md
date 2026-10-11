# Specs por fase

Cada arquivo é um roteiro operacional complementar à especificação normativa [`../spec.md`](../spec.md). Marque checkboxes apenas quando houver evidências. A ordem é definida em [`../plan.md`](../plan.md).

| Fase | Documento |
|---|---|
| 01 | [Foundation](./01-foundation.md) |
| 02 | [Parser e normalização OpenAPI](./02-openapi-parser.md) |
| 03 | [SQLite, workspaces e settings](./03-storage-settings.md) |
| 04 | [Embeddings intercambiáveis](./04-embeddings.md) |
| 05 | [Busca híbrida e RAG Inspector](./05-hybrid-retrieval.md) |
| 06 | [Laya + classificador configurável](./06-laya-classifier.md) |
| 07 | [Ollama e protocolo estruturado](./07-ollama-llm.md) |
| 08 | [Codegen determinístico](./08-codegen.md) |
| 09 | [Chat, Settings e UI final](./09-chat-ui.md) |
| 10 | [Privacidade, segurança e benchmarks](./10-security-evals.md) |
| 11 | [Packaging e release local](./11-release.md) |

## Regra de atualização
Registre na seção Evidências os comandos e os resultados reais. Se o teste não rodar, identifique como **NÃO EXECUTADO**. Não altere o status de outra fase sem completar o gate da fase atual.
