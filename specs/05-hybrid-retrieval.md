# Fase 05 — Busca híbrida e RAG Inspector

**Estado:** Concluída  
**Objetivo:** Resultados rastreáveis e avaliáveis.  
**Dependência:** Gate aprovado da fase 04.

## Passo a passo

- [x] **05.01** Indexar textos compactos das operations em FTS5/BM25 e VectorIndex (`packages/ai-core/src/retrieval/indexer.ts`).
- [x] **05.02** Aplicar filtros method/path/tags e fusão de rankings com RRF configurável (`packages/ai-core/src/retrieval/hybrid-retrieval.ts`).
- [x] **05.03** Carregar o schema canônico só após escolher candidatos (`packages/ai-core/src/retrieval/schema-hydrator.ts`).
- [x] **05.04** Definir top-K, desempate determinístico, threshold e no-answer explícito ([] sem alucinação).
- [x] **05.05** Expor metadados de scores no RAG Inspector (lexicalScore, vectorScore, fusedScore, ranks) sem vazar conteúdo em logs.
- [x] **05.06** Criar perguntas em português/inglês e medir Recall@5, MRR, top-1, gerando baseline (`packages/evals/src/retrieval-eval.ts`).

## Testes e verificações

- [x] Perguntas exatas por path/operationId e perguntas semânticas por intenção.
- [x] RRF determinístico para mesmos inputs com scores auditáveis.
- [x] Hydration lazy carrega JSON completo somente para top-K selecionado.
- [x] Filtros por method retornam estritamente o subset especificado.
- [x] Comparação de métricas gravada em `packages/evals/baselines/retrieval-baseline.json`.

## Critério de aceite

- [x] Retrieval devolve fonte rastreável, scores reproduzíveis e baseline de métricas armazenado.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que nenhum tráfego externo é gerado.
- [x] Embeddings e busca executam localmente em memória e SQLite.
- [x] Sem persistência de segredos ou vazamento de dados confidenciais nos logs.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 05.01-05.05 | `vitest run packages/ai-core/test/hybrid-retrieval.test.ts` | 7 passed (100%) | `packages/ai-core/test/hybrid-retrieval.test.ts` |
| 2026-10-11 | 05.06 | `vitest run packages/evals/test/retrieval-eval.test.ts` | 1 passed, Recall@5=100%, MRR=1.0 | `packages/evals/baselines/retrieval-baseline.json` |
| 2026-10-11 | Suite geral ai-core + evals | `vitest run packages/ai-core packages/evals` | 57 passed (100%) | Todas as suites passaram sem falhas |

## Decisões e riscos

- RRF implementado via `sum(w_i / (k + rank_i))` com `k=60` configurável via `FusionConfig`.
- Desempate determinístico implementado: `fusedScore DESC` -> `vectorScore DESC` -> `lexicalScore DESC` -> `id ASC`.
- Lazy hydration: `hydrateOperations` consulta `OperationRepository.findById` somente após a fusão e ranking do top-K candidatos.
- Dataset de avaliação com 10 perguntas PT/EN sobre Petstore 3.0 obteve 100% Top-1 Accuracy, Recall@5 de 1.0 e MRR de 1.0.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
