# Phase 1.0 — Migration Readiness Checklist

**Status:** ⬜ CHECKLIST IN PROGRESS  
**Date:** 2026-07-18  
**Design Phase — No database changes allowed.**

---

## 1. Repository Inventory

### 1.1 Backend Repository 完整清单

**GEO-specific (requires rewrite):**

| Repository | 当前操作实体 | 迁移目标 | 变更类型 | 文件位置 |
|------------|------------|---------|---------|---------|
| `geoProjectService` | `prisma.gEOProject` | `prisma.project` + `prisma.geoProfile` | 🔴 重写 | `backend/src/services/geo/services/geo-project.service.ts` |
| `geoEntityService` | `prisma.gEOProject.findUnique` (project 校验) | `prisma.project.findUnique` | 🟡 修改引用 | `backend/src/services/geo/services/geo-entity.service.ts` |
| `geoGraphService` | `prisma.gEOProject.findUnique` (project 校验) | `prisma.project.findUnique` | 🟡 修改引用 | `backend/src/services/geo/services/geo-graph.service.ts` |
| `geoClaimRepository` | `prisma.gEOClaim` | `prisma.gEOClaim` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-claim.repository.ts` |
| `geoEvidenceRepository` | `prisma.gEOEvidence` | `prisma.gEOEvidence` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-evidence.repository.ts` |
| `geoCitationRepository` | `prisma.gEOCitation` | `prisma.gEOCitation` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-citation.repository.ts` |
| `geoFAQRepository` | `prisma.gEOFAQ` | `prisma.gEOFAQ` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-faq.repository.ts` |
| `geoSchemaRepository` | `prisma.gEOSchemaMarkup` | `prisma.gEOSchemaMarkup` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-schema.repository.ts` |
| `geoReviewRepository` | `prisma.gEOReviewQueue` | `prisma.gEOReviewQueue` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-review.repository.ts` |
| `geoQualityRepository` | `prisma.gEOQualityScore` | `prisma.gEOQualityScore` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-quality.repository.ts` |
| `geoFreshnessRepository` | `prisma.gEOFreshnessRecord` | `prisma.gEOFreshnessRecord` (加 tenantId) | 🟢 加字段 | `backend/src/services/geo/repositories/geo-freshness.repository.ts` |

**Platform (no change):**

| Repository | 说明 |
|-----------|------|
| `TenantRepository` | 平台已有，新增 Personal Tenant 创建逻辑 |
| `WorkspaceRepository` | 平台已有，不变 |
| `projectStore` (frontend) | 平台已有，需扩展 |

### 1.2 GEO 子表独有字段 → tenantId 矩阵

| 模型 | 表名 | projectId | entityId | userId | tenantId (需加) |
|------|------|-----------|----------|--------|----------------|
| GEOProject | kmki_geo_projects | — | — | ✅ 有 | ❌ **新增** |
| GEOEntity | kmki_geo_entities | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOEntityRelation | kmki_geo_entity_relations | ✅ | sourceId/targetId | ❌ 无 | ❌ **新增** |
| GEOProjectVersion | kmki_geo_project_versions | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOClaim | kmki_geo_claims | — | ✅ | ❌ 无 | ❌ **新增** |
| GEOEvidence | kmki_geo_evidences | — | — | ❌ 无 | ❌ **新增** |
| GEOCitation | kmki_geo_citations | — | — | ❌ 无 | ❌ **新增** |
| GEOFAQ | kmki_geo_faqs | — | ✅ | ❌ 无 | ❌ **新增** |
| GEOSchemaMarkup | kmki_geo_schema_markups | — | ✅ | ❌ 无 | ❌ **新增** |
| GEOReviewQueue | kmki_geo_review_queues | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOQualityScore | kmki_geo_quality_scores | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOFreshnessRecord | kmki_geo_freshness_records | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOBenchmarkRecord | kmki_geo_benchmark_records | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOScoreSnapshot | kmki_geo_score_snapshots | ✅ | — | ❌ 无 | ❌ **新增** |
| GEOOptimizationHistory | kmki_geo_optimization_history | ✅ | — | ❌ 无 | ❌ **新增** |

**结论：15 张表中的 11 张有 projectId（可通过 JOIN 间接获取 tenant），4 张只有 entityId 无 projectId。全部需冗余存 tenantId。**

---

## 2. 数据影响矩阵

| 表 | 是否新增 | 新增字段 | 索引调整 | 回填需求 |
|----|---------|---------|---------|---------|
| `Project` | 直接扩展 | `tenantId`, `ownerId`, `type`, `resourceCount`, `lastExecutionAt`, `lastActivityAt` | 加 `@@index([tenantId])`, `@@index([type])` | tenantId 回填、type 回填 |
| `GeoProjectProfile` | ✅ **新建** | 全部 | `@@unique([projectId])` | 从 GEOProject 回填 |
| `GEOProject` | ❌ 废弃 | — | — | 迁移到 Project + Profile |
| 15 张 GEO 子表 | 加字段 | `tenantId` | 每表加 `@@index([tenantId])` | 从 Project.tenantId JOIN 回填 |
| `Workspace` | 加字段 | `tenantId`, `workspaceType` | `@@index([tenantId])` | 回填 |

---

## 3. API Inventory

### 3.1 后端 API 路径

| 路由文件 | 方法 | PATH | 当前操作 | 迁移后操作 |
|---------|------|------|---------|-----------|
| `geo-project.route.ts` | POST | `/api/geo/projects` | `geoProjectService.createProject` → `prisma.gEOProject.create` | → `ProjectService.create` + `geoProfileRepository.create` |
| `geo-project.route.ts` | GET | `/api/geo/projects` | `geoProjectService.listProjects` → `prisma.gEOProject.findMany` | → `ProjectService.listByType('geo')` |
| `geo-project.route.ts` | GET | `/api/geo/projects/:id` | `geoProjectService.getProject` → `prisma.gEOProject.findUnique` | → `ProjectService.get` + `geoProfileRepository.get` |
| `geo-project.route.ts` | PUT | `/api/geo/projects/:id` | `geoProjectService.updateProject` → `prisma.gEOProject.update` | → `ProjectService.update` + `geoProfileRepository.update` |
| `geo-project.route.ts` | DELETE | `/api/geo/projects/:id` | `geoProjectService.deleteProject` → soft-delete | → `ProjectService.delete` |
| `geo-project.route.ts` | GET | `/api/geo/projects/:id/versions/:version` | getProjectVersion | → 通过 Project 关联查询 |
| `geo-project.route.ts` | POST | `/api/geo/projects/:id/snapshot` | snapshotProject | → Project 下 Profile 快照 |
| `geo-entity.route.ts` | POST/GET/PUT | `/api/geo/entities/...` | 校验 `prisma.gEOProject`, 读写 `GEOEntity` | 校验走 `Project`, 子表加 `tenantId` |
| `geo-graph.route.ts` | POST/GET | `/api/geo/projects/:id/graph/...` | 校验 `prisma.gEOProject`, 读写 GEO 关系表 | 校验走 `Project` |
| `geo-knowledge-quality.route.ts` | POST/GET | `/api/geo/knowledge-quality/...` | 读写 GEOClaim/Evidence/Citation/FAQ | 子表加 `tenantId` |

### 3.2 统一 API (Phase 1b 新增)

| Method | Path | 功能 |
|--------|------|------|
| GET | `/api/projects?type=geo` | 统一查询 GEO 项目 |
| POST | `/api/projects` | 创建项目（type=geo 走 GeoProfile） |
| GET | `/api/projects/:id` | 统一获取 |
| PUT | `/api/projects/:id` | 统一更新 |
| DELETE | `/api/projects/:id` | 统一删除 |
| GET | `/api/projects/:id/geo-profile` | GEO 特有字段 |
| PUT | `/api/projects/:id/geo-profile` | 更新 GEO 特有字段 |

### 3.3 API 兼容策略

```
旧 API (Phase 1b-c 保留):
  GET /api/geo/projects → 内部调用 ProjectService，返回格式兼容
  POST /api/geo/projects → 内部创建 Project + GeoProfile

新 API (Phase 1b 新增):
  GET /api/projects?type=geo → 直接走 ProjectService
  /api/projects/:id/geo-profile → Profile 专用

切换: Feature flag `GEO_USE_LEGACY_PROJECT`
  true → 走旧 geoProjectService
  false → 走新 ProjectService
```

---

## 4. Frontend Inventory

### 4.1 引用 GeoProject/GeoProjectV2 的文件

| 文件 | 引用类型 | 用途 | 迁移方案 |
|------|---------|------|---------|
| `studio-v2/types/geo/brand.ts` | `GeoProject` / `GeoProjectV2` | 类型定义 | 🗑️ 替换为 `UnifiedProject` |
| `studio-v2/types/geo/runtime.ts` | `GeoProject[]` / `GeoProjectV2[]` | Store 状态类型 | 🗑️ 替换为 `UnifiedProject[]` |
| `studio-v2/types/geo/index.ts` | re-export | 类型入口 | 🟡 更新导出 |
| `studio-v2/workspace/brand-geo/stores/useBrandGeoStore.ts` | `GeoProject[]` / `GeoProjectV2[]` | store 数据 | 🗑️ 引用 `projectStore` + 本地 Profile 缓存 |
| `studio-v2/workspace/brand-geo/services/projectService.ts` | `GeoProject` | API 调用层 | 🗑️ 改为调用统一 API `/api/projects` |
| `studio-v2/workspace/brand-geo/composables/useBrandGEORuntime.ts` | `GeoProject` | 运行时逻辑 | 🟡 更新类型引用 |

### 4.2 前端 API 调用清单

| 文件 | 调用路径 | 当前行为 | 迁移后行为 |
|------|---------|---------|-----------|
| `brand-geo/services/projectService.ts` | `/api/geo/projects` | 直接调用 GEO API | 改为 `/api/projects?type=geo` |
| `brand-geo/stores/useBrandGeoStore.ts` | `/api/geo/projects` | fetch 旧 API | 调用 `projectService` 统一接口 |
| `brand-geo/stores/useBrandGeoStore.ts` | `/api/geo/brands` | 不变（Brand 非 Project） | 无需变更 |

### 4.3 GEO Brand 非-Project 数据 (不迁移)

以下数据不涉及 Project 实体，无需变更：
- `brandService.ts` → `/api/geo/brands`
- `brandService.ts` → `/api/geo/brands/:id/visibility`
- `brandService.ts` → `/api/geo/brands/:id/citations`
- `brandService.ts` → `/api/geo/brands/:id/competitors`
- `brandService.ts` → `/api/geo/brands/:id/entities`

---

## 5. Feature Flag 设计

### 5.1 后端

```typescript
// backend/src/config/flags.ts
export const FEATURE_FLAGS = {
  'project-center-v2': {
    // 由环境变量控制，默认关闭
    enabled: process.env.GEO_USE_LEGACY_PROJECT !== 'true',
  },
}

// 使用方式
if (featureFlags['project-center-v2'].enabled) {
  return unifiedProjectService.listByTenant(tenantId, 'geo')
} else {
  return geoProjectService.listProjects(tenantId)
}
```

### 5.2 前端

```typescript
// frontend/utils/featureFlags.ts
export const featureFlags = {
  'project-center-v2': computed(() => {
    // 从 API 配置或 localStorage 获取
    return useRuntimeConfig().public.featureFlags?.projectCenterV2 === true
  }),
}

// 组件中使用
if (featureFlags['project-center-v2'].value) {
  // 使用 UnifiedProject store
} else {
  // 使用旧 GeoProject store
}
```

### 5.3 回滚环境变量

```
# 回滚至旧逻辑
GEO_USE_LEGACY_PROJECT=true
VITE_FEATURE_PROJECT_CENTER_V2=false
```

---

## 6. Migration Script（草案，未执行）

### 6.1 Phase 1a — Prisma Schema 变更

```prisma
// Step 1: Project 表扩展
model Project {
  id               String     @id @default(uuid()) @db.Uuid
  tenantId         String     @db.Uuid          // NEW: NOT NULL after backfill
  ownerId          String     @db.Uuid          // NEW: renames from userId
  type             String     @default("custom") // NEW: 'geo' | 'video' | 'novel' | 'ppt' | 'custom'
  // 通用字段
  name             String
  description      String?
  status           String     @default("draft")
  version          Int        @default(1)
  // 预留
  resourceCount    Int        @default(0)
  lastExecutionAt  DateTime?
  lastActivityAt   DateTime?
  // 已有字段 (保留)
  budgetLimit      Float?
  budgetSpent      Float      @default(0)
  // ... 其他已有字段不变

  // 关系
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  owner     User      @relation(fields: [ownerId], references: [id])
  workspace Workspace? @relation(fields: [workspaceId], references: [id])

  // GEO Profile (NEW)
  geoProfile GeoProjectProfile?

  @@index([tenantId])
  @@index([type])
  @@index([tenantId, type])
  @@map("Project")
}

// Step 2: GeoProjectProfile (NEW)
model GeoProjectProfile {
  id         String   @id @default(uuid())
  projectId  String   @unique @db.Uuid
  website    String?
  domain     String?
  brand      String?
  language   String   @default("zh")
  country    String?
  industry   String?
  topic      String?
  geoConfig  Json     @default("{}")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("kmki_geo_project_profiles")
}

// Step 3: GEO 子表加 tenantId (以 GEOEntity 为例，其余 14 张相同)
model GEOEntity {
  id         String   @id @default(uuid())
  tenantId   String   @db.Uuid  // NEW
  projectId  String
  name       String
  type       String   @default("Concept")
  // ... 其余字段不变

  project  GEOProject          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  outgoing GEOEntityRelation[] @relation("outgoing")
  incoming GEOEntityRelation[] @relation("incoming")
  claims   GEOClaim[]
  faqs     GEOFAQ[]
  schemaMarkups GEOSchemaMarkup[]

  @@index([tenantId])
  @@index([projectId])
  @@index([projectId, type])
  @@map("kmki_geo_entities")
}
```

### 6.2 Migration Up

```sql
-- Step 1: Project 表加字段
ALTER TABLE "Project" ADD COLUMN "tenantId" UUID;
ALTER TABLE "Project" ADD COLUMN "ownerId" UUID;
ALTER TABLE "Project" ADD COLUMN "type" VARCHAR DEFAULT 'custom';
ALTER TABLE "Project" ADD COLUMN "resourceCount" INTEGER DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "lastExecutionAt" TIMESTAMP;
ALTER TABLE "Project" ADD COLUMN "lastActivityAt" TIMESTAMP;

-- Step 2: 新建 GeoProjectProfile
CREATE TABLE "kmki_geo_project_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL UNIQUE REFERENCES "Project"(id) ON DELETE CASCADE,
  "website" TEXT,
  "domain" TEXT,
  "brand" TEXT,
  "language" VARCHAR(10) DEFAULT 'zh',
  "country" VARCHAR(10),
  "industry" TEXT,
  "topic" TEXT,
  "geoConfig" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Step 3: GEO 子表加 tenantId
ALTER TABLE "kmki_geo_entities" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_entity_relations" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_project_versions" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_claims" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_evidences" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_citations" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_faqs" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_schema_markups" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_review_queues" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_quality_scores" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_freshness_records" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_benchmark_records" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN "tenantId" UUID;
ALTER TABLE "kmki_geo_optimization_history" ADD COLUMN "tenantId" UUID;

-- Step 4: Workspace 加字段
ALTER TABLE "Workspace" ADD COLUMN "tenantId" UUID;
ALTER TABLE "Workspace" ADD COLUMN "workspaceType" VARCHAR DEFAULT 'geo';
```

### 6.3 Backfill

```sql
-- Step 1: 建立 User → Tenant 映射（假设每个 User 有一个 Personal Tenant）
-- 如果没有 Personal Tenant，需要先创建
INSERT INTO "governance_tenant" (id, name, type, status)
SELECT id, name, 'personal', 'active'
FROM "User"
WHERE id NOT IN (SELECT ownerId FROM "governance_tenant" WHERE type='personal')
ON CONFLICT DO NOTHING;

-- Step 2: Backfill Project.tenantId
UPDATE "Project" p
SET "tenantId" = t.id
FROM "governance_tenant" t
WHERE p."userId" = t."ownerId" AND t.type = 'personal';

-- Backfill: 无映射的 Project → 创建一个默认 Personal Tenant
-- (实际执行时需脚本处理)

-- Step 3: GEOProject → Project + GeoProfile 迁移
-- 创建 Project（type='geo'）
INSERT INTO "Project" (id, "tenantId", "ownerId", type, name, status, "workspaceId", "createdAt", "updatedAt")
SELECT 
  gp.id,
  gp."userId",  -- 临时，后续更新为真实 tenantId
  gp."userId",
  'geo',
  gp.name,
  gp.status,
  gp."workspace_id",
  gp."createdAt",
  gp."updatedAt"
FROM "kmki_geo_projects" gp
WHERE gp."deletedAt" IS NULL;

-- 创建 GeoProjectProfile
INSERT INTO "kmki_geo_project_profiles" ("projectId", topic, industry, language, country, "geoConfig")
SELECT id, topic, industry, language, country, config
FROM "kmki_geo_projects"
WHERE "deletedAt" IS NULL;

-- Step 4: GEO 子表 backfill tenantId
UPDATE "kmki_geo_entities" e
SET "tenantId" = p."tenantId"
FROM "Project" p
WHERE e."projectId" = p.id;
-- ... 其余 14 张子表相同操作

-- Step 5: 索引
CREATE INDEX ON "Project"("tenantId");
CREATE INDEX ON "Project"("type");
CREATE INDEX ON "kmki_geo_entities"("tenantId");
-- ... 其余 14 个子表
```

### 6.4 Migration Down

```sql
-- 回滚：删列
ALTER TABLE "Project" DROP COLUMN "tenantId";
ALTER TABLE "Project" DROP COLUMN "ownerId";
ALTER TABLE "Project" DROP COLUMN "type";
ALTER TABLE "Project" DROP COLUMN "resourceCount";
ALTER TABLE "Project" DROP COLUMN "lastExecutionAt";
ALTER TABLE "Project" DROP COLUMN "lastActivityAt";
DROP TABLE IF EXISTS "kmki_geo_project_profiles";
ALTER TABLE "kmki_geo_entities" DROP COLUMN "tenantId";
-- ... 其余 14 张子表
ALTER TABLE "Workspace" DROP COLUMN "tenantId";
ALTER TABLE "Workspace" DROP COLUMN "workspaceType";
```

### 6.5 Verify

```sql
-- 校验：所有记录 tenantId 非空
SELECT COUNT(*) FROM "Project" WHERE "tenantId" IS NULL;
SELECT COUNT(*) FROM "kmki_geo_entities" WHERE "tenantId" IS NULL;
SELECT COUNT(*) FROM "kmki_geo_claims" WHERE "tenantId" IS NULL;
-- ... 全部应为 0

-- 校验：Project.type 非空
SELECT DISTINCT type FROM "Project";

-- 校验：数据一致性
SELECT COUNT(*) FROM "kmki_geo_project_profiles" pp
LEFT JOIN "Project" p ON pp."projectId" = p.id
WHERE p.id IS NULL;
-- 应为 0

-- 校验：迁移完整性
SELECT COUNT(*) FROM "kmki_geo_projects" gp
WHERE gp."deletedAt" IS NULL
  AND gp.id NOT IN (SELECT id FROM "Project" WHERE type = 'geo');
-- 应为 0
```

---

## 7. 测试计划

### 7.1 测试场景

| 测试 | 场景 | 预期 | 验证方式 |
|------|------|------|---------|
| TC-01 | 新建 GEO Project | 创建 Project（type=geo）+ GeoProjectProfile | API 调用 + DB 查询 |
| TC-02 | 编辑 GEO Project | 更新 Project 名称、GeoProfile 字段 | API 调用 |
| TC-03 | 删除 GEO Project | 软删除，子表级联 | API 调用 |
| TC-04 | 查询 GEO Project | 返回 UnifiedProject 包含 geoProfile | API 调用 |
| TC-05 | 查询所有 GEO Projects | 按 tenantId 过滤，type=geo | API 调用 + DB 查询 |
| TC-06 | Tenant 隔离 | Tenant A 看不到 Tenant B 的 Project | API 调用跨租户查询 |
| TC-07 | Project.type 过滤 | `GET /api/projects?type=geo` | API 调用 |
| TC-08 | 历史数据读取 | 已有 GEOProject 迁移后可读 | API 调用 + DB 查询 |
| TC-09 | 子表隔离查询 | GEOEntity 只返回当前 tenant 的数据 | API 调用跨租户 |
| TC-10 | 回滚 | feature flag 切换后系统正常 | 前后端切换测试 |
| TC-11 | 空环境 | 无数据时新建 Project | API 调用 |
| TC-12 | 并发创建 | 同一用户同时创建多个 Project | 压力测试 |

### 7.2 自动测试

```bash
# 单元测试
npx vitest run -- test/unit/project-center-v2.test.ts

# API 测试
npx vitest run -- test/api/geo-project.test.ts
npx vitest run -- test/api/unified-project.test.ts

# E2E 测试
npx cypress run --spec cypress/e2e/geo-project.cy.ts

# 数据一致性校验
node scripts/verify-migration.mjs
```

### 7.3 稳定运行验证

```
Day 1-3: 双写 + feature flag 观察
Day 4-7: 新 API 为主 + 旧 API 降级
Day 8+:  确认无异常，关闭旧代码

条件:
- 无 tenantId = NULL 记录新增
- 无 Project.type = NULL 记录新增
- 无前端 GeoProject 类型错误
- 无 GEO 功能降级报告
```

---

## 8. 风险清单

| # | 风险 | 等级 | 优先级 | 影响 | 应对 |
|---|------|------|-------|------|------|
| R1 | 历史数据 tenantId 回填失败 | 🔴 高 | **P0** | 数据库迁移无法完成 | 先建 User→Tenant 映射，分批 backfill，每批 verify |
| R2 | 前端仍引用 GeoProject 类型 | 🔴 高 | **P0** | 编译错误或运行时类型不匹配 | Inventory 确认全部替换，CI 添加类型检查 |
| R3 | 双写不一致（新旧数据冲突） | 🔴 高 | **P0** | 数据不一致 | Feature flag 控制 100% 切换，观察期双写校验 |
| R9 | 无 Personal Tenant 创建逻辑 | 🟡 中 | **P0** | 回填时 tenantId 缺失 | 在 migration 前实现 Personal Tenant 自动创建 |
| R4 | GEO 子表数据量过大导致 backfill 超时 | 🟡 中 | **P1** | 迁移窗口过长 | 分批迁移（每批 1000 条），加索引 |
| R5 | Workspace.tenantId 回填缺少映射 | 🟡 中 | **P1** | 无法建立 Tenant→Workspace 关系 | 通过 Project.tenantId 推导，或默认 |
| R6 | 迁移回滚后旧代码无法处理新加字段 | 🟡 中 | **P1** | 回滚后系统异常 | Migration Down 脚本必须完整删除新加字段 |
| R7 | HdzProject 也需要加 tenantId | 🟡 中 | **P1** | 当前只处理 GEO，小说会在后续 | 仅 Plan 阶段确认，不在 Phase 1 执行 |
| R8 | Platform Project 的短剧字段耦合过深 | 🟡 中 | **P1** | 迁移成本高 | 当前只加字段，不改现有字段名 |
| R10 | 团队成员未收到变更沟通 | 🟢 低 | **P2** | 并行开发冲突 | 设计评审后发出变更通知 |

---

## 9. Project Dependency Audit

### 9.1 GEOProject 依赖图

```
                    GEOProject (kmki_geo_projects)
                            │
            ┌───────────────┼───────────────────┐
            │               │                   │
       后端 Prisma     后端 Service         前端 Store
            │               │                   │
     ┌──────┴──────┐  ┌────┴────┐      ┌───────┴───────┐
     │ 15 张子表    │  │ geo-    │      │ useBrand      │
     │ (依赖 FK)   │  │ project │      │ GeoStore      │
     │             │  │ .service│      │               │
     │ GEOEntity   │  │ .ts     │      │ projects[]    │
     │ GEOClaim    │  │         │      │ v2Projects[]  │
     │ ...         │  │ ↔ routes│      │               │
     └─────────────┘  └────────┘      └───────────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
           geo-entity             geo-graph
           .service               .service
                 │                     │
                 └──── geo-knowledge-quality.route (/api/geo/knowledge-quality)
```

### 9.2 依赖层汇总

| 层 | 涉及文件数 | 说明 |
|----|-----------|------|
| Prisma Schema | 1 个表 + 15 子表 | schema.prisma |
| Backend Services | 11 个 | 1 个 project service + 10 个其他 service |
| Backend Routes | 4 个 | 所有 GEO 路由文件 |
| Backend Agents | 8 个 | entity.agent / knowledge-graph.agent / research.agent + 5 个 KQ agents |
| Backend Registry | 3 个 | geo-workflow.ts / geo-workflow-registration / geo-prompt-registry |
| Backend index.ts | 1 个 | 注册路由和 agent |
| Frontend Types | 2 个 | brand.ts / runtime.ts |
| Frontend Store | 1 个 | useBrandGeoStore.ts |
| Frontend Services | 1 个 | projectService.ts |
| Frontend Composables | 1 个 | useBrandGEORuntime.ts |

**总计：约 33 个文件受 Phase 1 影响。其中 8 个需重写、15 个需修改引用、10 个保持不变。**

---

## 10. Checklist 进度表

| # | 检查项 | 状态 | 完成日期 |
|---|--------|------|---------|
| 1.0.1 | ✅ Repository Inventory 完整 | ⬜ | 已输出 → `PHASE-1.0-CHECKLIST.md §1` |
| 1.0.2 | ✅ 数据影响矩阵完成 | ⬜ | 已输出 → `PHASE-1.0-CHECKLIST.md §2` |
| 1.0.3 | ✅ API Inventory 完整 | ⬜ | 已输出 → `PHASE-1.0-CHECKLIST.md §3` |
| 1.0.4 | ✅ Frontend Inventory 完整 | ⬜ | 已输出 → `PHASE-1.0-CHECKLIST.md §4` |
| 1.0.5 | ✅ Feature Flag 设计完成 | ⬜ | 后端 `backend/src/config/feature-flags.ts` + 前端 `frontend/utils/featureFlags.ts` |
| 1.0.6 | ✅ Migration Script（未执行）完成并评审 | ⬜ | 草案已输出 → `PHASE-1.0-CHECKLIST.md §6`，待评审 |
| 1.0.7 | ✅ 测试计划完成 | ⬜ | 场景已列出 → `PHASE-1.0-CHECKLIST.md §7`，待细化用例 |
| 1.0.8 | ✅ 风险清单完成 | ⬜ | 已分类 → `PHASE-1.0-CHECKLIST.md §8` |
| 1.0.9 | ✅ Personal Tenant 创建逻辑 | ⬜ | 后端 `backend/src/services/platform/governance/services/personal-tenant.service.ts` + 注册流程嵌入 |
| 1.0.10 | ✅ Cross-Workspace Impact Audit | ⬜ | 已输出 → `docs/reviews/CROSS-WORKSPACE-IMPACT-AUDIT.md` |
| **Gate** | **全部通过后，进入 Phase 1a** | **⬜** | **—** |

### 10.1 Phase 1a Entry Gates

| Gate | 状态 | 交付物 | 说明 |
|------|------|--------|------|
| A | ✅ Backfill Dry Run | `scripts/migration-dry-run.mjs` | 6 步模拟：Tenant→type→tenantId→Profile→子表→回滚。支持 `--summary`/`--sql-only` |
| B | ✅ 数据一致性校验器 | `scripts/verify-migration.mjs` | 5 类 15+ 项检查。支持 `--fast`/`--tenant-only` |
| C | ✅ Feature Flag 演练 | `scripts/test-feature-flags.mjs` | 5 个场景：Pre→Dual→Post→Rollback→Geo-only rollback |
| **Gate** | **⬜ 满足后执行 Phase 1a** | **—** | **—** |
