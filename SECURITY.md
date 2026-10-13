# SpecLens — Security Policy

## Threat Model and Security Philosophy

SpecLens is an offline-first, local API documentation intelligence assistant designed to operate over confidential OpenAPI specifications without leaking proprietary contracts, queries, embeddings, or context to external networks.

The core security principle is **Fail Closed**: in the presence of configuration ambiguity, missing local models, or network attempts, the system aborts execution rather than falling back to remote or unverified cloud providers.

---

## Private Mode Invariants (PM-001 to PM-010)

SpecLens enforces strict privacy boundaries under `privateMode=true` (enabled by default for all workspaces):

| Policy | Title | Specification Requirement |
|---|---|---|
| **PM-001** | Fail Closed | `privateMode=true` is the default. Rejects remote provider manifests, unknown execution locations, and unverified forwarding endpoints. |
| **PM-002** | No Implicit Network | Blocks external model downloads, telemetry, crash reporting, remote embeddings, remote classification, remote LLMs, remote `$ref` resolution, URL imports, external CDNs, and external fonts. |
| **PM-003** | Provider Locality Validation | Validates both provider manifest and actual runtime configuration. A loopback host (`localhost` / `127.0.0.1`) does not prove locality if the proxy forwards externally. Unknown or custom providers require verified local capability. |
| **PM-004** | Import & Parser Guards | File upload only by default. Uploads have no application byte-size cap; available memory/storage constrain large imports. Reference count caps, recursion depth limits, and parse timeouts remain. Remote `$ref` is blocked. |
| **PM-005** | Sensitive Data Redaction in Logs | Logs redact `Authorization` headers, API keys, cookies, user prompt text, and sensitive specification payloads. Records operational metadata only. |
| **PM-006** | Prompt Injection Defense | Imported documentation descriptions and example payloads are untrusted data, never treated as system instructions. LLM outputs cannot override schemas, policies, or access controls. |
| **PM-007** | Deterministic Inert Scripts | Code snippets (cURL, fetch, Python) are inert text for inspection/copy. SpecLens never auto-executes generated snippets or documentation expressions. |
| **PM-008** | Local Storage Boundary | Database SQLite and vector index files remain strictly local. Access across workspaces is restricted. |
| **PM-009** | Verified Air-Gap | Designed to function without internet connectivity after initial dependency and model provisioning. |
| **PM-010** | Explicit Privacy Override | Disabling privacy mode requires explicit, informed user confirmation detailing data egress categories. |

First-run provisioning is user-confirmed in `./start.sh`; it downloads only lockfile-pinned packages and the selected Ollama model. It never sends imported OpenAPI documents, prompts, embeddings, or workspace data. Non-interactive startup does not provision unless `SPECLENS_AUTO_PROVISION=1` is explicitly set. After provisioning, disconnecting the network is supported.

---

## Known Boundaries and Non-Guarantees (MVP)

In Docker Compose, the web process shares the Ollama container's network
namespace, and that namespace is attached only to a Docker `internal: true`
network. The host publishes the UI on `127.0.0.1:3000`; the Ollama API is not
published. HTTP redirects from Ollama are not followed, and model metadata is
rechecked before every generation. The opt-in OLL-06 smoke uses a uniquely
named project and temporary volumes, verifies external connection failure,
and runs synthetic inference using pre-provisioned local model files.

SpecLens is honest about its current security boundaries:

1. **No Formal Compliance Certification**: SpecLens has not undergone third-party SOC2, ISO 27001, or FedRAMP audits.
2. **At-Rest Plaintext Storage in MVP**: SQLite (`speclens.db`) and vector index files are stored in plaintext on the local filesystem. Protection at rest relies on operating-system-level disk encryption (e.g., Apple FileVault on macOS, LUKS on Linux, BitLocker on Windows). A dedicated workspace encryption vault is deferred to future releases.
3. **Multi-Tenancy & RBAC**: The MVP is designed for single-operator local workstation usage. It does not enforce role-based access control (RBAC) or authenticated multi-tenant separation.
4. **Local Host Compromise**: If the host machine running SpecLens or Ollama is compromised by an attacker with local root/user access, local storage and memory boundaries cannot be preserved by application-level controls alone.

---

## Reporting Vulnerabilities

If you discover a security vulnerability or privacy violation in SpecLens:

1. **Do not open a public issue.**
2. Send a detailed report describing the vulnerability, affected components, reproduction steps, and potential impact.
3. Please allow reasonable time for coordinated disclosure and remediation before publishing.
