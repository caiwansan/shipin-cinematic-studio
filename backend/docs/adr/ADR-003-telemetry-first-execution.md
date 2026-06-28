# ADR-003: Telemetry-First Execution Model

**Status:** Accepted
**Date:** 2026-05-16
**Context:** Architecture upgrade Phase 1.5 planning

---

## Decision

Every provider call MUST produce an observable telemetry trace.
Telemetry is append-only signal, not real-time truth.

## Rationale

- Previously, provider failure/success was only visible through application logs or circuit breaker state
- No single view of provider health existed for routing decisions
- Circuit breaker was DB-backed but not feeding into provider selection
- Provider scoring (`observability/provider-score.ts`) was in-memory with no retention

## Excluded Alternatives

- **No telemetry, rely on circuit breaker only** — rejected (breaker is reactive, not predictive)
- **Per-request DB writes** — rejected (write storm at scale)
- **Independent aggregator service** — rejected (additional deployment, state sync, failure mode)

## Telemetry Architecture

### Tier 1 — Raw counters (Redis INCR)
```
telemetry:raw:{providerId}:{capability}
  hash fields: requests, success, failure, total_latency
  TTL: 300s
```

### Tier 2 — Aggregated snapshot (Lua + timer)
```
provider_health_snapshot:{providerId}
  fields: avgLatencyMs, failureRate, requestCount, timestamp
  TTL: 60-120s
  Aggregation: every 15-30s via Lua script (not per-request compute)
```

### Tier 3 — Usage Metrics (DB, optional)
Phase 2, for cost accounting only.

## Consequences

- All HTTP execution paths in Registry must call `recordTelemetry()` after completion
- Telemetry is fire-and-forget within RuntimeHttpClient (no await, no blocking)
- Selection Engine reads snapshot only (never raw counters)
- No telemetry = no routing visibility = provider treated as unknown
- Missing/lost telemetry events are acceptable (< 30s convergence target)
