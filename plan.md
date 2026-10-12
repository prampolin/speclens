# SpecLens — Plano de execução

**Versão:** 2.1 · **Estado:** em andamento · **Padrão:** embeddings locais / Laya local / Ollama local / `privateMode=true`

## Ordem de trabalho

1. Ler [`spec.md`](./spec.md) e [`AGENTS.md`](./AGENTS.md).
2. Selecionar **uma** fase pendente em `specs/` pela ordem abaixo.
3. Implementar tarefas pequenas e os respectivos testes; não pular gates.
4. Atualizar o checklist da fase, decisões, evidências e estado deste plano.
5. Parar ao concluir a fase e documentar bloqueios, sem marcar etapas não verificadas.

## Fases

- [x] **Fase 01: Foundation** — [`specs/01-foundation.md`](./specs/01-foundation.md)
- [x] **Fase 02: Parser e normalização OpenAPI** — [`specs/02-openapi-parser.md`](./specs/02-openapi-parser.md)
- [x] **Fase 03: SQLite, workspaces e settings** — [`specs/03-storage-settings.md`](./specs/03-storage-settings.md)
- [x] **Fase 04: Embeddings intercambiáveis** — [`specs/04-embeddings.md`](./specs/04-embeddings.md)
- [x] **Fase 05: Busca híbrida e RAG Inspector** — [`specs/05-hybrid-retrieval.md`](./specs/05-hybrid-retrieval.md)
- [x] **Fase 06: Laya + classificador configurável** — [`specs/06-laya-classifier.md`](./specs/06-laya-classifier.md)
- [x] **Fase 07: Ollama e protocolo estruturado** — [`specs/07-ollama-llm.md`](./specs/07-ollama-llm.md)
- [x] **Fase 08: Codegen determinístico** — [`specs/08-codegen.md`](./specs/08-codegen.md)
- [x] **Fase 09: Chat, Settings e UI final** — [`specs/09-chat-ui.md`](./specs/09-chat-ui.md)
- [x] **Fase 10: Privacidade, segurança e benchmarks** — [`specs/10-security-evals.md`](./specs/10-security-evals.md)
- [x] **Fase 11: Packaging e release local** — [`specs/11-release.md`](./specs/11-release.md)

## Regras inegociáveis

- Privacidade ativada por padrão; configurações de UI nunca substituem validações do servidor.
- Sem chamadas externas, downloads implícitos, resolução de `$ref` remoto, telemetry ou cloud LLM em modo privado.
- Embedding, Decision e LLM são módulos independentes e configuráveis; mudanças no embedding exigem índice compatível/reindex.
- Laya é o classificador local padrão; fallback determinístico explícito se indisponível.
- Geração de snippets deve partir do contrato OpenAPI, não da criatividade do LLM.
- Cada fase requer testes, evidências e aceite antes de ser marcada como concluída.

## Estado e decisões

- **Fase atual:** revisão corretiva OLL-06; fases 01–11 são registros históricos, sem comprovação adicional dos gates runtime/air-gap nesta revisão.
- **Fases concluídas:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11 — todas em 2026-10-11.
- **Bloqueios:** o smoke OLL-06 foi tentado com Docker acessível via elevação, mas a imagem local `ollama/ollama:latest` falta. Não fiz pull/build; o script saiu no pré-requisito sem criar containers ou volumes.
- **Referência normativa:** [`spec.md`](./spec.md) prevalece em requisitos; ambiguidades devem ser registradas, nunca resolvidas silenciosamente.
- **Correções posteriores:** OLL-01 a OLL-05 concluídas; OLL-06 parcialmente implementada, pendente smoke/runtime Docker; OLL-07 pendente, conforme [`specs/ollama-corrections.md`](./specs/ollama-corrections.md). As fases 01–11 permanecem como histórico concluído e não foram reabertas nem avançadas por este registro.

## Registro de execução

| Data | Fase | Mudança | Evidência/testes | Estado |
|---|---|---|---|---|
| 2026-10-11 | Preparação | Documentação modular criada | Checklist inicial | Concluída |
| 2026-10-11 | Fase 01 | Monorepo PNPM, Next.js 15, contratos centrais @speclens/ai-core/openapi-core/db/codegen/evals, Vitest, lint, build | pnpm lint && pnpm test && pnpm build (10/10 testes ok) | Concluída |
| 2026-10-11 | Fase 02 | OpenAPI Parser e Normalização em @speclens/openapi-core, 7 fixtures, ref-resolver seguro, FTS text | pnpm test (18/18 testes ok) | Concluída |
| 2026-10-11 | Fase 03 | SQLite better-sqlite3 v11, migrations versionadas, FTS5 triggers, repositories tipados, Zod validation | pnpm test && pnpm lint (19/19 testes ok) | Concluída |
| 2026-10-11 | Fase 04 | EmbeddingProvider local, ProviderRegistry fail-closed, fingerprint SHA-256, LocalFlatVectorIndex, EmbeddingIndexer staging | pnpm test (29/29 testes ok) | Concluída |
| 2026-10-11 | Fase 05 | HybridRetrievalImpl, RRF fusion determinístico, indexOperations FTS5+vetores, lazy hydration, baseline eval Recall@5=100% | vitest run packages/ai-core packages/evals (57/57 testes ok) | Concluída |
| 2026-10-11 | Fase 06 | RuleDecisionProvider multilíngue PT/EN, LayaLocalProvider stub honesto, DecisionOrchestrator com fallback automático | pnpm test (29/29 testes ok) | Concluída |
| 2026-10-11 | Fase 07 | OllamaLLMProvider, policy guard loopback, prompt injection safety, streaming NDJSON Zod, scaffold Fase 05 | pnpm test (20/20 testes ok) | Concluída |
| 2026-10-11 | Fase 08 | Codegen determinístico cURL, fetch, Python, RequestModel canônico, placeholders rotulados, validação schema | pnpm --filter @speclens/codegen test (17/17 testes ok), pnpm test (121/121 testes ok) | Concluída |
| 2026-10-11 | Fase 09 | Chat UI SSE streaming, Shiki snippets cURL/fetch/Python, Settings por workspace, RAG Inspector com ranking e JSON Pointer, bloqueio no reindex, acessibilidade | vitest run apps/web (11/11 testes ok), next build (5/5 páginas ok), vitest run (132/132 testes ok) | Concluída |
| 2026-10-11 | Fase 10 | Fail-closed privateMode guard, SSRF URL validator, log redactor, limites parse/depth/timeout/quota, privacy & adversarial evals, baseline de latência e memória real | vitest run (16/16 suites PASS, 157/157 testes ok) | Concluída |
| 2026-10-11 | Fase 11 | Dockerfile standalone, docker-compose loopback estrito (127.0.0.1:3000), provision-offline.sh, smoke-test.sh, README com mockup, ARCHITECTURE, SECURITY, LICENSE | vitest run (16/16 suites PASS, 157/157 testes ok), provision-offline.sh PASS, smoke-test.sh validado | Concluída |
| 2026-10-11 | Correção OLL-01 | Default `llama3.2:3b`, comparação exata de modelo, normalização explícita de tag ausente e diagnóstico tipado | `packages/ai-core/tests/ollama-llm.test.ts` (23/23) e `packages/db/tests/storage-settings.test.ts` (20/20), exit code 0 | Concluída; OLL-02 próxima |
| 2026-10-11 | Correção OLL-02 | Precedência de settings por workspace, provider Ollama por snapshot, readiness por workspace e validação de configuração segura | `pnpm exec vitest run apps/web/src/__tests__/llm-settings.test.ts apps/web/src/__tests__/api-routes.test.ts` (15/15 testes, exit code 0); `git diff --check` sem erros | Concluída; OLL-03 próxima |
| 2026-10-11 | Correção OLL-03 | Diagnósticos específicos do Ollama, detecção de stream incompleto, descarte de tokens parciais no fallback e final validado | Vitest focado (39/39), TypeScript ai-core e web, `git diff --check` PASS; casos obrigatórios registrados em `specs/ollama-corrections.md` | Concluída; seguida por OLL-04 |
| 2026-10-11 | Correção OLL-04 | Deadline de geração em conexão e leitura, AbortSignal combinado, cancelamento/limpeza do reader e distinção entre timeout e abort do cliente | `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts` (30/30); TypeScript ai-core e `git diff --check` PASS | Concluída; OLL-05 próxima |
| 2026-10-11 | Correção OLL-05 | Startup sem downloads implícitos, provisionamento explícito de dependências, detecção por URL/modelo efetivos e cleanup do processo Ollama próprio | `pnpm exec vitest run tests/startup.test.ts` (7/7), `bash -n start.sh scripts/provision-offline.sh`, `git diff --check` PASS; harness mockado | Concluída; OLL-06 próxima |
| 2026-10-11 | Correção OLL-06 | Compose com namespace de rede compartilhado e rede interna, redirects bloqueados e metadata do modelo revalidada antes de contexto; smoke testa geração, egress, falha local e teardown isolado | `pnpm exec vitest run packages/evals/test/security-benchmark.test.ts packages/ai-core/tests/ollama-llm.test.ts` (38/38); typechecks ai-core/evals PASS; `docker compose config --quiet`, `bash -n scripts/test-ollama-docker.sh`, `git diff --check` PASS; smoke NÃO EXECUTADO: imagem `ollama/ollama:latest` ausente, sem pull/build | Parcial; OLL-06 ainda pendente do smoke e evidência runtime |


### Revisão 1–OLL-06 (2026-10-11)

Corrigidas persistência do bootstrap, diagnóstico de política, final duplicado, cancelamento durante metadata/fechamento do iterator, allowlist de origem e isolamento/teardown do smoke. Suíte focada 96/96 e regressão 200/200 PASS; TypeScript ai-core/web e lint PASS (61 warnings). Harness Docker falso 5/5 PASS. Config Compose e sintaxe shell PASS. Imagens locais Ollama/web ausentes: inferência, monitor de rede e teardown real **NÃO EXECUTADOS**. OLL-06 permanece parcial; OLL-07 não iniciada. Detalhes, arquivos e revalidação final em `specs/ollama-corrections.md`.
