# TD-001: Context Drift

- Status: Closed
- Severity: P0
- Created: 2025-06-28
- Resolved: 2025-06-28
- ADR: ADR-003
- Impact: Multiple Runtimes defined private Context interfaces instead of using PlatformContext, causing fragmented request metadata and inconsistent observability.
- Fix Plan:
  1. Confirm PlatformContext has all required fields
  2. Audit all Runtime for private Context definitions
  3. Replace all method signatures with `(ctx: PlatformContext, ...args)`
  4. Update API controllers to create PlatformContext at entry
  5. Update Event and Error models to carry Context

## Description
Various services defined their own context interfaces (ScannerContext, ExecutionContext, DecisionContext, etc.) instead of using the PlatformContext from `platform/context/`. This caused traceId/requestId to be lost across service boundaries.

## Root Cause
Legacy code evolved independently before the PlatformContext specification was finalized. Services were not refactored when PlatformContext was introduced.

## Resolution
- All Runtime method signatures now accept `(ctx: PlatformContext, ...args)`
- All private Context interface definitions remain in non-Runtime services (image pipeline, scanner) but are scoped to their module
- PlatformContext includes all required fields: traceId, requestId, tenantId, workspaceId, projectId, goalId, workflowId, taskId, capabilityId, providerId, userId, locale, permissions, metadata
- API route handlers create PlatformContext at entry
- Event types carry `context?: PlatformContext`
- Error types carry `context?: PlatformContext`
