# Technical Debt Log

## R1.5-001 / R1.5-002 — Credential Lifecycle Service

### 1. `globalThis` Bridge for CredentialLifecycleService

**Location**: `src/index.ts` (~line 1070) and `src/runtime/credential-lifecycle/recovery.route.ts`

**Problem**: Both the inline `/api/runtime/summary` route and the `/api/runtime/recovery` routes access the
`CredentialLifecycleService` instance via `(globalThis as any).__credentialLifecycleService`.

This was done because `registerRuntimeSummaryRoutes` (in `runtime-summary.route.ts`) and the recovery routes
need the service instance, but the module system doesn't have a clean central registry for singletons yet.

**Why it's here**: When `index.ts` initializes the service during `main()`, it stores it on globalThis so that
inline routes (registered later in the same function) can access it. This avoids having to restructure the
entire startup pipeline.

**Resolution**: Refactor to a proper module-level registration pattern (e.g., a service container or DI system)
so that `registerRuntimeSummaryRoutes` and `registerRecoveryRoutes` can import a provider rather than rely on
global mutation.

**Severity**: Low — only affects Credential Lifecycle routes. No security risk (globalThis is process-scoped).

---

### 2. tsx Export Compatibility Issue

**Location**: All dynamic imports in `src/index.ts` using `.then(m => m.default)`

**Problem**: TypeScript `export async function` / `export class` are compiled to `exports.default` by tsx/esbuild,
not `exports.NamedExport`. This means `const { registerRecoveryRoutes } = await import('./recovery.route.js')`
fails because the named export doesn't exist at runtime — it's wrapped in `.default`.

**Workaround**: Use `await import('./xxx.js').then(m => m.default)` for route registration, or access via
`m.namedExport` only after verifying the module shape.

**Affected**: The recovery route file (`recovery.route.ts`) and many others in the codebase.

**Impact**: Low — the workaround is well-understood and consistent across the codebase.

**Resolution**: Migrate to ESM-compatible build tooling or adjust the tsx configuration to preserve named exports.

---

### 3. ProviderStateService.refresh() — Lightweight Implementation

**Location**: `src/runtime/provider-state/provider-state.service.ts`

**Problem**: The `refresh()` method simply clears the in-memory cache. This means the next `get()` call will
re-fetch from the database. For truly ephemeral in-flight requests (if any), this could cause a brief window
of stale data.

**Why it's acceptable**: The cache TTL is only 30 seconds anyway, and recovery flows are rare admin operations.
The trade-off of full DB re-read vs complex cache invalidation is worth it.

**Resolution**: If real-time consistency becomes critical, implement a proper invalidation protocol (event bus,
DB trigger, or WebSocket push).

---

### 4. Recovery Route Uses Prisma Directly for Error Details

**Location**: `src/runtime/credential-lifecycle/recovery.route.ts`

**Problem**: `GET /api/runtime/recovery/errors` directly accesses `prisma.credentialRuntimeState.findMany()` to
get failure reasons for REQUIRES_RECONFIGURATION providers, rather than using a dedicated
`CredentialLifecycleService` method.

**Why it's here**: The CredentialLifecycleService doesn't expose a method to query by lifecycle status with
selected fields. Adding one would be cleaner but is deferred to avoid API churn.

**Resolution**: Add `getEntriesByStatus(status: CredentialLifecycleStatus)` to CredentialLifecycleService.

---

## Notes

- All TECH_DEBT entries are prioritized as Low unless otherwise noted.
- Refactoring blocks should be addressed in a dedicated Sprint before the next major release.
