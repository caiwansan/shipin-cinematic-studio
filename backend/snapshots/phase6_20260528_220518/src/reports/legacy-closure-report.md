# 🧭 Legacy Closure Report

**Generated:** 2026-05-24T14:55:00.429Z
**Source root:** /root/shipin-cinematic-studio/backend/src

## 1. Graph State

| Metric | Value |
|--------|-------|
| Total TS files | 717 |
| Static graph size | 717 |
| Execution graph size | 557 |
| Unreachable nodes | 160 |

## 2. Legacy Classification

| Class | Count | Interpretation |
|-------|-------|----------------|
| **L0 — Dead Code** | 101 | No imports, no execution path → DELETE |
| **L1 — Isolated** | 59 | Static ref only, not runtime → DELETE |
| **L2 — Shadow Path** | 0 | Execution reachable via legacy branch → ASSERT |
| **L3 — Coupled Legacy** | 9 | Runtime-coupled legacy → REFACTOR |
| **Active (unclassified)** | 548 | In execution graph, no legacy markers |

## 3. Execution Violations

9 violations found:

| File | Class | Action | Reason |
|------|-------|--------|--------|
| `core/bridge/legacy-provider-bridge.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `core/bridge/phase1/shadow-executor.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `core/policy-adapter/fallback-state-machine.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `core/provider-registry/fallback-resolver.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `director-v2/norm/fallback-policy.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `director-v2/runtime/shadow-ui-router.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `routes/shadow.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |
| `services/ai-router.service.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + type drift |
| `services/shadow-execution.service.ts` | L3_COUPLED | REFACTOR | Reachable in execution graph + legacy naming |

## 4. Type Drift

2 type drift sources:

- `closure/closure-engine.ts`
- `services/ai-router.service.ts`

## 5. Closure Score

**CLOSURE_SCORE: 96/100**

✅ **Execution graph is closed.** Legacy exists in static graph only.