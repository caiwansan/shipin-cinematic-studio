# PLATFORM-INTEGRITY-REPORT.md

## Audit Date
2026-06-24

---

## P0 Issues

### P0-1: 会员等级双真相源 (Membership Dual Truth Source)

**Root Cause**: Two separate tier systems co-existing without sync.

**User表**: `memberTier` (String) — Legacy field with values like `premium`, `vip_year`, `vip_test`
**Membership表**: `tier` (String, default "free") — New unified tier with values `free`, `basic`, `pro`, `enterprise`

**Affected Files**:
- `backend/prisma/schema.prisma` — Both fields exist
- `backend/src/routes/admin-auth.ts:202` — Complex manual mapping between systems
- `backend/src/routes/sms-auth.ts:251` — `resolvedTier = membership?.tier || user.memberTier || 'free'` (fallback chain)
- `frontend/constants/membership.ts` — Legacy-to-new mapping table

**Impact**:
- Admin changes `Membership.tier` → Member center reads `User.memberTier` → mismatch
- Auth checks use `User.memberTier` for some permissions, `Membership.tier` for others
- Subscription plan changes may not propagate to both fields

**Fix Plan**:
1. Deprecate `User.memberTier` field
2. Always read tier from `Membership.tier`
3. Add DB migration to sync existing data: `User.memberTier → Membership.tier`
4. Update all auth/permission checks to use `Membership.tier` only

---

### P0-2: Novel Project Creation — Need Investigation

**Status**: Insufficient evidence found. The novel workbench uses `pages/novel/` (Nuxt pages), not the `studio-v2` workspace. Need to audit the specific HTTP error/error log from the user's failed project creation attempt.

**Requires**: User's error message or browser console output to locate the failure point.

---

### P0-3: Novel Chapter Recovery — Need Investigation

**Status**: Chapter retrieval routes exist at `GET /api/novels/:id/chapters/:no` (novel.ts:152). Need to verify if the API returns data when DB has chapters.

**Affected Files**:
- `backend/src/routes/novel.ts` — Chapter API
- `frontend/pages/novel/[id].vue` — Chapter display
- DB: `novel_chapters` table (if exists) or `chapters` relation on Novel model

**Requires**: User's project ID or chapter IDs to trace `DB → API → Frontend` flow.

---

## P1 Issues

### P1-1: VIP Tier vs Subscription System (Already Fixed in Scope)

**Root Cause**: Same as P0-1 — dual membership system. The admin "VIP套餐管理" page uses a different tier naming scheme than the "会员等级" management.

**Affected Files**:
- Same as P0-1
- `frontend/pages/admin/aigc/vip.vue` — VIP package management UI
- `frontend/pages/user/membership.vue` — Member center UI

**Status**: Resolution is DEPENDENT on P0-1 fix (unify to single tier system).

---

### P1-2: Storyboard Description (Already Fixed)

**Root Cause**: Schema Drift — `executionResults.videoSegments[].narrative` field name not included in store mapping.

**Fix Applied**: `useStudioStore.ts` — Added `seg.narrative` as fallback for `narrativePurpose` and `fullText` fields.

**Status**: ✅ FIXED in previous session. Verified in code at lines 587, 600, 709.

---

## Summary

| Issue | Priority | Status | Type |
|-------|:--------:|:------:|:----:|
| Membership Dual Tier | P0 | 🔴 UNFIXED | Truth Source Drift |
| Novel Project Create | P0 | 🟡 NEEDS DATA | Unknown |
| Novel Chapter Recovery | P0 | 🟡 NEEDS DATA | Data Restoration |
| VIP Tier Unification | P1 | 🔴 DEFERRED | Blocked by P0-1 |
| Storyboard Description | P1 | ✅ FIXED | Schema Drift |

## Recommendations

1. **P0-1**: Unify to `Membership.tier` as single source of truth. Add sync migration. Remove `User.memberTier`.
2. **P0-2/P0-3**: Requires user-provided error details or project IDs for further diagnosis.
3. **P1-1**: Blocked by P0-1. Unify tier naming across admin and user-facing UIs.
4. **P1-2**: Already fixed. No further action needed.
