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

## Interface Overview (Mockup)

```
┌─────────────────┬────────────────────────────────────────────┬────────────────────────┐
│ Workspaces      │ Chat & Grounded Answers                    │ RAG Inspector          │
├─────────────────┼────────────────────────────────────────────┼────────────────────────┤
│ > Default (v1.0)│ User: "How to register an item?"           │ Retrieved Candidates:  │
│                 │                                            │ 1. POST /v1/items      │
│ Specs:          │ Assistant:                                 │    Score: 0.94 (RRF)   │
│ • store-api.yaml│ To create an item, use the POST /v1/items  │    Method: POST        │
│                 │ route with required authorization.         │    Source: #/paths/    │
│ Endpoints (14): │                                            │            ~1items/post│
│ • GET  /health  │ ```bash                                    │                        │
│ • POST /v1/items│ curl -X POST http://127.0.0.1:8000/v1/items│ Operation Schema:      │
│ • GET  /v1/items│   -H "Authorization: Bearer <AUTH_TOKEN>"  │ {                      │
│                 │ ```                                        │   "summary": "Create", │
│ [Settings]      │                                            │   "tags": ["items"]    │
│ [Private Mode:ON│ [Inspect Source] [Copy cURL] [Copy Python] │ }                      │
└─────────────────┴────────────────────────────────────────────┴────────────────────────┘
```

---

## System Requirements

- **Operating System**: macOS (Apple Silicon recommended) or Linux (x86_64 / arm64)
- **Node.js**: `v24.x` or higher
- **Package Manager**: `pnpm` `v11.x` or higher
- **Local LLM Runner**: [Ollama](https://ollama.com/) (running on `http://127.0.0.1:11434`)
- **Memory**: 8 GB RAM minimum (16 GB recommended when running 3B+ parameter local LLMs)

---

---

## Quick Start — Comando Único 🚀

Com Node.js, pnpm e Ollama instalados, clone o projeto e rode `./start.sh`. Na primeira execução, o script informa cada download e pede confirmação para instalar as dependências travadas pelo lockfile e baixar o modelo padrão `llama3.2:3b`. Os documentos e consultas do SpecLens não são enviados ao baixar dependências ou pesos. Depois do provisionamento, os próximos inícios não acessam registries. Se você recusar ou estiver sem rede, o app inicia em modo degradado sem baixar nada.

```bash
git clone https://github.com/vitorprampolin/speclens.git
cd speclens
./start.sh
# ou: pnpm start
```

O primeiro uso requer confirmação no terminal para downloads. Para automação, `SPECLENS_AUTO_PROVISION=1 ./start.sh` autoriza explicitamente os downloads iniciais. Para preparar a máquina antes de desconectar, use `bash scripts/provision-offline.sh` e baixe o modelo escolhido com `ollama pull <model>`.

Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### Aplicativo Desktop / PWA (Progressive Web App) 📱💻

O SpecLens possui manifesto web completo e suporte a **PWA (Progressive Web App)**:
- No **Chrome / Edge**: clique no ícone **"Instalar SpecLens"** na barra de endereço.
- No **Safari (macOS Sonoma/Sequoia)**: acesse o menu *Arquivo > Adicionar ao Dock* (ou botão de compartilhamento).
- O SpecLens abrirá em uma **janela dedicada sem barras de navegador**, com ícone próprio no Dock/barra de tarefas e comportamento de aplicativo nativo.

---

## Deployment with Docker Compose

SpecLens includes a production-ready Docker Compose configuration that binds **strictly to loopback (`127.0.0.1`)** to prevent accidental exposure to external network interfaces:

```bash
# 1. Provision npm dependencies before disconnecting
bash scripts/provision-offline.sh

# 2. Build images while connected, then launch without runtime downloads
docker compose up -d --build

# 3. Verify health
bash scripts/smoke-test.sh
```

Compose persists SQLite/index data under `./data`, embedding assets under
`./models`, and Ollama weights under `./models/ollama` by default. Override
those bind paths with `SPECLENS_DATA_PATH`, `SPECLENS_MODELS_PATH`, and
`SPECLENS_OLLAMA_MODELS_PATH` if needed. The web and Ollama containers share Ollama's
network namespace, so the web process uses `http://127.0.0.1:11434`; the
project network is `internal: true` and the Ollama API is not published on the
host. Only the UI is published on `127.0.0.1:3000`.

Provision the selected Ollama model explicitly while connected. Seed the
default Compose model directory before starting the private network:

```bash
mkdir -p models/ollama
docker run --rm --volume "$PWD/models/ollama:/root/.ollama" ollama/ollama:latest pull llama3.2:3b
```

The Compose runtime itself does not pull models. For OLL-06's isolated Docker
smoke, keep the source volume provisioned and run:

```bash
bash scripts/test-ollama-docker.sh
```

The smoke requires local application/Ollama images and a provisioned model. It
copies the source model directory into a unique temporary directory, mounts
temporary directories for all app data, uses a unique Compose project, blocks
external egress, runs one synthetic inference, then removes only that test
project and its temporary directories. Set `OLLAMA_SOURCE_DIR` if model files
are stored elsewhere.

---

## Platform-Specific Workflows

### macOS / Apple Silicon
1. Install Ollama via Homebrew (`brew install --cask ollama`) or direct download.
2. Ollama utilizes Metal acceleration out of the box for fast local token generation.
3. Node.js native extensions (`better-sqlite3`) compile natively against macOS ARM64.

### Linux / Docker
1. Ensure build tools (`build-essential`, `python3`, `make`, `g++`) are available for compiling native Node addons during `pnpm install`.
2. Compose runs Ollama and the web process in a shared network namespace on a Docker internal network; it does not connect to a host Ollama service.

---

## Verifying Private Mode and Air-Gap Operation

SpecLens is designed to remain completely operational when disconnected from the internet:

1. While connected, start once with `./start.sh` and confirm dependency/model provisioning, or run `bash scripts/provision-offline.sh` and `ollama pull <model>` explicitly.
2. Disconnect your machine from the network (disable Wi-Fi / unplug ethernet).
3. Start the application (`./start.sh` or `docker compose up -d`).
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

- **Ollama connection refused**: Ensure Ollama is installed and accessible at the configured `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`). `./start.sh` starts the local service if needed.
- **Missing model error**: `./start.sh` offers to download the bootstrap model on first use. To select another model, use `OLLAMA_MODEL_ID=<model> ./start.sh` or download it explicitly with `ollama pull <model>`; workspace selections are checked independently.
- **Database lock or permission issues**: Ensure the user running the process has write permissions to `./data` and `./models`.
- **Reindexing needed**: When switching embedding models or vector dimensionality in workspace settings, initiate a reindex from the UI settings panel.

---

## License

This project is licensed under the [MIT License](./LICENSE).
