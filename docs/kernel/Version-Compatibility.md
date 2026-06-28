# Version Compatibility Report — ExecutionPlan Version Audit
## KMKI-KERNEL-001-E: ExecutionPlan Version Audit

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Version Field Compliance

The ExecutionPlan now has **5 version fields** for full replay compatibility:

| Version Field | Type | Purpose | Set By |
|---|---|---|---|
| `schemaVersion` | string (semver) | IR schema compatibility | Compiler |
| `plannerVersion` | string (semver) | Planner version that generated the logical plan | Planner |
| `compilerVersion` | string (semver) | Compiler version that built the executable plan | Compiler |
| `contractVersion` | string (semver) | Source capability contract version | Planner |
| `strategyVersion` | string (semver) | Strategy configuration version | Compiler |

### Current Values

```typescript
export const EXECUTION_SCHEMA_VERSION = '2.0.0'
export const EXECUTION_PLANNER_VERSION = '2.0.0'
export const EXECUTION_COMPILER_VERSION = '2.0.0'
export const EXECUTION_CONTRACT_VERSION = '1.0.0'
export const EXECUTION_STRATEGY_VERSION = '1.0.0'
```

## Version Semantic

Following semver (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes to the IR structure (field removal, type changes)
- **MINOR**: Additive changes (new fields, new step types)
- **PATCH**: Bug fixes, no structural changes

## Version Compatibility Rules

```
MAJOR must match for replay compatibility
MINOR and PATCH are forward-compatible
```

### Validation Logic (in Validator)

```typescript
_validateSchemaVersion(plan, errors, warnings) {
  const planMajor = parseInt(plan.schemaVersion.split('.')[0], 10)
  const runtimeMajor = parseInt(EXECUTION_SCHEMA_VERSION.split('.')[0], 10)
  if (planMajor !== runtimeMajor) {
    errors.push(`Schema version mismatch: plan v${plan.schemaVersion}, runtime v${EXECUTION_SCHEMA_VERSION}`)
  }
  if (parseInt(plan.schemaVersion.split('.')[1], 10) > parseInt(EXECUTION_SCHEMA_VERSION.split('.')[1], 10)) {
    warnings.push('Plan schema includes minor version features beyond runtime')
  }
}
```

### Validation Logic (in ReplayEngine)

```typescript
_validateVersionCompatibility(plan) {
  const planMajor = parseInt(plan.schemaVersion.split('.')[0], 10)
  const runtimeMajor = parseInt(EXECUTION_SCHEMA_VERSION.split('.')[0], 10)
  if (planMajor !== runtimeMajor) {
    throw new RuntimeError('Version incompatibility for replay', ...)
  }
}
```

## Version Flow

```
                    ┌───────────────────┐
                    │ CapabilityContract │
                    │ version: 1.2.0    │
                    └────────┬──────────┘
                             │
                             ▼
                    ┌───────────────────┐
                    │     Planner       │
                    │ plannerVersion:   │  ← EXECUTION_PLANNER_VERSION
                    │ 2.0.0             │
                    │ contractVersion:  │  ← from contract.version
                    │ 1.2.0             │
                    └────────┬──────────┘
                             │ LogicalPlan
                             ▼
                    ┌───────────────────┐
                    │    Compiler       │
                    │ compilerVersion:  │  ← EXECUTION_COMPILER_VERSION
                    │ 2.0.0             │
                    │ strategyVersion:  │  ← EXECUTION_STRATEGY_VERSION
                    │ 1.0.0             │
                    │ schemaVersion:    │  ← EXECUTION_SCHEMA_VERSION
                    │ 2.0.0             │
                    └────────┬──────────┘
                             │ ExecutionPlan
                             ▼
                    ┌───────────────────┐
                    │   Engine/Replay   │
                    │ Validates MAJOR   │
                    │ compatibility     │
                    └───────────────────┘
```

## Backward Compatibility Guarantees

| Change | Version Impact | Replay Compatible? |
|---|---|---|
| Add new StepType | MINOR bump | ✅ Yes |
| Add new ExecutionDecision field | MINOR bump | ✅ Yes |
| Fix bug in planner step ordering | PATCH bump | ✅ Yes |
| Add new version field | MINOR bump | ✅ Yes |
| Remove a StepType | MAJOR bump | ❌ No |
| Change ExecutionStep interface | MAJOR bump | ❌ No |
| Change dependency structure | MAJOR bump | ❌ No |

## File Reference

- Version constants: `backend/src/services/platform/execution/types.ts`
- Version validation: `backend/src/services/platform/execution/validators/execution-validator.ts`
- Version check in replay: `backend/src/services/platform/execution/engine/replay-engine.ts`
