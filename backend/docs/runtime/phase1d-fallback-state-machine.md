# Phase 1D — Fallback State Machine Design

> **Goal:** Converge all scattereed fallback/retry/degradation patterns into a single deterministic state machine.
> **Phase 1D rule:** Every failure → exactly one state transition. No implicit fallback.

---

## Current Fallback Paths (pre-Phase 1D)

| Layer | Path | Mechanism | Phase 1D Handling |
|-------|------|-----------|-------------------|
| BullMQ Queue | Job failure → 3 attempts (exponential backoff 2s) → DLQ | `attempts: 3`, `backoff.exponential` | ✅ Keep (platform-level) |
| Worker runtime | `callProvider()` failure → `throw` → BullMQ retry | Throws to queue retry | ✅ Keep |
| Circuit Breaker | Failure rate > 30% → `OPEN` → blocking (`HALF_OPEN` after cooldown) | State machine (HEALTHY → DEGRADED → OPEN → HALF_OPEN) | ✅ Keep |
| PolicyAdapter | `fallback-low-confidence` rule → reroute | `getFallbackDecision()` | ⚠️ Formalize |
| PolicyAdapter | `reroute-latency-miss` rule → reroute | `pickFallbackProvider()` | ⚠️ Formalize |
| PolicyAdapter | `reject-no-path` rule → mock | `getFallbackDecision()` → mock | ⚠️ Formalize |
| render-intelligence (legacy) | No provider available → `available[0]` (alphabetical) | `fallbackDecision()` | ❌ Removed in Phase 1C |
| apiRouter (legacy) | Auth error → skip + retry with next provider | `selectProvider(skipProvider)` | ❌ Removed in Phase 1C |
| apiRouter (legacy) | No env key → mock | `mockProviderCall()` | ❌ Removed in Phase 1C |

---

## Phase 1D: Single Fallback State Machine

```
                    ┌─────────────┐
                    │  Normal     │
                    │  Execution  │
                    └──────┬──────┘
                           │ success
                           │
                    ┌──────▼──────┐
                    │  Success    │──→ Done
                    └─────────────┘

                           │ failure
                           ▼
                    ┌─────────────┐
                    │  Failed     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Retryable│ │ Fatal    │ │ Auth-    │
       │ Error    │ │ Error    │ │ Blocked  │
       └────┬─────┘ └────┬─────┘ └────┬─────┘
            │            │            │
            ▼            ▼            ▼
    ┌─────────────┐ ┌─────────┐ ┌──────────┐
    │ Queue Retry │ │  DLQ    │ │ Circuit  │
    │ (BullMQ)    │ │         │ │ Breaker  │
    └──────┬──────┘ └─────────┘ └────┬─────┘
           │                         │
           ▼                         ▼
    ┌─────────────┐          ┌──────────────┐
    │ max 3 tries │          │ mark OPEN,   │
    │ → DLQ       │          │ cool down    │
    └─────────────┘          └──────────────┘
```

### State Definitions

```
State = {
  provider: string
  attempt: number      // 0–2 (BullMQ provides 3 total)
  error: ErrorType
  state: 'executing' | 'retrying' | 'blocked' | 'dead'
}
```

### Error Classification

```
ErrorType = 'retryable' | 'fatal' | 'auth_blocked' | 'timeout'

retryable:   network flake, transient 5xx, rate limit
fatal:       invalid input, bad model, assertion error
auth_blocked: insufficient balance, quota exceeded, 401/403
timeout:     >30s response
```

### Transitions

```
executing + success        → done
executing + retryable      → retrying (attempt++)
executing + fatal          → dead (→ DLQ)
executing + auth_blocked   → blocked (→ circuit breaker OPEN)
executing + timeout        → retrying (attempt++)
retrying + attempt < 3     → executing (with backoff)
retrying + attempt >= 3    → dead (→ DLQ)
blocked + cooldown expired → executing (circuit HALF_OPEN)
blocked + cooldown active  → dead (→ DLQ)
```

---

## Fallback Provider Selection (Phase 1D)

### Before (Phase 1C):
```
pickFallbackProvider(signal) → returns first non-saturated provider from fallback_chain
```

### After (Phase 1D):
```
FallbackPolicy.next(signal, context) → {
  provider: string      // next provider to try
  reason: string        // why this provider
  confidence: number    // adjusted confidence for this attempt
  is_terminal: boolean  // true if no more providers (end of chain)
}
```

### Implementation

```typescript
class FallbackPolicy {
  next(signal: PolicySignal, context: PolicyContext): FallbackDecision {
    const chain = signal.meta.fallback_chain
    const tried = context.retry_count

    if (tried >= chain.length) {
      // End of chain → terminal
      return {
        provider: 'mock',
        reason: 'Fallback chain exhausted',
        confidence: 0.2,
        is_terminal: true,
      }
    }

    const nextProvider = chain[tried]
    return {
      provider: nextProvider,
      reason: `Fallback: ${tried + 1}/${chain.length}`,
      confidence: Math.max(0.2, signal.confidence - tried * 0.15),
      is_terminal: false,
    }
  }
}
```

---

## Integration Points

| Component | Current | Phase 1D Change |
|-----------|---------|-----------------|
| `policy-adapter.ts` — `pickFallbackProvider()` | Inline heuristic | Replace with `FallbackPolicy.next()` |
| `fallback-policy.ts` — `getFallbackDecision()` | Uses `policyAdapter.evaluate()` | Use `FallbackPolicy.next()` for provider selection |
| `worker-runtime.ts` — `callProvider()` | Throws to BullMQ, no fallback chain consumption | Call `FallbackPolicy.next()` before throw |
| `queue-manager.ts` — BullMQ | `attempts: 3`, exponential backoff | No change (platform retry) |
| `circuit-breaker.ts` | HEALTHY → DEGRADED → OPEN → HALF_OPEN | Add phase-1D compatibility mapping |

---

## File Changes

```
NEW  src/core/policy-adapter/fallback-state-machine.ts   — FallbackPolicy class + ErrorType enum
MOD  src/core/policy-adapter/fallback-policy.ts           — Replace inline fallback with state machine
MOD  src/core/policy-adapter/policy-adapter.ts            — Replace pickFallbackProvider with FallbackPolicy
MOD  src/core/policy-adapter/index.ts                     — Export FallbackPolicy
DOC  docs/runtime/phase1d-fallback-state-machine.md       — This file
```
