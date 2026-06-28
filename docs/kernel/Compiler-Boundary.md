# Compiler Boundary Report
## KMKI-KERNEL-001-C: Planner / Compiler Separation

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Separation Principle

```
Capability Contract → [Planner] → LogicalPlan → [Compiler] → ExecutionPlan
```

- **Planner**: Only generates logical structure
- **Compiler**: Fills in all executable parameters

---

## Compiler Responsibilities (BEFORE Audit)

| Responsibility | Correct? | Description |
|---|---|---|
| Call `executionPlanner.plan()` | ✅ | Correct — delegates planning to Planner |
| Apply quality profile | ✅ | Correct compiler concern |
| Apply budget profile | ✅ | Correct compiler concern |
| Apply timeout profile | ✅ | Correct compiler concern |
| Apply runtime constraints | ✅ | Correct compiler concern |
| Generate warnings | ✅ | Correct |
| Validate compilation | ✅ | Correct |

## Compiler Responsibilities (AFTER Audit)

| Responsibility | Correct? | Description |
|---|---|---|
| ↑ All of the above | ✅ | Kept as-is |
| Map `LogicalStep` → `ExecutionStep` | ✅ | Fills in `timeout`, `retry`, `executorType`, `inputs`, `outputs` |
| Apply default timeouts per step type | ✅ | Compiler maps `StepType` → default timeout values |
| Apply default retry policies per step type | ✅ | Compiler maps `StepType` → default retry values |
| Apply default executor types per step type | ✅ | Compiler maps `StepType` → `ExecutorType` |
| Fill version fields | ✅ | Sets `compilerVersion`, `strategyVersion` |
| Generate compiler decisions | ✅ | Explainability for strategy/tradeoff choices |
| Select execution strategy | ✅ | Compiler-level strategy decision |

## Compiler Output: ExecutionPlan

```typescript
export interface ExecutionPlan {
  id: string
  capabilityId: string
  version: string
  schemaVersion: string          // Set by compiler
  plannerVersion: string          // From LogicalPlan
  compilerVersion: string         // Set by compiler
  contractVersion: string         // From LogicalPlan
  strategyVersion: string         // Set by compiler
  steps: ExecutionStep[]          // Full params filled
  dependencies: Record<string, string[]>
  parallelGroups: string[][]
  retryPolicy: RetryPolicy
  rollbackPolicy: RollbackPolicy
  context: PlatformContext
  decisions: ExecutionDecision[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

## What the Compiler Does NOT Do

- ❌ Determine step order or dependencies (Planner concern)
- ❌ Determine step categories (Planner concern)
- ❌ Generate new steps not in the LogicalPlan
- ❌ Call any provider or tool
- ❌ Execute any step

## Default Parameter Mapping

The compiler maps each `StepType` to default parameters:

### Default Timeouts

| StepType | Default Timeout |
|---|---|
| `REASON` | 60000ms |
| `CALL_TOOL` | 30000ms |
| `CALL_MCP` | 30000ms |
| `CALL_HUMAN` | 300000ms |
| `WAIT_EVENT` | 3600000ms |
| `LOAD_ASSET` | 30000ms |
| `STORE_ASSET` | 30000ms |
| Others | 15000ms |

### Default Retry Policies

| StepType | maxAttempts | backoffMs |
|---|---|---|
| `REASON` | 3 | 1000 |
| `CALL_TOOL` | 2 | 500 |
| `LOAD_ASSET` | 2 | 500 |
| `STORE_ASSET` | 2 | 500 |
| Others | 1 | 500 |

### Default Executor Types

| StepType | ExecutorType |
|---|---|
| `REASON` | provider |
| `CALL_TOOL` | tool |
| `CALL_MCP` | mcp |
| `CALL_HUMAN` | human |
| `WAIT_EVENT` | wait |
| `RUN_SCRIPT` | script |
| `VECTOR_SEARCH` | tool |
| `CACHE` | cache |
| Others | default |

## File Reference

- Compiler: `backend/src/services/platform/execution/compiler/execution-compiler.ts`
- Types: `backend/src/services/platform/execution/types.ts`
