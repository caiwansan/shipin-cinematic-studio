# Consumer Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## Mapping Format

```
Page/Component → API → Service → Repository → DB
```

---

## 1. GEODashboard.vue（工作台）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Brand List | GET /api/geo/projects | GeoProjectService | project.repository | GeoProject | ✅ Live |
| Mission Control | GET /api/geo/dashboard/mission | MissionService | mission.repository | GeoProject | ✅ Live |
| Stats | GET /api/geo/dashboard/stats | dashboardService | dashboard.repository | Prisma | ✅ Live |
| Recent Activity | — | In-memory | — | — | ⚠️ No DB |
| Business Value Hero | — | Client-side Math.random() | — | — | ❌ FAKE KPI |
| Walkthrough | GET /api/geo/walkthrough | WalkthroughEngine | — | — | ✅ Live |
| Brand Truth Card | GET /api/geo/dashboard/:pid/truth | dashboardService | dashboard.repository | Prisma | ❌ No UI consumer |
| Brand Presence Card | GET /api/geo/dashboard/:pid/presence | dashboardService | dashboard.repository | Prisma | ❌ No UI consumer |
| Brand Verification Card | GET /api/geo/dashboard/:pid/verification | dashboardService | dashboard.repository | Prisma | ❌ No UI consumer |
| Providers Card | GET /api/geo/dashboard/:pid/providers | dashboardService | dashboard.repository | Prisma | ❌ No UI consumer |
| Timeline Card | GET /api/geo/dashboard/:pid/timeline | dashboardService | dashboard.repository | Prisma | ❌ No UI consumer |

**Missing Consumers:** 5 API endpoints have no representation in the Dashboard UI.

---

## 2. KnowledgePage.vue（知识库）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| KO Table | GET /api/geo/knowledge | KnowledgeObjectService | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| KO Detail Panel | GET /api/geo/knowledge/:id | KnowledgeObjectService | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| KO Status Change | PATCH /api/geo/knowledge/:id/status | KnowledgeObjectService | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| KO Merge | POST /api/geo/knowledge/merge | KnowledgeObjectService | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| Quality Score | GET /api/geo/knowledge-quality | KIE | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| Entity Tab | GET /api/geo/entities | EntityService | entity.repository | EntityRegistry | ❌ No dedicated UI |
| Claim Tab | GET /api/geo/claims | ClaimService | claim.repository | — | ❌ No dedicated UI |
| Evidence View | GET /api/geo/evidence | EvidenceService | evidence.repository | — | ❌ No standalone page (embedded in BrandOverview) |

**Missing Consumers:** 3 API endpoints have no dedicated KnowledgePage UI.

---

## 3. RecommendationsPage.vue（优化中心）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Recommendation List | GET /api/geo/recommendations | RecommendationScoreService | — | Prisma | ✅ Live |
| Detail / Score | GET /api/geo/recommendations/:projectId/score | RecommendationScoreService | — | Prisma | ✅ Live |
| Execute Button | POST /api/geo/recommendations/:id/execute | — | — | — | ⚠️ No persistent queue |

**Missing Consumers:** 0

---

## 4. VerificationPage.vue（验证）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Run Verification | POST /api/geo/verification/run | VerificationEngine | — | VerificationResult | ✅ Live |
| History | GET /api/geo/verification/history/:projectId | VerificationEngine | — | VerificationResult | ✅ Live |
| Compare | GET /api/geo/verification/compare/:before/:after | VerificationEngine | — | VerificationResult | ✅ Live |
| Brand Quick Verify | POST /api/geo/brands/:id/verify | VerificationEngine | — | VerificationResult | ✅ Live (duplicate route) |

**Missing Consumers:** 0

---

## 5. HealthPage.vue（品牌健康）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Health Score | GET /api/geo/health/:projectId | HealthService | — | Prisma | ✅ Live |
| Monitor Dashboard | GET /api/geo/monitor/dashboard/:projectId | MonitorService | — | Prisma | ✅ Live |
| Check Published | POST /api/geo/monitor/check-published | MonitorService | — | — | ❌ No UI consumer |
| Check Indexed | POST /api/geo/monitor/check-indexed | MonitorService | — | — | ❌ No UI consumer |

**Missing Consumers:** 2 API endpoints not consumed by HealthPage.

---

## 6. GrowthPage.vue（成长）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Growth Data | GET /api/geo/growth/:projectId | GrowthService | growth.repository | GrowthMemory | ✅ Live |
| Record Event | POST /api/geo/growth/event | GrowthService | growth.repository | GrowthMemory | ✅ Live |

**Missing Consumers:** 0

---

## 7. MissionWorkspacePage.vue（任务）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Mission List | GET /api/geo/missions | MissionGenerator | MissionReadRepository | ❌ Empty | ⚠️ API 200 — empty array |
| Create Mission | POST /api/geo/missions/create | MissionGenerator | — | Stub | ❌ Stub |
| Execute Mission | POST /api/geo/missions/:id/execute | — | — | Stub | ❌ Stub |

**Missing Consumers:** All mission endpoints are either empty or stub.

---

## 8. BrandOverview.vue（品牌详情 — 4276行超级页面）

| UI Component | API | Service | Repository | DB | Status |
|---|---|---|---|---|---|
| Brand Profile | GET /api/geo/brands/:id | BrandService | brand.repository | GeoBrandProfile | ✅ Live |
| Presence | GET /api/geo/presence/:projectId | PresenceEngine | presence.repository | — | ✅ Live |
| Knowledge | GET /api/geo/knowledge?projectId=:id | KnowledgeObjectService | KnowledgeObjectRepository | KnowledgeObject | ✅ Live |
| Optimization | GET /api/geo/recommendations | RecommendationScoreService | — | — | ✅ Live |
| Verification | POST /api/geo/brands/:id/verify | VerificationEngine | — | VerificationResult | ✅ Live |
| Evidence (inline) | GET /api/geo/evidence | EvidenceService | evidence.repository | — | ✅ Embedded |
| Explain | POST /api/geo/explain | ExplainProviders | — | — | ✅ Live |

**Note:** BrandOverview duplicates most of the workspace's concepts inline.

---

## 9. Summary — Missing Consumer APIs

| API Endpoint | Module | Missing From |
|---|---|---|
| GET /api/geo/dashboard/:pid/truth | Dashboard | No card/widget in Dashboard |
| GET /api/geo/dashboard/:pid/presence | Dashboard | No card/widget in Dashboard |
| GET /api/geo/dashboard/:pid/verification | Dashboard | No card/widget in Dashboard |
| GET /api/geo/dashboard/:pid/providers | Dashboard | No card/widget in Dashboard |
| GET /api/geo/dashboard/:pid/timeline | Dashboard | No card/widget in Dashboard |
| GET /api/geo/entities | Knowledge | No Entity UI tab |
| GET /api/geo/claims | Knowledge | No Claim UI tab |
| GET /api/geo/workspace/timeline/* | Platform | No Timeline page |
| POST /api/geo/monitor/check-published | Health | No Monitor widget |
| POST /api/geo/monitor/check-indexed | Health | No Monitor widget |
| GET /api/geo/discovery/observatory/* | Discovery | Removed from IA |
| GET /api/geo/discovery/adoption | Discovery | Removed from IA |
| GET /api/geo/knowledge-quality | Knowledge | KIE scores embedded but no explain UI |

**Total Unconsumed:** 13 API endpoints
**Total Unconsumed minus Removed from IA:** 9 API endpoints

---

## 10. Consumer Health Index

| Module | Total API endpoints | Consumed | Unconsumed | Health |
|---|---|---|---|---|
| Dashboard | 9 | 4 | 5 | ⚠️ 44% |
| Knowledge | 7 | 5 | 2 | ⚠️ 71% |
| Recommendation | 3 | 3 | 0 | ✅ 100% |
| Verification | 4 | 4 | 0 | ✅ 100% |
| Health | 4 | 2 | 2 | ⚠️ 50% |
| Growth | 2 | 2 | 0 | ✅ 100% |
| Mission | 3 | 0 | 3 | ❌ 0% |
| BrandOverview | 7 | 7 | 0 | ✅ 100% |
| **Total** | **39** | **27** | **12** | **69% consumer coverage** |
