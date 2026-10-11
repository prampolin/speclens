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
- [ ] **Fase 08: Codegen determinístico** — [`specs/08-codegen.md`](./specs/08-codegen.md)
- [ ] **Fase 09: Chat, Settings e UI final** — [`specs/09-chat-ui.md`](./specs/09-chat-ui.md)
- [ ] **Fase 10: Privacidade, segurança e benchmarks** — [`specs/10-security-evals.md`](./specs/10-security-evals.md)
- [ ] **Fase 11: Packaging e release local** — [`specs/11-release.md`](./specs/11-release.md)

## Regras inegociáveis

- Privacidade ativada por padrão; configurações de UI nunca substituem validações do servidor.
- Sem chamadas externas, downloads implícitos, resolução de `$ref` remoto, telemetry ou cloud LLM em modo privado.
- Embedding, Decision e LLM são módulos independentes e configuráveis; mudanças no embedding exigem índice compatível/reindex.
- Laya é o classificador local padrão; fallback determinístico explícito se indisponível.
- Geração de snippets deve partir do contrato OpenAPI, não da criatividade do LLM.
- Cada fase requer testes, evidências e aceite antes de ser marcada como concluída.

## Estado e decisões

- **Fase atual:** 08 (Codegen determinístico) e 09 (UI / Chat).
- **Fases concluídas:** 01, 02, 03, 04, 05, 06, 07 — todas em 2026-10-11.
- **Bloqueios:** nenhum.
- **Referência normativa:** [`spec.md`](./spec.md) prevalece em requisitos; ambiguidades devem ser registradas, nunca resolvidas silenciosamente.

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
