# Fase 03 — SQLite, workspaces e settings

**Estado:** Concluída  
**Objetivo:** Persistência local e configurações atômicas.  
**Dependência:** Rebase sobre Foundation (feat/01-foundation).

## Passo a passo

- [x] **03.01** Criar migrações das tabelas workspaces, specifications, operations, vector_namespaces, workspace_settings, ingestion_jobs, evaluation_runs e _migrations.
- [x] **03.02** Implementar SettingsRepository transacional com schema Zod e versionamento.
- [x] **03.03** Criar padrão privateMode=true, embeddings=transformers-local, decision=laya-local, llm=ollama-local.
- [x] **03.04** Nunca armazenar credenciais em provider_configs JSON; usar mecanismo de secrets dedicado fora do MVP privado.
- [x] **03.05** Implementar importação idempotente por SHA-256 e isolamento por workspace com cascade deletes.
- [x] **03.06** Criar índice FTS5 com triggers automáticos de sincronização e busca full-text sanitizada.

## Testes e verificações

- [x] Criar workspace, alterar settings, reiniciar processo e conferir persistência (`Persistência em Disco e Simulação de Reinício`).
- [x] Simular falha de escrita e confirmar rollback e rejeição por Zod (`03.04 & 03.03 — Settings e Validação Zod`).
- [x] Buscar documento de outro workspace e validar isolamento (`03.05 & 03.06 — Operações e Busca FTS5`).

## Critério de aceite

- [x] Nenhuma configuração corrompida, nenhum segredo em texto puro e dados preservados após reinício.


## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo (`createDefaultWorkspaceSettings` e validação Zod).
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase (banco SQLite estritamente local em modo arquivo ou `:memory:`).
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 03.01 Client e Migrations | `pnpm --filter @speclens/db test` | Aprovado (3 testes) | `packages/db/tests/storage-settings.test.ts` |
| 2026-10-11 | 03.02 / 03.03 Settings e Zod | `pnpm --filter @speclens/db test` | Aprovado (5 testes) | `packages/db/src/repositories/settings.ts` |
| 2026-10-11 | 03.05 Isolamento e SHA-256 | `pnpm --filter @speclens/db test` | Aprovado (4 testes) | `packages/db/src/repositories/specifications.ts` |
| 2026-10-11 | 03.06 FTS5 e Triggers | `pnpm --filter @speclens/db test` | Aprovado (3 testes) | `packages/db/src/repositories/operations.ts` |
| 2026-10-11 | Persistência e Reinício | `pnpm --filter @speclens/db test` | Aprovado (1 teste) | `packages/db/tests/storage-settings.test.ts` |
| 2026-10-11 | Ingestion Jobs e Evals | `pnpm --filter @speclens/db test` | Aprovado (2 testes) | `packages/db/src/repositories/ingestion-jobs.ts` |
| 2026-10-11 | Suite geral | `pnpm test && pnpm lint` | Aprovado (29 testes, 0 warnings) | Terminal Vitest + ESLint |

## Decisões e riscos

- **better-sqlite3 v11:** Atualizado de v9 para `^11.8.1` devido aos cabeçalhos v8 do Node 24 (`v24.14.0`) que exigem padrão C++20 (`#error "C++20 or later required"` no node-gyp da v9).
- **FTS5 Triggers:** Implementados triggers `AFTER INSERT`, `AFTER DELETE` e `AFTER UPDATE` na tabela `operations` mantendo `operation_fts` sincronizado automaticamente com tabelas externas SQLite.
- **Fail Closed em Settings:** O schema Zod valida configurações tanto na escrita quanto na leitura de inicialização (`get`), impedindo que dados corrompidos ou com `privateMode` violado passem despercebidos.
- **Isolamento de Workspaces:** Cascata configurada via foreign keys com `ON DELETE CASCADE` e `PRAGMA foreign_keys = ON`, além de queries FTS5 com filtro de workspace `JOIN specifications s ON s.id = o.specification_id WHERE s.workspace_id = ?`.

## Revalidação OLL-07 — 2026-10-12

O E2E automatizado usou banco SQLite temporário e confirmou que os modelos escolhidos na UI foram persistidos e recebidos pelo provider Ollama falso em duas consultas consecutivas sem reinício do servidor. Também confirmou `privateMode=true`. `bash scripts/test-ollama-e2e.sh` — **PASS, 1/1**. A jornada e suas limitações estão descritas em [ollama-corrections.md](./ollama-corrections.md).

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados (19 testes unitários e de integração em `@speclens/db`).
- [x] Checagens de privacidade aprovadas (`privateMode=true` padrão inalterado).
- [x] `plan.md` atualizado com a fase finalizada.
