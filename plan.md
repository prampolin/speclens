# SpecLens — Plano de execução

**Versão:** 2.1 · **Estado:** ainda não implementado · **Padrão:** embeddings locais / Laya local / Ollama local / `privateMode=true`

## Ordem de trabalho

1. Ler [`spec.md`](./spec.md) e [`AGENTS.md`](./AGENTS.md).
2. Selecionar **uma** fase pendente em `specs/` pela ordem abaixo.
3. Implementar tarefas pequenas e os respectivos testes; não pular gates.
4. Atualizar o checklist da fase, decisões, evidências e estado deste plano.
5. Parar ao concluir a fase e documentar bloqueios, sem marcar etapas não verificadas.

## Fases

- [x] **Fase 01: Foundation** — [`specs/01-foundation.md`](./specs/01-foundation.md)
- [ ] **Fase 02: Parser e normalização OpenAPI** — [`specs/02-openapi-parser.md`](./specs/02-openapi-parser.md)
- [ ] **Fase 03: SQLite, workspaces e settings** — [`specs/03-storage-settings.md`](./specs/03-storage-settings.md)
- [ ] **Fase 04: Embeddings intercambiáveis** — [`specs/04-embeddings.md`](./specs/04-embeddings.md)
- [ ] **Fase 05: Busca híbrida e RAG Inspector** — [`specs/05-hybrid-retrieval.md`](./specs/05-hybrid-retrieval.md)
- [ ] **Fase 06: Laya + classificador configurável** — [`specs/06-laya-classifier.md`](./specs/06-laya-classifier.md)
- [ ] **Fase 07: Ollama e protocolo estruturado** — [`specs/07-ollama-llm.md`](./specs/07-ollama-llm.md)
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

- **Fase atual:** 02 — Parser e normalização OpenAPI (próxima).
- **Fases concluídas:** 01 — Foundation (2026-10-11).
- **Bloqueios:** nenhum confirmado; validar runtime do Laya e vector index nas respectivas fases.
- **Referência normativa:** [`spec.md`](./spec.md) prevalece em requisitos; ambiguidades devem ser registradas, nunca resolvidas silenciosamente.

## Registro de execução

| Data | Fase | Mudança | Evidência/testes | Estado |
|---|---|---|---|---|
| 2026-10-11 | Preparação | Documentação modular criada | Checklist inicial | Concluída |
| 2026-10-11 | Fase 01 | Monorepo PNPM, Next.js 15, contratos centrais @speclens/ai-core/openapi-core/db/codegen/evals, Vitest, lint, build | pnpm lint && pnpm test && pnpm build (10/10 testes ok) | Concluída |
