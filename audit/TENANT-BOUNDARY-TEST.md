# TENANT-BOUNDARY-TEST Report

**Date:** 2025-07-17  
**Tester:** 昆仑镜租户隔离测试员 (Subagent)  
**Scope:** `/api/resource/*` — All platform resource routes  
**Files Under Test:** 8 route files

---

## Files Analyzed

| File | Routes | Uses `resolveTenantId` | Tenant-Scoped |
|---|---|---|---|
| `contract.route.ts` | 7 | No | No — ResourceContract has no `tenantId` (global config) |
| `cost.route.ts` | 3 | Yes (2/3) | Yes — estimate is global by resourceId |
| `credential.route.ts` | 4 | Yes (4/4) | Yes — ResourceCredential.tenantId |
| `health.route.ts` | 3 | No | No — ResourceHealth has no `tenantId` (global) |
| `matrix.route.ts` | 7 | No | No — ResourceCapabilityMatrix has no `tenantId` (global) |
| `resolver.route.ts` | 3 | Yes (2/3) | Yes — strategies list is global |
| `resource-main.route.ts` | 4 | No | No — catalog items are global |
| `usage.route.ts` | 3 | Yes (3/3) | Yes — ResourceUsage.tenantId |

---

## Test Results

### Check A: Auth Coverage (preHandler: [fastify.authenticate])

**Status: ✅ PASS**

Every single route across all 8 files includes `preHandler: [fastify.authenticate]`. No unauthenticated endpoints found.

| File | Routes | Auth Coverage |
|---|---|---|
| contract.route.ts | 7/7 | ✅ |
| cost.route.ts | 3/3 | ✅ |
| credential.route.ts | 4/4 | ✅ |
| health.route.ts | 3/3 | ✅ |
| matrix.route.ts | 7/7 | ✅ |
| resolver.route.ts | 3/3 | ✅ |
| resource-main.route.ts | 4/4 | ✅ |
| usage.route.ts | 3/3 | ✅ |

---

### Check B: TenantId Source (Only from JWT, never from client input)

**Status: ✅ PASS**

All 4 `resolveTenantId()` implementations (in cost, credential, resolver, usage) exclusively read from:

1. `request.user.tenantId` — from JWT token (primary)
2. Database fallback: `prisma.tenant.findFirst(...)` by `request.user.id` (secondary)

**Zero instances** of tenantId read from:
- `request.body.tenantId`
- `request.query.tenantId`
- `request.params.tenantId`
- `request.headers['x-tenant-id']`
- Any other client-controlled source

No `resolveTenantId` reads from `request.body`, `request.query`, or `request.params`. All implementations are consistent across all files.

---

### Check C: Cross-tenant Attack Surface

**Status: ❌ FAIL → ✅ PASS (after fix)**

#### Vulnerabilities Found

| # | Endpoint | Severity | Issue |
|---|---|---|---|
| 1 | `DELETE /api/resource/credential/:id` | 🔴 **HIGH** | No ownership check — any authenticated user can delete any credential by ID |
| 2 | `POST /api/resource/credential/:id/rotate` | 🔴 **HIGH** | No ownership check — any authenticated user can rotate any credential's API key by ID |

#### Non-Issues (Justified)

| Endpoint | Reason |
|---|---|
| GET /api/resource/contract* | ResourceContract has no `tenantId` — global resource catalog, correct |
| DELETE /api/resource/contract/:id | Same — global config, not tenant-scoped |
| GET/POST /api/resource/health/* | ResourceHealth has no `tenantId` — global health data |
| GET/POST /api/resource/matrix/* | ResourceCapabilityMatrix has no `tenantId` — global capability map |
| GET /api/resource/catalog/* | Global resource catalog — no tenant scope |
| POST /api/resource/cost/estimate | Estimate by resourceId — uses global pricing, no tenant needed |

#### Verified Safe Routes

| Endpoint | Protection |
|---|---|
| GET /api/resource/credential | resolveTenantId filters by tenant ✅ |
| POST /api/resource/credential | resolveTenantId enforced, tenantId from JWT ✅ |
| GET /api/resource/usage | resolveTenantId filters by tenant ✅ |
| POST /api/resource/usage | resolveTenantId enforces tenant ✅ |
| GET /api/resource/cost | resolveTenantId filters by tenant ✅ |
| POST /api/resource/resolver/resolve | resolveTenantId enforced ✅ |
| GET /api/resource/resolver/check | resolveTenantId enforced ✅ |

---

## Fixes Applied

### Fix 1: DELETE /api/resource/credential/:id — Ownership Check

**File:** `backend/src/routes/platform/resource/credential.route.ts`

**Before:**
```typescript
fastify.delete('/api/resource/credential/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id } = request.params
  await resourceService.deleteCredential(id)
  return { success: true, message: 'Credential deleted' }
})
```

**After:**
```typescript
fastify.delete('/api/resource/credential/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id } = request.params
  const tenantId = await resolveTenantId(request)
  if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

  // Ownership check
  const existing = await prisma.resourceCredential.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing) return reply.status(404).send({ success: false, error: 'Credential not found' })
  if (existing.tenantId !== tenantId) return reply.status(403).send({ success: false, error: 'Forbidden: credential does not belong to your tenant' })

  await resourceService.deleteCredential(id)
  return { success: true, message: 'Credential deleted' }
})
```

### Fix 2: POST /api/resource/credential/:id/rotate — Ownership Check

**File:** `backend/src/routes/platform/resource/credential.route.ts`

**Before:**
```typescript
fastify.post('/api/resource/credential/:id/rotate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id } = request.params
  const body = request.body as any
  if (!body.newApiKey) return reply.status(400).send({ success: false, error: 'newApiKey is required' })
  const credential = await resourceService.rotateCredential(id, body.newApiKey)
  return { success: true, data: credential }
})
```

**After:**
```typescript
fastify.post('/api/resource/credential/:id/rotate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id } = request.params
  const body = request.body as any
  if (!body.newApiKey) return reply.status(400).send({ success: false, error: 'newApiKey is required' })

  const tenantId = await resolveTenantId(request)
  if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })

  // Ownership check
  const existing = await prisma.resourceCredential.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing) return reply.status(404).send({ success: false, error: 'Credential not found' })
  if (existing.tenantId !== tenantId) return reply.status(403).send({ success: false, error: 'Forbidden: credential does not belong to your tenant' })

  const credential = await resourceService.rotateCredential(id, body.newApiKey)
  return { success: true, data: credential }
})
```

---

## Verdict

### Overall: ✅ PASS (with fixes applied)

| Check | Status |
|---|---|
| **A: Auth Coverage** | ✅ PASS — 34/34 routes protected |
| **B: TenantId Source** | ✅ PASS — All resolveTenantId read JWT only |
| **C: Cross-tenant Attack Surface** | ✅ PASS (after fix) — Ownership checks added |

### Summary

1. **Auth:** All 34 routes across 8 files include `preHandler: [fastify.authenticate]`. No gaps.
2. **Tenant Isolation:** All `resolveTenantId()` implementations exclusively read from JWT (`request.user`), never from client input. Consistent across cost, credential, resolver, and usage routes.
3. **Cross-tenant:** 2 high-severity issues found in credential DELETE/ROTATE routes (missing ownership verification). **Both fixed** — routes now look up the credential, verify `tenantId` matches the requesting tenant's JWT-derived tenantId, and return 403 Forbidden on mismatch.
4. **Global Models:** Contract, health, matrix, and catalog routes intentionally omit tenantId because their Prisma models have no `tenantId` field — these are global resource configurations, not tenant-scoped data.

---

*Report generated by TENANT-BOUNDARY-TEST subagent*
