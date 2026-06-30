# GEO V1 Release Candidate — Frozen

> **冻结日期**: 2025-06-30  
> **版本**: GEO V1 RC  
> **状态**: ✅ Release Candidate — No further feature work; bug fixes only

---

## 1. 发布范围

| 域 | 内容 | 状态 |
|---|---|---|
| Frontend Pages | 16 pages, 42 integrated components | ✅ Frozen |
| Backend Routes | 15 REST routes, 11 services, 5 repositories | ✅ Frozen |
| Adapters | 5 frontend adapters (Citation, Claim, Evidence, History, Report) | ✅ Frozen |
| API Endpoints | 57+ endpoints with auth, pagination, unified envelopes | ✅ Frozen |
| Workflow | Brand → Knowledge → Evidence → Claim → History → Report | ✅ Runnable |

## 2. 已裁剪（不包含在 V1）

- SemanticExplorer — dead code, deleted
- WebsiteScanner — Phase 2 stub, deleted
- BrandProfilePage — unused, deleted
- AssetCenterPage — empty placeholder, deleted
- ExecutionPanel — superseded, deleted
- InspectorPanel — superseded, deleted
- ProjectCreatePage — unused, deleted
- ProjectSelectPage — unused, deleted
- Wizard components (8 files) — unused, deleted

## 3. API 端点一览

| 前缀 | 路由数 | 认证 | 分页 |
|---|---|---|---|
| `/api/geo/brands` | 7 | ✅ All | ✅ |
| `/api/geo/claims` | 3 | ✅ All | ✅ |
| `/api/geo/evidence` | 2 | ✅ All | ✅ |
| `/api/geo/keywords` | 5 | ✅ All | ✅ |
| `/api/geo/knowledge` | 4 | ✅ All | ✅ |
| `/api/geo/projects` | 7 | ✅ All | ✅ |
| `/api/geo/citations` | 5 | ✅ All | ✅ |
| `/api/geo/scans` | 4 | ✅ All | ✅ |
| `/api/geo/dashboard` | 2 | ✅ All | ✅ |
| `/api/geo/history` | 2 | ✅ All | ✅ |
| `/api/geo/reports` | 2 | ✅ All | ✅ |
| `/api/geo/traces` | 3 | ✅ All | ✅ |
| `/api/geo/watcher` | 3 | ✅ All | ✅ |
| `/api/geo/entity` | 7 | ✅ All | ✅ |
| `/api/geo/graph` | 6 | ✅ All | ✅ |

## 4. 冻结约定

1. **No new features**: No new pages, routes, services, or adapters
2. **Bug fixes only**: Critical/blocking issues may be patched
3. **No Platform code changes**: GEO stays within `brand-geo/` and `services/geo/`
4. **API envelope is frozen**: `{ success, data/error }` — no breaking changes
5. **Adapter interface is frozen**: Named exports only via `geo*Adapter`
6. **State component contract**: `GeoLoadingState`, `GeoErrorState`, `GeoEmptyState`, `GeoToast`

---

*GEO V1 Engineering Finish — Signed off at RC*
