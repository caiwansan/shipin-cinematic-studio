# DATA MODEL FREEZE — Phase 0

**Date:** 2026-07-18  
**Status:** ⛔ FROZEN until Phase 1 (Tenant + Project Center) completion

## Rule

**No GEO data model modifications until further notice:**

- ❌ Do not add new GEO tables (`GEOProject`, `GEOEntity`, `GEOClaim`, etc.)
- ❌ Do not add new columns to existing GEO tables
- ❌ Do not extend Prisma schema with GEO-related models
- ❌ Do not create new Claim/Evidence/Knowledge entities or storage

## Rationale

Phase 0 audit (GEO-INTEGRATION-AUDIT-001) revealed that:

1. **Tenant**: GEO tables use `userId` at most. Platform `Tenant` model exists but GEO does not use it. Adding data now means expensive migration later.
2. **Project Center**: GEO has its own `GEOProject` table instead of using platform `Project` with `type=geo`.
3. **Every new table/column** added during freeze period will require a `tenantId` migration in Phase 1.

## Scope

| Allowed | Not Allowed |
|---------|-------------|
| Integration (auth, routing, cleanup) | New Prisma models |
| Configuration changes | New GEO tables |
| Legacy code removal | New GEO fields/columns |
| Frontend auth page meta | New data entities |
| Existing data reads | New DB migrations with GEO changes |

## Verification

```bash
# Any new GEO model since freeze date?
git diff --name-only | grep "prisma/schema.prisma"
```

## Lift

This freeze is lifted when Phase 1 is complete:
- ✅ `GEOProject` has `tenantId` linked to `Tenant` model
- ✅ GEO sub-tables have `userId` or `tenantId`
- ✅ Project Center unified (`Project` + `type=geo` + optional `GeoProjectProfile`)
