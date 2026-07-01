# GEO MVP 清理计划

**日期**: 2026-07-20 | **基线**: GEO_MVP_REQUIREMENTS_V1.1.md + GEO_MVP_ARCHITECTURE.md  
**目标**: 列出所有需要删除/禁用/迁移的数据库表、后端文件、前端文件，精确到路径  

---

## 概览

| 类型 | 待删除 | 待保留 | 待迁移 |
|------|--------|--------|--------|
| Prisma Model | 34 | 3 | 0 |
| 数据库表（实际数据） | 18 张 0 行表 | 8 张有数据表 | 0 |
| 后端 Route 文件 | 14 | 3 (新增) | 0 |
| 后端 Service 文件 | ~70 | ~5 | 0 |
| 后端 Repository | 24 | 3 | 0 |
| 后端 Agent 文件 | 9 | 0 | 0 |
| 后端 KDP 文件 | 36 | 0 | 0 |
| 前端旧 workspace 文件 | 94 | 0 | 0 |
| 前端 RC1 页面 | 6 | 4 (重写) | 0 |
| 前端 RC1 Store | 6 | 4 (重写) | 0 |
| 产品文档 | ~20 | ~5 | 0 |

**清理原则**: 文件在工作目录中删除，git 历史保留。数据库表先用 `DROP TABLE IF EXISTS` 清理，数据保留在备份中。

---

## 1. 数据库清理

### 1.1 要保留的表（8 张）

| 表名 | 模型名 | 数据量 | 说明 |
|------|--------|--------|------|
| `kmki_geo_projects` | GEOProject | 8 | MVP核心 ✅ — 需添加 `website`/`keywords` 字段 |
| `geo_brand_settings` | GeoBrandSetting | 4 | MVP扩展配置 ✅ |
| `kmki_geo_project_profiles` | GeoProjectProfile | 8 | ⚠️ 数据需要迁移至 GEOProject.keywords + GEOProject.website，然后删表 |
| `kmki_geo_project_versions` | GEOProjectVersion | 3 | ⚠️ 数据需要迁移至新的 GEOScanRecord，然后删表 |
| `knowledge_objects` | KnowledgeObject | 104 | ⚠️ 保留物理表但不操作，模型先注释掉。数据有价值但 MVP 不消费 |
| `knowledge_packages` | KnowledgePackage | 13 | 同上 |
| `knowledge_assets` | KnowledgeAsset | 5 | 同上 |
| `optimization_executions` | OptimizationExecution | 7 | 保留物理表，不操作。数据不删但 MVP 不用 |

### 1.2 迁移步骤

| 步骤 | SQL | 注意事项 |
|------|-----|----------|
| 1 | `ALTER TABLE kmki_geo_projects ADD COLUMN website TEXT, ADD COLUMN keywords JSONB;` | 新增字段 |
| 2 | `UPDATE kmki_geo_projects p SET website = pp.website FROM kmki_geo_project_profiles pp WHERE pp."projectId" = p.id;` | 迁移 profile 数据（只有 8 条可用） |
| 3 | `UPDATE kmki_geo_projects p SET keywords = pp.keywords FROM kmki_geo_project_profiles pp WHERE pp."projectId" = p.id;` | 如果 profile 有关键词字段 |
| 4 | 创建 `kmki_geo_scan_records` 表（prisma migrate） | 新表 |
| 5 | 迁移 `kmki_geo_project_versions` 中有 `scanStatus` 的记录到新表 | 数据量很小（3 条） |

### 1.3 要删除的表（18 张无数据表 + 功能废弃表）

```sql
-- ⚠️ 这些表可以 DROP，数据已空或用不上

-- 无数据表
DROP TABLE IF EXISTS geo_projects;
DROP TABLE IF EXISTS geo_brand_profiles;
DROP TABLE IF EXISTS geo_graph_nodes;
DROP TABLE IF EXISTS geo_graph_edges;
DROP TABLE IF EXISTS kmki_geo_entity_relations;
DROP TABLE IF EXISTS kmki_geo_review_queue;
DROP TABLE IF EXISTS kmki_geo_quality_scores;
DROP TABLE IF EXISTS kmki_geo_freshness_records;
DROP TABLE IF EXISTS kmki_geo_benchmark_records;
DROP TABLE IF EXISTS kmki_geo_optimization_histories;
DROP TABLE IF EXISTS geo_score_versions;
DROP TABLE IF EXISTS growth_memories;
DROP TABLE IF EXISTS growth_knowledge;

-- 有微量数据但功能废弃的表
DROP TABLE IF EXISTS geo_keywords;             -- 6 rows，迁入 GEOProject.keywords
DROP TABLE IF EXISTS geo_scan_history;          -- 4 rows，迁入 GEOScanRecord
DROP TABLE IF EXISTS kmki_geo_score_snapshots;  -- 99 rows，全部测试数据
DROP TABLE IF EXISTS kmki_geo_citations;        -- 1 row，功能废弃
DROP TABLE IF EXISTS kmki_geo_faqs;             -- 1 row，功能废弃

-- 表未创建，仅注释 schema 中的 model
-- VerificationJob, VerificationResult, VerificationPolicy, LearningSignal,
-- PublishingRecord, PublishableClaim, PublishPlan, PublishPlanToClaim,
-- KnowledgeAsset, KnowledgePackage 等只在 schema 中定义，对应表不存在
```

### 1.4 要保留但模型注释的表

Prisma schema 中注释 model 但保留物理表不动（不回滚）：

```prisma
// 注释掉，表保留
// model GeoProjectProfile { ... }
// model GEOEntity { ... }
// model GeoKeyword { ... }
// model GeoScanHistory { ... }
// model KnowledgeObject { ... }
// model KnowledgePackage { ... }
// model KnowledgeAsset { ... }
// model OptimizationExecution { ... }
```

---

## 2. 后端文件清理

### 2.1 要保留的文件

```
backend/src/services/geo/
├── v1/
│   ├── geo-mvp.route.ts         ← 新增，MVP 10 个 API
│   ├── geo-scan.service.ts      ← 新增，扫描核心逻辑
│   └── geo-v1-product.route.ts  ← 删除，被 geo-mvp.route.ts 取代
├── repositories/
│   ├── geo-project.repository.ts        ← 保留并简化
│   ├── geo-scan-record.repository.ts    ← 新增
│   └── geo-brand-setting.repository.ts  ← 保留
├── index.ts                     ← 修改，只注册 MVP 路由
├── types.ts                     ← 保留
└── registry/
    └── geo-registry.ts          ← 保留
```

### 2.2 要删除/取消注册的后端文件（精确路径）

```
# 删整个目录
rm -rf backend/src/services/geo/agents/              # 9 files
rm -rf backend/src/services/geo/adapters/             # 3 files
rm -rf backend/src/services/geo/kdp/                  # 36 files, ~6300 lines
rm -rf backend/src/services/geo/routes/               # 14+ route files
rm -rf backend/src/services/geo/growth/               # 11 files
rm -rf backend/src/services/geo/monitor/              # 11 files
rm -rf backend/src/services/geo/publishing/            # 14 files
rm -rf backend/src/services/geo/recommendation/        # score service + route
rm -rf backend/src/services/geo/verification/          # verification engine + route

# 删单个仓库文件（保留 3 个，删 24 个）
rm backend/src/services/geo/repositories/geo-project-profile.repository.ts
rm backend/src/services/geo/repositories/geo-citation.repository.ts
rm backend/src/services/geo/repositories/geo-claim.repository.ts
rm backend/src/services/geo/repositories/geo-entity.repository.ts
rm backend/src/services/geo/repositories/geo-entity-relation.repository.ts
rm backend/src/services/geo/repositories/geo-evidence.repository.ts
rm backend/src/services/geo/repositories/geo-faq.repository.ts
rm backend/src/services/geo/repositories/geo-freshness.repository.ts
rm backend/src/services/geo/repositories/geo-keyword.repository.ts
rm backend/src/services/geo/repositories/geo-project-version.repository.ts
rm backend/src/services/geo/repositories/geo-quality.repository.ts
rm backend/src/services/geo/repositories/geo-review.repository.ts
rm backend/src/services/geo/repositories/geo-scan-history.repository.ts
rm backend/src/services/geo/repositories/geo-schema.repository.ts
rm backend/src/services/geo/repositories/geo-score-snapshot.repository.ts
rm backend/src/services/geo/repositories/geo-watcher.repository.ts
rm backend/src/services/geo/repositories/api-key.repository.ts
rm backend/src/services/geo/repositories/llm-usage-record.repository.ts
rm backend/src/services/geo/repositories/optimization-execution.repository.ts
rm backend/src/services/geo/repositories/publishing-record.repository.ts
rm backend/src/services/geo/repositories/resource-credential.repository.ts
rm backend/src/services/geo/repositories/user-model-config.repository.ts
rm backend/src/services/geo/repositories/verification-result.repository.ts
rm backend/src/services/geo/repositories/workspace-runtime.repository.ts
rm backend/src/services/geo/repositories/workspace-snapshot.repository.ts
```

**清理后后端 GEO 代码量**: 从 ~190 文件 / ~22,591 行 → **~20 文件 / ~2,500 行**（含新增的 450 行）

---

## 3. 前端文件清理

### 3.1 要保留的前端文件

```
frontend/workspaces/geo/
├── api.ts              ← 保留（auth ofetch 实例）
├── services/
│   └── projectService.ts ← 重写
├── stores/
│   └── useProjectStore.ts ← 重写（单一 store 替代 6 个）
├── pages/
│   ├── DashboardPage.vue       ← 重写
│   ├── CreatePage.vue          ← 重写
│   ├── BrandDetailPage.vue     ← 重写
│   └── ScanHistoryPage.vue     ← 重写
├── components/
│   ├── BrandCard.vue           ← 新增
│   └── ScanProgress.vue        ← 新增
├── layouts/
│   └── GeoWorkspaceLayout.vue  ← 简化
└── router.ts          ← 保留（更新路由映射）
```

### 3.2 要删除的前端文件

```
# 删除旧 workspace（全量删除——共 94 个文件）
rm -rf frontend/studio-v2/workspace/brand-geo/              # 72 files
rm -rf frontend/studio-v2/workspace/brand-geo-v2/            # 12 files

# 删除 RC1 废弃页面
rm frontend/workspaces/geo/pages/HealthPage.vue
rm frontend/workspaces/geo/pages/RecommendationsPage.vue
rm frontend/workspaces/geo/pages/VerificationPage.vue
rm frontend/workspaces/geo/pages/PublishingPage.vue
rm frontend/workspaces/geo/pages/GrowthPage.vue
rm frontend/workspaces/geo/pages/KnowledgePage.vue

# 删除 RC1 废弃 Service 文件
rm frontend/workspaces/geo/services/healthService.ts
rm frontend/workspaces/geo/services/recommendationsService.ts
rm frontend/workspaces/geo/services/verificationService.ts
rm frontend/workspaces/geo/services/publishingService.ts
rm frontend/workspaces/geo/services/growthService.ts
rm frontend/workspaces/geo/services/knowledgeService.ts

# 删除 RC1 废弃 Store 文件
rm frontend/workspaces/geo/stores/useHealthStore.ts
rm frontend/workspaces/geo/stores/useRecommendationsStore.ts
rm frontend/workspaces/geo/stores/useVerificationStore.ts
rm frontend/workspaces/geo/stores/usePublishingStore.ts
rm frontend/workspaces/geo/stores/useGrowthStore.ts
rm frontend/workspaces/geo/stores/useKnowledgeStore.ts

# 删除废弃 composables
rm frontend/workspaces/geo/composables/useGeoNavigation.ts
```

**清理后前端 GEO 代码量**: 从 ~1365 行（22 文件）→ **~800 行（10 文件，含新增）**

---

## 4. 产品文档清理

### 保留的文档（5 份）

| 文件 | 理由 |
|------|------|
| `docs/product/GEO_MVP_REQUIREMENTS_V1.1.md` | **新开发准则** |
| `docs/product/GEO_MVP_ARCHITECTURE.md` | **新架构指南** |
| `docs/product/GEO_MVP_CLEANUP.md` | **这个文件** |
| `docs/product/GEO_PRODUCT_PRINCIPLES.md` | 产品理念仍有效 |
| `docs/product/GEO_FEATURE_GATE.md` | 门禁机制仍用 |

### 归档（不删，移至 `docs/archive/`）

其余 24 份产品文档全部移入 `docs/archive/geo/` 目录：
- 旧 Wireframe（6 份）
- 旧 Sprint Brief（4 份）
- 旧 Backlog / Roadmap / Capability Matrix / Release Status
- 旧 Implementation Plan / Demo Script / Acceptance Standard
- 旧 Workspace Blueprint / IA / Narrative / Vocabulary
- 旧 Workspace Audit / RC1 Report
- 旧产品白皮书（以 v1.1 替代）
- 旧 Design System 文档（组件还在，文档要检查是否匹配）

---

## 5. Git 操作建议

```bash
# 创建一个清理分支
git checkout -b geo-mvp-cleanup

# 以上面的顺序执行
# 1. schema 修改 → prisma migrate
# 2. 后端文件删除
# 3. 前端文件删除
# 4. 文档归档
# 5. 新增文件写代码
# 6. 验证 build 通过
# 7. 部署验证

git commit -m "GEO MVP Cleanup: schema → 3 models, removed 170+ dead files, archived docs"
git tag geo-mvp-cleanup-v1
```

---

## 6. 风险与控制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 删除文件导致其他模块 import 断裂 | 编译失败 | `pnpm build` + `npx tsc` 双重验证 |
| `knowledge_objects` 虽不被消费但可能被 CEO 查询 | 数据不可见 | 表保留，prisma 注释但 DB 中 DROP 不执行 |
| `kmki_geo_project_profiles` 数据迁移丢失 | 品牌关键词丢失 | 迁移步骤先备份再操作 |
| 旧路由弃用后前台有人直接访问 | 404 | 不影响主要流程，加 Nginx 404 自解释 |
| 用户正在使用中的旧 GEO 页面 | 体验中断 | 提前预告+灰度切换 |

---

## 清理后代码量统计（目标）

| 区域 | 当前 | 清理后 | 减少 |
|------|------|--------|------|
| 后端 GEO 文件 | ~190 | ~20 | -170 |
| 后端 GEO 行数 | ~22,591 | ~2,500 | -20,091 |
| 前端 GEO 文件 | ~22 | ~10 | -12 (不含旧 workspace) |
| 前端 GEO 行数 | ~1,365 | ~800 | -565 |
| Prisma Model (GEO) | ~37 | ~3 | -34 |
| 产品文档 | ~29 | ~5 | -24（归档） |
