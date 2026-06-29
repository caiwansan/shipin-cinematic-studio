# Phase 1: Tenant & Project Center Migration Design

**Status:** ⚠️ DRAFT — pending design review  
**Date:** 2026-07-18  
**Impact:** GEO → Video → Novel → PPT (all Workspaces)

---

## 1. 现状 ER 图

### 1.1 现状 Tenant 体系

```
Tenant (governance_tenant)         ← 平台已有，GEO 不使用
┌─────────────┐
│ id          │
│ name        │
│ type        │  ← personal / team / enterprise
│ status      │
└─────────────┘
     │
     ├── GovOrganization[]
     ├── Subscription[]
     ├── Quota?
     ├── GovUser[]         ← 用户挂 Tenant
     └── Role[]
```

### 1.2 现状 Project 体系（分裂）

```
平台 Project (Project)
┌─────────────────────────┐
│ id (uuid)               │
│ name                     │
│ userId                   │  ← 无 tenantId
│ status / version         │
│ workspaceId              │
│ executionResults (JSON)  │
│ ... 短剧专用字段         │
│ script / plotBlueprint   │
│ ... 30+ relations        │  ← 短剧专用
└─────────────────────────┘

GEOProject (kmki_geo_projects)     ← 独立、未关联平台 Project
┌─────────────────────────┐
│ id                      │
│ userId                  │  ← userId，非 tenantId
│ name / topic / industry │
│ language / country      │
│ config (JSON)           │
│ workspaceId             │
│ deletedAt               │
└────┬────────────────────┘
     │
     ├── GEOEntity[]           ← 无 userId/tenantId
     ├── GEOEntityRelation[]   ← 无 userId/tenantId
     ├── GEOProjectVersion[]   ← 无 userId/tenantId
     ├── GEOClaim[]            ← 无 userId/tenantId
     ├── GEOEvidence[]         ← 无 userId/tenantId
     ├── GEOCitation[]         ← 无 userId/tenantId
     ├── GEOFAQ[]              ← 无 userId/tenantId
     └── ... 共 15 张 GEO 子表

HDZProject (hdz_projects)          ← 同样独立
┌─────────────────────────┐
│ id (uuid)               │
│ userId                  │
│ title / genre / status  │
│ ... 小说专用字段         │
└─────────────────────────┘
```

### 1.3 现状问题

| 问题 | 影响 |
|------|------|
| 3 套 Project 实体（Project / GEOProject / HdzProject） | 无法统一查询、无法跨 Workspace 关联 |
| 所有表用 `userId` 而非 `tenantId` | 企业版多用户无法共享数据 |
| GEO 15 张子表无 userId/tenantId | 跨租户数据无隔离 |
| 平台 Project 字段偏向短剧（script / plotBlueprint 等） | 不可直接用作 GEO 或小说 Project |

---

## 2. 目标 ER 图

### 2.1 目标 Tenant → Workspace → Project 体系

```
Tenant (governance_tenant)
┌─────────────────┐
│ id              │
│ name            │
│ type            │  ← personal / team / enterprise
│ status          │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Workspace (Workspace)
    │ ┌──────────────────────┐
    │ │ id                   │
    │ │ tenantId             │  ← NEW
    │ │ name                 │
    │ │ workspaceType        │  ← 'geo' | 'video' | 'novel' | 'ppt'
    │ └──────────┬───────────┘
    │            │
    │       ┌────┴─────────────────────────────────┐
    │       │ Project (统一主实体)                  │
    │       │ ┌──────────────────────────────────┐ │
    │       │ │ id                               │ │
    │       │ │ tenantId (NEW)                   │ │  ← NOT NULL
    │       │ │ workspaceId                      │ │
    │       │ │ ownerId (NEW, = userId)          │ │
    │       │ │ name                             │ │
    │       │ │ type (NEW)                       │ │  ← 'geo' | 'video' | 'novel' | 'ppt'
    │       │ │ status / version                 │ │
    │       │ │ resourceCount (NEW)              │ │  ← 预留
    │       │ │ lastExecutionAt (NEW)            │ │  ← 预留
    │       │ │ lastActivityAt (NEW)             │ │  ← 预留
    │       │ └──────────────────────────────────┘ │
    │       │                                      │
    │       │   type = 'geo'  →  GeoProjectProfile │
    │       │   type = 'video' →  (现有 Project)    │
    │       │   type = 'novel' →  NovelProfile      │
    │       └──────────────────────────────────────┘
    │
    └── 每个 Tenant 有多个 Workspace
        每个 Workspace 有多个 Project

### 2.1a Tenant 模型设计决策

**每个用户默认拥有一个 Personal Tenant。**

```
User 注册
   │
   ▼
Tenant (type=personal, ownerId=userId)
   │
   ├── Workspace[]
   ├── Project[]
   └── ...
```

- 免费用户 → Personal Tenant
- 企业用户 → Organization Tenant（以后支持）
- 用户可以属于多个 Tenant（默认进入 Personal Tenant）
- **`User` 不固定 `tenantId`** — 因为未来多 Tenant 场景很常见
- `User.tenantId` 只在 JWT session 中保存 `activeTenantId`，不写死在 User 表
```

### 2.2 目标 GeoProjectProfile

```
GeoProjectProfile （仅为 GEO 特有字段）
┌─────────────────────────┐
│ id                      │
│ projectId (FK→Project)  │  ← 唯一
│ website                 │
│ domain                  │
│ brand                   │
│ language                │
│ country                 │
│ industry                │
│ topic                   │
│ geoConfig (JSON)        │
│ createdAt               │
│ updatedAt               │
└─────────────────────────┘

GEO 子表沿用，但加 tenantId/ownerId 隔离：
┌─────────────┐
│ GEOEntity   │ ← +tenantId (从 Project 继承)
├─────────────┤
│ GEOClaim    │ ← +tenantId
├─────────────┤
│ GEOEvidence │ ← +tenantId
├─────────────┤
│ GEOCitation │ ← +tenantId
├─────────────┤
│ ...         │ ← 全部 +tenantId
└─────────────┘

注意：子表通过 projectId → Project → tenantId 间接继承租户，
但为了查询性能和数据隔离安全，建议在每张子表冗余存储 tenantId。
```

### 2.3 目标 Workspace 模型扩展

```
model Workspace {
  id             String   @id @default(uuid())
  tenantId       String   ← NEW: 关联 Tenant
  name           String
  workspaceType  String   ← NEW: 'geo' | 'video' | 'novel' | 'ppt' | 'custom'
  createdAt      DateTime
  updatedAt      DateTime

  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  projects  Project[]
}
```

### 2.4 目标 Project 模型

```
model Project {
  // ── 核心字段 ──
  id             String   @id @default(uuid())
  tenantId       String   ← NEW: NOT NULL
  workspaceId    String?  ← 已有
  ownerId        String   ← NEW: 从 userId 改名
  type           String   ← NEW: 'geo' | 'video' | 'novel' | 'ppt'
  name           String
  description    String?
  status         String   @default("draft")
  version        Int      @default(1)

  // ── 预留字段（Resource Platform v4.2）──
  resourceCount     Int      @default(0)  ← NEW
  lastExecutionAt   DateTime?             ← NEW
  lastActivityAt    DateTime?             ← NEW

  // ── 已有字段（保留、逐渐迁移到 Profile）──
  budgetLimit       Float?
  budgetSpent       Float     @default(0)
  // ... 短剧专用字段将在后续迁移到 VideoProfile

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // ── 关系 ──
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  workspace Workspace? @relation(fields: [workspaceId], references: [id])
  owner     User      @relation(fields: [ownerId], references: [id])

  // 可选 Profile
  geoProfile GeoProjectProfile?
  // videoProfile VideoProfile? ← 后续
  // novelProfile NovelProfile? ← 后续
}
```

---

## 3. 数据迁移方案

### 3.1 迁移顺序

```
Step 1: 新增字段（ALTER TABLE，不破坏现有代码）
Step 2: Backfill 历史数据
Step 3: 校验全部 tenantId 非空
Step 4: Repository 切换（先读新字段，再删旧逻辑）
Step 5: 清理旧字段/旧表
```

### 3.2 Prisma Migration 脚本

```prisma
// Step 1: 扩展平台 Project 表
model Project {
  // 新增字段
  tenantId         String    ← NEW, 开始可为空，backfill 后改为 NOT NULL
  ownerId          String    ← 从 userId 改名（先加新字段再删旧字段）
  type             String    ← NEW, default 'video'（保持向后兼容）
  resourceCount    Int       @default(0) ← NEW
  lastExecutionAt  DateTime? ← NEW
  lastActivityAt   DateTime? ← NEW

  // 改为可选 Profile
  geoProfile GeoProjectProfile? ← NEW
}

// Step 2: 新建 GeoProjectProfile 表
model GeoProjectProfile {
  id         String   @id @default(uuid())
  projectId  String   @unique
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

// Step 3: GEO 子表加 tenantId
model GEOEntity {
  // 新增
  tenantId   String  ← NEW
  
  // 现有字段不变
  ...
  @@index([tenantId]) ← NEW
}

// ... 其余 14 张子表相同操作
```

### 3.3 Backfill 策略

```sql
-- Step 1: 平台 Project 的 tenantId
-- 目前 Project.userId → User → 目前 User 没有直接关联 Tenant
-- 需要确认：是否需要先建立 User→Tenant 映射
-- 暂时：使用默认 tenant（personal）

-- Step 2: GEOProject 迁移到 Project
INSERT INTO Project (id, tenantId, workspaceId, ownerId, type, name, status, createdAt, updatedAt)
SELECT 
  id, 
  COALESCE(tenantId_from_user_mapping, 'default_tenant'), 
  workspaceId,
  userId,
  'geo',
  name,
  status,
  createdAt,
  updatedAt
FROM GEOProject
WHERE deletedAt IS NULL;

-- Step 3: 创建 GeoProjectProfile
INSERT INTO GeoProjectProfile (projectId, topic, industry, language, country, geoConfig)
SELECT id, topic, industry, language, country, config
FROM GEOProject
WHERE deletedAt IS NULL;

-- Step 4: GEO 子表关联到新 Project
-- GEOEntity.projectId → Project.id（类型不变，但 Project 现在是统一表）

-- Step 5: Backfill GEO 子表 tenantId
UPDATE GEOEntity e
SET tenantId = p.tenantId
FROM Project p
WHERE e.projectId = p.id;
```

### 3.4 回滚方案

| 场景 | 操作 |
|------|------|
| tenantId 填充异常 | 先不做 NOT NULL 约束，保持 nullable，回滚只需删索引 |
| GeoProjectProfile 写入失败 | GEOProject 数据保留，Profile 可重建 |
| 前端 Project 类型切换问题 | 保留旧 `GEOProject` Repository，走 feature flag 切换 |
| API 兼容性问题 | 新旧 API 并存 1 周，通过 `Accept-Version` header 控制 |

---

## 4. Repository 改造方案

### 4.1 后端 Repository 架构

```
                 ┌─────────────────────┐
                 │ ProjectService       │  ← 统一入口
                 │ (platform service)   │
                 └────────┬────────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
     ┌──────┴──────┐ ┌───┴────┐ ┌─────┴─────┐
     │ GEOProject   │ │ Video   │ │ Novel     │
     │ Repository   │ │ Project │ │ Project   │
     └──────┬──────┘ │ Repo    │ │ Repo      │
            │        └────────┘ └───────────┘
     ┌──────┴──────┐
     │ GeoProfile  │  ← NEW: 只读写 Profile 表
     │ Repository  │
     └─────────────┘
```

### 4.2 迁移步骤

```
Phase 1a: 新增 Project.type + GeoProjectProfile + master-detail
  - CREATE GeoProjectProfile 表
  - Project 表加 type / tenantId / ownerId 字段
  - 所有 GEO 子表加 tenantId

Phase 1b: Repository 双写（Old + New）
  - GEO 创建 Project 时：写 GEOProject + Project（type=geo）
  - GEO Project 读取时：先读 Project，fallback 到 GEOProject
  - GeoProfile 读写走新 Repository

Phase 1c: 切换读取源
  - 所有读取从 GEOProject 切到 Project
  - 验证无误后，GEOProject 降级为只读

Phase 1d: 删除 GEOProject 表
  - 确认全部数据迁移完成
  - DROP GEOProject 表（或保留为视图）
```

### 4.3 前端 Store 改造

```typescript
// Phase 1 前 → 后

// Before: 独立的 GEO Project Store
interface GeoStoreState {
  projects: GeoProject[]        // 独立类型
  v2Projects: GeoProjectV2[]    // 第二套类型
}

// After: 统一 Project Store
interface Project {
  id: string
  tenantId: string
  workspaceId?: string
  ownerId: string
  type: 'geo' | 'video' | 'novel' | 'ppt'
  name: string
  description?: string
  status: string
  // 通用字段
  resourceCount: number
  lastActivityAt?: string
  // GEO 特有 → 从 GeoProfile 读取
  geoProfile?: {
    website?: string
    brand?: string
    industry?: string
    language?: string
  }
}

// GEO Store 移除 projects/v2Projects，改为引用统一 Project Store
```

---

## 5. API 改造方案

### 5.1 新增 API

```
GET    /api/projects?type=geo          ← 统一查询 GEO 项目
POST   /api/projects                   ← 创建项目（type=geo 走 GeoProfile 创建）
GET    /api/projects/:id               ← 统一获取
PUT    /api/projects/:id               ← 统一更新
DELETE /api/projects/:id               ← 统一删除

GET    /api/projects/:id/geo-profile   ← GEO 特有字段
PUT    /api/projects/:id/geo-profile   ← 更新 GEO 特有字段
```

### 5.2 保留 API（兼容期）

```
GET    /api/geo/projects               ← 保留，内部调用统一 API
POST   /api/geo/projects               ← 保留，内部创建 Project+GeoProfile
```

### 5.3 认证

```
所有 API 通过 preHandler: [fastify.authenticate]
从 JWT 解析 tenantId（JWT payload 中需包含 tenantId）
```

---

## 6. 前端 Store 改造方案

### 6.1 改造范围

| Store | 改造内容 | 优先级 |
|-------|---------|--------|
| `stores/project.ts` | 扩展 Project 类型，支持 type/tenantId/ownerId | P0 |
| `brand-geo/stores/useBrandGeoStore.ts` | 移除 projects/v2Projects，引用统一 store | P0 |
| `modules/geo/store/useGEOStore.ts` | 已 DEPRECATED | P2 |
| `studio-v2/types/geo/brand.ts` | 移除 GeoProject/GeoProjectV2 接口 | P1 |

### 6.2 前端 Project 类型统一

```typescript
// frontend/types/project.ts  ← NEW: 统一 Project 类型
export interface UnifiedProject {
  id: string
  tenantId: string
  workspaceId?: string
  ownerId: string
  type: ProjectType
  name: string
  description?: string
  status: ProjectStatus
  version: number
  resourceCount: number
  lastExecutionAt?: string
  lastActivityAt?: string
  createdAt: string
  updatedAt: string
  // 按 type 加载的可选 Profile
  geoProfile?: GeoProjectProfile
}

export type ProjectType = 'geo' | 'video' | 'novel' | 'ppt'
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface GeoProjectProfile {
  website?: string
  domain?: string
  brand?: string
  language: string
  country?: string
  industry?: string
  topic?: string
  geoConfig: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

---

## 7. 回滚方案

### 7.1 数据库回滚

```bash
# 如果迁移出现问题
npx prisma migrate down --to 0  # 回滚到上一个版本
# 或者只回滚特定 migration
npx prisma migrate resolve --rolled-back "phase1_tenant_project"
```

### 7.2 API 回滚

```typescript
// 通过环境变量控制
const USE_OLD_GEO_REPO = process.env.GEO_USE_LEGACY === 'true'

// 双写阶段，读取优先走旧代码
if (USE_OLD_GEO_REPO) {
  return geoProjectRepository.listByUserId(userId)
}
return unifiedProjectRepository.listByTenant(tenantId, 'geo')
```

### 7.3 前端回滚

```typescript
// 通过 feature flag 控制
const useUnifiedProject = useFeatureFlag('project-center-v2')
if (!useUnifiedProject) {
  // 使用旧 GEOProject store
  return legacyGeoStore.projects
}
// 使用统一 Project store
return unifiedProjectStore.listByType('geo')
```

---

## 8. 验收标准

| # | 项目 | 验收条件 | 验证方法 |
|---|------|---------|---------|
| 1 | Tenant | 所有 GEO 数据可追溯至 Tenant | SQL: `SELECT DISTINCT tenantId FROM GEOEntity` 非空 |
| 2 | Project | 不再有独立 GEOProject 查询 | Repository 调用走 ProjectService |
| 3 | Profile | GEO 特有字段通过 GeoProjectProfile 读写 | API: GET /api/projects/:id/geo-profile 返回正确 |
| 4 | 子表隔离 | GEO 子表均有 tenantId 且非空 | SQL: 全部 15 张子表 `COUNT(NULL)` = 0 |
| 5 | API 兼容 | 旧 API 仍可用（内部转发） | 测试：POST /api/geo/projects 返回 201 |
| 6 | 前端统一 | Workspace 使用 UnifiedProject 类型 | 编译无类型错误 |
| 7 | 迁移完整 | 历史数据全部迁移 | count(Project WHERE type='geo') = count(GEOProject WHERE deletedAt IS NULL) |
| 8 | 跨租户隔离 | Tenant A 看不到 Tenant B 的 Project | API 测试 |

---

## 9. 实施计划

### Phase 1.0: Migration Readiness Checklist（0.5天）

**在迁移前完成，全部勾选后才执行数据库变更：**

| # | 项目 | 状态 | 说明 |
|---|------|------|------|
| 1.0.1 | 📋 所有 Repository 是否列出？ | ⬜ | GEO Project / Entity / Claim / Evidence / Citation / FAQ / Schema / Review / Quality / Freshness / Benchmark / Score / Optimization 共 13 个 |
| 1.0.2 | 📋 所有 API 是否列出？ | ⬜ | geo-project / geo-entity / geo-graph / geo-knowledge-quality 共 4 个路由文件 |
| 1.0.3 | 📋 所有前端 Store 是否列出？ | ⬜ | useBrandGeoStore / useGEOStore（deprecated）/ useProjectStore |
| 1.0.4 | 📋 所有后台页面是否列出？ | ⬜ | 首页 / GEO Workspace / 后台管理 |
| 1.0.5 | 📋 SQL Migration 是否有回滚？ | ⬜ | Prisma migrate down 已验证 |
| 1.0.6 | 📋 Feature Flag 是否准备完成？ | ⬜ | `GEO_USE_LEGACY_PROJECT` 环境变量 + `project-center-v2` 前端 feature flag |
| 1.0.7 | 📋 双写/双读方案是否验证？ | ⬜ | 新旧 Repository 共存测试 |
| 1.0.8 | 📋 User→Tenant 默认映射是否就绪？ | ⬜ | Personal Tenant 创建逻辑 |

### Phase 1a: 数据库迁移（2天）

| 任务 | 时间 |
|------|------|
| Prisma schema 修改（Project+GeoProfile+子表tenantId） | 0.5天 |
| Migration 脚本编写 | 0.5天 |
| Backfill 脚本（含 Project.type 回填：video/geo/novel/ppt） | 0.5天 |
| 数据校验（全部 tenantId 非空、type 非空） | 0.5天 |

### Phase 1b: Repository + API（1.5天）

| 任务 | 时间 |
|------|------|
| ProjectService 统一入口 | 0.5天 |
| GeoProfile Repository | 0.5天 |
| API 双写 + 兼容 | 0.5天 |

### Phase 1c: 前端统一（1.5天）

| 任务 | 时间 |
|------|------|
| UnifiedProject 类型 | 0.5天 |
| Project Store 改造 | 0.5天 |
| GEO Store 迁移 | 0.5天 |

### Phase 1d: 验收 + 稳定运行（持续验证）

**GEOProject 不下线固定时间，以下线条件为准：**

| 条件 | 说明 |
|------|------|
| ✅ 新 Repository 全部使用 Project + GeoProjectProfile | GEO 读写全部走新路径 |
| ✅ 新 API 全部切换 | 旧 API 可保留但内部调用新逻辑 |
| ✅ 前端 Store 全部切换 | 使用 UnifiedProject 类型 |
| ✅ 后台管理全部切换 | 管理页面使用统一 Project |
| ✅ Migration 校验 100% | tenantId 非空、type 非空 |
| ✅ 连续稳定运行 ≥1 周无回退 | 观察期 |
| ✅ Feature flag 关闭后系统正常 | 确认旧代码可删 |

**全部满足后，删除 GEOProject 表。**

**总预估：6天 + ≥1周稳定期**

---

## 10. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| User-to-Tenant 映射不存在 | 高 | 高 | **Personal Tenant 模型**：每个 User 注册时自动创建 Personal Tenant，无需等待企业版 |
| 短剧 Project 字段耦合过深 | 中 | 高 | 先只做 GEO，短剧保持现状，后续逐步迁移到 `VideoProfile` |
| 前端类型兼容性 | 中 | 中 | 先双写双读，feature flag 控制 |
| GEO 子表数据量大 | 低 | 中 | 分批 backfill，每小时校验进度 |
| 历史 Project 缺 type | 高 | 高 | **Migration 强制回填**：video/geo/novel/ppt，不保留空值。无对应类型的归入 `'custom'` |

### 10.1 Project.type 回填规则

所有已有项目在 migration 时必须回填明确类型，不留空值：

| 来源表 | type | 判断逻辑 |
|---------|------|---------|
| `Project`（现有短剧） | `'video'` | 有 script/plotBlueprint 字段 |
| `GEOProject` | `'geo'` | 存在 kmki_geo_projects 记录 |
| `HdzProject` | `'novel'` | 存在 hdz_projects 记录 |
| 无对应 | `'custom'` | 保底值 |

**`type` 字段设 NOT NULL + default('custom')，但 migration 后所有记录必须为具体类型。**

---

## 附录: 相关文件

- `docs/reviews/GEO-INTEGRATION-AUDIT-001.md` — 审计报告
- `docs/reviews/DATA-MODEL-FREEZE.md` — Phase 0 数据冻结
- `docs/reviews/PHASE-0-COMPLETE.md` — Phase 0 完成记录
- `backend/prisma/schema.prisma` — Prisma 模型定义
- `backend/src/services/geo/services/geo-project.service.ts` — GEO Project Service
- `frontend/stores/project.ts` — 平台 Project Store
- `frontend/studio-v2/workspace/brand-geo/stores/useBrandGeoStore.ts` — GEO Store
