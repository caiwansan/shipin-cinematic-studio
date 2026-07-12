# API Consumption Audit — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## Methodology

Scanned all GEO route files in `backend/src/services/geo/routes/`. 
Each API endpoint classified by: Consumer, Duplicate status, Deprecated status, Truth Level.

---

## 1. Dashboard Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/dashboard/mission | ✅ GEODashboard | — | — | TRUE | |
| GET /api/geo/dashboard/stats | ✅ GEODashboard | — | — | TRUE | |
| GET /api/geo/dashboard/:pid/truth | ❌ None | — | — | TRUE | No UI widget |
| GET /api/geo/dashboard/:pid/presence | ❌ None | — | — | TRUE | No UI widget |
| GET /api/geo/dashboard/:pid/verification | ❌ None | — | — | TRUE | No UI widget |
| GET /api/geo/dashboard/:pid/providers | ❌ None | — | — | TRUE | No UI widget |
| GET /api/geo/dashboard/:pid/timeline | ❌ None | — | — | TRUE | No UI widget |

**Dashboard Unused:** 5/7 (71% unused API endpoints)

---

## 2. Knowledge Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/knowledge | ✅ KnowledgePage | — | — | TRUE | |
| GET /api/geo/knowledge/:id | ✅ KnowledgePage | — | — | TRUE | |
| PATCH /api/geo/knowledge/:id/status | ✅ KnowledgePage | — | — | TRUE | |
| POST /api/geo/knowledge/merge | ✅ KnowledgePage | — | — | TRUE | |
| GET /api/geo/knowledge-quality | ✅ KnowledgePage | — | — | DERIVED | KIE engine |

**Knowledge Unused:** 0/5

---

## 3. Entity / Claim / Evidence Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/entities | ❌ None | — | — | TRUE | No Entity UI tab |
| POST /api/geo/entities | ❌ None | — | — | TRUE | |
| GET /api/geo/claims | ❌ None | — | — | TRUE | No Claim UI tab |
| POST /api/geo/claims | ❌ None | — | — | TRUE | |
| GET /api/geo/evidence | ⚠️ BrandOverview (embedded) | — | — | TRUE | No standalone page |
| GET /api/geo/evidence/:id | ❌ None | — | — | TRUE | |

**Entity/Claim/Evidence Unused:** 5/6 (83% unused)

---

## 4. Recommendation Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/recommendations | ✅ RecommendationsPage | — | — | DERIVED | |
| GET /api/geo/recommendations/:id | ✅ RecommendationsPage | — | — | DERIVED | |
| POST /api/geo/recommendations/:id/execute | ✅ RecommendationsPage | — | — | TRUE | |
| GET /api/geo/recommendations/:projectId/score | ✅ RecommendationsPage | — | — | DERIVED | |
| GET /api/geo/optimization-v2 | ✅ RecommendationsPage | ✅ Duplicate of /recommendations | — | DERIVED | Should unify |

**Recommendation Unused:** 0/5 (1 duplicate)

---

## 5. Verification Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| POST /api/geo/verification/run | ✅ VerificationPage | — | — | TRUE | |
| GET /api/geo/verification/history/:projectId | ✅ VerificationPage | — | — | TRUE | |
| GET /api/geo/verification/compare/:before/:after | ✅ VerificationPage | — | — | TRUE | |
| POST /api/geo/brands/:id/verify | ✅ BrandOverview | ✅ Duplicate of /verification/run | — | TRUE | Kept as UX shortcut |

**Verification Unused:** 0/4 (1 duplicate confirmed, intentionally kept)

---

## 6. Health / Monitor Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/health/:projectId | ✅ HealthPage | — | — | TRUE | |
| GET /api/geo/monitor/dashboard/:projectId | ✅ HealthPage | — | — | TRUE | |
| POST /api/geo/monitor/check-published | ❌ None | — | — | TRUE | No UI |
| POST /api/geo/monitor/check-indexed | ❌ None | — | — | TRUE | No UI |

**Health Unused:** 2/4 (50%)

---

## 7. Growth Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/growth/:projectId | ✅ GrowthPage | — | — | TRUE | |
| POST /api/geo/growth/event | ✅ GrowthPage | — | — | TRUE | |

**Growth Unused:** 0/2

---

## 8. Mission Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/missions | ⚠️ Page exists, API returns empty array | — | — | EMPTY | BLOCKER |
| POST /api/geo/missions/create | — | — | — | STUB | |
| POST /api/geo/missions/:id/execute | — | — | — | STUB | |
| GET /api/geo/missions/:id | — | — | — | EMPTY | |

**Mission Unused:** 4/4 (empty or stub)

---

## 9. Discovery Routes (removed from IA)

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/discovery/report | Page hidden | Duplicate v1/v2 | ✅ Deprecated | SIMULATED | 100% mock |
| GET /api/geo/discovery/action-plan | — | — | ✅ Deprecated | SIMULATED | |
| GET /api/geo/discovery/verify | — | — | ✅ Deprecated | SIMULATED | |
| GET /api/geo/discovery/observatory | ❌ None | — | — | NO_EVIDENCE | Registry-based, no product value |
| GET /api/geo/discovery/adoption | ❌ None | — | — | NO_EVIDENCE | |

**Discovery Unused:** 5/5 (all removed from IA)

---

## 10. Publishing Routes (removed from IA)

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/publishing/:projectId | Page hidden | — | — | SIMULATED | Empty channels |
| POST /api/geo/publishing/:projectId/publish | — | — | — | SIMULATED | No real push |
| GET /api/geo/publishing/:id/status | — | — | — | TRUE | |

**Publishing Unused:** 2/3 (hidden from IA)

---

## 11. Platform / Workspace Routes

| Endpoint | Consumer | Duplicate | Deprecated | Truth | Notes |
|---|---|---|---|---|---|
| GET /api/geo/projects | ✅ GEODashboard | — | — | TRUE | |
| POST /api/geo/projects | ✅ GEOCreate | — | — | TRUE | |
| GET /api/geo/projects/:id | ✅ GEODetail | — | — | TRUE | |
| PUT /api/geo/projects/:id | ✅ GEODetail | — | — | TRUE | |
| DELETE /api/geo/projects/:id | ✅ GEODetail | — | — | TRUE | |
| GET /api/geo/workspace/mission-control | ❌ None | Duplicate of /dashboard/mission | ✅ Deprecated | SIMULATED | Legacy |
| GET /api/geo/workspace/timeline* | ❌ None | — | — | SIMULATED | In-memory |

**Platform Unused:** 2/7

---

## 12. Summary

### Usage by Module

| Module | Total APIs | Consumed | Unconsumed | Unconsumed % |
|---|---|---|---|---|
| Dashboard | 7 | 2 | 5 | 71% |
| Knowledge | 5 | 5 | 0 | 0% |
| Entity/Claim/Evidence | 6 | 1 | 5 | 83% |
| Recommendation | 5 | 5 | 0 | 0% |
| Verification | 4 | 4 | 0 | 0% |
| Health | 4 | 2 | 2 | 50% |
| Growth | 2 | 2 | 0 | 0% |
| Mission | 4 | 0 | 4 | 100% |
| Discovery | 5 | 0 | 5 | 100% (removed) |
| Publishing | 3 | 0 | 3 | 100% (removed) |
| Platform | 7 | 5 | 2 | 29% |
| **Total** | **52** | **26** | **26** | **50%** |

### Duplicate Routes

| Endpoint A | Endpoint B | Status |
|---|---|---|
| POST /api/geo/brands/:id/verify | POST /api/geo/verification/run | ✅ Intentionally kept |
| GET /api/geo/optimization-v2 | GET /api/geo/recommendations | ⚠️ Should unify |
| GET /api/geo/discovery/report (v1) | GET /api/geo/discovery/report (v2) | ✅ Both deprecated |
| GET /api/geo/workspace/mission-control | GET /api/geo/dashboard/mission | ⚠️ Legacy, should remove |

### Deprecated Routes

| Endpoint | Reason |
|---|---|
| GET /api/geo/discovery/report | 100% mock, removed from IA |
| GET /api/geo/discovery/action-plan | 100% mock, removed from IA |
| GET /api/geo/discovery/verify | 100% mock, removed from IA |
| GET /api/geo/workspace/mission-control | Superseded by /dashboard/mission |
| Various .bak files in routes/ | Need cleanup |
