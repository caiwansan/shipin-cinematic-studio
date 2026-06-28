# Platform Intermediate Representation (Platform IR)
## ExecutionPlan IR Specification
### Version 2.0.0

| Document | Status |
|---|---|
| KMKI-KERNEL-001 | ✅ Final |
| Date | 2025-06-28 |

---

## Overview

The **Platform Intermediate Representation (Platform IR)** is the formal specification for execution plans in the Kunlun Mirror AI Platform. The `ExecutionPlan` is the **IR + ABI (Application Binary Interface)** of the platform — it is:

- **Provider-Agnostic**: No LLM/model/provider-specific fields
- **Fully Versioned**: 5 version fields for backward compatibility
- **Explainable**: Every decision records reasoning and tradeoffs
- **Replayable**: Plans can be replayed, dry-run, simulated, resumed
- **Deterministic**: Same input → same plan structure
- **Serializable**: Plans can be stored, transmitted, and reconstructed

### Core Principles

1. `ExecutionPlan` = platform IR (provider agnostic)
2. Step classification by **action type** (Acquire/Transform/Reason/Execute/Persist/Notify/Wait/Control)
3. Planner = Logical Plan generation (structure only)
4. Compiler = Logical Plan → Executable Plan (parameter filling)
5. Engine = Stateless (state via Repository)
6. Full versioning for replay compatibility
7. Explainability via `ExecutionDecision` records

---

## Object Model

### ExecutionPlan

```typescript
interface ExecutionPlan {
  // Identity
  id: string
  capabilityId: string
  version: string

  // Version fields
  schemaVersion: string           // IR schema version (semver)
  plannerVersion: string          // Planner version
  compilerVersion: string         // Compiler version
  contractVersion: string         // Originating contract version
  strategyVersion: string         // Strategy version

  // Structure
  steps: ExecutionStep[]
  dependencies: Record<string, string[]>    // stepId → [dependencyStepIds]
  parallelGroups: string[][]                // groups of steps that can run in parallel

  // Policies
  retryPolicy: RetryPolicy
  rollbackPolicy: RollbackPolicy

  // Context
  context: PlatformContext

  // Explainability
  decisions: ExecutionDecision[]

  // Metadata
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

### ExecutionStep

```typescript
interface ExecutionStep {
  id: string
  name: string
  phase: number                          // Execution phase
  category: StepCategory                 // Abstract action type (IR)
  type: StepType                         // Plugin type for registry
  executorType: ExecutorType             // How to execute
  inputs: Record<string, any>            // Step inputs
  outputs: Record<string, string>        // stepId → outputKey routing
  dependencies: string[]                 // Dependency step IDs
  timeout: number                        // ms
  retry: RetryPolicy
  condition?: string                     // Condition expression
  decisions: ExecutionDecision[]         // Step-level explainability
  metadata: Record<string, any>
}
```

### ExecutionDecision

```typescript
interface ExecutionDecision {
  id: string
  stepId: string                    // '__plan__', '__compile__', '__strategy__', or stepId
  reason: string                    // Why this decision was made
  decision: string                  // What was decided
  alternatives: string[]            // All considered alternatives
  rejectedAlternatives: string[]    // Explicitly rejected
  chosenStrategy: string            // Chosen strategy name
  qualityTradeoff: string           // Quality impact
  costTradeoff: string              // Cost impact
  latencyTradeoff?: string          // Latency impact
  metadata?: Record<string, any>
}
```

### RetryPolicy

```typescript
interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier?: number
  maxBackoffMs?: number
  retryableErrors?: string[]
}
```

### RollbackPolicy

```typescript
interface RollbackPolicy {
  enabled: boolean
  rollbackSteps?: string[]
  compensation?: string
  timeout?: number
}
```

---

## Step Model

### StepCategory (Action Types)

Steps are classified by what they DO, not by which provider they use.

| Category | Description | Examples |
|---|---|---|
| `Acquire` | Fetch data from external sources | LOAD_ASSET, LOAD_SEMANTIC, VECTOR_SEARCH |
| `Transform` | Transform or enrich data | BUILD_CONTEXT, TRANSFORM |
| `Reason` | AI/LLM reasoning | REASON |
| `Execute` | Execute business logic | CALL_TOOL, CALL_MCP, RUN_SCRIPT |
| `Persist` | Store data | STORE_ASSET, UPDATE_GRAPH, CACHE |
| `Notify` | Emit events, notifications | EMIT_EVENT |
| `Wait` | Wait for external input | CALL_HUMAN, WAIT_EVENT |
| `Control` | Flow control | VALIDATE_OUTPUT, CONDITION |

### StepType (Registry Types)

Each `StepCategory` contains multiple `StepType` values. See [Step-Taxonomy.md](../kernel/Step-Taxonomy.md) for the complete catalog.

### ExecutorType (Execution Mechanism)

| ExecutorType | Description | Examples |
|---|---|---|
| `provider` | AI/LLM provider | REASON |
| `tool` | System/business tool | CALL_TOOL, VECTOR_SEARCH |
| `mcp` | Model Context Protocol | CALL_MCP |
| `human` | Human-in-the-loop | CALL_HUMAN |
| `script` | Script execution | RUN_SCRIPT, TRANSFORM |
| `cache` | Cache lookup/store | CACHE |
| `wait` | Wait for condition | WAIT_EVENT |
| `default` | Default executor | LOAD_ASSET, STORE_ASSET |

---

## Graph Model

### DAG Structure

The execution plan forms a **Directed Acyclic Graph (DAG)**:

- **Nodes**: `ExecutionStep` instances
- **Edges**: `dependencies[]` arrays (step A depends on step B → B must complete before A)
- **Entry Points**: Steps with no dependencies
- **Exit Points**: Steps that no other step depends on

### Dependencies

```typescript
dependencies: Record<string, string[]>
```

- Key: step ID
- Value: array of step IDs that must complete before this step

### ParallelGroups

```typescript
parallelGroups: string[][]
```

- Steps in the same group can execute in **parallel**
- Steps in different groups execute **sequentially** (group 0 → group 1 → ...)
- Groups are computed from dependency depth

### Validation Rules

1. **No cycles**: The dependency graph must be acyclic
2. **All dependencies exist**: Each dependency references a valid step
3. **No self-references**: A step cannot depend on itself
4. **Parallel safety**: Steps in the same parallel group cannot depend on each other
5. **No isolated steps**: Every step should be reachable (warning)
6. **Unique IDs**: All step IDs must be unique

---

## Version Model

Five version fields ensure full replay compatibility:

| Field | Semver | Set By | Purpose |
|---|---|---|---|
| `schemaVersion` | MAJOR.MINOR.PATCH | Compiler | IR schema compatibility |
| `plannerVersion` | MAJOR.MINOR.PATCH | Planner | Planner compatibility |
| `compilerVersion` | MAJOR.MINOR.PATCH | Compiler | Compiler compatibility |
| `contractVersion` | MAJOR.MINOR.PATCH | Planner | Source contract version |
| `strategyVersion` | MAJOR.MINOR.PATCH | Compiler | Strategy config version |

### Compatibility Rules

- **MAJOR must match** for replay compatibility
- MINOR and PATCH are forward-compatible
- Schema validation checks MAJOR version match at runtime

---

## Explain Model

### Decision Points

| Point | Source | Decision Records |
|---|---|---|
| Planning | Planner | Step pipeline structure, template selection |
| Compilation | Compiler | Strategy selection, tradeoff analysis |
| Strategy | Strategy implementation | Quality/cost/latency tradeoffs |
| Execution | Step plugins (future) | Retry decisions, tool selection |

### Tradeoff Dimensions

| Dimension | Description |
|---|---|
| `qualityTradeoff` | Impact on output quality (e.g., "High quality, 2x cost") |
| `costTradeoff` | Impact on execution cost (e.g., "2x baseline") |
| `latencyTradeoff` | Impact on execution time (e.g., "3x baseline") |

---

## Replay Model

### API

| Method | Description | Engine Invocation | Output Type |
|---|---|---|---|
| `replay(plan, ctx)` | Exact re-execution | Yes | `ExecutionResult` |
| `dryRun(plan, ctx)` | Mock execution, no provider calls | Yes (with flag) | `ExecutionResult` |
| `simulate(plan, ctx)` | Fast simulation with generated results | No | `SimulationResult` |
| `resume(plan, ctx, fromStepId)` | Resume from specific step | Yes (with flag) | `ExecutionResult` |

### Replay Guarantees

1. **Exact plan reuse**: The same `ExecutionPlan` object is used (same step IDs)
2. **Version validation**: MAJOR schema version must match runtime
3. **No engine modification**: All replay methods compose existing engine functions
4. **Stateless**: All replay methods are pure functions of (plan, ctx)

---

## ABI Compatibility

### Backward Compatibility Guarantees

| Change Type | Version Impact | Replay Compatible? |
|---|---|---|
| Add new `StepType` | MINOR | ✅ Yes |
| Add new `ExecutionDecision` field | MINOR | ✅ Yes |
| Fix bug in planner step ordering | PATCH | ✅ Yes |
| Add new version field | MINOR | ✅ Yes |
| Remove a `StepType` | MAJOR | ❌ No |
| Change `ExecutionStep` interface | MAJOR | ❌ No |
| Change dependency structure | MAJOR | ❌ No |

### Serialization

ExecutionPlan is JSON-serializable:
- All fields are primitive types or serializable objects
- `Date` fields are ISO strings in JSON
- `Map` instances are NOT used in the plan (use arrays/objects)
- `AbortController` is NOT part of the plan (runtime only)

---

## File Reference

- IR Types: `backend/src/services/platform/execution/types.ts`
- Planner: `backend/src/services/platform/execution/planner/execution-planner.ts`
- Compiler: `backend/src/services/platform/execution/compiler/execution-compiler.ts`
- Engine: `backend/src/services/platform/execution/engine/execution-engine.ts`
- Replay Engine: `backend/src/services/platform/execution/engine/replay-engine.ts`
- Graph Validator: `backend/src/services/platform/execution/validators/graph-validator.ts`
- Step Registry: `backend/src/services/platform/execution/registry/step-plugin-registry.ts`
