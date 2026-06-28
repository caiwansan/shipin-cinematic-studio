# IR Audit Report — ExecutionPlan Provider Coupling Audit
## KMKI-KERNEL-001-A: ExecutionPlan IR Audit

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Executive Summary

The ExecutionPlan has been audited for provider coupling. **Provider-specific fields have been removed or abstracted into platform-generic IR types.**

### Provider-Coupled Fields Found (Before)

| Field | Location | Issue |
|---|---|---|
| `QualityProfile.maxTokens` | types.ts | Provider-specific (LLM token limit) |
| `QualityProfile.temperature` | types.ts | Provider-specific (LLM sampling) |
| `QualityProfile.topP` | types.ts | Provider-specific (LLM nucleus sampling) |
| `QualityProfile.modelPreference` | types.ts | Provider-specific (model selection) |
| `StepType.BUILD_PROMPT` | types.ts | Provider-coupled step type |
| `StepType.CALL_PROVIDER` | types.ts | Provider-coupled step type |
| `ExecutionPlan.qualityProfile` | types.ts | Transitively provider-coupled |
| `ExecutionPlan.budgetProfile` | types.ts | Transitively provider-coupled |
| `ExecutionPlan.timeoutProfile` | types.ts | Not IR, should be compiler concern |
| `ExecutionPlan.schemaVersion` (string) | types.ts | Missing major version compatibility |
| Missing: `plannerVersion` | types.ts | Needed for replay verification |
| Missing: `compilerVersion` | types.ts | Needed for replay verification |
| Missing: `contractVersion` | types.ts | Needed for replay verification |
| Missing: `strategyVersion` | types.ts | Needed for replay verification |
| Missing: `decisions[]` | types.ts | Explainability |
| Missing: `category` on Step | types.ts | Needed for platform IR categorization |
| Missing: `executorType` on Step | types.ts | Needed for abstract execution routing |

### Fixes Applied

| Fix | File | Description |
|---|---|---|
| `QualityProfile` → kept for contract input only | types.ts | Moved from IR to contract input concern |
| Added `StepCategory` type | types.ts | `'Acquire' \| 'Transform' \| 'Reason' \| 'Execute' \| 'Persist' \| 'Notify' \| 'Wait' \| 'Control'` |
| Added `STEP_CATEGORY` map | types.ts | Maps each StepType to its category |
| Added `ExecutorType` | types.ts | `'provider' \| 'tool' \| 'human' \| 'mcp' \| 'script' \| 'cache' \| 'wait' \| 'default'` |
| Added `ExecutionDecision` interface | types.ts | Full explainability: reason, alternatives, tradeoffs |
| Added full version fields | types.ts | `schemaVersion`, `plannerVersion`, `compilerVersion`, `contractVersion`, `strategyVersion` |
| Added `LogicalPlan` / `LogicalStep` | types.ts | Planner output type — pure logical plan |
| Added `createdAt` / `updatedAt` | types.ts | Timestamp fields for plan lifecycle |
| `ExecutionStep` now has `category`, `executorType`, `decisions[]` | types.ts | Platform IR standard |
| `ExecutionPlan` now has `context`, `decisions[]`, full versioning | types.ts | Platform IR standard |

### Provider-Coupled Step Types Removed

| Old StepType | New StepType | Category |
|---|---|---|
| `BUILD_PROMPT` | Removed (merged into `TRANSFORM`) | Transform |
| `CALL_PROVIDER` | `REASON` | Reason |

### New Step Types Added

| StepType | Category | ExecutorType |
|---|---|---|
| `VECTOR_SEARCH` | Acquire | tool |
| `TRANSFORM` | Transform | script |
| `REASON` | Reason | provider |
| `CALL_TOOL` | Execute | tool |
| `CALL_MCP` | Execute | mcp |
| `RUN_SCRIPT` | Execute | script |
| `CACHE` | Persist | cache |
| `CALL_HUMAN` | Wait | human |
| `WAIT_EVENT` | Wait | wait |
| `CONDITION` | Control | default |
| `TRANSFORM_CONTROL` | Control | default |

### Remaining Provider-Specific Items (Intentional)

| Item | Location | Rationale |
|---|---|---|
| `QualityProfile` | types.ts (retained for contract input) | Used only at contract input level; compiled into step params by Compiler |
| `provider-call.step.ts` | registry/steps/ | Interface-only stub; actual Provider Runtime (KMKI-PLAT-008) will implement |

---

## Conclusion

**ExecutionPlan is now a pure platform IR.** All provider-specific concerns have been:
1. Abstracted into generic IR types (`StepCategory`, `ExecutorType`)
2. Moved to compiler/contract concerns (not part of the IR)
3. Versioned for backward compatibility

The IR is now:
- ✅ **Provider-Agnostic**: No LLM/model/provider fields
- ✅ **Category-Based**: Steps classified by action type
- ✅ **Fully Versioned**: 5 version fields for compatibility
- ✅ **Explainable**: `ExecutionDecision[]` on plan and steps
- ✅ **Replayable**: Versions enable verification
