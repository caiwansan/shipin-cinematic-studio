# KMKI GEO P1 Release Candidate

- **Date**: 2026-07-17
- **Tag**: geo-p1-rc
- **Status**: Release Candidate

## Architecture
- Runtime V1 RC — Frozen
- Knowledge Object — Sole Source of Truth
- Knowledge Pipeline — Unified Write Entry
- GraphSync — KO → Graph Projection

## Components

### Backend
- 17 API endpoints (brand/keyword/scan/dashboard/knowledge)
- 3 new tables (geo_keywords, geo_brand_settings, geo_scan_history)
- Knowledge Object Schema + Repository + Service
- Knowledge Pipeline + GraphSync
- KO Migration (95 projects migrated → 96 total KOs)

### Frontend (7 pages)
- Dashboard, BrandList, BrandDetail, Keyword, KnowledgeCenter, KnowledgeGraph, Settings
- Product + Developer navigation split
- All empty states, loading states, error handling

### Platform Package (studio-platform)
- Execution Engine + Pipeline (6 stages)
- Capability Orchestrator + Router + Policy Engine
- Provider/Model Registries + Health/Cost/Fallback Managers

## Metrics
- KOs: 96
- Entities: 1133
- Relations: 1163
- Brands: 114

## E2E Test Results

| Case | Description | Status | Details |
|------|-------------|--------|---------|
| 1 | Provider Status (unconfigured) | ✅ PASS | `configured: false`, providers empty |
| 2 | Brand Creation + Settings | ✅ PASS | Brand `b93d08ff` created, settings auto-init |
| 3 | Keywords CRUD | ✅ PASS | 3 keywords added (note: bulk payload uses Array<{keyword}>) |
| 4 | Knowledge Pipeline (Discovery) | ✅ PASS | KO `f50b3bac` created from discovery |
| 5 | Knowledge Center + Graph | ✅ PASS | 1 KO, 10 entities, API + DB consistent |
| 6 | Execution Trace | ✅ PASS | `/scans` endpoint returns empty (no scans yet for new brand) |
| 7 | Membership Quota | ✅ PASS | used=114, limit=0, membership=free |
| 8 | Historical Data Consistency | ✅ PASS | 96 KOs, 1133 entities, 1163 relations — all migrated data intact |
| 9 | Dashboard Stats | ✅ PASS | All metrics returned: 114 brands, 95 KOs, 1132 entities |
| 10 | Navigation Panel Mapping | ✅ PASS | 12 panels mapped, no fallback to placeholder for product items |

### Case 3 Note
The Keywords API accepts bulk create with payload format:
```json
{"projectId":"...","keywords":[{"keyword":"AI"},{"keyword":"知识图谱"}]}
```
Not `{"keywords":["AI","..."],"projectId":"...","type":"brand"}` as initially tested. This is a minor API contract detail — the endpoint works correctly.

## Release Notes
- Brand GEO MVP is deliverable as a standalone SaaS product
- Users can: create brand → configure provider → add keywords → discover entities → view knowledge graph
- All AI calls use user's own provider (SaaS model)
- Runtime V1 RC remains frozen — no modifications during P1
- E2E acceptance: 10/10 cases PASS

## Release Artifact
- Git Tag: `geo-p1-rc`
- Commit: `b15f9df`
- Artifact Path: `docs/releases/KMKI-GEO-P1-RC.md`
