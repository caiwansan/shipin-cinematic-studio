# ADR-007: Runtime Lifecycle — 统一 Init/Load/Validate/Execute/Update/Dispose

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: runtime, lifecycle, convergence

## Context
ARCH-001 audit revealed that all four Runtimes (Asset, Semantic, Goal, Capability) had inconsistent lifecycle methods. Asset Runtime had `initialize()` and `version()` but no `validate()` or `dispose()`. Semantic Runtime had `initialize()` and `load()` but no `validate()` or `dispose()`. Goal Runtime had `initialize()` and `executeTask()` but no `validate()` or `dispose()`. Capability Runtime had `initialize()` and `validateContract()` but no `dispose()`.

## Decision
Create a unified `RuntimeLifecycle<TInput, TOutput>` interface in `platform/lifecycle/` with six phases:

1. **Init** — Initialize runtime, load config, establish connections
2. **Load** — Load input data by identifier
3. **Validate** — Validate input against domain rules
4. **Execute** — Execute main business logic
5. **Update** — Update domain entity by ID
6. **Dispose** — Cleanup, release resources

All four Runtimes implement this interface. Legacy methods are preserved for backward compatibility.

## Alternatives Considered
- **Keep existing lifecycle**: Would continue lifecycle drift
- **Three-phase lifecycle** (Init/Execute/Dispose): Would skip validation and update
- **Per-Runtime interfaces**: Defeats convergence purpose

## Consequences
- All Runtimes now have predictable method signatures
- New Runtimes must implement RuntimeLifecycle
- Legacy callers continue to work via preserved methods
- validate() provides early failure detection
- dispose() ensures proper resource cleanup

## Compliance
- `grep -rn "implements RuntimeLifecycle" backend/src/services/` should return 4 matches
- Each Runtime must implement all 6 methods
