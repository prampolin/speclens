# Phase 12 — RAG Reliability

**Status:** Planned; implementation NOT STARTED.
**Date:** 2026-10-12
**Dependencies:** Historical phases 01–11 and OLL-01–OLL-07; their completion is not a substitute for the new gates.
**Detailed steps, test matrix and commands:** [plan.md](../plan.md).

## Scope

Reliable real local embeddings, persistent vector generations, truthful ingestion status, workspace-aware settings, isolated retrieval, canonical LLM context and verified offline operation. Preserve `privateMode=true`, local providers, deterministic snippets and single-command startup. No cloud services, implicit downloads or execution of documented APIs.

## Ordered checklist

Each ID maps to the detailed section with the same ID in plan.md. Execute one small task at a time. Do not mark a task complete without its automated test evidence.

- [ ] **RAG-01** Define versioned state/configuration contracts and regression fixtures.
- [ ] **RAG-02** Require real embeddings and consistent offline model provisioning.
- [ ] **RAG-03** Persist vectors and activate complete generations transactionally.
- [ ] **RAG-04** Consolidate durable ingestion and expose truthful outcomes.
- [ ] **RAG-05** Apply workspace settings and schedule compatible rebuilds.
- [ ] **RAG-06** Enforce workspace/version isolation and effective retrieval modes.
- [ ] **RAG-07** Preserve canonical contract details in bounded LLM context.
- [ ] **RAG-08** Expose indexing, degradation, retry and inspector behavior in the UI.
- [ ] **RAG-09** Record real semantic evaluation, restart and offline release gates.

## Evidence log

| Date | Task | Command / artifact | Result | Limitations |
|---|---|---|---|---|
| 2026-10-12 | Planning | Source inspection; detailed plan and historical archive | Documentation prepared | Runtime tests NOT EXECUTED (NÃO EXECUTADO); no implementation changes |
| 2026-10-12 | Documentation validation | Python assertions for local Markdown links, balanced code fences, nine task/checklist IDs and unchecked completion states; targeted `git diff --check` | PASS | Documentation validation only; no runtime claims |

For each future task record files changed, decisions, command/exit code/test counts, privacy checks, risks and the next unstarted task. Mark missing prerequisites explicitly; a skipped real-model test never passes a gate.

## Conflicts, risks and pending decisions

Historical Phase 04 completion claims exceed the current runtime's persistence/atomicity guarantees. spec.md remains the functional contract. Preserve historical evidence and add corrective evidence here. SQLite exact-search scale, model asset packaging, Portuguese retrieval quality, interrupted job recovery and context truncation require the validations defined in plan.md.

## Exit gate

- [ ] All RAG tasks and their automated tests completed with evidence.
- [ ] Real local inference demonstrated; no production synthetic embedding fallback.
- [ ] Persistent indexes survive restart and failed/interrupted rebuilds.
- [ ] No cross-workspace/version/model contamination.
- [ ] UI distinguishes semantic readiness, lexical fallback and contract-only explanation.
- [ ] Private-mode egress and secret-safe diagnostics verified in isolated runtime.
- [ ] Retrieval quality and latency measured with actual pinned models.
- [ ] plan.md and operational documentation updated; no later phase started automatically.

**Next item:** RAG-01, not started.
