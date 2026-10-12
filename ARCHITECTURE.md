# SpecLens — Architecture

## Overview

SpecLens is a modular monorepo engineered for offline, private, and deterministic OpenAPI documentation retrieval, classification, and code generation.

```
                              ┌────────────────────────────────────────┐
                              │            Web UI (apps/web)           │
                              │ Next.js 15 · Chat · Inspector · Shiki  │
                              └───────────────────┬────────────────────┘
                                                  │ API Routes (SSE)
                                                  ▼
                                      ┌───────────────────────┐
                                      │   Orchestration Layer │
                                      │    (@speclens/ai-core)│
                                      └───────────┬───────────┘
               ┌──────────────────────────────────┼──────────────────────────────────┐
               ▼                                  ▼                                  ▼
    ┌──────────────────────┐           ┌──────────────────────┐           ┌──────────────────────┐
    │  Decision Provider   │           │   Hybrid Retrieval   │           │     LLM Provider     │
    │  Laya Local / Rules  │           │   FTS5 + Vector (RRF)│           │ Ollama (Loopback-only│
    └──────────────────────┘           └──────────┬───────────┘           └──────────────────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │   Schema Hydration    │
                                      │(@speclens/openapi-core│
                                      └───────────┬───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │ Deterministic Codegen │
                                      │  (@speclens/codegen)  │
                                      │  cURL · fetch · Python│
                                      └───────────────────────┘
```

---

## Monorepo Packages and Responsibilities

| Package | Purpose & Responsibilities |
|---|---|
| **`@speclens/openapi-core`** | Ingests OpenAPI 3.0, 3.1, and Swagger 2.0 files. Resolves local `$ref` pointers with loop and depth guards (blocking remote `$ref`). Normalizes operations into canonical `NormalizedOperation` structures and extracts tokenized text for FTS search. |
| **`@speclens/db`** | Manages local SQLite storage (`better-sqlite3`). Provides migration runners, FTS5 virtual tables with synchronization triggers, and strongly-typed repositories for workspaces, specifications, operations, settings, and jobs. |
| **`@speclens/ai-core`** | Defines core provider contracts (`EmbeddingProvider`, `DecisionProvider`, `LLMProvider`, `VectorIndex`), the `ProviderRegistry` with fail-closed security rules, reciprocal rank fusion (RRF) `HybridRetrievalImpl`, rule-based fallback decision orchestrators, and loopback-only Ollama streaming adapters. |
| **`@speclens/codegen`** | Deterministic code generator. Produces syntactically valid and schema-conforming cURL, fetch (JavaScript/TypeScript), and Python snippets. Places labeled typed placeholders for authentication and parameters without inventing non-existent contract fields. |
| **`@speclens/evals`** | Evaluation harness for search and classification. Measures Recall@1, Recall@3, Recall@5, MRR, Top-1 accuracy, and macro-F1 against canonical test datasets. |
| **`apps/web`** | Next.js 15 application. Serves the workspace explorer, SSE-streamed chat conversation UI, RAG Inspector drawer with JSON pointer resolution, workspace settings manager, and syntax-highlighted code blocks with Shiki. |

---

## End-to-End Query Execution Flow

1. **User Prompt Ingestion**: The client submits a prompt via `POST /api/chat`.
2. **Policy Verification**: The server verifies `privateMode=true`, confirms the active workspace, and verifies that configured providers satisfy locality constraints.
3. **Intent Classification**:
   - The query is analyzed by `DecisionOrchestrator`.
   - The classifier tests if the query matches search intents, endpoint queries, or out-of-scope interactions.
   - If confidence is below the calibration threshold or the model is unavailable, it gracefully defaults to hybrid search.
4. **Hybrid Retrieval**:
   - **Lexical**: SQLite FTS5 searches indexed operation tokens (paths, summaries, tags, parameters).
   - **Dense Vector**: The local embedding provider (e.g. Transformers.js / local ONNX) encodes the query and searches the namespace index.
   - **Fusion**: Reciprocal Rank Fusion (RRF with $k=60$) merges both rankings deterministically.
5. **Authoritative Schema Hydration**:
   - For the top $K$ candidate operations, the authoritative normalized schema and JSON pointers are retrieved from SQLite.
6. **LLM Grounding & SSE Streaming**:
   - An explanation prompt is formatted containing *only* the grounded candidate operations.
   - Ollama streams explanation tokens over Server-Sent Events (SSE).
   - Specification descriptions and example payloads are quarantined as untrusted data to prevent prompt injection.
7. **Deterministic Snippet Generation**:
   - `@speclens/codegen` creates verified cURL, fetch, and Python snippets directly from the hydrated operation contracts.

---

## Privacy Architecture: Fail-Closed Enforcement

- **Strict Network Isolation**: In Private Mode, no network calls are initiated to remote servers, external CDNs, remote font providers, or cloud AI endpoints. Docker Compose uses an `internal: true` network with no external route.
- **Loopback Enforcement**: Ollama calls are restricted to the explicit loopback allowlist. In Compose, the web container shares Ollama's network namespace and uses `127.0.0.1`; the Ollama API is not published to the host.
- **Redirect and Model Checks**: Ollama requests disable redirect following. Before each generation, the runtime model list is fetched and the exact selected model's metadata is checked for cloud/proxy routing before any specification context is sent.
- **No Implicit Downloads**: If a requested local model or vector index is missing, the system emits an explicit readiness error instead of attempting an automatic download.
- **Index Migration Invariant**: When an embedding model, revision, or chunking configuration is altered, existing indices are preserved and a new namespace is indexed independently. Vectors from distinct spaces are never cross-compared.

---

## Adding New AI Providers

To register a new AI provider:

1. Implement the corresponding interface in `@speclens/ai-core`:
   - `EmbeddingProvider` (`embed(texts)`, `manifest`, `readiness()`)
   - `DecisionProvider` (`classify(input)`, `manifest`, `readiness()`)
   - `LLMProvider` (`streamExplanation(input)`, `manifest`, `readiness()`)
2. Define a versioned `ProviderManifest` specifying:
   - Unique `id` and semantic `version`
   - `executionLocation` (`'in-process'` or `'local-service'`)
   - Supported dimensions, languages, and capabilities
3. Register the provider instance in `ProviderRegistry`:
   ```typescript
   registry.registerProvider(new CustomLocalProvider());
   ```
4. Verify provider readiness through `readiness()` and ensure Private Mode compliance checks pass.
