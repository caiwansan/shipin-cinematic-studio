# TD-003: Lifecycle Drift

- Status: Closed
- Severity: P0
- Created: 2025-06-28
- Resolved: 2025-06-28
- ADR: ADR-007
- Impact: Runtimes had inconsistent lifecycle methods. Some had initialize() but not validate/dispose. No shared interface existed.
- Fix Plan:
  1. Create platform/lifecycle/runtime-lifecycle.ts with RuntimeLifecycle<TInput, TOutput>
  2. Implement RuntimeLifecycle on each Runtime (Asset, Semantic, Goal, Capability)
  3. Add validate() implementation to all Runtimes
  4. Add dispose() implementation to all Runtimes

## Description
Before ARCH-002, there was no unified lifecycle interface. Each Runtime had its own initialization pattern, and methods like validate/dispose were missing entirely.

## Root Cause
Lifecycle management was ad-hoc. Runtimes evolved independently with different method signatures.

## Resolution
- Created `RuntimeLifecycle<TInput, TOutput>` with: init, load, validate, execute, update, dispose
- All 4 Runtimes implement this interface
- Each validate() has actual domain logic (checking existence, state validity)
- Each dispose() cleans up initialized state
- Legacy methods preserved for backward compatibility (initialize(), etc.)
