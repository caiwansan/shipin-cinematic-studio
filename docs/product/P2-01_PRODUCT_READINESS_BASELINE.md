# Product Readiness Baseline — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## 1. Overall Readiness

| Metric | Value |
|---|---|
| Total Capabilities | 57 (across 10 modules) |
| Production Ready | 28 (49%) |
| Beta | 12 (21%) |
| Simulated | 7 (12%) |
| Unavailable | 7 (12%) |
| Removed from IA | 3 modules |

## 2. Critical Quality Metrics

| Metric | Value | Threshold |
|---|---|---|
| User-Usable Capabilities | 40/57 (70%) | ≥90% |
| Frontend API Coverage | 27/39 (69%) | ≥95% |
| Unconsumed API Endpoints | 13 | ≤2 |
| FAKE KPI Count | 1 | 0 |
| Mock/Stub in Production Flow | ~38% reduction target | 0% |
| End-to-End Business Workflow Steps | 3/10 walkable (30%) | 100% |
| In-Memory Only Data | 2 (Timeline, Verification Job Runner) | 0 |
| Duplicate Routes | 4 pairs | 0 |
| Deprecated Routes | 4 | Remove |
| Broken Pipelines (Engine → Consumer) | 1 (KnowledgeActionAdapter) | 0 |
| Pages Not in Nav but Exist | 3 (Learning, Report, Walkthrough) | Decide |

## 3. Module Readiness Score

| Module | Production | Beta | Simulated | Unavailable | Score |
|---|---|---|---|---|---|
| Dashboard | 7 | 4 | 2 | 0 | ⚠️ **73%** (FAKE KPI -1) |
| Knowledge | 5 | 2 | 0 | 1 | ⚠️ **78%** (ActionAdapter broken) |
| Recommendation | 3 | 1 | 0 | 0 | ✅ **100%** |
| Verification | 4 | 1 | 0 | 0 | ✅ **100%** |
| Health | 2 | 2 | 0 | 0 | ⚠️ **50%** (2 no consumer) |
| Growth | 2 | 0 | 0 | 0 | ✅ **100%** |
| Mission | 0 | 0 | 2 | 3 | ❌ **0%** |
| Discovery | 0 | 0 | 2 | 2 | ❌ Removed from IA |
| Publishing | 0 | 2 | 1 | 0 | ❌ Removed from IA |
| Platform | 5 | 0 | 0 | 1 | ✅ **83%** |

## 4. FAKE KPI Inventory

| Location | KPI | Value | Issue |
|---|---|---|---|
| GEODashboard.vue:331 | projectedExposureGrowth | `Math.round(baseRate * 0.85)` | Client-side random |
| GEODashboard.vue:332 | projectedCitationGrowth | `Math.round(baseRate * 0.36)` | Client-side random |

**Total FAKE KPIs:** 2 (both in Business Value Hero component)

## 5. Mock/Stub Inventory

| Module | Component | Type | Impact |
|---|---|---|---|
| Discovery | Full module | Mock | Removed from IA |
| Discovery | Action Plan | Mock | Removed from IA |
| Mission | Mission Create | Stub | Empty list root cause |
| Mission | Mission Execute | Stub | Non-functional |
| Dashboard | Recent Activity | In-memory | Lost on refresh |

## 6. Unconsumed API Endpoints Detail

| API | Module | Consumer Missing |
|---|---|---|
| GET /api/geo/dashboard/:pid/truth | Dashboard | Dashboard brand card widget |
| GET /api/geo/dashboard/:pid/presence | Dashboard | Dashboard brand card widget |
| GET /api/geo/dashboard/:pid/verification | Dashboard | Dashboard brand card widget |
| GET /api/geo/dashboard/:pid/providers | Dashboard | Dashboard brand card widget |
| GET /api/geo/dashboard/:pid/timeline | Dashboard | Dashboard brand card widget |
| GET /api/geo/entities | Knowledge | Entity tab |
| GET /api/geo/claims | Knowledge | Claim tab |
| GET /api/geo/workspace/timeline/* | Platform | Timeline page |
| POST /api/geo/monitor/check-published | Health | Monitor widget |
| POST /api/geo/monitor/check-indexed | Health | Monitor widget |
| GET /api/geo/discovery/observatory | Discovery | Removed |
| GET /api/geo/discovery/adoption | Discovery | Removed |
| POST /api/geo/missions/create | Mission | Not functional anyway |

## 7. Unused But Not Harmful

| Item | Reason |
|---|---|
| Discovery routes (x5) | Removed from IA, kept for reference |
| Publishing routes (x3) | Removed from IA, kept for compatibility |
| .bak route files (x8) | Historical backups, should eventually clean |

## 8. Summary — Go/No-Go Assessment by Module

| Module | Going to Production as-is? | Requires Prework |
|---|---|---|
| Dashboard | ⚠️ **REVISE** (fix FAKE KPI, add sub-API widgets) | P2-02 |
| Knowledge | ✅ **GO** | P2-06 (Entity/Claim UI) |
| Recommendation | ✅ **GO** | — |
| Verification | ✅ **GO** | P2-04 (Job Runner persistence) |
| Health | ⚠️ **REVISE** (add monitor widgets) | P2-09 |
| Growth | ✅ **GO** | — |
| Mission | ❌ **NO-GO** | P2-03 (entire mission pipeline) |
| Discovery | ❌ **NO-GO** (removed from IA) | Future |
| Publishing | ❌ **NO-GO** (removed from IA) | Future |
