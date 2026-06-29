# Phase 1a — 数据库迁移实施计划

**Design freezed.** — 以设计评审结果为准，实施阶段不改变设计。

---

## 执行节奏：5 Stage + 验收点

```
Stage 1: Schema Expansion ────── 验收点（旧功能正常）
    │
    ├── 只加字段，不改代码
    ├── 新字段全部可空
    ├── Feature Flag 保持旧路径
    └── 不修改 Repository
    │
Stage 2: Backfill ────────────── 验收点（校验器全部通过）
    │
    ├── Personal Tenant → Project.type → tenantId → Profile → 子表
    ├── 运行 verify-migration.mjs
    ├── Dry Run 与正式结果一致
    └── 不切业务流量
    │
Stage 3: Dual Write ──────────── 验收点（新旧数据一致）
    │
    ├── 新数据写入旧结构 + 新结构
    ├── 读仍走旧结构
    ├── 校验器持续通过
    └── Feature Flag 控制
    │
Stage 4: Read Switch ─────────── 验收点（全站功能正常）
    │
    ├── Repository: Legacy → Project + GeoProfile
    ├── API: 旧 API 内部转发
    ├── Frontend: GeoProject → UnifiedProject
    └── Feature Flag 控制
    │
Stage 5: Stable Run → Phase 1d ─ 验收点（7 项条件满足）
    │
    ├── 双写 + 新读
    ├── 连续运行 ≥1 周无回退
    ├── 关闭双写
    └── 删除 GEOProject 表
```

---

## Stage 1: Schema Expansion

### 1.1 Prisma Schema 变更

**文件:** `backend/prisma/schema.prisma`

```prisma
// === Project 表扩展 ===
model Project {
  // ... 现有字段不变 ...

  // NEW: Phase 1a
  tenantId         String   @db.Uuid           // 可为空（Backfill 前），Stage 2 后 NOT NULL
  ownerId          String?  @db.Uuid           // 新字段，从 userId 过渡
  type             String?                      // 可为空，Stage 2 后 NOT NULL

  // NEW: Resource Platform 预留
  resourceCount    Int      @default(0)
  lastExecutionAt  DateTime?
  lastActivityAt   DateTime?

  // NEW: Relations
  tenant    Tenant?    @relation(fields: [tenantId], references: [id])  // 可为空，Stage 2 后必填
  owner     User?      @relation(fields: [ownerId], references: [id])

  // NEW: Profile
  geoProfile GeoProjectProfile?

  // NEW: Indexes
  @@index([tenantId])
  @@index([type])
}

// === GeoProjectProfile (NEW) ===
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

// === GEO 子表加 tenantId（以 GEOEntity 为例） ===
model GEOEntity {
  // 现有字段不变
  id         String   @id @default(uuid())
  projectId  String
  // ...

  // NEW:
  tenantId   String?  @db.Uuid   // 可为空，Backfill 后 NOT NULL

  // NEW Index:
  @@index([tenantId])
}

// ... 其余 14 张子表相同操作 ...
// GEOEntityRelation, GEOProjectVersion, GEOClaim, GEOEvidence,
// GEOCitation, GEOFAQ, GEOSchemaMarkup, GEOReviewQueue,
// GEOQualityScore, GEOFreshnessRecord, GEOBenchmarkRecord,
// GEOScoreSnapshot, GEOOptimizationHistory
// → 全部加 tenantId 字段 + index

// === Workspace 表扩展 ===
model Workspace {
  // 现有字段不变

  // NEW:
  tenantId       String?  @db.Uuid
  workspaceType  String?  // 'geo' | 'video' | 'novel' | 'ppt'
}
```

### 1.2 注意事项

```
❌ 不加 NOT NULL 约束 — 所有新字段 Stage 1 阶段可为空
❌ 不修改任何 Repository — 旧代码完全不受影响
❌ 不修改任何 Route/API — 业务完全不感知
❌ 不修改任何前端代码 — 前端完全不受影响
✅ 仅数据库 Schema 变更
```

### 1.3 Stage 1 验收标准

| 检查项 | 方法 |
|--------|------|
| 所有旧 API 正常工作 | 调用一次 `GET /api/geo/projects` |
| 所有旧页面正常渲染 | 打开 GEO Workspace |
| Feature Flag 保持旧路径 | 确认 `GEO_USE_LEGACY_PROJECT` 为 true |
| 新字段存在且可为空 | SQL: `SELECT * FROM information_schema.columns WHERE is_nullable = 'YES'` |

---

## Stage 2: Backfill

### 2.1 执行顺序

```
Step 1: Personal Tenant 创建
  → 为每个没有 Tenant 的 User 创建 Personal Tenant
  → 脚本: node scripts/migration-dry-run.mjs（验证计划）
  → 正式: 启动 backfillPersonalTenants()

Step 2: Project.type Backfill
  → GEOProject 已存在的 → type='geo'
  → 短剧 Project（有 video_tasks）→ type='video'
  → 其余 → type='custom'
  → Verify: 全部非空

Step 3: Project.tenantId Backfill
  → 通过 userId → Personal Tenant 映射回填
  → Verify: 全部非空

Step 4: GeoProject → Project + GeoProfile 迁移
  → 迁移条件: GEOProject.deletedAt IS NULL
  → 创建 Project(type='geo') → 创建 GeoProjectProfile
  → Verify: 一一对应

Step 5: GEO 子表 tenantId Backfill
  → 通过 projectId JOIN Project 回填
  → 14 张子表，分批执行（每批 1000 条）
  → Verify: 全部非空

Step 6: Workspace tenantId Backfill
  → 通过 organizationId → Tenant 映射推导
  → Verify: 全部非空
```

### 2.2 回滚（同一脚本）

```bash
# 回滚所有 Backfill
# 1. Feature Flag 保持旧路径
# 2. 新字段不清除（允许空值）
# 3. 无业务影响

# 如果出现数据异常：
npx prisma migrate resolve --rolled-back "phase1a_schema"
```

### 2.3 Stage 2 验收标准

| 检查项 | 方法 |
|--------|------|
| 校验器全部通过 | `node scripts/verify-migration.mjs` |
| Dry Run 与正式结果一致 | 对比 dry run 计数与实际 |
| 无孤儿记录 | 校验器 §3 |
| 所有历史数据可正常读取 | `GET /api/geo/projects` |
| 旧业务完全不受影响 | 短剧/GEO/小说功能正常 |

---

## Stage 3: Dual Write

### 3.1 Feature Flag 配置

```bash
# .env
FEATURE_PROJECT_V2=true         # 启用统一 Project
GEO_USE_LEGACY_PROJECT=true     # 读仍走旧表
TENANT_ISOLATION_ENABLED=false  # 先不启用隔离
```

### 3.2 双写范围

| 操作 | 旧路径（主） | 新路径（辅） |
|------|------------|------------|
| 创建 GEO Project | `prisma.gEOProject.create` | `ProjectService.create` + `geoProfileRepository.create` |
| 更新 GEO Project | `prisma.gEOProject.update` | 同步更新 Project + GeoProfile |
| 删除 GEO Project | `prisma.gEOProject.update (deletedAt)` | 同步标记 Project |
| 读取 | `prisma.gEOProject.findUnique` | 不读（仍走旧路径） |

### 3.3 验证方法

```bash
# 创建项目后，检查新旧一致
curl -X POST /api/geo/projects -H "Authorization: Bearer $TOKEN" -d '{"name":"test"}'

# 手动校验
node scripts/verify-migration.mjs --fast

# 检查数据漂移
SELECT COUNT(*) FROM "kmki_geo_projects" gp
LEFT JOIN "Project" p ON gp.id = p.id
WHERE p.id IS NULL AND gp."deletedAt" IS NULL;
# 应为 0
```

### 3.4 Stage 3 验收标准

| 检查项 | 方法 |
|--------|------|
| 新创建的 GEO Project 在新旧表中一致 | 校验器 §3 |
| 更新操作同步到新表 | 手动测试 |
| 删除操作同步到新表 | 手动测试 |
| 读仍走旧路径，返回正确 | API 调用 |
| 新建短剧 Project（type=video）正常 | API 调用 |

---

## Stage 4: Read Switch

### 4.1 Feature Flag 配置

```bash
# .env
FEATURE_PROJECT_V2=true
GEO_USE_LEGACY_PROJECT=false    # 读切换到新表
TENANT_ISOLATION_ENABLED=false  # 仍不启用隔离（Phase 2 启用）
```

### 4.2 切换顺序

```
1. Repository 层切换
   ← geoProjectService 内部改为 ProjectService + GeoProfileService
   ← 旧 geoProjectService 保留但不再被 route 调用（fallback 用）

2. API 层切换  
   ← /api/geo/projects 内部调用 ProjectService
   ← /api/geo/projects/:id/geo-profile 新增

3. 前端 Store 切换
   ← useBrandGeoStore 引用 UnifiedProject 类型
   ← projectService.ts 调用 /api/projects?type=geo

4. 统一 API 上线
   ← GET /api/projects?type=geo
   ← POST /api/projects
   ← GET /api/projects/:id/geo-profile
```

### 4.3 回滚

```bash
# 如果出现问题
GEO_USE_LEGACY_PROJECT=true
pm2 restart 8  # 重启后端
```

### 4.4 Stage 4 验收标准

| 检查项 | 方法 |
|--------|------|
| 全站功能测试通过 | 手动走通 GEO 核心流程 |
| 后台管理正常 | 管理页面 Project 列表 |
| GEO Workspace 正常 | 打开、创建、编辑 Project |
| 没有 Legacy Repository 被调用 | 日志检查（添加 log） |
| Feature Flag 回滚验证 | OFF → ON → OFF 完整走一遍 |

---

## Stage 5: Stable Run → Phase 1d

### 5.1 稳定运行条件

```
连续运行 ≥1 周
  AND 无 GEO 功能降级报告
  AND 校验器持续通过（每日运行）
  AND 无 tenantId = NULL 记录新增
  AND 无 type = NULL 记录新增
```

### 5.2 Phase 1d 清理

```bash
# 1. 关闭双写
GEO_USE_LEGACY_PROJECT=false
FEATURE_PROJECT_V2=true

# 2. 删除 GEOProject 表
DROP TABLE "kmki_geo_projects" CASCADE;

# 3. 清理旧 Repository
rm backend/src/services/geo/services/geo-project.service.ts  # 备份至 deprecated/

# 4. 清理旧前端类型
# 移除 GeoProject / GeoProjectV2 类型
```

### 5.3 Stage 5 + Phase 1d 验收标准

| 条件 | 说明 |
|------|------|
| ✅ 平台统一 Project 成为唯一主实体 | 无独立 GEOProject 查询 |
| ✅ GeoProjectProfile 承载 GEO 专属数据 | 所有 GEO 特有字段通过 Profile 读写 |
| ✅ 所有 GEO 数据具备 tenantId | 校验器通过 |
| ✅ Personal Tenant 模型正式生效 | 新注册用户自动拥有 |
| ✅ 新旧数据一致 | 双写验证通过 |
| ✅ Repository/API/前端全部切换 | 无 Legacy 调用 |
| ✅ Legacy 保留但不再承担主流程 | 等待 Phase 1d 删除 |

---

## 附录: 环境变量清单

| 变量 | 用途 | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|------|------|---------|---------|---------|---------|---------|
| `FEATURE_PROJECT_V2` | 启用统一 Project | false | false | **true** | true | true |
| `GEO_USE_LEGACY_PROJECT` | GEO 读旧表 | true | true | true | **false** | false |
| `TENANT_ISOLATION_ENABLED` | 多租户隔离 | false | false | false | false | false |
| `FEATURE_GATE_ENABLED` | Feature Gate | false | false | false | false | false |
| `RESOURCE_PLATFORM_ENABLED` | Resource | false | false | false | false | false |
