# 🧭 Legacy Closure Report

**Generated:** 2026-05-24T14:54:30.048Z
**Source root:** /root/shipin-cinematic-studio/backend/src/closure

## 1. Graph State

| Metric | Value |
|--------|-------|
| Total TS files | 2 |
| Static graph size | 2 |
| Execution graph size | 0 |
| Unreachable nodes | 2 |

## 2. Legacy Classification

| Class | Count | Interpretation |
|-------|-------|----------------|
| **L0 — Dead Code** | 2 | No imports, no execution path → DELETE |
| **L1 — Isolated** | 0 | Static ref only, not runtime → DELETE |
| **L2 — Shadow Path** | 0 | Execution reachable via legacy branch → ASSERT |
| **L3 — Coupled Legacy** | 0 | Runtime-coupled legacy → REFACTOR |
| **Active (unclassified)** | 0 | In execution graph, no legacy markers |

## 3. Execution Violations

✅ **Zero execution violations** — execution graph is pure.

## 4. Type Drift

1 type drift sources:

- `closure-engine.ts`

## 5. Closure Score

**CLOSURE_SCORE: 96/100**

✅ **Execution graph is closed.** Legacy exists in static graph only.