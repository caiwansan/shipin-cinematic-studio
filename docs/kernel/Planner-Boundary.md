# Planner Boundary Report
## KMKI-KERNEL-001-C: Planner / Compiler Separation

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Separation Principle

```
Capability Contract → [Planner] → LogicalPlan → [Compiler] → ExecutionPlan
```

- **Planner**: Only generates logical structure (step order, dependencies, categories)
- **Compiler**: Fills in parameters (timeout, budget, strategy, executorType)

---

## Planner Responsibilities (BEFORE Audit)

| Responsibility | Correct? | Issue |
|---|---|---|
| Generate step order | ✅ | Correct |
| Set timeouts | ❌ | Compiler concern — planner shouldn't set step timeout=30000 |
| Set retry policies | ❌ | Compiler concern — planner shouldn't set step retry |
| Set inputs/outputs | ❌ | Partial — inputs should be logical references |
| Generate plan ID | ✅ | Correct |
| Use `Date.now()` in step IDs | ❌ | Non-deterministic, breaks deterministic planning |
| Use `Math.random()` in step IDs | ❌ | Non-deterministic, breaks deterministic planning |
| Store QualityProfile | ❌ | Not part of logical plan |

## Planner Responsibilities (AFTER Audit)

| Responsibility | Correct? | Description |
|---|---|---|
| Generate `LogicalPlan` | ✅ | Pure logical plan (step order + dependencies only) |
| Assign `StepCategory` | ✅ | Category by action type |
| Assign `StepType` | ✅ | Generic type, not provider-specific |
| Generate `ExecutionDecision[]` | ✅ | Explainability records |
| Build `parallelGroups` | ✅ | Dependency depth-based grouping |
| Build `dependencies map` | ✅ | Step dependency graph |
| Deterministic step IDs | ✅ | Monotonically incrementing counter, no random |
| Output `LogicalPlan` | ✅ | Contains only logical structure, no params |

## Planner Output: LogicalPlan

```typescript
export interface LogicalPlan {
  id: string
  capabilityId: string
  version: string
  plannerVersion: string      // For replay verification
  contractVersion: string     // Source contract version
  steps: LogicalStep[]        // Logical steps (no params)
  dependencies: Record<string, string[]>
  parallelGroups: string[][]
  decisions: ExecutionDecision[]
  metadata: Record<string, any>
  createdAt: Date
}

export interface LogicalStep {
  id: string
  name: string
  phase: number
  category: StepCategory      // Platform IR category
  type: StepType              // Step type (generic)
  dependencies: string[]      // Dependency step IDs
}
```

## What the Planner Does NOT Do

- ❌ Set timeouts
- ❌ Set retry policies
- ❌ Set executor types
- ❌ Set input/output values
- ❌ Set budget/quality profiles
- ❌ Call any provider
- ❌ Generate prompts or templates
- ❌ Use random or time-based step IDs

## File Reference

- Planner: `backend/src/services/platform/execution/planner/execution-planner.ts`
- Types: `backend/src/services/platform/execution/types.ts`
