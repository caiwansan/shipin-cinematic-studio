# ADR-001: Provider Registry as Unified Execution Entry

**Status:** Accepted
**Date:** 2026-05-16
**Context:** Architecture upgrade Phase 1 planning

---

## Decision

All provider calls MUST go through a centralized Provider Registry. 
The Registry is a **dumb executor** — it does not score, rank, or make business decisions.

## Rationale

- Before this change, provider calls were scattered across routes (`images.ts`, `tts.ts`), services (`volcengine-image.provider.ts`), and agents (`agent-pool.ts`)
- These call sites had duplicated logic: API key loading, HTTP client setup, error handling
- Adding a new provider required changes in multiple files
- The existing LLM-only registry (`runtime/providers/provider.registry.ts`) proved the pattern works

## Excluded Alternatives

- **Direct SDK calls in business logic** — rejected (creates scattered coupling)
- **Middleware-based interception** — rejected (hides call graph, hard to debug)
- **Dynamic adapter loading from DB** — rejected (protocol semantics are Runtime Physics, not data)

## Consequences

- Registry must support: LLM, image, video, TTS capabilities (extend from LLM-only)
- Registry must NOT embed: scoring, fallback chain, business rules
- All new providers must be added via `registry.register()`, not new files or route entries
- Existing provider service files become adapters called by Registry, not standalone entry points
