# GEO MVP 简化架构方案 v1.0

**日期**: 2026-07-20 | **基线**: GEO_MVP_REQUIREMENTS_V1.1.md  
**目标**: 极小改动跑通"创建 → 扫描 → 报告 → 优化"闭环  
**原则**: 统一命名空间 / 复用现有能力 / 异步优先 / 零新增基础设施  

---

## 1. 整体架构

```
┌─────────────────┐     ┌───────────────────┐     ┌───────────────┐
│  前端 (Nuxt)     │────▶│  后端 v1 路由层    │────▶│  Prisma + PG  │
│  4 个页面 + DS   │◀────│  /api/v1/geo/*    │◀────│  3 张核心表    │
└─────────────────┘     └────────┬──────────┘     └───────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼             ▼
            ┌────────────┐ ┌──────────┐ ┌──────────┐
            │ ScanService │ │unified-ai│ │ Rate    │
            │ (轻量)      │ │ gateway  │ │ Limit   │
            │ 5 个模型     │ │(已有)    │ │ (已有)   │
            │ 并行+超时    │ │          │ │         │
            └────────────┘ └──────────┘ └──────────┘
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 服务层 | 新增 `scanService.ts`（轻量），不复用现有 AIGC Agent 编排 | MVP 不需要 execution trace / circuit breaker |
| AI API 调用 | `scanService` 直接调 `unified-ai-gateway` 的底层函数，绕过编排层 | 直通，最少中间层 |
| 异步任务 | 用 `setTimeout + 状态轮询`，不上 BullMQ | MVP 没有延迟敏感度，队列增加复杂度 |
| 前端路由 | Nuxt 插件注册（同现有方案） | 零改动 |
| 认证 | 复用 `fastify.authenticate` | 已实现 |
| VIP 检查 | 在 v1 路由层加 middleware | 一行代码 |
| 限流 | 复用现有 Rate Limit 服务 | 已实现 |

---

## 2. 后端变更清单

### 2.1 新增文件（共 3 个）

| 文件 | 用途 | 行数估算 |
|------|------|----------|
| `services/geo/v1/geo-scan.service.ts` | AI 扫描核心逻辑：并行调 5 个模型、解析 JSON、计算分数 | ~150 |
| `repositories/geo-scan-record.repository.ts` | GEOScanRecord CRUD | ~50 |
| `services/geo/v1/geo-mvp.route.ts` | MVP 的 10 个全新 API 端点，替换现有 v1 route | ~250 |
| **合计新增** | | **~450 行** |

### 2.2 修改文件（共 5 个）

| 文件 | 改动 | 复杂度 |
|------|------|--------|
| `backend/prisma/schema.prisma` | 新增 `GEOScanRecord` model；移除 34 个弃用 model；`GEOProject` 加 `website/keywords` 字段 | 中等 |
| `backend/src/services/geo/index.ts` | 注册 `geo-mvp-route.ts`，取消注册弃用的路由 | 低 |
| `backend/src/index.ts` | 确认 `geo-v1` 路由注册路径（可能只需改 index.ts import） | 低 |
| `services/geo/repositories/geo-project.repository.ts` | 简化，只留 `findMany/findUnique/create/update` | 低 |
| `services/geo/repositories/geo-brand-setting.repository.ts` | 保留（extend config），可选项 | 低 |

### 2.3 删除/禁用文件（共 170+ 个）

直接删除过于激进，采用 **Git 分支清理 + 软删除**：
- 文件保留在 git 历史中
- 工作目录中删除
- 详细删除列表见《清理计划》

### 2.4 弃用的路由（取消注册）

以下路由全部取消注册，文件保留但不再 import：

| 路由文件 | 功能 | 弃用理由 |
|----------|------|----------|
| `routes/geo-entity.route.ts` | 实体 CRUD | MVP 不包含 |
| `routes/geo-claim.route.ts` | 声明 CRUD | MVP 不包含 |
| `routes/geo-evidence.route.ts` | 证据 CRUD | MVP 不包含 |
| `routes/geo-faq.route.ts` | FAQ CRUD | MVP 不包含 |
| `routes/geo-graph.route.ts` | 图谱 | MVP 不包含 |
| `routes/geo-keyword.route.ts` | 关键词 | 合并到 project |
| `routes/geo-knowledge.route.ts` | 知识对象 | MVP 不包含 |
| `routes/geo-knowledge-quality.route.ts` | 质量评分 | MVP 不包含 |
| `routes/geo-brand.route.ts` | 品牌（旧版） | 被 v1 路由替代 |
| `routes/geo-scan.route.ts` | 扫描（旧版） | 被 v1 路由替代 |
| `routes/geo-dashboard.route.ts` | 仪表盘（旧版） | 被 v1 替代 |
| `routes/geo-watcher.route.ts` | 监控 | MVP 不包含 |
| `routes/geo-trace.route.ts` | 执行追踪 | MVP 不包含 |
| `routes/geo-history.route.ts` | 历史 | 被 v1 替代 |
| `routes/geo-report.route.ts` | 报告 | MVP 简化 |
| `recommendation/recommendation.route.ts` | 推荐 (v4 版) | 被 v1 替代 |
| `verification/verification.route.ts` | 验证 | MVP 不包含 |
| `growth/*` (5 files) | 学习引擎 | MVP 不包含 |
| `monitor/*` (11 files) | 监控 | MVP 不包含 |
| `publishing/*` (14 files) | 发布 | MVP 不包含 |
| `kdp/*` (36 files, ~6300 行) | 知识分发 | MVP 不包含 |
| `adapters/citation/*` (3 files) | 引用适配器 | MVP 不包含 |
| `agents/*` (9 files) | AI Agent 层 | MVP 不包含 |

---

## 3. 核心服务逻辑：scanService.ts

### 流程

```
scanService.scan(projectId)
  1. 创建 GEOScanRecord (status: pending)
  2. 并行调用 5 个 AI 模型（各 30s 超时）
     → unifiedAIGateway.ask(prompt, model)
  3. 收集所有响应
  4. 解析每个模型的 JSON 输出
  5. 计算 4 维分数
  6. 生成优化建议（基于低分维度 + 具体问题）
  7. 更新 GEOScanRecord (status: completed)
  8. 返回结果
```

### 4 维分数算法

| 维度 | 算法 |
|------|------|
| 可见度 | `count(recognizes == true) / totalModels * 100` |
| 准确性 | `accuracy == "accurate" → 100, "partial" → 50, "inaccurate" → 0`，取均值 |
| 一致性 | 各模型 `description` 的 cosine similarity 均值（简化版：关键词重叠率） |
| 推荐意愿 | `recommendation == "positive" → 100, "neutral" → 50, "negative" → 0`，取均值 |

总分 = `visibility * 0.35 + accuracy * 0.25 + consistency * 0.20 + recommendation * 0.20`

### AI 调用策略

- 使用用户自己的 API Key（从 unified-ai-gateway 获取）
- 如果用户某个模型的 key 未配置：**跳过该模型**，不影响其他 4 个
- 如果 5 个模型全部不可用：scan 状态设为 `failed`，返回具体错误
- JSON 解析失败：单个模型标记为 `parse_error`，其他模型正常评分

---

## 4. 前端页面结构

### 4 个页面（均在 `/frontend/workspaces/geo/` 目录）

| 页面 | 路由 | 说明 |
|------|------|------|
| **DashboardPage.vue** | `/workspace/geo` | 品牌卡片列表 + 创建入口 |
| **CreatePage.vue** (或弹窗) | `/workspace/geo/create` | 创建品牌表单 |
| **BrandDetailPage.vue** | `/workspace/geo/:id` | 品牌详情 + 扫描入口 + 最新报告 + 优化 |
| **ScanHistoryPage.vue** | `/workspace/geo/:id/history` | 历史扫描列表 + 趋势图 |

### 组件复用策略

- **不复用旧 workspace 的组件**（全部删除）
- **复用 design-system 的以下组件**:
  - `primitives/Button`, `Input`, `Card`, `Skeleton`, `Badge`, `Spacer`, `Tabs`
  - `components/LoadingState`, `ErrorBanner`, `EmptyState`, `MetricCard`, `ScoreCard`, `TrendChart`
  - `product-blocks/Hero`（仪表盘顶部）
- **新增的文件**（少量自定义）:
  - `components/BrandCard.vue` — 品牌卡片
  - `components/ScanProgress.vue` — 扫描进度条

### 删除的前端文件（94 个）
- `frontend/studio-v2/workspace/brand-geo/` — 72 文件（全部）
- `frontend/studio-v2/workspace/brand-geo-v2/` — 12 文件（全部）
- `frontend/workspaces/geo/` 中以下文件不再需要：
  - `pages/HealthPage.vue` → 替换为 DashboardPage
  - `pages/RecommendationsPage.vue` → 合并入 BrandDetailPage
  - `pages/VerificationPage.vue` → 删
  - `pages/PublishingPage.vue` → 删
  - `pages/GrowthPage.vue` → 删
  - `pages/KnowledgePage.vue` → 删
  - `stores/useVerificationStore.ts` → 删
  - `stores/usePublishingStore.ts` → 删
  - `stores/useGrowthStore.ts` → 删
  - `stores/useKnowledgeStore.ts` → 删
  - `layouts/GeoWorkspaceLayout.vue` → 可以简化或复用

---

## 5. 权限与计费

### VIP 检查（后端 middleware）

```ts
// 在 geo-mvp.route.ts 中
fastify.get('/api/v1/geo/projects', {
  preHandler: [fastify.authenticate, async (req, reply) => {
    const user = req.user as any
    // 从 User model 或 auth store 中获取 VIP Level
    if (!user || user.vipLevel !== '高级VIP') {
      return reply.status(403).send({ error: '仅高级VIP用户可用' })
    }
  }]
})
```

### 限流

复用已有的 `geo-ratelimit` 逻辑，在 scan 端点加：

```ts
// 30 分钟冷却期检查
const lastScan = await scanRecordRepo.findLatest(projectId)
if (lastScan && Date.now() - lastScan.createdAt < 30 * 60 * 1000) {
  return reply.status(429).send({ error: '扫描冷却期 30 分钟' })
}
```

### 次数计数

每月扫描次数存于 `GeoBrandSetting.extraMetadata`，或复用已有的 CREDIT 体系。

---

## 6. 数据流闭环验证

```
[创建品牌]                              [DB]
POST /api/v1/geo/projects         →     GEOProject.insert()
  ↓
[发起扫描]                              [DB]              [AI]
POST /projects/:id/scan            →    ScanRecord.insert(pending)   →   调 5 模型
  ↓
[轮询状态]                              [DB]              [前端]
GET /scans/:scanId                 →    ScanRecord.select(status)   →   Loading 动画
  ↓
[扫描完成]                              [DB]              [前端]
GET /scans/:scanId                 →    ScanRecord.completed        →   报告渲染
  ↓
[一键优化]                              [AI]              [DB]
POST /optimize                     →    AI 生成文案      →   存至 optimizationItems
```

---

## 7. 实施计划

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| Phase 1 | Schema 清理：新增 GEOScanRecord、删除 34 个弃用 model、GEOProject 加字段 | 1 天 |
| Phase 2 | 后端：3 个新文件 + 4 个修改 + route 清理 | 2 天 |
| Phase 3 | 前端：写 4 个页面 + 复用 DS 组件 + 删除旧文件 | 2 天 |
| Phase 4 | 端到端联调 + 部署 + 数据验证 | 1 天 |
| **合计** | **MVP 改造** | **~6 天** |

算上验收、修复、文档更新，加缓冲后仍能控制在 **10 天内**。
剩下的 20 天留给优化、UI polish、和真实用户测试。
