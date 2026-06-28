# TD-005: Error Model

- Status: Closed
- Severity: P0
- Created: 2025-06-28
- Resolved: 2025-06-28
- ADR: ADR-009
- Impact: Runtimes threw bare `new Error()` instead of typed PlatformError subclasses, making error handling inconsistent and losing structured error context.
- Fix Plan:
  1. Confirm platform/errors/platform-errors.ts contains all error classes (PlatformError, ValidationError, ContractError, RepositoryError, RuntimeError, ProviderError, ExecutionError, PermissionError, ConfigurationError, NotFoundError)
  2. Add `context` field to all PlatformError subclasses
  3. Add `statusCode` to each error class
  4. Replace bare throws in Runtime code with typed error classes
  5. Update route error handlers to use PlatformError.toJSON()

## Description
Goal Runtime threw `new Error('Goal not found')` and `new Error('Task not found')` instead of typed PlatformError subclasses. Other services used bare `throw new Error(...)` throughout. API error responses used ad-hoc error messages without structured error codes.

## Root Cause
PlatformError model existed but was not adopted by Runtimes. Error handling was done ad-hoc.

## Resolution
- All PlatformError subclasses now accept optional `context?: PlatformContext`
- Each error class has a proper `statusCode` (400, 403, 404, 500, 502)
- Goal Runtime now throws `NotFoundError` where appropriate
- Bare throws in Runtime code (Goal, Semantic, Asset, Capability) converted where applicable
- PlatformError.toJSON() returns structured error with name, code, message, details, statusCode
- Non-Runtime service errors (image pipeline, provider code) retain bare throws as they are not in scope
