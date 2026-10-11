# SpecLens — Product & Technical Specification

**Version:** 2.0  
**Status:** Approved specification; implementation not started  
**Date:** 2026-10-11  
**Companion:** [`plan.md`](./plan.md) and [`specs/README.md`](./specs/README.md)  
**Principles:** local-first · private by default · provider-agnostic · contract-grounded · measurable.

## 1. Overview

SpecLens is a developer-facing assistant that imports OpenAPI/Swagger JSON or YAML, indexes API operations, answers natural-language questions (including Portuguese and English), and produces contract-grounded snippets in cURL, JavaScript `fetch`, and Python `requests`. The user can inspect exactly which endpoint, operation, specification version, request schema, and parameters support each answer.

### 1.1 Target users
- Developers integrating internal or third-party APIs.
- Teams with sensitive internal Swagger/OpenAPI specifications.
- Engineers troubleshooting endpoint discovery and request construction.

### 1.2 Primary value proposition
Find the right API operation from either technical language or business-language intent and obtain verifiable usage examples without exposing proprietary documentation to external inference services.

### 1.3 Explicit MVP boundaries
- **In scope:** local import, parsing/normalization, source-preserving storage, hybrid endpoint retrieval, configurable embeddings and decision models, local LLM explanation, deterministic snippet generation, citations and inspection UI, evaluations, offline deployment.
- **Out of scope:** performing API calls against the documented systems, saving production credentials, automatic database changes, cloud account/team synchronization, RBAC, CI integration, remote telemetry, guaranteed sub-second end-to-end generation.

## 2. Configuration baseline

| Capability | Default | User choice | Private Mode rule |
|---|---|---|---|
| Runtime | Next.js App Router (Node.js) | No runtime change in MVP | Bind UI locally by default; local process only |
| Metadata persistence | SQLite | Workspace location permitted by policy | Local filesystem only |
| Lexical search | SQLite FTS5 | Ranking parameters | Local only |
| Vector search | Local vector index | Backend behind `VectorIndex` | Local only |
| Embeddings | `@huggingface/transformers` | Local or custom compatible provider; cloud only when Private Mode explicitly disabled | Model files must be locally available, no implicit downloads |
| Classification | Laya multilingual | Laya, deterministic rules, other decision provider | Local-capable provider only; no implicit downloads |
| Generation | Ollama | Installed local model; additional LLM adapters later | Model and execution must be local; cloud-backed model names forbidden |
| Code generation | Contract-driven templates | cURL / fetch / Python | No execution of generated snippets |
| Response protocol | Typed JSON envelope + stream events | Not configurable in MVP | Validate schema before rendering |
| Privacy | `privateMode=true` | Can be disabled with explicit informed confirmation | Fail closed on violations |

**Important:** "local" refers to actual processing and data flow, not merely a `localhost` URL. A local proxy that forwards data to a cloud service is **not** allowed in Private Mode. Air-gapped operation requires provisioning all dependencies and model weights ahead of time.

## 3. Personas and user journeys

**UJ-01 — Import:** User creates a local workspace, uploads `openapi.yaml`, sees validation status, operation count, API title/version, warnings and source origin.

**UJ-02 — Ask:** User asks "Como cadastro um produto com desconto de 15%?". SpecLens discovers candidate operations, identifies the most relevant method and path, and explains the request requirements.

**UJ-03 — Generate:** User switches between cURL, fetch and Python examples. All generated fields exist in the selected operation's schema; missing data uses clearly labeled placeholders.

**UJ-04 — Inspect:** User clicks the cited endpoint and sees its method, path, tags, parameters, request body, response contracts, security schemes and exact source version.

**UJ-05 — Configure:** User selects an embedding model, a decision model and an LLM independently. The application checks local availability, provider capabilities, index compatibility, privacy restrictions and fallback behavior.

**UJ-06 — Offline:** After initial model setup, user disconnects the machine. Import, indexing, query, retrieval, classification, code generation and local explanation continue without unauthorized network calls.

## 4. Functional requirements

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-001 | Import OpenAPI 3.x and Swagger 2.0 in JSON/YAML | P0 | Valid files accepted; invalid formats rejected with actionable errors |
| FR-002 | Normalize each HTTP method+path as a distinct `Operation` | P0 | No operation disappears silently; operation count matches supported source entries |
| FR-003 | Preserve path/query/header/cookie parameters, body schemas, required fields, responses, auth and examples | P0 | Contract inspection matches source fixture |
| FR-004 | Resolve local `$ref` safely; handle cycles, `allOf`, `oneOf`, `anyOf` and unsupported patterns explicitly | P0 | Tests cover nested/cyclic fixtures with no unbounded recursion |
| FR-005 | Persist imported specifications and metadata by workspace/version | P0 | Reopen after process restart without reimport |
| FR-006 | Provide lexical and vector retrieval with metadata filtering | P0 | Relevant candidates returned for text and exact field/path queries |
| FR-007 | Fuse rankings and support configurable reranking/fallback | P0 | Fusion deterministic for fixed inputs |
| FR-008 | Generate cURL/fetch/Python from normalized contract, not hallucinated endpoints | P0 | Snippets preserve method/path/body/auth placeholders |
| FR-009 | Use LLM for explanation and intent assistance with clearly cited operations | P0 | Every asserted endpoint citation resolves to an indexed source |
| FR-010 | Allow independent embedding provider/model selection | P0 | Incompatible embedding spaces trigger reindex, never silent reuse |
| FR-011 | Allow independent classification provider/model selection | P0 | Laya, rule-based fallback, and custom adapter contract supported |
| FR-012 | Allow independent LLM provider/model selection | P0 | Default Ollama works offline; unauthorized providers denied |
| FR-013 | Persist effective and user-selected settings per workspace | P0 | Settings survive restarts and are validated when loaded |
| FR-014 | Enforce Private Mode at all data egress points | P0 | Offline test records zero unauthorized outbound requests |
| FR-015 | Stream progress/explanation and render validated structured final response | P1 | No partial invalid JSON is treated as final answer |
| FR-016 | Show source badges and retrieval explanation/inspector | P1 | User can inspect ranked candidates and source references |
| FR-017 | Show processing state, recoverable errors, and model readiness | P1 | Clear reasons for failed imports/model absence |
| FR-018 | Provide evaluation datasets and reproducible quality/latency reports | P1 | CI/manual eval outputs trace to model/index versions |
| FR-019 | Permit workspace deletion with local data cleanup | P1 | Indexed representations and imported source are removed |
| FR-020 | Support updating a specification without contaminating previous versions | P1 | Active version is explicit and switchable |

## 5. System architecture

```text
[Next.js UI]
     |
[Node API / Orchestrator] --- [Policy Guard + Provider Registry]
     |                        |       |        |
     |                 [Embedding] [Decision] [LLM]
     |                  Local JS     Laya      Ollama
     |
[OpenAPI Parser + Normalizer] --> [SQLite: specs, ops, settings, FTS5]
                                            |
                                    [Local Vector Index]
                                            |
                                [Hybrid Retrieval + Rerank]
                                            |
                                [Schema Hydration + Grounding]
                                            |
                         [Deterministic Codegen + LLM Explanation]
                                            |
                               [Typed Stream / JSON Output]
```

Separate **retrieval description** from **authoritative normalized contract**. Use compact text for embeddings; hydrate the full resolved operation schema **after** choosing candidates. The model may explain, but may not invent unavailable fields, security parameters or response codes.

### 5.1 Module responsibilities
- `openapi-core`: validation, safe reference handling, normalization, source mapping, schema hydration.
- `ai-core/providers`: versioned adapters and readiness/capability checks.
- `ai-core/retrieval`: full-text/vector lookup, filters, fusion and relevance scoring.
- `ai-core/orchestration`: intent decision, grounding, fallback, timeout and cancellation.
- `ai-core/security`: Private Mode policy, provider verification, secret scrubbing, import restrictions.
- `codegen`: validated language-specific templates and contract conformance.
- `apps/web`: API surface, settings screen, chat, source inspector, model status.
- `evals`: fixtures, classification and retrieval datasets, snippet checks, latency and privacy tests.

## 6. Provider contracts (TypeScript, normative sketch)

```ts
type ExecutionLocation = 'local' | 'remote' | 'unknown';
type ProviderKind = 'embedding' | 'decision' | 'llm';

interface ProviderManifest {
  id: string;
  kind: ProviderKind;
  implementationVersion: string;
  executionLocation: ExecutionLocation;
  requiresNetwork: boolean;
  modelId: string;
  modelRevision: string;
  supportsOffline: boolean;
}

interface EmbeddingProvider {
  manifest: ProviderManifest;
  dimensions(): Promise<number>;
  embed(text: string, signal?: AbortSignal): Promise<number[]>;
  embedBatch(texts: string[], signal?: AbortSignal): Promise<number[][]>;
  readiness(): Promise<{ ready: boolean; reason?: string }>;
}

type Intent = 'search_endpoint' | 'generate_code' |
  'explain_schema' | 'compare_endpoints';

interface DecisionProvider {
  manifest: ProviderManifest;
  classify(input: string, candidates: Intent[], signal?: AbortSignal):
    Promise<{ intent: Intent | null; confidence: number | null; abstained: boolean }>;
  readiness(): Promise<{ ready: boolean; reason?: string }>;
}

interface LLMProvider {
  manifest: ProviderManifest;
  streamExplanation(input: {
    query: string;
    groundedOperations: NormalizedOperation[];
    locale: 'pt-BR' | 'en-US';
  }, signal?: AbortSignal): AsyncIterable<ExplanationEvent>;
  readiness(): Promise<{ ready: boolean; reason?: string }>;
}

interface VectorIndex {
  upsert(namespace: string, vectors: IndexedVector[]): Promise<void>;
  search(namespace: string, vector: number[], limit: number): Promise<VectorHit[]>;
  deleteNamespace(namespace: string): Promise<void>;
}
```

`NormalizedOperation`, `ExplanationEvent`, `IndexedVector`, `VectorHit`, provider capability and API DTO schemas must be defined centrally and validated using Zod. These definitions are a baseline contract, not an instruction to embed concrete model types in business logic.

### 6.1 Classifier behavior
- Laya is the **default intent decision provider**, not an endpoint search replacement.
- The classifier chooses among a **small controlled set** of intents.
- If it abstains, errors or returns a confidence below a calibrated threshold, fall back to safe default hybrid search.
- Never use opaque confidence values as guaranteed probabilities; calibrate using held-out fixtures.
- Provide rule-based classification without Laya as an offline fallback.
- Start with Laya multilingual; evaluate a maintained Node/ONNX adapter. Add isolated Python sidecar only if needed.

### 6.2 Embedding migration
Every vector namespace is keyed by workspace + specification version + provider/model ID + exact revision + dimensionality + normalization/chunking version. Selection of a different incompatible configuration creates/rebuilds an index asynchronously within the local process (visible job state) while retaining the last compatible index. Never compare embeddings from incompatible spaces.

### 6.3 Ollama compatibility
- Connect to an explicitly allowlisted local service address.
- Check model availability and reject cloud-routed model selections in Private Mode.
- Avoid automatic pulls in Private Mode.
- Expose readiness/error messages for missing models rather than making hidden requests.

## 7. Persistence and settings

### 7.1 Data entities
- `workspaces`: ID, title, created/updated timestamps.
- `specifications`: ID, workspace, title, semantic version, OpenAPI dialect, source checksum, imported/active status.
- `operations`: stable operation ID, spec version, method, path, operationId, tags, normalized JSON, source pointers.
- `operation_fts`: tokenized searchable operation text.
- `vector_namespaces`: provider/model ID, revision, dimensions, chunking version, index location, status.
- `workspace_settings`: workspace ID, schema version, serialized JSON, changed timestamp.
- `ingestion_jobs`: state, progress, error/warnings, artifact IDs, timestamps.
- `evaluation_runs`: dataset version, configuration snapshot, metrics, timestamps.

Do not store raw production credentials, auth tokens or secret example values in application logs or evaluation artifacts. If uploaded source specs contain secrets, treat them as confidential input and keep access strictly local.

### 7.2 Example persisted settings

```json
{
  "schemaVersion": 1,
  "workspaceId": "workspace-uuid",
  "privateMode": true,
  "embedding": {
    "providerId": "transformers-local",
    "modelId": "configured-local-model-id",
    "revision": "pinned-revision"
  },
  "decision": {
    "providerId": "laya-local",
    "modelId": "configured-laya-checkpoint"
  },
  "llm": {
    "providerId": "ollama-local",
    "modelId": "approved-installed-model"
  },
  "retrieval": {
    "lexicalEnabled": true,
    "vectorEnabled": true,
    "topK": 5
  }
}
```

Settings must be **validated on write AND on startup**, migrated with explicit schema versions, and applied atomically. Store API keys only in a secure OS secret store or environment-backed adapter if cloud mode is added; never in workspace JSON. Show selected versus effective settings and block unsafe transitions.

## 8. Private Mode: trust boundary and security rules

**PM-001 — Fail closed:** `privateMode=true` is the default for every new workspace. Reject remote provider manifests, unknown execution locations or unverified forwarding endpoints.

**PM-002 — No implicit network:** deny external model downloads, telemetry, crash-report forwarding, remote embeddings, classification, generation, `$ref` fetches, URL import, CDN scripts and external fonts by default.

**PM-003 — Provider validation:** validate both manifest and actual runtime configuration. A loopback host does not prove locality if the process proxies to the internet. Unknown/custom providers need verified local capability and explicit approval/policy.

**PM-004 — Import guard:** default upload-only file import; cap file size, references, recursion depth and parse time. Disallow remote `$ref` in Private Mode. If URL import is enabled in another mode, block SSRF, private/metadata IPs and redirects to forbidden networks.

**PM-005 — Logs:** redact Authorization, API keys, cookies, user prompts and sensitive specification contents. Record operational metadata only, with telemetry disabled by default.

**PM-006 — Prompt injection:** imported descriptions and example payloads are untrusted data, never system instructions. LLM output cannot override schemas, policy or permissions.

**PM-007 — Script safety:** snippets are inert display/copy content; never autoexecute curl, JS, Python, shell or expressions derived from documentation.

**PM-008 — Secrets/storage:** database and index paths remain local. Restrict filesystem permissions and prevent cross-workspace query access. Explain that local plaintext storage depends on device-level protections; encryption-at-rest is a future enhancement.

**PM-009 — Verified air-gap:** test with outbound traffic blocked and a local capture/monitor. Model provisioning and dependency installation happen separately before disconnecting.

**PM-010 — Disabling privacy:** require explicit informed user action describing which categories of data may leave the device; do not automatically upload existing workspaces or indexes.

## 9. OpenAPI parsing and grounding

For each operation, normalize:

```ts
interface NormalizedOperation {
  id: string;
  specificationId: string;
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  servers: string[];
  parameters: NormalizedParameter[];
  requestBodies: NormalizedRequestBody[];
  responses: NormalizedResponse[];
  security: NormalizedSecurityRequirement[];
  sourcePointer: string;
}
```

The missing referenced types must capture required/optional status, media types, examples, object structure, nullable/union choices, enum constraints, response codes and supported authentication schemes. Handle OpenAPI 3.0 vs 3.1 dialect differences explicitly. Store the original document checksum and stable source pointers for every answer.

Retrieve with FTS5 and vector search, apply eligible metadata filters, combine rankings (e.g. reciprocal rank fusion), optionally rerank, then **hydrate the entire authoritative schema** for selected candidates. If multiple operations remain ambiguous, present choices instead of selecting a random route.

## 10. Output contract and code generation

### 10.1 Final response envelope

```json
{
  "schemaVersion": 1,
  "query": "Como cadastrar um produto com desconto?",
  "answer": {
    "locale": "pt-BR",
    "explanation": "...",
    "limitations": []
  },
  "sources": [{
    "specificationId": "spec-id",
    "operationId": "operation-id",
    "method": "POST",
    "path": "/products",
    "sourcePointer": "#/paths/~1products/post"
  }],
  "snippets": [{
    "language": "javascript",
    "label": "fetch",
    "code": "...",
    "validated": true,
    "validationWarnings": []
  }]
}
```

Schema examples are illustrative only. The real response must be Zod-validated server-side and source references checked against the active normalized database. Streaming can send discriminated typed events (`status`, `token`, `sources`, `snippets`, `final`, `error`); incomplete fragments must never be confused with final validated JSON.

### 10.2 Code generation invariants
- Endpoint paths, methods, query keys and payload field names come only from normalized contracts.
- Preserve required/optional status; required fields get a value if grounded by the query or an obvious typed placeholder.
- Security uses explicit placeholders (never copied credentials).
- Check media types and supported body serialization for each language.
- Unsupported unions/content types yield warnings or refusal to synthesize a falsely valid snippet.
- Validate emitted examples against normalized schema where practical; track syntax validation separately from semantic correctness.

## 11. API and interface design

| Method | Endpoint | Purpose | Key conditions |
|---|---|---|---|
| `POST` | `/api/specifications` | Upload/import document | Local file, size/parser limits, workspace validation |
| `GET` | `/api/specifications` | List/version status | Current workspace only |
| `GET` | `/api/operations/:id` | Inspect normalized source | Must belong to workspace/spec version |
| `POST` | `/api/chat` | Classify, retrieve, explain, generate | Policy check before providers/IO; streaming option |
| `GET` | `/api/settings` | Read effective selection | Redacted settings only |
| `PATCH` | `/api/settings` | Validate/save settings | Atomic transaction; reindex plan on embedding change |
| `GET` | `/api/providers` | List providers/readiness | Include locality and install status |
| `GET` | `/api/health` | Local runtime readiness | Do not leak document data |
| `DELETE` | `/api/workspaces/:id` | Delete local artifacts | Confirm intent and consistent cleanup |

Route examples are design contracts, not implementation commitments to one exact Next.js folder naming convention. API errors should carry stable codes, a human explanation, retryability and correlation ID without logging confidential input.

### 11.1 Main UI
- Sidebar: workspaces, imported specs, spec versions, route/method filters.
- Main: chat, prompt input, processing stages, answer, citations and selectable language snippets.
- Right drawer: endpoint inspector (contract details and source pointer).
- Settings: embedding provider, classifier, LLM, Private Mode, readiness and reindex status.
- Diagnostics: search candidates, scores, timing, classifier output, warnings (not raw sensitive payloads in logs).
- Accessible keyboard navigation, focus styles, proper live regions for streamed content; Shiki code blocks with copy controls.

## 12. Non-functional requirements

| ID | Requirement | How to prove |
|---|---|---|
| NFR-001 | Fully functional offline after provisioning | Air-gap smoke test on Mac and Docker/Linux |
| NFR-002 | No unauthorized egress or model fetch in Private Mode | Network monitor and denied outbound connection tests |
| NFR-003 | Local data survives restart and updates | Persistence/migration test |
| NFR-004 | Stable, repeatable indexing | Checksum + model/revision + deterministic normalization |
| NFR-005 | Fault isolation by provider | Simulate Laya/Ollama missing, timeout, malformed output |
| NFR-006 | No silently fabricated contract elements | Schema/source coverage and snippet validation |
| NFR-007 | Measured latency, no invented SLO | p50/p95 per stage and device profile; thresholds set from baseline |
| NFR-008 | Inspectable evaluation performance | Versioned datasets and reproducible eval output |
| NFR-009 | Resource-aware local execution | Measure RAM/CPU/first-run setup for Apple Silicon |
| NFR-010 | Maintainability | Strict TypeScript, lint, unit/integration/E2E and docs |

## 13. Acceptance tests and evaluation

**AT-01 Import fidelity:** ingest canonical OpenAPI 3.0, 3.1, Swagger 2.0 fixtures with `$ref`, `allOf`, `oneOf`, auth, required fields. Validate operation count and source mapping.

**AT-02 Semantic discovery:** map Portuguese nontechnical questions to deliberately renamed endpoints (`POST /v1/catalog/items`) without relying on English path wording.

**AT-03 Exact matching:** find exact field names, paths and HTTP methods by lexical retrieval and metadata filters.

**AT-04 Classification:** evaluate Laya and rule fallback on multilingual held-out intent cases; record macro-F1, abstention and latency; never route directly to endpoint by class alone.

**AT-05 Provider switching:** change embedding model/revision; verify old index never reused incorrectly and new namespace is built with visible status.

**AT-06 Grounded code:** snippets must not introduce nonexistent fields, methods, paths or auth. Verify cURL/fetch/Python variants.

**AT-07 Response integrity:** inject malformed LLM JSON or false citations; final output is rejected/normalized without corrupting the UI.

**AT-08 Offline privacy:** block external networking after provisioning; run import, query, embeddings, Laya and Ollama without outbound calls.

**AT-09 Adversarial input:** try remote `$ref`, malicious URLs, prompt injection in description, oversized files and accidental secrets in logs.

**AT-10 Persistence/recovery:** restart between import and query; migrate settings; recover from partial indexing job without selecting a half-built index.

Track **Recall@5, MRR, top-1 operation accuracy, wrong-method rate, classifier macro-F1, snippet syntactic validity, schema conformance, p50/p95 retrieval/classification/TTFT/total latency, peak RAM, privacy violations**. Initial thresholds will be established after collecting a representative baseline dataset rather than fabricated now.

## 14. Definition of done and delivery mapping

The MVP is complete only when:
1. All P0 functional requirements pass automated and manual tests.
2. Offline privacy tests pass after pre-provisioning dependencies/models.
3. Every answer's cited endpoint resolves to a stored source document/version.
4. No generated snippet contains unsupported contractual elements without warnings.
5. Users can change embedding/classifier/LLM choices safely with persisted settings and readiness indication.
6. `README.md` documents prerequisites, offline installation, limitations and troubleshooting.
7. `plan.md` acceptance checkboxes and evidence are updated phase-by-phase.

### Implementation mapping
| Spec section | Implementation plan |
|---|---|
| §§2, 5–7 | `plan.md` phases 1, 3, 4, 6, 7 |
| §§4, 9 | `plan.md` phases 2, 5 |
| §10 | `plan.md` phases 8, 9 |
| §8 | `plan.md` phase 10 security |
| §§12–13 | `plan.md` phases 10–11 evaluation/release |

## 15. Assumptions, open technical validations and deferred work

- Choose/pin exact Transformers.js embedding model after checking multilingual quality, vector dimensions and local Mac performance.
- Confirm Laya multilingual checkpoint compatibility and local Node ONNX runtime; retain optional Python sidecar if it is not viable.
- Confirm Ollama installed-model identification and cloud-backed-model detection through supported runtime metadata/policy; deny uncertain setups.
- Benchmark an SQLite-compatible vector extension on macOS ARM64 and Linux; for small inputs allow measured, local cosine fallback.
- Do not advertise security certification or absolute privacy guarantees; validate the defined network and process boundary under documented threat assumptions.
- Deferred: team sharing, cloud deployment, interactive API execution, in-app model benchmark UI, specification diffing, encrypted-at-rest workspace vault.

## 16. Agent instructions

`AGENTS.md` should require the coding agent to read **both `spec.md` (what and why)** and **`plan.md` (order and status)** before any implementation. Any conflict should be reported and resolved by amending the two documents together; implementation must not silently override either. Mark work complete only with evidence and tests. Preserve the default Private Mode policy.

## 17. References

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Swagger Parser](https://github.com/APIDevTools/swagger-parser)
- [Transformers.js](https://huggingface.co/docs/transformers.js/)
- [Laya model](https://huggingface.co/convaiinnovations/laya)
- [Ollama documentation](https://docs.ollama.com/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
