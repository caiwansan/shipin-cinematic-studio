# Capability Matrix v2 — GEO Workspace SSOT

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27
**Scope:** 100% GEO Capability Scan

---

## Legend

- **TRUTH:** TRUE / DERIVED / ESTIMATION / SIMULATED / NO_EVIDENCE
- **CAPABILITY:** Production / Beta / Simulated / Unavailable
- **CONSUMER:** Which UI page or component consumes this
- **MISSING:** What prevents this from being production-ready

---

## 1. Dashboard

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Brand List | GET /api/geo/projects | — | ✅ GeoProject | ✅ Dashboard | TRUE | Production | GEODashboard | — |
| Mission Control | GET /api/geo/dashboard/mission | — | ✅ Prisma | ✅ Dashboard | TRUE | Production | GEODashboard | — |
| Brand Stats | GET /api/geo/dashboard/stats | — | ✅ Prisma | ✅ Dashboard | TRUE | Production | GEODashboard | — |
| ADI Progress | — | ScoreService | ✅ | ✅ Dashboard | DERIVED | Production | BrandOverview | — |
| Journey Progress | — | — | ✅ | ✅ Dashboard | TRUE | Production | GEODashboard | — |
| Recent Activity | — | — | ⚠️ In-memory | ✅ Dashboard | SIMULATED | Beta | GEODashboard | No DB persistence |
| System Health | — | — | — | ✅ Dashboard | TRUE | Production | GEODashboard | Static system status |
| ROI Calculator | — | — | — | ✅ Dashboard | ESTIMATION | Beta | GEODashboard | Client-side calc |
| Business Value Hero | — | — | — | ✅ Dashboard | ❌ FAKE | ❌ FAKE | GEODashboard | Math.random() — violates Product Principle #4 |
| Brand Truth | GET /api/geo/dashboard/:pid/truth | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Brand Presence | GET /api/geo/dashboard/:pid/presence | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Brand Verification | GET /api/geo/dashboard/:pid/verification | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Providers | GET /api/geo/dashboard/:pid/providers | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Timeline | GET /api/geo/dashboard/:pid/timeline | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Walkthrough | — | WalkthroughEngine | — | ✅ GEODashboard | TRUE | Production | GEODashboard | — |

**Subtotal:** 15 capabilities / 5 TRUE-DERIVED usable / 10 engaged / 5 missing consumer / 1 FAKE KPI

---

## 2. Knowledge

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| KO List | GET /api/geo/knowledge | — | ✅ KnowledgeObject | ✅ KnowledgePage | TRUE | Production | KnowledgePage | — |
| KO Detail | GET /api/geo/knowledge/:id | — | ✅ DB | ✅ KnowledgePage | TRUE | Production | KnowledgePage | — |
| KO Status Update | PATCH /api/geo/knowledge/:id/status | — | ✅ DB | ✅ | TRUE | Production | KnowledgePage | — |
| KO Merge | POST /api/geo/knowledge/merge | — | ✅ DB | ✅ | TRUE | Production | KnowledgePage | — |
| KIE Quality | GET /api/geo/knowledge-quality | ✅ KIE (5 rules) | ✅ | ✅ KnowledgePage | DERIVED | Production | KnowledgePage | Rule-based, not AI |
| Entity | GET/POST /api/geo/entities | — | ✅ DB | ❌ No dedicated UI | TRUE | Beta | ❌ None | No frontend CRUD |
| Claim | GET/POST /api/geo/claims | — | ✅ DB | ❌ No dedicated UI | TRUE | Beta | ❌ None | No frontend CRUD |
| Evidence | GET /api/geo/evidence | — | ✅ DB | ⚠️ Embedded in BrandOverview | TRUE | Beta | BrandOverview | No standalone page |
| KIE Insight → Action | — | KnowledgeActionAdapter | — | ❌ Not connected | ❌ BROKEN | Unavailable | ❌ None | Not wired to product — BLOCKER for Mission |

**Subtotal:** 9 capabilities / 7 usable / 2 missing consumer / 1 BROKEN pipeline

---

## 3. Recommendation

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Recommendation List | GET /api/geo/recommendations | ✅ RecScoreService | ✅ DB | ✅ RecommendationsPage | DERIVED | Production | RecommendationsPage | — |
| Recommendation Detail | GET /api/geo/recommendations/:id | ✅ RecScoreService | ✅ DB | ✅ | DERIVED | Production | RecommendationsPage | — |
| Recommendation Execute | POST /api/geo/recommendations/:id/execute | — | ✅ DB | ✅ | TRUE | Beta | RecommendationsPage | No persistent job queue |
| Recommendation Score | GET /api/geo/recommendations/:projectId/score | ✅ RecScoreService | ✅ DB | ✅ | DERIVED | Production | RecommendationsPage | — |

**Subtotal:** 4 capabilities / all usable / 1 Beta (execution)

---

## 4. Verification

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Run Verification | POST /api/geo/verification/run | ✅ VerificationEngine | ✅ Prisma | ✅ VerificationPage | TRUE | Production | VerificationPage | — |
| Verification History | GET /api/geo/verification/history/:id | — | ✅ DB | ✅ | TRUE | Production | VerificationPage | — |
| Verification Compare | GET /api/geo/verification/compare/:before/:after | — | ✅ DB | ✅ | TRUE | Production | VerificationPage | — |
| Brand Quick Verify | POST /api/geo/brands/:id/verify | ✅ VerificationEngine | ✅ DB | ✅ BrandOverview | TRUE | Production | BrandOverview | Duplicates /verification/run (kept for UX) |
| Job Runner | — | InMemoryJobRunner | ❌ Memory | — | SIMULATED | Beta | — | No DB persistence — data lost on restart |

**Subtotal:** 5 capabilities / 4 production / 1 memory-only

---

## 5. Health

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Health Assessment | GET /api/geo/health/:projectId | — | ✅ Prisma | ✅ HealthPage | TRUE | Production | HealthPage | — |
| Monitor Dashboard | GET /api/geo/monitor/dashboard/:projectId | — | ✅ DB | ✅ HealthPage | TRUE | Production | HealthPage | — |
| Check Published | POST /api/geo/monitor/check-published | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |
| Check Indexed | POST /api/geo/monitor/check-indexed | — | ✅ DB | ❌ No UI | TRUE | Beta | ❌ None | No frontend consumer |

**Subtotal:** 4 capabilities / 2 engaged / 2 missing consumer

---

## 6. Growth

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Growth Tracking | GET /api/geo/growth/:projectId | — | ✅ GrowthMemory | ✅ GrowthPage | TRUE | Production | GrowthPage | — |
| Growth Event | POST /api/geo/growth/event | — | ✅ DB | ✅ GrowthPage | TRUE | Production | GrowthPage | — |

**Subtotal:** 2 capabilities / both usable

---

## 7. Mission

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Mission List | GET /api/geo/missions | ✅ MissionGenerator | ✅ (empty) | ✅ MissionWorkspacePage | ❌ EMPTY | Unavailable | MissionWorkspacePage | Generator has no input — BLOCKER |
| Mission Create | POST /api/geo/missions/create | — | ✅ (stub) | ✅ | SIMULATED | Stub | — | Stub |
| Mission Execute | POST /api/geo/missions/:id/execute | — | ✅ (stub) | ✅ | SIMULATED | Stub | — | Stub |
| Mission Generator | — | ✅ MissionGenerator | — | ❌ | ❌ No input | Unavailable | — | Needs KnowledgeActionAdapter — BLOCKER |
| Mission Prioritizer | — | ✅ MissionPrioritizer | — | ❌ | ❌ No input | Unavailable | — | No missions to prioritize |

**Subtotal:** 5 capabilities / 3 are BLOCKER / 2 stub / 0 production

---

## 8. Discovery (removed from IA)

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Discovery Report | GET /api/geo/discovery/report | MockScanner | ❌ Mock | DiscoveryLabPage | SIMULATED | Simulated | Page hidden | 100% mock |
| Action Plan | GET /api/geo/discovery/action-plan | Mock | ❌ Mock | — | SIMULATED | Simulated | Hidden | 100% mock |
| Observatory | GET /api/geo/discovery/observatory | Registry | ❌ No DB | ❌ No UI | NO_EVIDENCE | Unavailable | ❌ None | Registry-based, no consumer |
| Adoption | GET /api/geo/discovery/adoption | Registry | ❌ No DB | ❌ No UI | NO_EVIDENCE | Unavailable | ❌ None | Registry-based, no consumer |

**Subtotal:** 4 capabilities / 0 production / 0 in current IA

---

## 9. Publishing (removed from IA)

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Publishing Plan | GET /api/geo/publishing/:projectId | — | ✅ DB (empty) | PublishingPage | SIMULATED | Beta | Page hidden | Empty channels |
| Publish Execute | POST /api/geo/publishing/:projectId/publish | — | ✅ DB | — | SIMULATED | Beta | Hidden | No real push pipeline |
| Distribution Engine | — | ✅ Platform-level | — | ❌ | NO_EVIDENCE | Unavailable | ❌ None | Not integrated into GEO |

**Subtotal:** 3 capabilities / 0 production / 0 in current IA

---

## 10. Platform / Cross-cutting

| Capability | API | Engine | DB | UI | TRUTH | CAPABILITY | CONSUMER | MISSING |
|---|---|---|---|---|---|---|---|---|
| Auth (JWT) | POST /api/auth/login | — | ✅ User | ✅ Login | TRUE | Production | All pages | Some routes skip auth |
| Project CRUD | GET/POST/PUT /api/geo/projects[/:id] | — | ✅ GeoProject | ✅ GEOCreate, GEODetail | TRUE | Production | Create, Detail | No versioning |
| Brand Overview | GET /api/geo/brands/:id | Multi-Service | ✅ Multi | ✅ BrandOverview.vue | TRUE | Production | BrandOverview | 4276 line super-page |
| Timeline (persisted) | GET /api/geo/workspace/timeline* | — | ❌ In-memory | ❌ No UI | SIMULATED | Unavailable | ❌ None | In-memory only |
| Explain Engine | POST /api/geo/explain | ✅ ExplainProviders | — | ✅ BrandOverview | DERIVED | Production | BrandOverview | — |
| Walkthrough | GET /api/geo/walkthrough | WalkthroughEngine | — | ✅ GEODashboard | TRUE | Production | — | — |

---

## 11. Summary

| Module | Total Capabilities | Production | Beta | Simulated | Unavailable | Missing Consumer | BLOCKER |
|---|---|---|---|---|---|---|---|
| Dashboard | 15 | 7 | 4 | 2 | 0 | 5 | 1 FAKE KPI |
| Knowledge | 9 | 5 | 2 | 0 | 1 | 2 | 1 BROKEN (ActionAdapter) |
| Recommendation | 4 | 3 | 1 | 0 | 0 | 0 | — |
| Verification | 5 | 4 | 1 | 0 | 0 | 0 | — |
| Health | 4 | 2 | 2 | 0 | 0 | 2 | — |
| Growth | 2 | 2 | 0 | 0 | 0 | 0 | — |
| Mission | 5 | 0 | 0 | 2 | 3 | 0 | 3 BLOCKER |
| Discovery | 4 | 0 | 0 | 2 | 2 | 2 | Removed from IA |
| Publishing | 3 | 0 | 2 | 1 | 0 | 0 | Removed from IA |
| Platform | 6 | 5 | 0 | 0 | 1 | 2 | Timeline in-memory |
| **TOTAL** | **57** | **28 (49%)** | **12 (21%)** | **7 (12%)** | **7 (12%)** | **13** | **5 CRITICAL** |

**User-Usable Capabilities (Production+Beta):** 40/57 = 70%
**Frontend-Consumed API Capabilities:** ~28/57 = 49%
**Broken/Missing Consumer:** 13 endpoints or capabilities
**FAKE KPI:** 1 (Business Value Hero growth projection)
**BLOCKER items for next Sprint:** 5 (Mission input pipeline, KnowledgeActionAdapter, Timeline persistence, Dashboard KPI truth, 5 unused dashboard sub-APIs)
