# SpecLens — RAG Reliability Improvement Plan

**Version:** 3.0
**Date:** 2026-10-12
**Status:** In progress — RAG-01 completed; RAG-02 through RAG-09 pending.
**Current workstream:** Phase 12 — RAG reliability. RAG-02 is the next pending task.
**Contract:** [spec.md](./spec.md), [AGENTS.md](./AGENTS.md), [SKILL.md](./SKILL.md).
**Execution checklist:** [specs/12-rag-reliability.md](./specs/12-rag-reliability.md).

## 1. Objective and authorization boundary

Make an uploaded OpenAPI/Swagger document reliably searchable through real local embeddings and persistent indexes, with truthful status reporting and grounded answers. Upload prepares the retrieval corpus; retrieval-augmented generation happens when a user asks a question. Upload does not train or fine-tune the LLM.

This request authorizes writing the plan. It does not mark any implementation task or gate complete. Execute one small task at a time when implementation is requested; do not automatically start a later phase. Preserve private mode, local execution, canonical OpenAPI contracts, and the existing single-command startup.

The previous plan, including all historical completion claims, evidence and the upload-size exception, is preserved verbatim in [the historical plan](./plan-history-2026-10-12.md). Phases 01–11 and OLL-01–OLL-07 remain historically recorded as completed. Their earlier evidence is not proof that the new acceptance criteria below pass.

## 2. Observed gaps and documentation conflicts

These findings come from source inspection, not a new runtime test.

| Finding | Existing implementation | Required correction |
|---|---|---|
| Successful upload can hide missing vectors | `packages/ai-core/src/retrieval/indexer.ts` skips unavailable embeddings and catches vector errors; upload then completes the job | Persist and expose separate lexical/vector outcomes and explicit degraded mode |
| Synthetic vectors can escape test usage | `providers/embedding/transformers-local.ts` checks only path existence and falls back to character-derived vectors on pipeline failures | Production must use verified model inference or return a typed failure |
| Vector contents are volatile | `providers/embedding/vector-index.ts` stores vectors in a `Map`; `apps/web/src/lib/server/providers.ts` selects that implementation | Persist vectors and active generations, reopen them after process restart |
| Selected embeddings are not necessarily effective | Server uses a global hard-coded embedding provider; settings PATCH reports `reindexRequired` without rebuilding | Resolve providers per workspace and snapshot configuration for jobs and queries |
| Rebuild paths are inconsistent | Upload uses `retrieval/indexer.ts`; `providers/embedding/indexer.ts` has a separate staging path that embeds twice | One durable ingestion service with transactional activation |
| Search can scan unrelated namespaces | Multi-spec branch in `hybrid-retrieval.ts` calls `listNamespaces()` without ownership filtering | Resolve eligible namespaces from workspace/spec/version metadata before search |
| Prompt loses contract detail | `llm/prompt.ts` includes body media types but omits full body schemas and response/auth details | Build a bounded, source-preserving context from hydrated contracts |
| Existing quality evidence has limited scope | Existing Petstore evaluation contains ten questions; controlled tests do not prove actual model inference | Separate deterministic regression tests from real-model semantic evaluation |
| Provisioning paths disagree | Server expects `.speclens/models/embedding` relative to cwd; provisioning mentions `models/embedding` | One validated local model path shared by startup, server, tests and Docker |

**Conflicts to retain explicitly:** `spec.md` still says implementation has not started, while historical plans report completion. Historical Phase 04 claims persistent/atomic indexing, but the active runtime uses an in-memory index and a different ingestion path. Treat `spec.md` functional requirements as authoritative; retain old evidence as history and add corrective evidence without silently rewriting it. Any lifecycle/schema extensions below must be documented as implementation decisions, not as already-existing features.

## 3. Scope and intended architecture

In scope: real local embeddings, persistent vector storage, workspace isolation, durable ingestion/reindex jobs, effective settings, visible fallback, grounded context, offline verification, and reproducible retrieval evaluations.

Out of scope: cloud embeddings/LLMs, LangChain, hosted queues, external vector databases, telemetry, fine-tuning, arbitrary PDF/web documentation ingestion, automatic API execution, new CI service integration, or a redesign of Laya. Do not reintroduce the removed upload byte cap; use bounded processing and existing structural guards instead.

Proposed implementation decisions, to confirm against code in RAG-01:

1. Keep `EmbeddingProvider` and `VectorIndex` replaceable. Use the existing SQLite database for durable vectors and metadata, with exact cosine search initially. Avoid new native vector extensions until measured scale requires them.
2. Store vectors as validated Float32 payloads with dimension, encoding version, operation ownership and generation identifiers. Never deserialize arbitrary executable formats.
3. Build an immutable generation in bounded batches. Activate it by changing a persisted pointer inside one transaction only after count, dimension, ownership and checksum validation. Readers see the complete old or new generation.
4. Pin model assets by immutable revision/content digest. Include provider implementation, tokenizer/preprocessing, pooling, normalization and operation-text versions in the embedding fingerprint. Mutable `main` alone is insufficient.
5. Resolve a provider from each workspace's validated effective configuration. A job/query captures its configuration once; later setting changes cannot change its embedding space halfway through execution.
6. Retain old generations during a rebuild. Serve an old generation only with its matching query provider and an explicit effective configuration; otherwise use disclosed lexical fallback. Never query old vectors using a new model.
7. Use a persisted local job queue/lease and the existing application process. No separate hosted worker is required. Startup recovers interrupted jobs; concurrency and retry counts are bounded.
8. Preserve deterministic code generation from canonical operations. A language model never generates the authoritative endpoint/schema contract.

## 4. Observable state and fallback contract

Define centrally with Zod and migrate existing records in RAG-01/RAG-03. Names below are proposed, not current API fields.

| Dimension | Proposed states | Meaning |
|---|---|---|
| Job lifecycle | `queued`, `running`, `completed`, `completed_with_warnings`, `failed`, `cancelled`, `interrupted` | Execution outcome, independent of retrieval capability |
| Lexical capability | `pending`, `ready`, `failed`, `disabled` | Whether textual retrieval is available |
| Vector capability | `pending`, `building`, `ready`, `unavailable`, `stale`, `failed`, `disabled` | Whether a compatible, verified vector generation is available |
| Effective retrieval | `hybrid`, `lexical_only`, `vector_only`, `unavailable` | Sources actually used for this query |
| Explanation | `llm`, `contract_only` | Whether Ollama produced a validated final response |

Persist operation count, successfully embedded count, active generation, fingerprint, timestamps, retryability and sanitized reason codes. Suggested reasons include `MODEL_MISSING`, `MODEL_INVALID`, `EMBEDDING_RUNTIME_UNAVAILABLE`, `EMBEDDING_FAILED`, `INDEX_INCOMPATIBLE`, `INDEX_CORRUPT`, `JOB_INTERRUPTED`, and `VECTOR_DISABLED`. Distinguish policy rejection from an ordinary unavailable local model.

Rules:

- A job cannot claim semantic readiness unless all eligible operations have valid durable vectors and activation has committed. A zero-operation document has an explicit empty outcome.
- A completed lexical import with unavailable vectors is `completed_with_warnings`; intentional vector disablement is reported separately from failure.
- A private-mode policy violation stops the prohibited action and returns a typed diagnostic. Never silently turn a policy denial into successful provider execution.
- If lexical retrieval is disabled and vectors are unavailable, report retrieval unavailable. If both are disabled, reject settings rather than silently searching.
- Keep ingestion status independent of Ollama readiness. Upload/indexing must work without an LLM.
- Existing records with no verified persisted generation start with unknown/unavailable semantic capability, never fabricated readiness.
- Transport remains compatible with current polling/SSE where practical; version any breaking DTO changes and update both server and UI in the same task.

## 5. Ordered implementation tasks

Each task below includes code locations, automated tests and an exit gate. New file names are proposed. Recheck the working tree before editing and preserve unrelated user changes.

### RAG-01 — Define contracts and establish regression fixtures

**Dependencies:** planning accepted for implementation; no code dependency on later tasks.
**Primary files:** central types/schemas in `packages/ai-core/src`, `packages/db/src/types.ts`, `packages/db/src/settings-schema.ts`; tests under existing `test/`, `tests/` and web `__tests__/` directories.

1. Map import → indexing → settings → retrieval → hydration → prompt → SSE, identifying the active runtime entry points.
2. Specify state transitions, typed error codes, capability DTOs, generation identity and requested versus effective configuration.
3. Define workspace ownership checks at specification, job, operation and namespace boundaries; identifiers alone are not ownership proof.
4. Add synthetic fixtures with two workspaces, two versions, colliding operationIds, CRUD methods, local refs, nested bodies, responses/auth, and prompt-injection strings.
5. Capture existing regressions using meaningful failing tests, then implement only the contracts needed for this step. Do not merge unexplained failing suites; later behavior tests can land alongside their fixes.
6. Record migration and compatibility decisions. Correct stale overview wording in a separate documented edit without weakening normative requirements.

**Automated tests:** valid/invalid DTOs; illegal transitions; contradictory readiness; empty specifications; fingerprint changes for every incompatible input; rejection of both retrieval modes disabled; legacy settings parsing/migration.

**Gate:** contracts are explicit, schema tests pass, affected callers typecheck, and no runtime feature is claimed complete.

### RAG-02 — Require real embeddings and consistent offline provisioning

**Dependencies:** RAG-01.
**Primary files:** `packages/ai-core/src/providers/embedding/transformers-local.ts`, provider errors/registry, `packages/ai-core/package.json`, lockfile, server provider factory, `start.sh`, `scripts/provision-offline.sh`, Docker configuration.

1. Declare and pin a supported Transformers runtime dependency; validate actual Next.js/Node bundling. Dependency installation belongs to explicit provisioning.
2. Remove production character-vector fallback. Keep deterministic test doubles in test-only modules injected explicitly; production must not import them.
3. Validate model config, tokenizer and weights, then initialize the local pipeline and run a small local readiness probe. Folder existence alone does not pass readiness.
4. Disable runtime remote downloads and remote backend/WASM assets. Validate effective asset paths and reject traversal, unsupported locations and unsafe symlink escapes.
5. Validate output count, dimensions, finite values, nonzero norm and normalization; propagate typed errors, cancellation and bounded execution behavior.
6. Deduplicate concurrent pipeline initialization. Bound provider cache lifetime/concurrency so repeated settings changes do not retain unlimited model copies.
7. Unify model path resolution across project root, web cwd and Docker. Document explicit provisioning of immutable assets without sending documentation or queries.
8. Preserve single-command startup after provisioning. Missing weights produce an actionable local diagnostic without automatic network requests.

**Automated tests:** missing directory; empty directory; missing tokenizer/weights; corrupt model; missing runtime package; pipeline rejection; invalid dimensions/NaN/Infinity/zero vectors; cancelled batch; shared initialization; root/web cwd parity; forbidden remote asset access; no production fallback to fake vectors. Add a separate real-model smoke with installed assets; missing prerequisites fail that gate rather than silently passing.

**Gate:** real-model smoke proves inference with recorded asset identity; all failure paths remain local and explicit.

### RAG-03 — Persist vectors and implement atomic generation activation

**Dependencies:** RAG-01; RAG-02 for real-model integration verification.
**Primary files:** `packages/db/src/{schema,migrations,types}.ts`, vector namespace repository, proposed vector/generation repositories, proposed `packages/ai-core/src/providers/embedding/sqlite-vector-index.ts`, server index factory.

1. Add an additive migration for durable generations/vectors and an active-generation pointer. Reuse existing namespace metadata rather than creating a second conflicting catalog.
2. Define foreign keys, unique constraints, vector encoding, ownership and status constraints. Handle existing namespace rows without vector payloads as unverified.
3. Implement upsert/search/delete behind `VectorIndex`; add explicit generation operations through a typed interface instead of casting to undocumented methods.
4. Validate payload length and dimensions on write and read. Use bounded reads/exact cosine search and deterministic tie ordering.
5. Stage vectors without exposing them to searches. Validate completeness and atomically activate the generation; delete stale operation vectors by generation replacement, not additive overwrite.
6. Reopen indexes directly from SQLite after restart. Verify corruption and model compatibility before marking them available.
7. Clean up abandoned staging generations and delete vectors with their workspace/specification. Protect the active generation from premature cleanup.
8. Document schema rollback constraints and backup/recovery before applying migrations to existing user databases. Tests use temporary copies only.

**Automated tests:** migration from current schema with existing docs; idempotent migrations/upserts; rollback on injected write failure; readers during activation; vector corruption; dimension mismatch; deletion cascade; reduced operation count after rebuild; fresh process reopen preserving IDs/scores; crash before/after activation; missing legacy payloads never appear ready.

**Gate:** a child process imports persisted vectors, exits, and a different process retrieves them without re-upload or embedding the documents again.

### RAG-04 — Make ingestion durable and outcomes truthful

**Dependencies:** RAG-02, RAG-03.
**Primary files:** both current indexers, ingestion repository, specification repository, upload/jobs routes, proposed local ingestion service and startup recovery.

1. Consolidate upload/reindex around one service. Remove duplicate operation writes and the second embedding pass used by the old staging helper.
2. Validate/normalize input before activating a new specification. Persist source, operations, FTS and initial job consistently; invalid input must not replace the previous active specification.
3. Claim persisted jobs using an atomic lease. Bound concurrent jobs and model batches; checkpoint progress between durable batches.
4. Snapshot configuration and generate vectors once per operation per successful attempt. Retry only transient/recoverable work with a bounded policy.
5. Persist lexical/vector outcomes and sanitized diagnostics. Do not swallow failures or report vector completion based on readiness checked before inference.
6. Recover interrupted work after restart with idempotent resume/restart semantics. Cancel/delete jobs safely and prevent late activation after workspace deletion.
7. Define activation behavior for replacement specs: keep previous active version until the new import reaches its documented usable state; expose deliberate lexical degradation.
8. Return a job ID promptly; poll persisted state. Show weighted/phase progress without reaching 100% semantic readiness before commit.

**Automated tests:** successful upload; missing model; inference failing halfway; FTS transaction failure; restart while queued/running; expired lease recovery; two claimants; repeated retry; cancellation; duplicate submission policy; simultaneous uploads; workspace deletion during embedding; job progress and counts; invalid upload preserves previous active spec; upload with Ollama absent.

**Gate:** accepted jobs reach a truthful terminal/recoverable state; no partial index is advertised as ready and no failure disappears silently.

### RAG-05 — Apply workspace settings and rebuild safely

**Dependencies:** RAG-04.
**Primary files:** `apps/web/src/lib/server/providers.ts`, settings/providers routes, settings schema/repository, ingestion service; proposed reindex route if the existing surface cannot express retry/rebuild.

1. Replace hard-coded embedding singleton selection with a workspace-aware factory using validated snapshots and verified local model configuration.
2. Persist requested configuration separately from effective index configuration. Report both in readiness responses.
3. On incompatible embedding change, schedule one durable rebuild per eligible specification; deduplicate repeated PATCH/retry actions.
4. Reuse persisted source/operations; no re-upload is required. Preserve the previous generation on failure.
5. Apply lexical/vector enable flags and topK in actual retrieval, not only in settings storage.
6. Never reuse vectors across incompatible revisions, dimensions or preprocessing. A failed requested configuration cannot silently appear effective.
7. Validate ownership, payloads, privacy and retryability on every new or changed route.

**Automated tests:** two workspaces with different providers; settings survive restart; model A → B → failed B → retry B; settings change during a running job/query; repeated PATCH; unknown provider; unavailable local model; forbidden remote configuration; topK and mode flags; old index queried only with matching provider.

**Gate:** saved settings demonstrably control inference and retrieval; switching models cannot mix embedding spaces.

### RAG-06 — Scope hybrid retrieval and expose its effective mode

**Dependencies:** RAG-03, RAG-05.
**Primary files:** `packages/ai-core/src/retrieval/{hybrid-retrieval,types,schema-hydrator}.ts`, operation/namespace repositories, chat route, central SSE/response schemas.

1. Resolve eligible active specification versions and compatible generations from the current workspace. Validate an explicit specificationId belongs to it.
2. Remove unrestricted global namespace scans. Revalidate candidate ownership before hydration and citation construction.
3. Apply method/path/tag constraints consistently to lexical and vector candidate pools before final topK. Prevent candidate limits from discarding all eligible matches prematurely.
4. Implement configured retrieval flags; disclose missing/corrupt/incompatible vectors and query-embedding failures with typed reasons.
5. Preserve deterministic RRF, expose lexical/vector ranks and generation fingerprint, and distinguish genuine vector participation from a merely configured vector provider.
6. Define no-answer behavior with calibrated relevance criteria. Do not treat nearest-neighbor output as evidence that the question is answerable; calibrate rather than inventing a threshold.
7. Propagate timeout/cancellation and do not send unrelated context to the LLM after retrieval failures.

**Automated tests:** adversarial cross-workspace nearest neighbor; zero/one/multiple specs; inactive versions; forged specificationId; mixed model generations; same dimensions but different revision; filter-selective candidate pools; tie ordering; exact path/operationId; vector-only and lexical-only; unavailable retrieval; unrelated query; inspector metadata matches the actual search.

**Gate:** no foreign, inactive or incompatible vector contributes to ranking, hydration, citations or generation.

### RAG-07 — Preserve canonical contract details in bounded LLM context

**Dependencies:** RAG-06.
**Primary files:** `packages/ai-core/src/llm/{prompt,schemas,ollama-provider}.ts`, schema hydrator, chat route; existing codegen remains authoritative.

1. Build context after retrieval from canonical hydrated operations, including relevant parameter schemas, required fields, body schemas, response contracts and security requirements.
2. Preserve source specification/version and JSON Pointers for included facts. Handle cycles/composition explicitly using existing resolver semantics.
3. Bound context deterministically by model budget with reserved room for instructions/query/output. Report omitted sections instead of implying the full document was considered.
4. Keep imported text as untrusted reference data. Do not place OpenAPI descriptions in system instructions.
5. Validate cited endpoint identities against retrieved operations. Do not claim schema validation proves every natural-language statement is true; test grounding with controlled fixtures and real-model review evidence.
6. Expose `llm` versus `contract_only` separately from retrieval mode. Keep generated snippets deterministic and inert.

**Automated tests:** nested required body fields; response/auth questions; local refs/cycles; composition warnings; context-budget truncation; prompt injection; forged citations; empty retrieval; invalid/incomplete Ollama stream; fallback with sources; snippets conform to schemas and are never executed.

**Gate:** contract fields needed by test questions reach the model, omissions are visible, and citations resolve to the exact imported version.

### RAG-08 — Make indexing and degradation clear in the UI

**Dependencies:** RAG-04 through RAG-07.
**Primary files:** `ChatContext.tsx`, `Sidebar.tsx`, `ChatArea.tsx`, `EndpointInspector.tsx`, settings page, jobs/specifications/providers routes, Playwright fixtures.

1. Show queued/running phases, operation/vector counts and recoverable errors without exposing document text or sensitive filesystem details.
2. Distinguish “ready for semantic search,” “text search only,” “rebuilding,” “index unavailable” and intentional vector disablement.
3. Provide retry/reindex actions backed by the durable service. Do not offer an action that only clears a frontend flag.
4. Show effective retrieval mode, model/revision, source version, relevant scores and LLM fallback in the inspector/chat.
5. Restore status after reload and server restart; stop polling terminal/deleted jobs and announce updates accessibly.
6. Preserve drag/drop, uncapped upload bytes, existing settings/Ollama behavior and private-mode defaults.

**Automated tests:** Playwright upload → indexed → question → citations/inspector; missing embeddings warning; model installation followed by retry; model switch/rebuild; failed rebuild keeps compatible old generation; page reload/restart; keyboard/status accessibility; Ollama offline while retrieval succeeds; existing upload-size regression.

**Gate:** the user can tell whether semantic retrieval actually occurred, and every visible retry action has a tested backend effect.

### RAG-09 — Establish real semantic quality and offline release gates

**Dependencies:** RAG-02 through RAG-08.
**Primary files:** `packages/evals`, real-model/restart test harnesses under `scripts/` and `tests/`, existing Docker isolation harness, README/ARCHITECTURE/SECURITY and phase evidence.

1. Keep fast deterministic tests for contracts and orchestration. Mark their providers as test doubles; never count them as real semantic quality evidence.
2. Add a versioned synthetic PT-BR/EN dataset with exact matches, paraphrases without endpoint vocabulary, CRUD ambiguity, nested schema questions, irrelevant queries and multi-spec/workspace distractors. Separate calibration and held-out sets.
3. Run lexical-only, real-vector-only and hybrid retrieval on identical corpora/settings. Record Recall@5, MRR, top-1, wrong-method rate and no-answer metrics by language/category.
4. Pin model/runtime/assets and record dataset hash, fingerprint, device profile, operation count, indexing time, stage p50/p95 and peak RAM. Establish quality/performance thresholds from the measured calibration baseline before evaluating held-out cases, as required by spec.md.
5. Do not silently switch the default model to improve a benchmark. If the current model is inadequate for Portuguese, compare provisioned local alternatives and document a separate model-selection decision/reindex impact.
6. Add a fresh-process restart test and an interrupted-ingestion recovery test with durable on-disk fixtures. Verify document embeddings are not recomputed merely to restore a healthy index.
7. Run upload → real embeddings → hybrid query → local Ollama → sources with outbound network blocked. Monitor backend inference/assets and browser traffic; browser-only monitoring is insufficient.
8. Add explicit missing/corrupt-assets cases under the same network policy. Assert no remote requests, implicit downloads, private content in logs or execution of documented APIs/snippets.
9. Update release/provisioning instructions and evidence only after gates run. Stop at the Phase 12 gate; do not create a follow-on phase automatically.

**Gate:** representative semantic evaluation and real offline/restart journeys pass their recorded criteria. Skipped/missing real-model prerequisites leave the gate pending, even if every mocked test passes.

## 6. Automated validation strategy and commands

### Existing commands available now

Run focused tests for each implementation task, then broader checks when integration changes justify them:

```sh
pnpm exec vitest run packages/ai-core/test/embedding.test.ts packages/ai-core/test/indexer.test.ts
pnpm exec vitest run packages/ai-core/test/hybrid-retrieval.test.ts packages/db/tests/storage-settings.test.ts
pnpm exec vitest run apps/web/src/__tests__/api-routes.test.ts apps/web/src/__tests__/llm-settings.test.ts
pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts packages/evals/test/security-benchmark.test.ts tests/startup.test.ts
pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json
pnpm exec tsc --noEmit -p packages/db/tsconfig.json
pnpm exec tsc --noEmit -p apps/web/tsconfig.json
pnpm test
pnpm lint
pnpm build
git diff --check
```

Existing browser command: `pnpm --filter web test:e2e`. Run it only with isolated temporary DB/model settings and exclusive loopback ports; extend the existing harness rather than attach to a developer's running app. Existing `bash scripts/test-ollama-e2e.sh` and `bash scripts/test-ollama-local.sh` cover Ollama; neither alone proves real embedding inference or vector persistence.

### Proposed automation to implement

These commands/files **do not exist yet** and are deliverables, not recorded executions:

| Proposed command | Deliverable | Failure policy |
|---|---|---|
| `pnpm test:rag` | Focused schema/provider/storage/ingestion/retrieval/grounding suites | Any invariant failure exits nonzero |
| `pnpm test:rag:restart` | Fresh-process persistence and crash-recovery harness | Re-upload requirement, recomputation on healthy reopen or lost vectors fails |
| `pnpm test:rag:e2e` | Isolated Playwright runner, fake Ollama and explicit test-only embeddings | Checks application behavior, never claims semantic quality |
| `pnpm test:rag:real` | Real pinned embedding model + real local Ollama smoke | Missing prerequisites fail the release gate with a clear diagnostic |
| `pnpm eval:rag` | Lexical/vector/hybrid PT/EN quality comparison | Requires real embeddings; no automatic golden-file updates |
| `pnpm test:rag:offline` | Full journey in network-isolated runtime with egress observation | Any unauthorized traffic or implicit download fails |

Harness requirements: temporary directories/DBs, synthetic documents only, deterministic seeds for test doubles, child-process timeouts, bounded polling, cleanup of only owned processes/containers, no model pulls or dependency installs, and no writes to tracked baseline files during ordinary tests. Baseline acceptance is an explicit reviewed action. Record command, exit code, test counts, model/runtime fingerprints and artifact path for every release gate.

### Minimum automated acceptance matrix

| Scenario | Required assertion | Layer |
|---|---|---|
| Upload with valid local model | Real vectors cover all operations; generation activated; sources traceable | Integration + real smoke |
| Missing/corrupt local model | Explicit lexical-only/unavailable state; no synthetic vectors/network | Unit + API + offline |
| Restart | Same persisted generation and retrieval results in another process | Process integration |
| Crash during rebuild | Previous complete generation remains usable; interrupted job recoverable | Fault injection |
| Embedding model change | Different fingerprint; no mixed-space comparisons; durable rebuild | API + integration |
| Workspace/version collision | No foreign/inactive operation reaches prompt or citations | Retrieval + API |
| Configuration flags | Actual search honors selected modes; both disabled rejected | Unit + API |
| Semantically phrased PT/EN query | Measured relevant retrieval using actual local model | Held-out evaluation |
| Unanswerable query | No unsupported endpoint claim; disclosed no-answer/fallback | Evaluation + grounding |
| Nested body/response/auth question | Context contains canonical evidence or explicit omission | Prompt + real smoke |
| LLM unavailable | Retrieval and deterministic snippets work; contract-only explanation labeled | API + E2E |
| Offline operation | No unauthorized backend/browser egress or implicit asset download | Isolated runtime |

## 7. Risks, recovery and release gate

- SQLite exact search is linear in vector count; measure latency/RAM before considering a different index backend. Batching controls transient embedding memory but does not make uncapped parsing free of resource limits.
- Model loading may require runtime-specific local assets and careful bundling. A directory check cannot validate deployment readiness.
- Concurrent jobs, settings edits and deletion can race. Generation ownership, leases, immutable snapshots and transactional activation must be tested together.
- Old historical rows may say “completed” despite missing vectors. Migration must downgrade capability honestly and schedule/recommend rebuild without silently downloading models.
- Prompt budgets can omit relevant schema detail. Make omissions visible and evaluate schema questions independently of endpoint lookup.
- Model quality, especially Portuguese paraphrases, is unknown until measured with real assets. Do not manufacture success thresholds or reuse mocked benchmark scores as evidence.
- Keep recoverable source/operation data and previous compatible generations until new activation is validated. Clean obsolete generations only after safe retention checks; never reset a user's database to fix a migration.

Phase 12 closes only after all task gates and these checks pass:

- [ ] Real production inference has no fake-vector fallback.
- [ ] Durable vector generations survive process restart and interruption.
- [ ] Upload/job/query UI reports actual retrieval capability and explanation mode.
- [ ] Workspace, version and embedding-space isolation is enforced end to end.
- [ ] Settings changes trigger tested rebuilds with safe activation/recovery.
- [ ] Context and citations remain canonical; code snippets remain deterministic/inert.
- [ ] Real-model PT/EN metrics and device-specific performance baselines are recorded.
- [ ] Offline runtime verifies private-mode behavior without unauthorized egress.
- [ ] Relevant regression, typecheck, lint, build and browser gates have execution evidence.
- [ ] Phase checklist, operational docs and this plan are updated with risks and residual limitations.

## 8. Execution evidence and next action

| Date | Work | Status | Evidence |
|---|---|---|---|
| 2026-10-12 | Source inspection and corrective planning | Documentation only | Upload/chat routes, embedding providers/indexers, persistence, settings, prompt, tests and provisioning inspected |
| 2026-10-12 | RAG-01 — Contracts, ownership guards & regression fixtures | PASS | Pre-fix regression captured (exit 1); contracts/fixtures implemented; 7 Vitest suites (74 tests) PASS (exit 0); `tsc --noEmit` across `db`, `ai-core`, `web` PASS (exit 0) |
| Pending | RAG-02 through RAG-09 | NOT EXECUTED (NÃO EXECUTADO) | Runtime embedding inference, SQLite vector persistence, durable ingestion, retrieval isolation, context budget, UI status and offline gates remain pending |

**Next task:** RAG-02. Only RAG-01 contracts, ownership guards, and regression fixtures are complete; no runtime feature or Phase 12 exit gate is claimed complete.

### Diretrizes visuais — 2026-10-12

Criado [DESIGN.md](./DESIGN.md), a pedido do usuário, com direção visual inspirada na imagem do Codex fornecida na conversa. Escopo exclusivamente documental, complementar à Fase 12; não inicia RAG-08 nem altera gates ou dependências.

Validação: Python verificou nove links locais, fences balanceados, checkboxes não marcados e whitespace do documento (PASS, exit 0). Testes de runtime e validação visual: **NÃO EXECUTADO**, pois nenhum código da aplicação mudou. Risco pendente: validar contraste, responsividade e estados reais na implementação. Defaults privados preservados; nenhuma rota ou dependência adicionada. Próximo item funcional continua RAG-01; aplicação visual exige microtarefa própria.

### Microtarefa adicional — switches LLM / Laya — 2026-10-12

Pedido explícito do usuário autoriza esta extensão pontual de configurações/backend/UI, relacionada a RAG-05/RAG-08, sem concluir esses itens nem avançar de fase. Dois switches em Configurações permitem só LLM, só Laya ou ambos. A escolha é persistida por workspace; ausência do campo mantém ambos ligados. Ambos desligados são rejeitados. Laya desligado pula classificação; LLM desligado entrega resposta contratual identificada. Busca, fontes, snippets e `privateMode=true` preservados; sem reindexação.

Validação: cinco suítes Vitest, 61 testes PASS (exit 0); typecheck db/ai-core/web PASS; ESLint dos arquivos de implementação alterados PASS (exit 0, 12 warnings preexistentes); navegador com servidor loopback e SQLite temporário: três modos, salvar, recarregar, bloqueio do último switch e teclado PASS. Evidência visual: `output/playwright/inference-switches.png`. Testes da API usam provedores locais simulados e verificam ausência de fetch e de chamadas ao provedor desativado. Reabertura do SQLite testada. Build completo e gate offline com modelos reais: NÃO EXECUTADO nesta microtarefa.

Próximo item não iniciado: resolver as duas lacunas de contratos identificadas na auditoria RAG-01 antes de avançar para RAG-02. Os checklists históricos permanecem sem nova marcação; esta extensão não resolve essas lacunas.
