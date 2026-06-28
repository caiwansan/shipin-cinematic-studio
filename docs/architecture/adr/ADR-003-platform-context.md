# ADR-003: Platform Context

## Decision
All Runtime method signatures must accept a `PlatformContext` parameter as the first argument:
```typescript
async someMethod(ctx: PlatformContext, ...args): Promise<Result>
```

PlatformContext carries cross-cutting metadata:
- Trace/request IDs for observability
- Tenant/workspace/project/user identity
- Permission claims
- Arbitrary metadata bag

## Context
The audit found no consistent context passing:
- **Asset Runtime**: methods take `(projectId, url, html)` with no context
- **Semantic Runtime**: methods take `(projectId, input)` with no context
- **Goal Runtime**: methods take `(data)`, `(id)`, etc. with no context
- **Capability Runtime**: `resolve(request)` includes optional context inside `request.context`, but it's inconsistent
- **Scanner Runtime**: uses `ScannerContext { url, projectId }` — closest to correct but non-standard

## Alternatives
1. **Express-style req object** — heavyweight; couples Runtime to HTTP
2. **Global singleton** — bad for testability and multi-tenancy
3. **No context** — loses traceability; makes observability impossible

## Consequences
- **Positive**: Every operation is traceable; multi-tenant ready; easy to add authz
- **Negative**: Method signatures become longer; existing callers must be updated
- **Migration**: Start with new methods; existing callers can pass `createContext()`
