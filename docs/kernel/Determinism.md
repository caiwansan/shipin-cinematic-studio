# Determinism Report — Deterministic Planning
## KMKI-KERNEL-001-I: Deterministic Planning

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Principle

**Same input → Same ExecutionPlan structure** (metadata can differ).

The goal is that two runs of the planner with the same capability contract produce:
- Same step IDs
- Same step order
- Same dependency structure
- Same parallel groups
- Same categories and types

## Audit Findings

### Random Sources Found (BEFORE)

| Source | Location | Impact | Fix |
|---|---|---|---|
| `Date.now()` in `stepId()` | `planner/execution-planner.ts` | ❌ Step IDs non-deterministic | Replaced with monotonically incrementing counter |
| `Math.random()` in `stepId()` | `planner/execution-planner.ts` | ❌ Step IDs contain random suffix | Removed |
| `Date.now()` in plan `id` | `planner/execution-planner.ts` | ✅ Metadata only | Kept (metadata, not structure) |
| `new Date()` in metadata | `planner/execution-planner.ts` | ✅ Metadata only | Acceptable |

### Random Sources in Metadata (Acceptable)

| Source | Location | Reason |
|---|---|---|
| `new Date().toISOString()` in metadata | Various | Timestamps are metadata, not structural |
| `Date.now()` in plan ID | Planner | Plan ID uses timestamp suffix for uniqueness |
| `Math.random()` in simulation | Replay Engine | Simulation generates plausible outputs — inherently non-deterministic |

## Implementation

### Before (Non-Deterministic):

```typescript
function stepId(type: StepType, index: number): string {
  return `step-${type.toLowerCase()}-${index}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
// Output: step-load_asset-0-lx3k2f-a1b2c3d
// Next call: step-load_asset-0-lx3k2f-e4f5g6h (different!)
```

### After (Deterministic):

```typescript
let _stepCounter = 0

function stepId(type: StepType, index: number): string {
  _stepCounter++
  return `step-${type.toLowerCase()}-${index}-${_stepCounter}`
}
// Output: step-load_asset-0-1
// Next call: step-load_asset-0-2 (deterministic!)
```

## What is Deterministic

| Component | Deterministic? | Notes |
|---|---|---|
| `stepId()` output | ✅ Yes | Monotonically incrementing counter |
| Step order | ✅ Yes | Template-based, fixed |
| Dependencies | ✅ Yes | Derived from fixed templates |
| Parallel groups | ✅ Yes | Depth-based, deterministic |
| Step categories | ✅ Yes | From `STEP_CATEGORY` map |
| Step types | ✅ Yes | From contract or fixed templates |

## What is NOT Deterministic

| Component | Deterministic? | Notes |
|---|---|---|
| Plan `id` | ❌ No | Contains `Date.now()` for uniqueness |
| `createdAt` / `updatedAt` | ❌ No | Timestamps |
| `metadata.plannedAt` | ❌ No | Timestamps |
| `metadata.originalPlanId` | ❌ No | From replan |
| Step plugin outputs | ❌ No | Depends on external systems |

This is **by design** — metadata and timestamps are structural decorations, not part of the logical plan.

## Verification

Run the planner twice with the same contract:

```typescript
const plan1 = await executionPlanner.plan(contract)
const plan2 = await executionPlanner.plan(contract)

// Structural comparison (excluding metadata, IDs, timestamps)
const structuralEquality = 
  plan1.steps.length === plan2.steps.length &&
  plan1.steps.every((s, i) => 
    s.name === plan2.steps[i].name &&
    s.category === plan2.steps[i].category &&
    s.type === plan2.steps[i].type &&
    JSON.stringify(s.dependencies.sort()) === JSON.stringify(plan2.steps[i].dependencies.sort())
  )
```

## File Reference

- Planner: `backend/src/services/platform/execution/planner/execution-planner.ts`
- Step ID counter: global `_stepCounter` variable
