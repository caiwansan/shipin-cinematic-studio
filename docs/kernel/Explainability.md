# Explainability Report — Explainable Execution
## KMKI-KERNEL-001-F: Explainable Execution

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Principle

Every execution decision should be explainable:
- What was decided
- Why it was decided
- What alternatives were considered
- What tradeoffs were accepted

## ExecutionDecision Interface

```typescript
export interface ExecutionDecision {
  id: string                    // Unique decision identifier
  stepId: string                // Step the decision applies to ('__plan__', '__compile__', '__strategy__', or actual stepId)
  reason: string                // Why this decision was made
  decision: string              // What was decided (the chosen value)
  alternatives: string[]        // All considered alternatives
  rejectedAlternatives: string[] // Alternatives explicitly rejected
  chosenStrategy: string        // Which strategy was chosen
  qualityTradeoff: string       // Quality impact description
  costTradeoff: string          // Cost impact description
  latencyTradeoff?: string      // Latency impact description
  metadata?: Record<string, any>
}
```

## Decision Points

### 1. Planner Decisions

Generated during planning. Records:
- Whether default or custom steps were used
- Step pipeline structure decisions
- Phase/category assignments

Example:
```typescript
{
  id: 'decision-planner-contract-123',
  stepId: '__plan__',
  reason: 'Plan structure derived from capability contract',
  decision: 'Default step pipeline',
  alternatives: ['Custom step pipeline'],
  rejectedAlternatives: [],
  chosenStrategy: 'Default template steps',
  qualityTradeoff: 'Steps follow category-based pipeline (Acquire → Transform → Reason → Control → Persist → Notify)',
  costTradeoff: 'Default pipeline uses minimal required steps',
}
```

### 2. Compiler Decisions

Generated during compilation. Records:
- Strategy selection
- Tradeoff analysis (quality vs cost vs latency)
- Runtime constraint application

Example:
```typescript
{
  id: 'decision-compiler-strategy-abc123',
  stepId: '__compile__',
  reason: 'Strategy selection for execution plan',
  decision: 'QualityFirst',
  alternatives: ['LatencyFirst', 'CostFirst', 'Balanced'],
  rejectedAlternatives: ['LatencyFirst', 'CostFirst'],
  chosenStrategy: 'QualityFirst',
  qualityTradeoff: 'High quality, 2x cost, 3x latency',
  costTradeoff: '2x baseline',
  latencyTradeoff: '3x baseline',
}
```

### 3. Strategy Decisions

Each `IExecutionStrategy` now returns `getDecisions()`:

| Strategy | Decision Content |
|---|---|
| `QualityFirst` | High quality, 2x cost, 3x latency |
| `LatencyFirst` | (TBD) |
| `CostFirst` | (TBD) |
| `Balanced` | (TBD) |

### 4. Step-level Decisions (Future)

Individual steps can record decisions during execution:
- Retry decisions (why retried, what backoff was applied)
- Condition evaluation results
- Tool selection decisions

---

## Data Flow

```
Planner ──→ decisions[] ──┐
                          ├──→ ExecutionPlan.decisions[] ──→ ExecutionResult.decisions[]
Compiler ──→ decisions[] ─┘
Strategy ──→ getDecisions() ──→ Compiler ──→ decisions[]
```

---

## Frontend: ExecutionExplorer Decision Display

Add to ExecutionExplorer component (planned):

```
┌─────────────────────────────────────────┐
│ 🔍 Execution Decisions                   │
├─────────────────────────────────────────┤
│                                         │
│  📋 Plan Structure                      │
│  Decision: Default step pipeline        │
│  Reason: Plan structure derived from    │
│          capability contract            │
│  Tradeoff: Quality-focused pipeline     │
│                                         │
│  ⚙️ Compilation Strategy                │
│  Decision: QualityFirst                 │
│  Reason: Strategy selection for         │
│          execution plan                 │
│  Alternatives considered:               │
│    ❌ LatencyFirst (too fast, low qual) │
│    ❌ CostFirst (cheap, low quality)    │
│    ✅ QualityFirst (high qual, 2x cost) │
│                                         │
│  📊 Tradeoff Summary                    │
│  Quality: ⭐⭐⭐⭐⭐                       │
│  Cost:    💰💰💰💰 (2x baseline)        │
│  Latency: ⏱️⏱️⏱️ (3x baseline)         │
└─────────────────────────────────────────┘
```

## File Reference

- `ExecutionDecision` interface: `backend/src/services/platform/execution/types.ts`
- Planner decisions: `backend/src/services/platform/execution/planner/execution-planner.ts`
- Compiler decisions: `backend/src/services/platform/execution/compiler/execution-compiler.ts`
- Strategy decisions: `backend/src/services/platform/execution/strategies/execution-strategy.interface.ts`
- Strategy implementation: `backend/src/services/platform/execution/strategies/quality-first.strategy.ts`
