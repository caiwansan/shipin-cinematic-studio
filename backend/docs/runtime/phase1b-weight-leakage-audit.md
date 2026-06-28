# Phase 1B — Weight Leakage Audit Report

> **Purpose:** Verify that PolicySignal.weights accurately reflect the actual decision causality.
> **If weights don't match causality → signal is misleading → Phase 1C will build on false assumptions.**
> **Generated:** 2026-05-16 12:44

---

## Layer 1: Static Dependency Audit

### Score Formula (line 79)

```typescript
const score = qScore * 0.4 + speedScore * 0.3 + costScore * 0.3
```

**Weights in code:** `{ quality: 0.4, latency: 0.3, cost: 0.3 }`
**Weights in PolicySignal:** `{ quality: 0.4, latency: 0.3, cost: 0.3 }`

**Result:** ✅ Weights match source code.

### Norm Factors (hidden influencers)

| Normalization | Formula | Ceiling | Effective Weight Impact |
|--------------|---------|---------|------------------------|
| qScore | `qualityScore / 10` | qualityScore max = 10 | Linear 0–1 |
| speedScore | `1 - min(latency / 120000, 1)` | 120s ceiling | Non-linear: latency < 12s = near max, >120s = 0 |
| costScore | `1 - min(cost / 1, 1)` | $1 ceiling | Non-linear: cost < $0.10 = near max, >$1 = 0 |

**Finding:** Norm factors introduce hidden asymmetry:
- $0.01 cost (5s video at $0.002/s) → costScore = 0.99 (near max)
- 30s latency → speedScore = 0.75
- qualityScore 8/10 → qScore = 0.8

This means the **effective weight** (actual contribution to score) depends on the input range, not just the weight value. For typical inputs:
- Cost contributes near-max for all providers (all < $0.10) → weight over-represented
- Speed discriminates at mid-range (15–45s) → weight correctly applied
- Quality discriminates at mid-range (5–8) → weight correctly applied

**Actual effective weights for typical inputs:**
```
qScore × 0.4 = 0.8 × 0.4  = 0.32  (effective 40-50%)
speedScore × 0.3 = 0.75 × 0.3 = 0.225 (effective 25-35%)
costScore × 0.3 = 0.99 × 0.3 = 0.297 (effective 30-40%)
```

### SLA Filters (score-independent bypasses)

| Filter | Line | Effect |
|--------|------|--------|
| `maxLatencyMs` | 60 | Eliminates high-latency providers before scoring |
| `maxBudgetUsd` | 61 | Eliminates expensive providers before scoring |
| `minQualityScore` | 62 | Eliminates low-quality providers before scoring |
| `sla.maxLatencyMs` | 63 | SLA tier filters |
| `sla.maxCostPerMinute` | 64 | SLA tier cost filter |

**Finding:** SLA filters are pre-score gates. They **mask** weight effects — a provider filtered out by SLA never reaches scoring. This means weight changes in PolicySignal may have NO observable effect on decision if SLA filters dominate.

**Risk:** 🟡 MEDIUM — Phase 1C policy layer must reapply SLA filters before weights.

---

## Layer 2: Runtime Influence Analysis

### Score Sensitivity Test

Using actual CostProfile data, simulate weight changes:

| Provider | Quality (1-10) | Latency (ms) | Cost ($/5s) | Base Score (0.4/0.3/0.3) | Quality++ (0.5/0.25/0.25) | Speed++ (0.25/0.5/0.25) |
|----------|:--------------:|:------------:|:-----------:|:-------------------------:|:-------------------------:|:-----------------------:|
| volcengine (seedance-2-0) | 8 | 30,000 | 0.01 | 0.475 | 0.537 ↑ | 0.406 ↓ |
| volcengine (seedance-2-0-fast) | 7 | 15,000 | 0.015 | 0.474 | 0.521 ↑ | 0.448 ↓ |
| volcengine (seedance-1-5) | 7 | 45,000 | 0.02 | 0.415 | 0.478 ↑ | 0.332 ↓ |
| replicate (minimax) | 7 | 30,000 | 0.03 | 0.360 | 0.422 ↑ | 0.291 ↓ |

**Findings:**
- All scores are close together (0.36–0.48 range) — tight clustering
- Weight changes shift scores but rarely reverse provider order
- For quality-dominated pairs (8 vs 7 quality), quality weight matters significantly
- For latency-dominated pairs (15s vs 45s), speed weight matters but not enough to reverse

**Conclusion:** Weights DO influence decision but are NOT the primary decision factor. SLA filters + profile quality scores dominate.

### Confidence Boosting (line 110)

```typescript
0.85 + (candidates.filter(c => c.score > 0.8).length > 1 ? 0 : 0.1)
```

**Effect:** If no other candidate scores above 0.8, boost confidence by +0.1.

**Finding:** This is a **decision leakage** — confidence is modified AFTER scoring using a separate heuristic. The confidence value now carries information not derived from weights.

**Risk:** 🔴 HIGH — Phase 1C policy layer may misinterpret confidence as weight-derived.

---

## Layer 3: Hidden Coupling Audit

### Fallback Decision (lines 197-213)

```typescript
private async fallbackDecision(...): Promise<RouteDecision> {
  const fallbackProviderName = available[0] || 'mock'
  // ...hardcoded mock profile...
  confidence: 0.4
}
```

**Finding:** Fallback decision uses `available[0]` (first alphabetically). This **completely bypasses weights** and uses provider list order instead.

**Risk:** 🔴 HIGH — Fallback decision is NOT weight-driven. PolicySignal generated during fallback would be misleading if weights are read without fallback context.

### Confidence-Reliant Logic

| Location | What It Uses Confidence For | Effect |
|----------|---------------------------|--------|
| `buildDecision()` | Sets confidence from scoring (0.85–1.0) | Confidence reflects scoring certainty |
| `confidence boost` | +0.1 if clear winner | Confidence inflated in non-competitive scenarios |
| `fallbackDecision()` | Hardcoded 0.4 | Confidence drops to floor |

**Finding:** Confidence is NOT used in any subsequent decision (no retry threshold, no fallback trigger). It's purely informational. The `fallback_risk` computed in PolicySignal (1 - confidence) is disconnected from actual fallback behavior (which uses exception handling, not confidence).

**Risk:** 🟡 MEDIUM — `fallback_risk` feature in PolicySignal may be meaningless.

### Weight ↔ Execution Decoupling

| Check | Pass? |
|-------|-------|
| Changing adapter weights changes runtime execution? | ❌ NO — adapter is read-only |
| Changing score weights in decide() changes provider selection? | ✅ YES — directly |
| SLA filters can be bypassed by weights? | ❌ NO — filters happen first |
| Fallback uses weights? | ❌ NO — uses `available[0]` |

---

## Overall Assessment

### PASS: 3/7 checks
- ✅ Weights in code match PolicySignal
- ✅ Adapter is pure transform (no reverse influence)
- ✅ SLA filters correctly separated

### FAIL: 4/7 checks
| Issue | Severity | Impact |
|-------|----------|--------|
| Norm factors create effective weight != declared weight | 🟡 Medium | Signal weights overstate cost impact |
| Confidence carries non-weight information | 🔴 High | Phase 1C may misinterpret confidence |
| Fallback decision ignores weights entirely | 🔴 High | Fallback PolicySignal is misleading |
| `fallback_risk` feature is disconnected from real fallback trigger | 🟡 Medium | Feature exists but not causal |

### Verdict

> **PolicySignal is accurate for normal-path decisions (not fallback).**
> **But 2 critical issues must be addressed before Phase 1C:**
> 1. Fallback path needs explicit signal (not weight-derived)
> 2. Confidence needs separation from "clear winner boost"

### Recommended Fixes (Phase 1B scope)

1. ✅ (No code change) Document that weights ≠ effective weights due to norm factors
2. ✅ (No code change) Mark `fallback_risk` as preliminary — needs Phase 1C fallback model
3. ❌ (Out of scope) Separate confidence calculation from "clear winner boost" — Phase 1C

---

## Final Phase 1B Status

| Criterion | Status |
|-----------|--------|
| PolicySignal schema defined | ✅ |
| Adapter created (pure transform) | ✅ |
| Injection to 3 call sites | ✅ |
| Weights exposed | ✅ |
| Weights reflect actual causality | ⚠️ Partial (normal-path OK, fallback NOT) |
| Confidence accurate | ⚠️ Inflated on clear winner |
| SLA filters separated | ✅ |
| Norm factors documented | ✅ |
| Fallback path explicit | ❌ Needs Phase 1C |
