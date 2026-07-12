# GEO Workspace 能力矩阵 (Capability Matrix)

> 版本：v1.1 | 生成日期：2025-07-05  
> 核心问题：GEO 缺能力还是缺产品装配？

---

## 矩阵总览

| 页面 | 后端能力丰富度 | 前端完成度 | UI 代码状态 | 核心缺口 | 评估 |
|---|---|---|---|---|---|
| **Dashboard (Mission Control)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 全功能 | 无 | 已完成 |
| **Brand Overview** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 超丰富 (4865行) | 部分按钮 disabled"即将开放" | 核心页面已完成 |
| **Discovery Lab** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 全功能 | 后端部分 Mock | 缺能力→缺装配过渡 |
| **Mission Center** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 全功能 | Execution 状态追踪较浅 | **缺装配** |
| **Recommendations** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 有数据状态 | 缺少"创建 Mission"流 | **缺装配** |
| **Verification** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 功能完整 | Before/After 对比逻辑较简单 | **缺装配** |
| **Knowledge** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 功能完整 | 知识质量评分需要更丰富 | 基本完成 |
| **Publishing** | ⭐⭐⭐ | ⭐⭐⭐⭐ | 功能完整 | 缺少真实发布渠道接入 | **缺装配** |
| **Learning** | ⭐⭐⭐ | ⭐ | Placeholder | signals 永远为空 | **缺能力+缺装配** |
| **Growth** | ⭐⭐⭐ | ⭐⭐⭐ | 有趋势数据 | 数据源来自静态 | **缺装配** |
| **GEOCreate** | ⭐⭐⭐ | ⭐⭐⭐⭐ | 完整表单 | 无 | 完成 |

---

## 详细矩阵

### 1. GEODashboard / Mission Control (入口首页)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/geo/workspace/mission-control` — 聚合所有引擎状态、AI可见度、今日目标、队列状态 |
| | `GET /api/geo/workspace/timeline` — 全局时间线 |
| | `GET /api/geo/workspace/timeline/project/:id` — 项目时间线 |
| | `GET /api/geo/workspace/timeline/actionable` — 需要用户操作的事件 |
| | `GET /api/geo/dashboard/stats` — Dashboard 统计数据 |
| **Service 层** | `DashboardService.getTruthSummary()` — 聚合 Brand + Score + Presence + Verification |
| | `DashboardService.getTimeline()` — 委托 TimelineService |
| | `MissionControl API` — 从 Observatory + Queue 推断引擎状态 |
| **已有 UI 组件** | WorkflowNode, UISkeleton, UIEmptyState, UIErrorCard, UIToastContainer, GeoPageSkeleton, GeoErrorState, GeoEmptyState |
| **页面功能** | Hero 区域(AI可见度+今日目标+状态), Workflow 流程, Next Action 卡片, Activity Feed, 引擎健康网格 |
| **数据绑定** | `missionControlService.getMissionControl()` → 后端 mission-control |
| | `timelineStore.getAll()` → 时间线渲染 |
| **缺失** | 无重大缺失 |
| **可直接复用率** | 90% |
| **评估** | **已完成** — 是 GEO 产品化最完整的面 |

### 2. BrandOverview (品牌详情)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/geo/brands/:id` — 品牌详情 |
| | `GET /api/geo/brands/:id/optimizations` — 优化建议 (P0-T004) |
| | `GET /api/geo/brands/:id/action-plans` — 执行计划 (P0-T007) |
| | `POST /api/geo/brands/:id/action-plans/refresh` |
| | `POST /api/geo/brands/:id/action-plans/:planId/start\|pause\|complete` |
| | `GET/POST /api/geo/brands/:id/presence` — LLM 认知扫描 |
| | `POST /api/geo/brands/:id/verify` — 执行验证 |
| | `GET /api/geo/brands/:id/verifications` — 验证历史 |
| | `GET /api/geo/explain?type=xxx&id=xxx` — Explain API |
| | `GET /api/geo/knowledge?projectId=xxx` — 知识数据 |
| | `POST /api/geo/knowledge-quality` — 知识质量 Pipeline |
| **Service 层** | PresenceService, VerificationService, DashboardService, ExplainEngine (5个Provider) |
| | DiscoveryService, RecommendationIntelligence |
| **已有 UI 组件** | 20+ Geo 组件 (GeoBadge, GeoCard, GeoExplainButton, GeoExplainDrawer, GeoLoading, GeoErrorState, GeoEmptyState, GeoWalkthroughBar, MissionCard, DecisionIntelligencePanel 等) |
| **页面功能** | 品牌头像/名称/状态, 完善度环形图, Truth Summary(认知信号), 快速操作, Explain, 优化任务, Decision Graph, 优化中心, 执行计划, LLM认知扫描, 验证引擎 (Before/After) |
| **数据绑定** | 全套 API 调用, 丰富的数据映射 |
| **缺失** | 1. 优化中心的"开始优化"按钮全部 disabled (`即将开放`) |
| | 2. 执行计划的状态变更 (start/pause/complete) 仅在 UI 上做乐观更新, 后端真实状态同步链未验证 |
| | 3. 验证引擎 After snapshot 需要更多真实数据 |
| **可直接复用率** | 95% |
| **评估** | **已完成 (缺产品装配)** — 这是最全的页面, 4865 行代码, 所有 Section 都有真实数据流。优化按钮 disabled 表明: **能力不缺, 装配链不完整 — Mission→Execution→Verification 的闭环未真正串联** |

### 3. Discovery Lab (发现实验室)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/v1/geo/discovery/report?entity=xxx` — 实体发现评估报告 |
| | `GET /api/v1/geo/discovery/action-plan?entity=xxx` — 行动方案列表 |
| | `GET /api/v1/geo/discovery/verify?entity=xxx` — 实体验证报告 |
| | `POST /api/geo/brands/:id/presence` — Presence Engine 扫描 |
| **Service 层** | DiscoveryService (Orchestrator + ProviderRegistry + ConsumerRegistry) |
| | PresenceEngine (5+ provider adapters) |
| **已有 UI 组件** | GeoWalkthroughBar, GeoExplainButton, GeoExplainDrawer |
| **页面功能** | 实体搜索输入, ADI 大卡片(3子维度), 覆盖概览(4个统计), 场景覆盖表格, 优化机会(高/中/低优先级), Top/Bottom 5 场景 |
| **数据绑定** | `useDiscoveryStore` → `discoveryService.evaluateEntity()` |
| | `explainService.getExplain('discovery', entityName)` |
| **缺失** | 1. Discovery 报告数据来自 Benchmark 层 (`benchmark/discovery/`), 部分为 Mock |
| | 2. 需要与 Mission Engine 联动: 发现完成后自动生成 Mission |
| | 3. Provider 注册是硬编码的 (8个 provider, 仅 DeepSeek enabled) |
| **可直接复用率** | 85% |
| **评估** | **缺装配** — 扫描能力真实存在, 但 Discovery 输出→Mission 生成→Optimization 的链路未自动串联。用户做完 Discovery 后需要手动去 Mission Center |

### 4. MissionCenterShell (任务中心)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `POST /api/geo/missions/:missionId/execute` — 执行 Mission |
| | Mission Engine Routes (内存存储) |
| | `Explainer API` — Explain Drawer 数据 |
| **Service 层** | MissionExecutionAdapter → ExecutionPlanner → ResourceAllocator → DAGScheduler |
| | MissionGenerator, missionStore |
| **已有 UI 组件** | MissionCard (支持 action/skip/explain/executed 事件), GeoExplainDrawer, GeoPageSkeleton, GeoErrorState, GeoEmptyState |
| **页面功能** | Brand Selector, 总体进度条 (已完成/进行中/待处理), Next Mission 卡片, 全部任务列表, Explain Drawer |
| **数据绑定** | `fetchMissionCenter(brandId)`, `fetchMissions()`, `completeMission()`, `skipMission()` |
| **缺失** | 1. Execution 状态只是前端 in-memory 管理 (`executionStatusMap`), 没有后端持久化 |
| | 2. 缺少 Execution 历史查看 — 只有一个 `executionId` 字符串 |
| | 3. "跳过"任务只做了前端状态变更, 后端 skip 逻辑简单 |
| | 4. 执行链: Mission→ExecutionPlanner→DAGScheduler 全部在内存中, 没有持久化 |
| **可直接复用率** | 80% |
| **评估** | **缺装配** — Mission Center 是产品装配的核心枢纽, 但 Execution 持久化/状态追踪/历史回放三个关键能力未打通。用户看不到"我的 Mission 执行到哪里了" |

### 5. Recommendations (优化建议)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/geo/brands/:id/optimizations` — 优化建议 |
| | `POST /api/geo/knowledge-quality` — 知识质量 Pipeline |
| **Service 层** | `RecommendationIntelligenceService` — Unified API (score + tasks + roadmap + timeline + summary) |
| | `generateRecommendations()` — 基于规则的优化建议生成 |
| **已有 UI 组件** | GeoPageSkeleton, GeoErrorState, GeoEmptyState, GeoCard, GeoSectionHeader, GeoBadge, GeoExplainDrawer, GeoExplainButton |
| **页面功能** | 影响预估 (当前→预期评分), 成功/失败反馈, 优先行动卡片列表 |
| **数据绑定** | `usePublishingStore` (store.fetchRecs), `store.recommendations` |
| **缺失** | 1. 前端 `recommendations.vue` (旧) 是 **纯 Placeholder** — 只有 UIEmptyState |
| | 2. `RecommendationsPage.vue` (新, 有数据) 依赖 `usePublishingStore`, 名字暗示它来自 Publishing Store, 命名混淆 |
| | 3. 优化建议不可交互 — 按钮显示"即将开放", disabled |
| | 4. 缺少"创建 Mission"的 flow (有 banner 但创建 Mission 功能未展开) |
| | 5. 没有 roadmap 展示 (后端有 `generateRoadmap()` 但前端未用) |
| | 6. 没有 timeline 展示 (后端有 `getTimeline()` 但前端未用) |
| **可直接复用率** | 40% (新), 0% (旧) |
| **评估** | **缺装配 (严重)** — 两个文件 (`recommendations.vue` 纯空状态, `RecommendationsPage.vue` 有基础数据), 存在**页面分裂**。后端有完整的 Intelligence API (score + tasks + roadmap + timeline + summary), 但前端只用了 score 部分。roadmap 和 timeline 两个能力完全未装配 |

### 6. Verification (验证引擎)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `POST /api/geo/brands/:id/verify` — 执行验证 |
| | `GET /api/geo/brands/:id/verifications` — 验证历史 |
| | `GET /api/geo/brands/:id/verifications/:vid` — 验证详情 |
| | `GET /api/geo/discovery/verify?entity=xxx` — 旧版验证 (v1 prefix) |
| **Service 层** | VerificationService (run/getExecution/getResult/compare/getHistory/list/getJobStatus) |
| | VerificationEngine (P0-T006) |
| | TimelineService |
| **已有 UI 组件** | GeoVerificationPattern, GeoExplainButton, GeoExplainDrawer, StatusBanner |
| **页面功能** | 实体输入, Before/After 对比表格 (5 个指标), Claims 列表, 验证状态展示 |
| **数据绑定** | `fetchEntityVerification()`, `adaptVerificationReport()` |
| **缺失** | 1. `verification.vue` (旧) 是 **纯 Placeholder** — 只有 UIEmptyState |
| | 2. `VerificationPage.vue` (新) 有完整功能, 但页面通过 entity name 搜索, 而不是自动关联当前品牌 |
| | 3. 缺少跨页 flow: Mission 完成→自动跳转 Verification |
| | 4. 验证后的数据不回流到 Dashboard |
| | 5. Before/After 对比只做了基础 delta 展示, 没有可视化趋势图 |
| **可直接复用率** | 45% (新), 0% (旧) |
| **评估** | **缺装配** — 与 Recommendations 相同的问题: 新老两个文件共存 (`verification.vue` Placeholder + `VerificationPage.vue` 有数据)。后端验证能力完整, 但未与 Mission 执行结果自动关联 |

### 7. Knowledge / KnowledgePage (知识库)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/geo/knowledge?projectId=xxx` — 知识列表 |
| | `GET /api/geo/knowledge/:id` — 单条知识 |
| | `PATCH /api/geo/knowledge/:id/status` — 更新状态 |
| | `POST /api/geo/knowledge/merge` — 合并知识 |
| | `POST /api/geo/knowledge-quality` — 知识质量 Pipeline |
| **Service 层** | KnowledgeObjectService (CRUD), KnowledgeQualityService (LLM pipeline) |
| | geoClaimService, geoEvidenceService, geoCitationAdapter, geoFAQService, geoSchemaService |
| **已有 UI 组件** | GeoPageSkeleton, GeoErrorState, GeoEmptyState, GeoCard, GeoScoreCard, GeoBadge, GeoSectionHeader |
| **页面功能** | 知识评分 (维度: 身份/知识/优化), 实体/声明/证据/关系/关键词统计, 分类覆盖, 新鲜度, 缺失知识建议 |
| **数据绑定** | `useKnowledgeStore` → `knowledgeObjectService.getByProject()` |
| **缺失** | 1. `knowledge.vue` (旧) 是 **纯 Placeholder** — 只有 UIEmptyState |
| | 2. `KnowledgePage.vue` (新) 有完整数据, 但缺乏知识编辑/筛选/搜索功能 |
| | 3. 知识质量 Pipeline 的结果未在 UI 中展示 |
| | 4. 缺少"实体→声明→证据→引用"知识链的树状可视化 |
| **可直接复用率** | 50% (新), 0% (旧) |
| **评估** | **基本完成, 缺部分装配** — 知识 CRUD + 质量评分 UI 已就绪。Knowledge Quality Pipeline 是 REST endpoint `POST /api/geo/knowledge-quality`, 但未与 UI 联动。知识链可视化确实是个能力缺口 |

### 8. Publishing (发布引擎)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/v1/geo/manifests` — 清单列表 |
| | `GET /api/v1/geo/manifests/stats` — 清单统计 |
| | `GET /api/v1/geo/manifests/:slug` — 单条清单 |
| | `POST /api/v1/geo/manifests` — 创建清单 |
| | `POST /api/v1/geo/manifests/:id/publish\|archive` — 发布/归档 |
| | `POST /api/v1/geo/manifests/rebuild/brands` — 重建品牌清单 |
| **Service 层** | ManifestRepository (CRUD), manifestRegistry, PublishingService (claim/plan/recorder) |
| | PublishManifest 完整类型系统 (Identity/Routing/Content/StructuredData/Metadata/Discoverability/Assets/Publishing/Version) |
| **已有 UI 组件** | GeoPageSkeleton, GeoErrorState, GeoEmptyState, GeoCard, GeoBadge, GeoPageHeader, StatusBanner |
| **页面功能** | 分发概况 (活跃渠道/总渠道/发布计划/当前版本), 内容概览, 渠道列表, 发布计划管理 (创建/审核/发布), 发布记录 |
| **数据绑定** | `usePublishingStore` → `manifestRepository` |
| **缺失** | 1. `publishing.vue` (旧) 是 **纯 Placeholder** — 只有 UIEmptyState |
| | 2. `PublishingPage.vue` (新) 有完整功能, 但发布渠道 (schemas / html / markdown) 没有真实集成的下游系统 |
| | 3. Manifest 的主要消费者 (Renderer / Generator / Sitemap / Feed) 未实现 |
| | 4. 缺少"验证通过→自动发布"的自动流 |
| **可直接复用率** | 70% (新), 0% (旧) |
| **评估** | **缺装配 (渠道层)** — 发布管理 UI 完整, Manifest 类型系统精致, 但发布渠道本身是空壳。内容准备好后"发布到哪里"是个未解决的问题 |

### 9. Learning (学习闭环)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | `GET /api/v1/geo/learning/candidates` — Candidate 列表 |
| | `GET /api/v1/geo/learning/candidates/:id/pending` — 待审核列表 |
| | `POST /api/v1/geo/learning/candidates/:id/review\|promote` — 审核/晋升 |
| | `GET /api/v1/geo/learning/dashboard` — Dashboard 统计 |
| | `GET /api/v1/geo/learning/promotions` — 晋升记录 |
| **Service 层** | LearningService (learn/getRecommendationSignals/explain/getHistory/getDashboard) |
| | LearningEngine, LearningRepository, CandidateStore, ReviewQueue, PromotionEngine |
| **已有 UI 组件** | UIEmptyState, TaskCardRenderer |
| **页面功能** | 信号列表 (永远为空) |
| **数据绑定** | `signals = ref([])` — **硬编码空数组** |
| **缺失** | 1. 页面完全是 Placeholder — `signals` 永远为空, 没有调用任何 API |
| | 2. 后端有完整的 Learning API (candidates/review/promote/dashboard), 但前端**完全未装配** |
| | 3. 缺少 Candidate 审核 UI (Review Modal) |
| | 4. 缺少晋升历史展示 |
| | 5. 缺少 Dashboard 统计视图 |
| | 6. TaskCardRenderer 已导入但未真正使用 |
| **可直接复用率** | 5% |
| **评估** | **缺能力+缺装配 (最严重)** — 后端 Learning Engine 完整 (Candidates + Review + Promotion + Dashboard), 但前端完全没连。不止是装配问题, UI 组件也几乎不存在 |

### 10. Growth (增长趋势)

| 维度 | 内容 |
|---|---|
| **已有后端 API** | 无独立 Growth API — 数据来自 Dashboard + Verification 聚合 |
| **Service 层** | GrowthService (forecast/optimization/content-generator/monitor) |
| | LearningService (复用) |
| **已有 UI 组件** | GeoPageSkeleton, GeoErrorState, GeoEmptyState, GeoCard, GeoPageHeader |
| **页面功能** | 增长概况 (优化前/后 score), 品牌健康趋势 (柱状图), 优化提升 (4 个维度) |
| **数据绑定** | `useGrowthStore` → 静态数据 |
| **缺失** | 1. 没有专用的后端 Growth API |
| | 2. 趋势数据来自本地静态数据, 不真实请求后端 |
| | 3. 后端 `GrowthService` 提供了 forecast/optimization/monitor 能力但未暴露为 API |
| **可直接复用率** | 50% |
| **评估** | **缺装配** — 后端有 GrowthService 但 API 层缺失。前端趋势图好看但数据是假的 (静态) |

---

## 核心发现

### 1. 真正的"缺能力"页面

| 页面 | 缺口类型 | 严重程度 |
|---|---|---|
| **Learning** | 🚨 后端能力完整, 前端完全未装配 | **Critical** — 5% 复用率 |
| **Recommendations (旧)** | 🚨 后端有完整 Intelligence API, 前端 Placeholder | **Critical** — 0% 复用率 |
| **Verification (旧)** | 🚨 后端验证能力完整, 前端 Placeholder | **High** — 0% 复用率 |
| **Knowledge (旧)** | 🚨 后端知识 CRUD + Quality Pipeline 完整, 前端 Placeholder | **High** — 0% 复用率 |
| **Publishing (旧)** | 🚨 后端 Manifest 系统完整, 前端 Placeholder | **High** — 0% 复用率 |

**结论：旧页面 (`.vue` 后缀) 全部是 Placeholder, 新页面 (`*Page.vue` 或 `*Shell.vue`) 有真实数据。**

### 2. 真正的"缺产品装配"问题

| 装配缺口 | 影响页面 | 描述 |
|---|---|---|
| **Discovery→Mission 自动流** | Discovery Lab → Mission Center | 扫描完成不自动生成 Mission |
| **Mission→Execution 持久化** | Mission Center | Execution 状态只在前端内存, 无后端持久化 |
| **Execution→Verification 自动流** | Mission Center → Verification | 执行完成不自动触发验证 |
| **Verification→Publishing 自动流** | Verification → Publishing | 验证通过不自动进入发布队列 |
| **Optimization 按钮 disabled** | Brand Overview / Recommendations | "开始优化/即将开放" 按钮禁用 |
| **Roadmap 未装配** | Recommendations | 后端有 roadmap 数据, 前端不用 |
| **Timeline 未装配** | Recommendations | 后端有 timeline 数据, 前端不用 |
| **Learning API 未装配** | Learning | 后端有完整 API, 前端不调用 |
| **Quality Pipeline 未集成** | Knowledge | 后端有 Pipeline, 前端不触发 |
| **发布渠道空壳** | Publishing | UI 完整但无下游消费 |

### 3. 页面分裂问题 (严重)

6个旧页面和新页面**并存**:

| 旧文件 (Placeholder) | 新文件 (有数据) |
|---|---|
| `recommendations.vue` | `RecommendationsPage.vue` |
| `verification.vue` | `VerificationPage.vue` |
| `publishing.vue` | `PublishingPage.vue` |
| `knowledge.vue` | `KnowledgePage.vue` |
| `discovery.vue` | `DiscoveryLabPage.vue` |
| `learning.vue` | — (无替代) |

路由未清理, 导致用户可能访问到空页面。

---

## 最终结论

**GEO 目前的核心问题是: 缺产品装配 (70%), 缺能力 (30%)。**

### 缺产品装配 (70% 的工作量)

从 Matrix 可以看出:
1. **后端能力覆盖面已达 85%+** — Discovery / Presence / Verification / Recommendation / Dashboard / Manifest / Explain / Execution / Mission Engine 都有完整实现
2. **关键缺口在页面间的装配链** — 6 个主要工作流页面中, 5 个有 PageShell 版本的新页面, 但:
   - Discovery→Mission 未串联
   - Mission→Execution 无持久化
   - Execution→Verification 无自动触发
   - Verification→Publishing 无自动流
   - Publishing 渠道为空壳
   - Learning 前端完全未连

### 具体缺什么装配

按优先级排序:

1. **P0 - 启动 Learning 前端装配** — 后端 Learning API 完整, 前端调用 0 行代码
2. **P0 - 路由清理** — 删除 6 个旧 Placeholder 文件, 统一到新页面
3. **P0 - Execution 持久化** — 让用户能看到 Mission 执行状态
4. **P1 - Discovery→Mission 自动流** — 发现完自动生成 Mission
5. **P1 - Optimization 按钮激活** — 去掉 disabled
6. **P1 - Roadmap/Timeline 装配** — 后端已有, 前端复用
7. **P1 - 验证后数据回流 Dashboard**
8. **P2 - Execution→Verification→Publishing 自动链**
9. **P2 - 真实发布渠道接入**

### 缺能力 (30% 的工作量)

1. **Learning 前端组件** — Review Modal / Promotion History / Dashboard Stats 需要新开发
2. **知识链可视化** — 实体→声明→证据→引用树状图
3. **验证对比图表** — Before/After 趋势可视化
4. **发布渠道适配器** — 各渠道 (RSS / Sitemap / API Feed) 的适配器实现
5. **Provider 配置 UI** — 目前 Provider 注册是硬编码的

### 一句话总结

> **GEO 不缺能力, 缺的是把这些能力串成用户可感知的"产品流程"。后端已经建好了 7 个引擎, 但前端只组装了 BrandOverview 一个完整的"产品页面"。剩下 5 个页面处于"有壳无肉"或"新老分裂"状态。最 urgent 的操作不是加新能力, 而是: (1) 删除旧 Placeholder 文件, (2) 装配 Learning API, (3) 打通 Mission→Execution 的状态持久化。**
