# ADR-002: Policy Adapter Layer as Single Decision Authority

**Status:** Accepted
**Date:** 2026-05-16
**Context:** Post-scan findings showed 3 competing policy systems (LLM Registry, render-intelligence scoring, provider-score observability)

---

## Decision

A new **Policy Adapter Layer** must sit between L1 Heuristic Policy and L2 Registry Execution.
Its sole job: normalize all policy outputs into one standardized `Decision` type.

## Rationale

- Pre-migration scan revealed three independent systems each trying to "choose a provider":
  - `render-intelligence.ts` (heuristic scoring: quality/speed/cost weights)
  - `observability/provider-score.ts` (in-memory score map)
  - LLM Registry `getProviderForModel()` (structural match)
- Without an adapter, these would compete as decision sources, causing split-brain routing
- The adapter enforces: many signals → one decision

## Excluded Alternatives

- **Registry chooses provider directly** — rejected (registry becomes policy engine, violating single responsibility)
- **Provider Score becomes sole decision source** — rejected (immature, in-memory only)
- **No adapter, let L1 write directly to Registry** — rejected (hardcodes L1 dependency into execution layer)

## Consequences

- Policy Adapter input: `L1 scores + registry metadata + health snapshot`
- Policy Adapter output:
  ```ts
  interface PolicyDecision {
    providerId: string
    confidence: number
    fallbackChain: string[]  // ordered alternatives
  }
  ```
- L1 scoring models can evolve independently without touching L2
- Registry stays dumb: `(PolicyDecision) → HTTP call → telemetry`
