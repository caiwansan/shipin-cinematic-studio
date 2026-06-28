# ADR-009: Platform Error Model — 统一错误层次结构 + 所有 throw 使用 PlatformError

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: errors, convergence

## Context
ARCH-001 audit revealed inconsistent error handling. Runtimes threw bare `new Error()` without error codes or context. API routes returned ad-hoc error responses. Error handling of the same condition (e.g., entity not found) differed across Runtimes.

## Decision
Standardize on `PlatformError` hierarchy in `platform/errors/`:

1. **PlatformError** base class with code, message, details, context, statusCode, toJSON()
2. **Error subclasses**: ValidationError (400), ContractError (400), RepositoryError (500), RuntimeError (500), ProviderError (502), ExecutionError (500), PermissionError (403), ConfigurationError (500), NotFoundError (404)
3. All Runtime code must throw PlatformError subclasses instead of bare Error
4. API route handlers use `PlatformError.toJSON()` for structured error responses
5. `ErrorCodes` constant maps all error codes for reference

## Alternatives Considered
- **Keep bare throws**: No structured error handling
- **Single PlatformError without subclasses**: Loses typed error handling
- **External library (e.g., Verror)**: Additional dependency; our hierarchy is sufficient

## Consequences
- Type-safe error handling: catch blocks can discriminate by error type
- API responses are structured: `{ name, code, message, details, statusCode }`
- Error context aids debugging
- statusCode maps directly to HTTP status codes
- Non-Runtime services (image pipeline, providers) may retain bare throws; documented exceptions

## Compliance
- `grep -rn "throw new Error(" backend/src/services/ --include="*.ts"` should return 0 in Runtime code
- All `catch` blocks should handle `PlatformError` specifically where possible
