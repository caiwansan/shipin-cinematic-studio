# Graph Validation Report — Execution DAG Validation
## KMKI-KERNEL-001-G: Execution Graph Validation

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Graph Validator

A dedicated `graphValidator` has been created at:
`backend/src/services/platform/execution/validators/graph-validator.ts`

## Validation Checks

### 1. Dependency Integrity

Ensures every dependency reference points to a valid, existing step.

| Check | Description | Error Message |
|---|---|---|
| Unknown dependency | Step depends on non-existent step ID | `Step "X" depends on unknown step "Y"` |
| Self-reference | Step depends on itself | `Step "X" has a self-referencing dependency` |
| Orphan dependencies map | Dependencies map references unknown step | `Dependencies map references unknown step "X"` |

### 2. Cycle Detection

Uses DFS with white/grey/black coloring to detect cycles.

| Check | Description | Error Message |
|---|---|---|
| Cycle detection | DFS detects back edges | `Dependency cycle detected: A → B → C → A` |

### 3. Dead Step Detection

Detects steps that are isolated (no dependencies, no dependents).

| Check | Description | Error Message |
|---|---|---|
| Isolated step | Step has no deps and no dependents (in multi-step plan) | `Step "X" is isolated: no dependencies and no dependents` |

### 4. Unreachable Step Detection

BFS from entry points to find unreachable steps; reverse BFS from exit points.

| Check | Description | Warning Message |
|---|---|---|
| Unreachable from entry | Can't be reached from root steps | `Steps potentially unreachable: X, Y` |

### 5. Parallel Safety Check

Ensures steps in the same parallel group don't have cross-dependencies.

| Check | Description | Error Message |
|---|---|---|
| Cross-dependency in group | Two steps in same group depend on each other | `Parallel safety violation: step "A" depends on "B" but both are in same parallel group` |

### 6. Step ID Uniqueness

Ensures all step IDs are unique within a plan.

| Check | Description | Error Message |
|---|---|---|
| Duplicate IDs | Two steps share the same ID | `Duplicate step id: "X"` |

## Validation Result Interface

```typescript
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  details?: Record<string, any>
}
```

## Usage

```typescript
import { graphValidator } from './validators/graph-validator.js'

const result = graphValidator.validate(plan)
if (!result.valid) {
  console.error('DAG validation failed:', result.errors)
}
```

## Error Severity

| Level | Meaning | Schema Version Impact |
|---|---|---|
| `errors[]` | Plan is invalid, cannot execute | MAJOR violation |
| `warnings[]` | Plan is valid but has issues | Recommend MINOR fix |

## Integration

The `graphValidator` is **not** automatically called during execution (to avoid breaking existing behavior). It is available for:
- Pre-execution validation (can be called by Runtime)
- CI/CD pipeline checks
- Development-time debugging
- The existing `executionValidator` handles basic DAG checks; `graphValidator` provides deeper analysis.

## File Reference

- Validator: `backend/src/services/platform/execution/validators/graph-validator.ts`
- Existing validator: `backend/src/services/platform/execution/validators/execution-validator.ts`
