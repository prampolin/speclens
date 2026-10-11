# SpecLens

> **Privacy-First, Offline-Ready API Documentation Intelligence**

SpecLens transforms OpenAPI specifications (3.0, 3.1, and Swagger 2.0) into an interactive, grounded knowledge assistant. It combines local SQLite full-text search (FTS5) with local vector embeddings and intent classification to answer queries and generate executable snippets (cURL, fetch, Python) **without transmitting your proprietary API schemas, questions, or context to cloud services**.

---

## Key Features

- 🔒 **Fail-Closed Private Mode**: Operates completely on your machine. External network egress, CDNs, telemetry, and cloud models are blocked by default.
- ⚡ **Hybrid Retrieval**: Merges lexical token search (SQLite FTS5) and dense semantic vector search via Reciprocal Rank Fusion (RRF).
- 🎯 **Grounded & Deterministic**: Answers cite verified operations and JSON pointers from your uploaded specifications. Code snippets are generated directly from authoritative schemas, not hallucinated by the LLM.
- 🧠 **Pluggable Local AI**: Designed for local Ollama runtimes, in-process embedding transformers, and configurable intent classifiers (Laya / rule-based fallbacks).
- 🔍 **RAG Inspector**: Inspect retrieved operations, match scores, citations, and raw OpenAPI contracts side-by-side in real time.

---

## System Requirements

- **Operating System**: macOS (Apple Silicon recommended) or Linux (x86_64 / arm64)
- **Node.js**: `v24.x` or higher
- **Package Manager**: `pnpm` `v11.x` or higher
- **Local LLM Runner**: [Ollama](https://ollama.com/) (running on `http://127.0.0.1:11434`)
- **Memory**: 8 GB RAM minimum (16 GB recommended when running 3B+ parameter local LLMs)

---

## Quick Start (Local Development)

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/vitorprampolin/speclens.git
cd speclens
pnpm install
```

### 2. Prepare Local Models

Start Ollama and download the recommended local model:

```bash
ollama serve
ollama pull llama3.2:3b
```

Run the offline provisioning script to prepare directories and verify local assets:

```bash
bash scripts/provision-offline.sh
```

### 3. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment with Docker Compose

SpecLens includes a production-ready Docker Compose configuration that binds **strictly to loopback (`127.0.0.1`)** to prevent accidental exposure to external network interfaces:

```bash
# 1. Provision offline assets before build
bash scripts/provision-offline.sh

# 2. Build and launch the container
docker compose up -d --build

# 3. Verify health
bash scripts/smoke-test.sh
```

Container volumes:
- `./data`: Stores the persistent SQLite database (`speclens.db`) and vector indices.
- `./models`: Local embedding weights and classification caches.

---

## Platform-Specific Workflows

### macOS / Apple Silicon
1. Install Ollama via Homebrew (`brew install --cask ollama`) or direct download.
2. Ollama utilizes Metal acceleration out of the box for fast local token generation.
3. Node.js native extensions (`better-sqlite3`) compile natively against macOS ARM64.

### Linux / Docker
1. Ensure build tools (`build-essential`, `python3`, `make`, `g++`) are available for compiling native Node addons during `pnpm install`.
2. When running Docker alongside a host Ollama instance, `docker-compose.yml` connects through `host.docker.internal:11434`. On Linux hosts without Docker Desktop, add `--add-host=host.docker.internal:host-gateway` if necessary.

---

## Verifying Private Mode and Air-Gap Operation

SpecLens is designed to remain completely operational when disconnected from the internet:

1. Follow the **Provisioning** step while connected (`bash scripts/provision-offline.sh`).
2. Disconnect your machine from the network (disable Wi-Fi / unplug ethernet).
3. Start the application (`pnpm dev` or `docker compose up -d`).
4. Upload an OpenAPI specification, search endpoints, and execute queries.
5. All operations run against local SQLite, in-process embeddings, and local Ollama without egress attempts.

---

## Known MVP Limitations

- **No Sub-Second Latency Guarantees**: Local retrieval and generation speeds depend directly on your hardware, CPU/GPU throttling, and local model size (e.g., Apple Silicon Metal vs. CPU-only). Latencies are tracked via baseline measurements rather than fabricated fixed SLOs.
- **Single-User Local Execution**: Designed for local workstation developer environments. Multi-user authentication, roles (RBAC), and team sharing are deferred.
- **At-Rest Plaintext**: Local SQLite files and vector indices are stored in plaintext on disk; protect confidential data using OS-level full-disk encryption (FileVault / LUKS).
- **No Specification Diffing**: Version diffing between uploaded specifications is planned for future releases.

---

## Troubleshooting

- **Ollama connection refused**: Ensure Ollama is running (`ollama serve`) and accessible at `http://127.0.0.1:11434`.
- **Missing model error**: If the chat indicates the model is not found, verify installed models with `ollama list` and run `ollama pull llama3.2:3b`.
- **Database lock or permission issues**: Ensure the user running the process has write permissions to `./data` and `./models`.
- **Reindexing needed**: When switching embedding models or vector dimensionality in workspace settings, initiate a reindex from the UI settings panel.

---

## License

This project is licensed under the [MIT License](./LICENSE).
