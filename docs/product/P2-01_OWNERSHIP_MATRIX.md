# Ownership Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## Domain Ownership

| Capability Module | Product Domain | Primary Service Directory | Owner Role |
|---|---|---|---|
| Dashboard | Dashboard Domain | `backend/src/services/geo/dashboard/` | Dashboard |
| Knowledge | Knowledge Domain | `backend/src/services/geo/runtime/knowledge/` | Knowledge |
| Recommendation | Optimization Domain | `backend/src/services/geo/recommendation/` | Optimization |
| Verification | Verification Domain | `backend/src/services/geo/verification/` | Verification |
| Health | Health Domain | `backend/src/services/geo/monitor/` | Health |
| Growth | Growth Domain | `backend/src/services/geo/growth/` | Growth |
| Mission | Mission Domain | `backend/src/services/geo/mission-engine/` | Mission |
| Discovery | Discovery Domain | `backend/src/services/geo/discovery/` | Discovery |
| Publishing | Publishing Domain | `backend/src/services/geo/publishing/` | Publishing |
| Presence | Presence Domain | `backend/src/services/geo/presence/` | Presence |

---

## Frontend Ownership

| Page | Vue File | Domain Owner |
|---|---|---|
| GEODashboard | `frontend/workspaces/geo/pages/GEODashboard.vue` | Dashboard |
| KnowledgePage | `frontend/workspaces/geo/pages/KnowledgePage.vue` | Knowledge |
| RecommendationsPage | `frontend/workspaces/geo/pages/RecommendationsPage.vue` | Optimization |
| VerificationPage | `frontend/workspaces/geo/pages/VerificationPage.vue` | Verification |
| HealthPage | `frontend/workspaces/geo/pages/HealthPage.vue` | Health |
| GrowthPage | `frontend/workspaces/geo/pages/GrowthPage.vue` | Growth |
| MissionWorkspacePage | `frontend/workspaces/geo/pages/MissionWorkspacePage.vue` | Mission |
| BrandOverview | `frontend/workspaces/geo/pages/BrandOverview.vue` | Cross-domain (shared) |
| GEOCreate | `frontend/workspaces/geo/pages/GEOCreate.vue` | Dashboard |
| DiscoveryLabPage | `frontend/workspaces/geo/pages/DiscoveryLabPage.vue` | Discovery |
| PublishingPage | `frontend/workspaces/geo/pages/PublishingPage.vue` | Publishing |

---

## Impact Rules

Any Sprint that touches a capability must involve its domain owner:

| If Sprint modifies... | Must involve... |
|---|---|
| Mission API or MissionGenerator | Mission Domain |
| KIE or KnowledgeObject | Knowledge Domain |
| Dashboard widgets | Dashboard Domain |
| etc. (self-explanatory from table above) | |
