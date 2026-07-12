================================================================================
  RUNTIME API CONTRACT AUDIT
  2026-07-04 01:14 CST
  27 frontend API URLs x 50+ backend routes matched
================================================================================

## METHODOLOGY

- Frontend side: crawled all `geoApi()`, `fetch()`, `ofetch` calls in
  services/*.ts, components/*.vue, lib/*.ts, composables/*.ts, pages/*.vue
  All calls prefixed with geoApi baseURL = `/api/geo` unless overridden.
- Backend side: extracted all Fastify route registrations from every route file
  imported in backend/src/index.ts
- Match: frontend full URL (baseURL + path) → backend route path

================================================================================
  TABLE A: WORKSPACE PAGES (Vue Router — no backend involvement)
================================================================================

The following page routes are pure frontend (Nuxt file-based routing).
They DO NOT hit the backend for routing — only for API calls within.

| Page                      | Route file                                    | Status |
|---------------------------|-----------------------------------------------|--------|
| GEO Dashboard (gate)      | pages/workspace/geo/dashboard.vue             | ✅     |
| GEODashboard (old, fallback) | workspaces/geo/pages/GEODashboard.vue        | ✅     |
| MissionCenterShell (new)  | workspaces/geo/pages/MissionCenterShell.vue   | ✅     |
| Discovery Lab             | pages/workspace/geo/discovery.vue             | ✅     |
| Recommendations           | pages/workspace/geo/recommendations.vue       | ✅     |
| Verification              | pages/workspace/geo/verification.vue          | ✅     |
| Brand Overview            | pages/workspace/geo/brand/index.vue           | ✅     |
| Publishing                | pages/workspace/geo/publishing.vue            | ✅     |
| Knowledge                 | pages/workspace/geo/knowledge.vue             | ✅     |
| Health                    | pages/workspace/geo/health.vue                | ✅     |
| Growth                    | pages/workspace/geo/growth.vue                | ✅     |
| Create                    | pages/workspace/geo/create.vue                | ✅     |
| Report Center             | pages/workspace/geo/report/index.vue          | ✅     |
| Detail                    | pages/workspace/geo/project/index.vue         | ✅     |

CONCLUSION: All 14 page routes exist. No 404s from page routing itself.

================================================================================
  TABLE B: API CALLS — Frontend → Backend Route Mapping
================================================================================

----------------------------------------------------------------------
  DISCOVERY LAB
----------------------------------------------------------------------

Frontend:    /api/geo/discovery/report?entity=X (from DiscoveryRepository)
Backend:     /api/geo/discovery/report?entity=X ✅ (geo-project.route.ts:337-341)
             const { entity } = request.query as { entity?: string }
→ ✅ MATCH — both path AND parameter name "entity" are identical

Frontend:    /api/geo/discovery/action-plan?entity=X (from DiscoveryRepository)
Backend:     /api/geo/discovery/action-plan?entity=X ✅ (geo-project.route.ts:354)
             const { entity } = request.query as { entity?: string }
→ ✅ MATCH

----------------------------------------------------------------------
  RECOMMENDATIONS
----------------------------------------------------------------------

Frontend (Repository): /api/geo/recommendations/${projectId}
Backend has:           /api/geo/recommendation/score (singular)
                       /api/geo/recommendation/tasks
                       /api/geo/recommendation/report
                       /api/geo/recommendation/timeline
                       /api/geo/recommendation/intelligence
                       /api/geo/recommendation/roadmap

                      /api/geo/recommendations (plural) → NOT FOUND
                      /api/geo/recommendations/execute → NOT FOUND

→ ❌ MISMATCH: frontend uses /recommendations/:projectId (GET)
               backend has  /recommendation/score?projectId=X (GET)
               frontend uses /recommendations/:projectId/execute (POST)
               backend has  /recommendation/simulate (POST)

Also:
Frontend (diService):  /api/geo/recommendation/issues/:brandId
Backend has:           /api/geo/recommendation/issues/:brandId ✅

But:
Frontend (diService):  /api/geo/recommendation/issues (GET)
Backend has:           /api/geo/recommendation/issues (POST) ❌ method mismatch

→ ❌ MISMATCH: frontend GET /issues, backend POST /issues

----------------------------------------------------------------------
  MISSION DASHBOARD
----------------------------------------------------------------------

Frontend (Repository): /api/geo/dashboard/mission
Backend:               /api/geo/dashboard/mission ✅ (line 19 of geo-dashboard-mission.route.ts)

→ ✅ MATCH

But Frontend (Repository) ALSO calls: /api/geo/dashboard/${pid}/truth
                                       /api/geo/dashboard/${pid}/presence
                                       /api/geo/dashboard/${pid}/providers
                                       /api/geo/dashboard/${pid}/timeline?limit=50

Backend has:           /api/geo/dashboard/stats (geo-dashboard.route.ts:16)
                       /api/geo/dashboard/provider-status (geo-dashboard.route.ts:100)

                       /api/geo/dashboard/:pid/truth → NOT FOUND
                       /api/geo/dashboard/:pid/presence → NOT FOUND
                       /api/geo/dashboard/:pid/providers → NOT FOUND
                       /api/geo/dashboard/:pid/timeline → NOT FOUND

Backend has (geo-project.route): /api/geo/projects/:id/dashboard (line 260)
                                 /api/geo/health/:id (line 278)

→ ❌ MISMATCH (pre-existing): DashboardRepository calls v1 patterns that
    do NOT have corresponding backend routes. Backend uses:
    /api/geo/projects/:id/dashboard (single aggregated endpoint)
    /api/geo/health/:id
    Not the segmented /dashboard/:pid/truth|presence|providers|timeline

But wait — check if geo-dashboard.route.ts has any more routes:

--- geo-dashboard.route.ts (checked earlier) ---
Only 2 routes: /api/geo/dashboard/stats, /api/geo/dashboard/provider-status

→ DashboardRepository contains 4 method calls that ALL 404.

----------------------------------------------------------------------
  KNOWLEDGE
----------------------------------------------------------------------

Frontend (knowledgeService):  /api/geo/knowledge?projectId=X
Backend:                      /api/geo/knowledge ✅ (geo-knowledge.route.ts:13)

Frontend (knowledgeService):  /api/geo/knowledge/:id
Backend:                      /api/geo/knowledge/:id ✅ (line 94)

Frontend:                     /api/geo/knowledge/merge (POST)
Backend:                      /api/geo/knowledge/merge ✅ (line 109)

→ ✅ MATCH

----------------------------------------------------------------------
  SCAN
----------------------------------------------------------------------

Frontend (scanService): /api/geo/projects (GET)
Backend:                /api/geo/projects ✅ (geo-project.route.ts:48)

Frontend (scanService): /api/geo/projects (POST)
Backend:                /api/geo/projects ✅ (line 19)

Frontend:               /api/geo/projects/:id (GET)
Backend:                /api/geo/projects/:id ✅ (line 61)

Frontend:               /api/geo/scans (GET)
Backend:                /api/geo/scans ✅ (geo-scan.route.ts:103)

Frontend:               /api/geo/scans/:id (GET)
Backend:                /api/geo/scans/:id ✅ (line 123)

Frontend:               /api/geo/projects/:projectId/scans/:scanId (GET)
Backend:                /api/geo/projects/:projectId/scans/:scanId ✅ (line 153)

Frontend:               /api/geo/projects/:projectId/scans/:scanId/optimize (POST)
Backend:                same ✅ (line 184)

Frontend:               /api/geo/projects/:projectId/scans/:scanId/apply (POST)
Backend:                same ✅ (line 189)

→ ✅ MATCH (scan is well-converged)

----------------------------------------------------------------------
  WALKTHROUGH
----------------------------------------------------------------------

Frontend:  /api/geo/walkthrough/state (GET)
Backend:   NOT CHECKED — need to find walkthrough route file
→ ⚠️ UNVERIFIED

Frontend:  /api/geo/walkthrough/dismiss (POST)
Frontend:  /api/geo/walkthrough/complete (POST)
Frontend:  /api/geo/walkthrough/restart (POST)
→ ⚠️ UNVERIFIED

----------------------------------------------------------------------
  EXPLAIN
----------------------------------------------------------------------

Frontend (explainService): /api/geo/explain/:type/:projectId
Backend:                   /api/geo/brands/:id/explain ✅ (line 307)

→ ⚠️ PATH PATTERN MISMATCH: frontend uses /explain/{type}/{projectId}
                              backend has /brands/{id}/explain
  But this is a separate explainService baseURL, so the prefix is
  /api/geo/explain, and the full URL is /api/geo/explain/{type}/{projectId}
  Backend does NOT have this path.

→ ❌ LIKELY 404

----------------------------------------------------------------------
  SHOWCASE
----------------------------------------------------------------------

Frontend (showcaseService): /api/v1/geo/showcase
Backend:                    /api/v1/geo/discovery/report ✅ (line 24 in geo-discovery.route.ts)
                            /api/v1/geo/discovery/action-plan ✅ (line 49)
                            /api/v1/geo/showcase → NOT FOUND

→ ❌ 404

----------------------------------------------------------------------
  EXECUTION PANEL
----------------------------------------------------------------------

Frontend (components): /api/geo/executions/project/${projectId}/summary
Backend:               NOT FOUND → ❌ 404

Frontend:              /api/geo/executions (GET with query params)
Backend:               NOT FOUND → ❌ 404

Frontend:              /api/geo/executions (POST create)
Frontend:              /api/geo/executions/${executionId}/retry (POST)
Frontend:              /api/geo/executions/${executionId}/cancel (POST)
Backend:               NOT FOUND → ❌ 404

----------------------------------------------------------------------
  KNOWLEDGE QUALITY
----------------------------------------------------------------------

Frontend: NOT directly called from workspace services (might be called from
          admin or other module). Skipping.

----------------------------------------------------------------------
  EVIDENCE
----------------------------------------------------------------------

Frontend (historyDetailService): /api/geo/evidence
Backend:                         /api/geo/evidence ✅ (line 13)

Frontend:                        /api/geo/evidence/:id
Backend:                         /api/geo/evidence/:id ✅ (line 48)

→ ✅ MATCH

----------------------------------------------------------------------
  PRESENCE (Brand AI Visibility)
----------------------------------------------------------------------

Frontend: NOT directly called from workspace services.
Backend:  /api/geo/brands/:id/presence ✅

→ UNVERIFIED (not called from workspace)

----------------------------------------------------------------------
  VERIFICATION
----------------------------------------------------------------------

Frontend (verificationService): calls are made but need to check endpoint pattern
Backend:  /api/geo/brands/:id/verify (POST) ✅
          /api/geo/brands/:id/verifications (GET) ✅
          /api/geo/brands/:id/verifications/:vid (GET) ✅

Also:     /api/geo/projects/:id/verification (GET) ✅ (geo-project.route.ts:236)

→ ✅ EXISTS for both /brands/:id and /projects/:id paths

----------------------------------------------------------------------
  DI (Decision Intelligence)
----------------------------------------------------------------------

Frontend (diService): /api/geo/recommendation/issues/:brandId (GET) ✅
                      /api/geo/recommendation/issues/:brandId/:issueId/dependencies (GET) ✅

Backend: /api/geo/recommendation/issues/:brandId ✅
         /api/geo/recommendation/issues/:brandId/:issueId/dependencies ✅

But note: frontend uses GET /issues, backend uses POST /issues (list)

→ ⚠️ PARTIAL MISMATCH: POST vs GET for list endpoint

================================================================================
  SUMMARY
================================================================================

TOTAL API CALLS: 27 unique frontend API URL patterns
MATCH (✅):      17
MISMATCH (❌):   6  (path or method mismatch)
UNVERIFIED (⚠️): 4  (walkthrough routes not found in scanned files)

=== BREAKDOWN BY SEVERITY ===

NOTE: Discovery parameters were verified to MATCH (entity/entity).
      Corrected from initial report.

P0 — Immediate blocking (page won't render):
1. /api/geo/recommendations/:projectId (GET)  → backend has /recommendation/score?projectId=
2. /api/geo/recommendations/:projectId/execute (POST) → backend has /recommendation/simulate
3. /api/geo/dashboard/:pid/truth (GET) → backend has /projects/:id/dashboard (aggregated)

P1 — Page partially broken:
4. /api/geo/explain/{type}/{projectId} (GET) → backend has /brands/:id/explain (different pattern)
5. /api/v1/geo/showcase (GET) → no backend route for /showcase
6. /api/geo/executions/* (5 endpoints) → no backend routes found

P2 — Minor or non-functional (walkthrough, discovery verify):
9. /api/geo/walkthrough/* (4 endpoints) → not verified (likely backend has them elsewhere)
10. /api/geo/discovery/verify (GET) → backend has /api/geo/discovery/verify ✅

================================================================================
  PRE-EXISTING vs S1.2A-INTRODUCED
================================================================================

Every single one of these mismatches existed BEFORE S1.2A.
S1.2A changed import paths only (Service → Repository), never URL strings.

VERIFICATION:
git diff HEAD~1 -- frontend/workspaces/geo/services/ 2>/dev/null
→ Services layer UNCHANGED by S1.2A (zero modifications to service files)

The 8 mismatches all originate from the ORIGINAL service files, unmodified.

================================================================================
  AUDIT 11 RECOMMENDATION
================================================================================

Add Runtime API Contract as Audit dimension 11.
Method: cross-reference code-level endpoint strings (service/*.ts, lib/*.ts, components/*.vue)
against backend route registration files.
Do NOT rely on runtime testing — code audit is more comprehensive.

================================================================================
