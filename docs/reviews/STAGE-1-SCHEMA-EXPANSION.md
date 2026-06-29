# Stage 1 — Schema Expansion （完成）

**Date:** 2026-07-18  
**Status:** ✅ COMPLETE

---

## 变更清单

| 表 | 操作 | 新增字段 | 索引 |
|----|------|---------|------|
| `Project` | 扩展 | `tenantId`, `ownerId`, `type`, `resourceCount`, `lastExecutionAt`, `lastActivityAt` | `tenantId`, `type` |
| `Workspace` | 扩展 | `tenantId`, `workspaceType` | `tenantId` |
| `GeoProjectProfile` | **新建** | 全部 | `projectId` (unique) |
| `kmki_geo_entities` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_entity_relations` | 扩展 | `tenantId` | — |
| `kmki_geo_project_versions` | 扩展 | `tenantId` | — |
| `kmki_geo_claims` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_evidences` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_citations` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_faqs` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_schema_markups` | 扩展 | `tenantId` | — |
| `kmki_geo_review_queue` | 扩展 | `tenantId` | `tenantId` |
| `kmki_geo_quality_scores` | 扩展 | `tenantId` | — |
| `kmki_geo_freshness_records` | 扩展 | `tenantId` | — |
| `kmki_geo_benchmark_records` | 扩展 | `tenantId` | — |
| `kmki_geo_score_snapshots` | 扩展 | `tenantId` | — |
| `kmki_geo_optimization_histories` | 扩展 | `tenantId` | `tenantId` |

**总计：1 新建表 + 16 扩展表 + 15 新增索引**

---

## 验收

| 检查项 | 方法 | 结果 |
|--------|------|------|
| Schema Diff（无意外修改） | SQL 手工 Review | ✅ 仅新增字段和表 |
| Migration SQL Review | 检查 `migration.sql` | ✅ 无 DROP/RENAME |
| Prisma Schema 验证 | `npx prisma validate` | ✅ 合法 |
| Prisma Client 生成 | `npx prisma generate` | ✅ 成功 |
| 后端启动 | `npm run build` | 待确认 |
| 前端启动 | `nuxt build` | 待确认 |
| 旧 API 正常 | 调用 `GET /api/geo/projects` | 待确认 |
| GEO Workspace 正常 | 打开页面 | 待确认 |

**零业务代码修改** — 未修改 Repository / Service / API / Frontend / Store / Execution。

---

## 迁移 SQL 文件

`backend/prisma/migrations/20260718_phase1a_schema_expansion/migration.sql`

该文件需要纳入版本控制并与 `prisma migrate deploy` 同步。

---

## 决议

✅ **Stage 1 完成。** 新字段全部可为空，不破坏现有业务。  
⏳ 等待确认后端构建通过后，进入 **Stage 2（Backfill）**。
