# Replay Readiness Report — Replay Validation
## KMKI-KERNEL-001-H: Replay Validation

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Replay Engine

A dedicated `replayEngine` has been created at:
`backend/src/services/platform/execution/engine/replay-engine.ts`

## Replay API

### `replay(plan, ctx, options?)`

**Purpose**: Exact re-execution of a plan, reusing the identical `ExecutionPlan`.

**Behavior**:
- Uses the exact same `ExecutionPlan` (same step IDs, same params)
- Validates version compatibility (MAJOR version must match)
- Returns `ExecutionResult` identical to original (different timestamps, same structure)

**Use Cases**:
- Debugging: "Does this plan always behave the same way?"
- Audit: "Show me exactly what happened during execution"
- Verification: "Does this plan still work after a runtime update?"

```typescript
const result = await replayEngine.replay(plan, ctx, { logProgress: true })
```

### `dryRun(plan, ctx, options?)`

**Purpose**: Simulate execution without calling any provider or tool.

**Behavior**:
- Sets `metadata._dryRun = true` on the plan
- Runs through Engine but step plugins should return mock/simulated results
- Actual provider/tool calls are blocked (plugin-level)

**Use Cases**:
- Cost estimation
- Timing analysis
- "What if" scenarios

```typescript
const result = await replayEngine.dryRun(plan, ctx, { logProgress: true })
```

### `simulate(plan, ctx, options?)`

**Purpose**: Fast simulation with generated results (no Engine invocation).

**Behavior**:
- Does NOT call the Engine at all
- Topologically sorts steps and generates plausible outputs per category
- Returns `SimulationResult` with step-level simulated outputs

**Use Cases**:
- Quick "what if" analysis
- Development-time testing
- Performance estimation

```typescript
const result = await replayEngine.simulate(plan, ctx, { logProgress: true })
// Returns SimulationResult (not ExecutionResult)
// result.simulated === true
```

### `resume(plan, ctx, fromStepId, completedOutputs?, options?)`

**Purpose**: Continue execution from a specific step.

**Behavior**:
- Skips all steps before `fromStepId`
- Marks skipped steps with `_resumed: true`
- Executes from `fromStepId` onward

**Use Cases**:
- Recovery after partial failure
- Manual step-by-step debugging
- Resuming long-running workflows

```typescript
const result = await replayEngine.resume(plan, ctx, 'step-reason-3', completedOutputs, { logProgress: true })
```

## Decision: Why Replay is Separate from Engine

The replay engine is a **separate module** (not part of the Engine) because:

1. **Single Responsibility**: Engine's job is to execute; Replay's job is to orchestrate replay
2. **No Engine Modification**: Replay works by composing existing Engine functions
3. **Version Check**: Replay adds version compatibility validation
4. **Different Output Types**: `simulate()` returns `SimulationResult`, not `ExecutionResult`

## Dependency Chain

```
Replay Engine
├── replay()    ── uses executionEngine.execute()
├── dryRun()    ── uses executionEngine.execute() with _dryRun flag
├── simulate()  ── uses executionScheduler._topologicalSort() + own logic
└── resume()    ── uses executionEngine.execute() with _resumed plan
```

## File Reference

- Replay Engine: `backend/src/services/platform/execution/engine/replay-engine.ts`
- Engine (stateless): `backend/src/services/platform/execution/engine/execution-engine.ts`
- Types: `backend/src/services/platform/execution/types.ts`
