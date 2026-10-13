# Phase 12 — RAG Reliability

**Status:** In progress — RAG-01 completed; RAG-02 through RAG-09 pending.
**Date:** 2026-10-12
**Dependencies:** Historical phases 01–11 and OLL-01–OLL-07; their completion is not a substitute for the new gates.
**Detailed steps, test matrix and commands:** [plan.md](../plan.md).

## Scope

Reliable real local embeddings, persistent vector generations, truthful ingestion status, workspace-aware settings, isolated retrieval, canonical LLM context and verified offline operation. Preserve `privateMode=true`, local providers, deterministic snippets and single-command startup. No cloud services, implicit downloads or execution of documented APIs.

## Ordered checklist

Each ID maps to the detailed section with the same ID in plan.md. Execute one small task at a time. Do not mark a task complete without its automated test evidence.

- [x] **RAG-01** Define versioned state/configuration contracts and regression fixtures.
- [ ] **RAG-02** Require real embeddings and consistent offline model provisioning.
- [ ] **RAG-03** Persist vectors and activate complete generations transactionally.
- [ ] **RAG-04** Consolidate durable ingestion and expose truthful outcomes.
- [ ] **RAG-05** Apply workspace settings and schedule compatible rebuilds.
- [ ] **RAG-06** Enforce workspace/version isolation and effective retrieval modes.
- [ ] **RAG-07** Preserve canonical contract details in bounded LLM context.
- [ ] **RAG-08** Expose indexing, degradation, retry and inspector behavior in the UI.
- [ ] **RAG-09** Record real semantic evaluation, restart and offline release gates.

## Runtime entry-point mapping (RAG-01)

1. **Import (`POST /api/specifications`)**: `apps/web/src/app/api/specifications/route.ts` parses and normalizes via `parseOpenAPIDocument` and `normalizeDocument` (`@speclens/openapi-core`), then persists via `SpecificationRepository.create`/`setActive` and `OperationRepository.createBatch` (`@speclens/db`).
2. **Indexing**: `apps/web/src/app/api/specifications/route.ts` starts an in-process background task calling `indexOperations` (`packages/ai-core/src/retrieval/indexer.ts`) and updates `IngestionJobRepository` (`packages/db/src/repositories/ingestion-jobs.ts`). `EmbeddingIndexer` (`packages/ai-core/src/providers/embedding/indexer.ts`) is currently a separate unused staging helper to be consolidated in RAG-04.
3. **Settings (`GET`/`PATCH /api/settings`)**: `apps/web/src/app/api/settings/route.ts` validates with `workspaceSettingsSchema` (`packages/db/src/settings-schema.ts`), persists via `SettingsRepository` (`packages/db/src/repositories/settings.ts`), and resolves defaults via `resolveWorkspaceSettings` (`apps/web/src/lib/server/providers.ts`).
4. **Retrieval (`POST /api/chat`)**: `apps/web/src/app/api/chat/route.ts` invokes `HybridRetrievalImpl.search` (`packages/ai-core/src/retrieval/hybrid-retrieval.ts`), combining `OperationRepository.fullTextSearch` (SQLite FTS5) and `VectorIndex.search` (currently `LocalFlatVectorIndex` in `packages/ai-core/src/providers/embedding/vector-index.ts`, to be backed by SQLite in RAG-03).
5. **Hydration (`GET /api/operations/[id]`, `POST /api/chat`)**: `hydrateOperations` (`packages/ai-core/src/retrieval/schema-hydrator.ts`) and `apps/web/src/app/api/operations/[id]/route.ts` load normalized operation contracts from `OperationRepository.findById`.
6. **Prompt & LLM (`POST /api/chat`)**: `OllamaLLMProvider.streamExplanation` (`packages/ai-core/src/llm/ollama-provider.ts`) builds untrusted reference context via `buildExplanationPrompt` (`packages/ai-core/src/llm/prompt.ts`).
7. **SSE & Job Polling**: `apps/web/src/app/api/chat/route.ts` streams `status`, `intent`, `retrieval`, `sources`, `snippets`, `token`, `final`, and `error` events; `apps/web/src/app/api/jobs/[id]/route.ts` and `GET /api/specifications` serve job polling.

## Evidence log

| Date | Task | Command / artifact | Result | Limitations |
|---|---|---|---|---|
| 2026-10-12 | Planning | Source inspection; detailed plan and historical archive | Documentation prepared | Runtime tests NOT EXECUTED (NÃO EXECUTADO); no implementation changes |
| 2026-10-12 | Documentation validation | Python assertions for local Markdown links, balanced code fences, nine task/checklist IDs and unchecked completion states; targeted `git diff --check` | PASS | Documentation validation only; no runtime claims |
| 2026-10-12 | RAG-01 (red-to-green regression capture) | `pnpm exec vitest run packages/db/tests/storage-settings.test.ts` before schema refinement | FAIL (1 failed / 20 passed, exit 1) as expected for both retrieval modes disabled | Confirmed pre-fix gap before implementing RAG-01 contracts |
| 2026-10-12 | RAG-01 (contracts & fixtures validation) | `pnpm exec vitest run packages/db/tests/storage-settings.test.ts packages/ai-core/test/embedding.test.ts packages/ai-core/test/rag-contracts.test.ts packages/ai-core/test/indexer.test.ts packages/ai-core/test/hybrid-retrieval.test.ts apps/web/src/__tests__/api-routes.test.ts apps/web/src/__tests__/llm-settings.test.ts` | PASS (7 files, 74 tests passed, exit 0) | Contracts, DTO invariants, ownership guards, and synthetic fixtures only; runtime embedding/persistence changes belong to RAG-02..RAG-08 |
| 2026-10-12 | RAG-01 (typecheck) | `pnpm exec tsc --noEmit -p packages/db/tsconfig.json && pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json && pnpm exec tsc --noEmit -p apps/web/tsconfig.json` | PASS (exit 0) | Static type verification across affected packages |

For each future task record files changed, decisions, command/exit code/test counts, privacy checks, risks and the next unstarted task. Mark missing prerequisites explicitly; a skipped real-model test never passes a gate.

## Conflicts, risks and pending decisions

Historical Phase 04 completion claims exceed the current runtime's persistence/atomicity guarantees. spec.md remains the functional contract (its stale overview status header was updated in a documented edit without altering any normative requirement). Preserve historical evidence and add corrective evidence here.

Confirmed RAG-01 migration and compatibility decisions:
- **Settings schema v1 compatibility**: `workspaceSettingsSchema` retains `schemaVersion: 1` for backward compatibility while rejecting `{ lexicalEnabled: false, vectorEnabled: false }` on write; `migrateLegacyWorkspaceSettings` upgrades unversioned/partial payloads, defaults `privateMode=true`, repairs legacy both-disabled retrieval flags with `REPAIRED_BOTH_RETRIEVAL_MODES_DISABLED`, and flags mutable revisions (`main`/`latest`/`master`/`HEAD`) with `UNPINNED_MODEL_REVISION`.
- **Unverified legacy records**: `deriveLegacyVectorCapability` downgrades legacy records lacking a verified persisted generation to `vectorCapability: 'unavailable'` with `INDEX_UNVERIFIED`, preventing fabricated semantic readiness.
- **Embedding space fingerprint**: `computeEmbeddingFingerprint` and extended `namespaceId`/`areNamespacesCompatible` include `providerId`, `implementationVersion`, `modelId`, `modelRevision`, `assetDigest`, `dimensions`, `pooling`, `normalize`, `preprocessingVersion`, `operationTextVersion`, and `encodingVersion`.
- **Ownership proof**: `assertSpecificationOwnership`, `assertJobOwnership`, `assertOperationOwnership`, and `assertNamespaceOwnership` verify relational workspace/specification records and active-version state rather than trusting ID prefixes or namespace hashes.

SQLite exact-search scale, model asset packaging, Portuguese retrieval quality, interrupted job recovery and context truncation require the validations defined in plan.md.

## Exit gate

- [ ] All RAG tasks and their automated tests completed with evidence.
- [ ] Real local inference demonstrated; no production synthetic embedding fallback.
- [ ] Persistent indexes survive restart and failed/interrupted rebuilds.
- [ ] No cross-workspace/version/model contamination.
- [ ] UI distinguishes semantic readiness, lexical fallback and contract-only explanation.
- [ ] Private-mode egress and secret-safe diagnostics verified in isolated runtime.
- [ ] Retrieval quality and latency measured with actual pinned models.
- [ ] plan.md and operational documentation updated; no later phase started automatically.

**Next item:** RAG-02, not started.

## Diretrizes visuais complementares — 2026-10-12

Entregue [DESIGN.md](../DESIGN.md) com composição, tokens, componentes, acessibilidade e critérios futuros, conforme solicitação explícita de documentação visual. Arquivos alterados: DESIGN.md, plan.md e este registro. Nenhum checklist RAG concluído; dependências de RAG-08 preservadas.

Evidência: validação Python do documento (9 links locais, fences, checkboxes pendentes e whitespace), PASS/exit 0. Runtime, egress e comparação visual: **NÃO EXECUTADO**, mudança somente documental, sem novas rotas ou recursos externos. Riscos: contraste e comportamento responsivo ainda precisam de validação renderizada. Próximo item permanece RAG-01, não iniciado.

## Microtarefa adicional — switches LLM / Laya — 2026-10-12

Escopo autorizado explicitamente pelo usuário: seleção de só LLM, só Laya ou ambos, em Configurações, com efeito no próximo chat. Extensão pontual relacionada a RAG-05/RAG-08; não representa conclusão desses gates.

Arquivos alterados nesta microtarefa: `packages/db/src/settings-schema.ts`, `packages/ai-core/src/{schemas,types}.ts`, `apps/web/src/app/settings/page.tsx`, `apps/web/src/app/api/chat/route.ts`, `apps/web/src/lib/server/providers.ts`, `apps/web/src/__tests__/api-routes.test.ts`, novo `packages/db/tests/inference-settings.test.ts`, `spec.md`, `plan.md` e este registro.

Decisão: `inference` opcional no schema v1, com `layaEnabled` e `llmEnabled`; settings antigos mantêm ambos ativos. Pelo menos um habilitado é obrigatório. Provedor desligado não executa inferência nem readiness. LLM desligado usa resposta contratual explicitamente identificada. Persistência por workspace, sem reindexação, sem nova rota ou dependência, privacidade preservada.

Evidências:
- `pnpm exec vitest run packages/db/tests/inference-settings.test.ts apps/web/src/__tests__/api-routes.test.ts apps/web/src/__tests__/llm-settings.test.ts packages/db/tests/storage-settings.test.ts packages/ai-core/test/rag-contracts.test.ts`: PASS, 5 arquivos / 61 testes, exit 0. Inclui três modos, rejeição de ambos desligados sem sobrescrever settings, ausência de chamadas aos provedores desligados/fetch, compatibilidade legada e reabertura de SQLite temporário.
- `pnpm exec tsc --noEmit -p packages/db/tsconfig.json && pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json && pnpm exec tsc --noEmit -p apps/web/tsconfig.json`: PASS, exit 0.
- ESLint direcionado aos sete arquivos de implementação/teste alterados então existentes: PASS, exit 0; 12 warnings preexistentes.
- Navegador em `127.0.0.1:43187`, SQLite temporário e Ollama indisponível: ambos, só Laya, só LLM, salvar, recarregar e tecla Espaço verificados. Captura `output/playwright/inference-switches.png`.

Riscos/limites: testes determinísticos não comprovam qualidade de modelos reais; Laya indisponível continua usando fallback local por regras. Build completo e isolamento offline real: NÃO EXECUTADO. Nenhuma API documentada ou snippet executado. Próximo item: corrigir as lacunas da auditoria RAG-01 (DTO vector_only com vetor desligado e serialização ambígua do fingerprint); não iniciadas aqui.
