# GEO 平台收敛设计文档

> 版本: v1.0 · 状态: 草案 · 日期: 2026-07-17

---

## 现状

昆仑镜平台存在**两套并行 GEO 实现**，这是技术债务，必须消除。

| 维度 | KMKI-GEO | Brand GEO |
|---|---|---|
| 后端 | 完整（4 routes / 11 services / 8 repos / 8 agents） | 零后端（18+ API 全部返回 404） |
| 前端 | 12 个文件，未导入（死代码） | 17 个文件，完整 UI，`pages/workspace/geo.vue` 渲染此组件 |
| DB | GeoProject + 8 张领域表（prisma） | GeoProject / GeoBrandProfile / WebsiteSnapshot / GeoGraphNode / GeoGraphEdge |
| 集成度 | 后端 E2E 验证通过，前端未连接 | 前端 15 个菜单项完整，后端不存在 |

**结论**: 当前运行时入口指向 Brand GEO 前端（UI 完整），但所有 API 调用返回 404。KMKI 后端逻辑真实可靠，前端是死代码。需要合并两者为单一 GEO Workspace。

---

## 架构原则（产品架构师确认）

1. **一个 Workspace** —— 只有一个 GEO Workspace，Brand 是子模块（一个菜单项 + 一个资产类型），不是独立系统。
2. **平台优先** —— Auth、Membership、Permission、Project Center、Asset Center、Storage、Workspace Runtime 全部走昆仑镜统一能力。
3. **领域数据归 GEO** —— Claims、Evidence、Citations、FAQ、Schema、Knowledge Graph 等 GEO 专有数据留在 GEO。
4. **Keep/Migrate/Remove** —— 逐文件决策，不是"全部保留"或"全部删除"。

---

## 1. 单一 Workspace 定义

### 1.1 什么是 GEO Workspace

GEO Workspace 是昆仑镜下的一个工作空间类型，路径 `/workspace/geo`。它是品牌生态情报（Brand Ecosystem Intelligence）工作台，提供：

- 品牌档案管理 · 网站扫描与快照 · 知识图谱构建与可视化
- 实体发现与管理 · Claims/Evidence/Citations/FAQ 管线
- 语义管理器 · Asset Center · 增长目标与任务管理
- 搜索引擎可见性分析 · 竞品与选题分析

### 1.2 Brand 是子模块

Brand 是 GEO Workspace 中的一个菜单项 + 一种资产类型。Brand GEO 的 UI（15 个菜单项）大部分保留或迁移到 GEO Workspace，但 Brand 概念（品牌档案、网站扫描）是 GEO Workspace 的工作流阶段，不是独立系统的功能。

---

## 2. Keep/Migrate/Remove 矩阵（核心交付物）

### 2.1 后端 KMKI — 所有 36+ 文件

#### 路由层（4 files）

| 文件 | 决策 | 目标 | 理由 |
|---|---|---|---|
| `geo-project.route.ts` | Migrate | `routes/geo/project.route.ts` | 5 端点（CRUD + snapshot + version），Brand 前端同样需要 |
| `geo-entity.route.ts` | Keep | `routes/geo/entity.route.ts` | 7 端点，知识图谱核心 API |
| `geo-graph.route.ts` | Keep | `routes/geo/graph.route.ts` | 6 端点，知识图谱核心 API |
| `geo-knowledge-quality.route.ts` | Keep | `routes/geo/knowledge-quality.route.ts` | KQ 管线入口。C2 中替换 createStubLLM |

#### 服务层（11 files）

| 文件 | 决策 | 理由 |
|---|---|---|
| `geo-project.service.ts` | Migrate | 项目管理领域逻辑，Brand 前端同样需要 |
| `geo-entity.service.ts` | Keep | 实体发现与管理，领域核心 |
| `geo-graph.service.ts` | Keep | 知识图谱构建，领域核心 |
| `geo-claim.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-evidence.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-citation.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-faq.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-schema.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-quality.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-freshness.service.ts` | Keep | Sprint 1B 领域核心 |
| `geo-review.service.ts` | Keep | Sprint 1B 领域核心 |

#### 仓储层（8 files）

全部 **Keep** — 领域数据持久化，保留不动。`claim/evidence/citation/faq/schema/quality/freshness/review`。

#### 代理层（8 files）

全部 **Keep** — 5 个 Sprint 1B（claim/evidence/citation/faq/schema）E2E 验证通过；3 个 Sprint 1A（research/entity/knowledge-graph）保留但 C2 中需要实现真实 LLM 调用替换存根。

#### 注册层（4 files）

全部 **Keep** — `geo-registry.ts` / `geo-prompt-registry.ts` / `geo-workflow.ts` / `geo-workflow-registration.ts`。

#### 类型/入口（2 files）

全部 **Keep** — `types.ts` 领域类型定义，`index.ts` 模块导出。

### 2.2 前端 KMKI — 12 files

| 文件 | 决策 | 目标 | 理由 |
|---|---|---|---|
| `pages/GEOProjectList.vue` | Migrate | 合并到 Brand `ProjectSelectPage.vue` | 项目列表 UI 可复用 |
| `pages/GEOProjectWorkspace.vue` | Remove | - | 功能已被 Brand Workspace 覆盖 |
| `components/EntityDiscoveryPanel.vue` | Merge | 合并到 Brand `KnowledgeGraphPage.vue` | 实体发现 UI 作为补充组件 |
| `components/FlowPipeline.vue` | Merge | GEO Workspace 通用组件 | 管线流程 UI 有复用价值 |
| `components/GEOProjectCard.vue` | Merge | 合并到 Brand 项目卡片 | 项目卡片 UI 复用 |
| `components/KnowledgeGraphViewer.vue` | Merge | 合并到 Brand 图谱页面 | 图谱可视化功能合并 |
| `components/ProvenanceTimeline.vue` | Keep | 通用组件 | 溯源时间线，GEO 特有 |
| `components/TopicResearchPanel.vue` | Merge | 合并到 Brand 研究面板 | 主题研究 UI |
| `runtime/geo.runtime.ts` | Remove | - | 被 `useBrandGEORuntime` 取代 |
| `services/geo.service.ts` | Migrate | 合并到统一 API 客户端 | API 逻辑对接 Brand 后端 |
| `store/useGEOStore.ts` | Remove | - | 被 `useBrandGeoStore` 取代 |
| `types/index.ts` | Migrate | 合并到 Studio V2 GEO 类型 | 类型整合 |

### 2.3 前端 Brand GEO — 17 files

| 文件 | 决策 | 目标 | 理由 |
|---|---|---|---|
| `BrandGEOWorkspace.vue` | Migrate | `GEOWorkspace.vue` | 结构良好，保留布局，重命名 |
| `components/BrandGEOSidebar.vue` | Migrate | `components/GEOSidebar.vue` | UI 良好，重命名 |
| `components/GeoDashboard.vue` | Keep | - | 仪表板组件 |
| `components/GeoPlaceholderPanel.vue` | Keep | - | 占位面板（用于未实现面板） |
| `composables/useBrandGEORuntime.ts` | Migrate | `composables/useGEORuntime.ts` | 运行时控制，重命名 + 对接 KMKI 后端 |
| `config/dashboard-cards.ts` | Keep | - | 仪表盘配置 |
| `config/sidebar.ts` | Keep | - | 侧边栏配置，需更新菜单项 |
| `pages/AssetCenterPage.vue` | Keep | - | 使用平台 Asset Center 能力 |
| `pages/BrandProfilePage.vue` | Keep | - | GEO 特有领域页面 |
| `pages/KnowledgeGraphPage.vue` | Keep | - | 合并 KMKI 图谱查看器 |
| `pages/ProjectCreatePage.vue` | Keep | - | 对接 KMKI geo-project API |
| `pages/ProjectSelectPage.vue` | Keep | - | 对接 KMKI geo-project API |
| `pages/SemanticExplorer.vue` | Keep | - | 语义管理器，GEO 特有 |
| `pages/WebsiteScannerPage.vue` | Keep | - | 网站扫描，GEO 特有 |
| `services/brandService.ts` | Remove | - | Brand 特定 API 移除，走统一平台 API |
| `services/citationService.ts` | Merge | 合并到 `geoService.ts` | 引用 API 对接 KMKI citation service |
| `services/competitorService.ts` | Merge | 合并到 `geoService.ts` | 竞品分析 API |
| `services/index.ts` | Remove | - | 调整导出路径 |
| `services/projectService.ts` | Merge | 合并到 `geoService.ts` | 对接 KMKI geo-project service |
| `services/utils.ts` | Remove | - | `getAuthHeaders()` 由平台 auth gate 处理 |
| `services/visibilityService.ts` | Merge | 合并到 `geoService.ts` | 可见性分析 API |
| `stores/useBrandGeoStore.ts` | Migrate | `stores/useGeoStore.ts` | 去 Brand 前缀，保留数据模型，对接 KMKI |

### 2.4 数据库层

| 表 | 决策 | 理由 |
|---|---|---|
| `GeoProject` | Keep | 合并两种模式到同一表，schema 基本兼容 |
| `GeoBrandProfile` | Keep | GEO 特有领域数据 |
| `WebsiteSnapshot` | Keep | GEO 特有领域数据 |
| `GeoGraphNode` | Keep | GEO 特有领域数据（Entity 概念映射） |
| `GeoGraphEdge` | Keep | GEO 特有领域数据（EntityRelation 映射） |
| 8 张 KMKI 领域表 | Add | 在 prisma schema 中创建（C2） |

### 2.5 配置层

| 配置 | 决策 | 理由 |
|---|---|---|
| `brand-geo/config/sidebar.ts` | Keep | 侧边栏菜单配置，更新菜单项 |
| `brand-geo/config/dashboard-cards.ts` | Keep | 仪表盘卡片 |
| KMKI 应用配置 | Remove | 由 Brand 配置取代 |
| 后端 index.ts 代理注册（407-418） | Keep | 注册逻辑保留 |

---

## 3. 前端收敛方案

### 3.1 Brand GEO 汇总

- **Keep（11）**: GeoDashboard, GeoPlaceholderPanel, dashboard-cards.ts, sidebar.ts 及 7 个页面文件
- **Migrate（4）**: BrandGEOWorkspace→GEOWorkspace, BrandGEOSidebar→GEOSidebar, useBrandGEORuntime→useGEORuntime, useBrandGeoStore→useGeoStore
- **Merge（4）**: citationService, competitorService, projectService, visibilityService → 统一 `geoService.ts`
- **Remove（3）**: brandService.ts, services/index.ts, services/utils.ts

### 3.2 KMKI-GEO 汇总

- **Keep（1）**: ProvenanceTimeline.vue
- **Merge（5）**: EntityDiscoveryPanel, FlowPipeline, GEOProjectCard, KnowledgeGraphViewer, TopicResearchPanel
- **Migrate（2）**: GEOProjectList, geo.service.ts
- **Remove（3）**: GEOProjectWorkspace.vue, geo.runtime.ts, useGEOStore.ts

### 3.3 最终目录结构

```
frontend/studio-v2/workspace/geo/
├── GEOWorkspace.vue                  # 原 BrandGEOWorkspace
├── components/
│   ├── GEOSidebar.vue                # 原 BrandGEOSidebar
│   ├── GeoDashboard.vue              # Keep
│   ├── GeoPlaceholderPanel.vue       # Keep
│   ├── ProvenanceTimeline.vue        # 从 KMKI 迁移
│   └── FlowPipeline.vue              # 从 KMKI 合并
├── composables/
│   └── useGEORuntime.ts              # 原 useBrandGEORuntime
├── config/
│   ├── dashboard-cards.ts            # Keep
│   └── sidebar.ts                    # Keep，更新菜单
├── pages/
│   ├── AssetCenterPage.vue           # Keep
│   ├── BrandProfilePage.vue          # Keep
│   ├── KnowledgeGraphPage.vue        # Keep，合并 KMKI 图谱
│   ├── ProjectCreatePage.vue         # Keep
│   ├── ProjectSelectPage.vue         # Keep，合并 KMKI 项目列表
│   ├── SemanticExplorer.vue          # Keep
│   └── WebsiteScannerPage.vue        # Keep
├── services/
│   └── geoService.ts                 # 统一 API 客户端
├── stores/
│   └── useGeoStore.ts                # 原 useBrandGeoStore
└── types/
    └── index.ts                      # 合并 Brand + KMKI 类型
```

### 3.4 迁移步骤

1. **重命名**: BrandGEOWorkspace→GEOWorkspace, BrandGEOSidebar→GEOSidebar, useBrandGEORuntime→useGEORuntime
2. **统一 Store**: useBrandGeoStore→useGeoStore，保持 API 兼容，用 KMKI 后端替换 stub
3. **统一 Service**: 合并 6 个 service 为 1 个 geoService.ts
4. **合并 KMKI 组件**: EntityDiscoveryPanel, KnowledgeGraphViewer, ProvenanceTimeline 等合并到对应页面
5. **更新入口**: `pages/workspace/geo.vue` 导入路径
6. **删除死代码**: 删除 `frontend/modules/geo/` 目录（C3）

---

## 4. 后端收敛方案

### 4.1 留在 GEO（领域专属）

- 项目管理（不代替平台 Project Center，GEO 领域上下文内的项目）
- 实体管理（发现、检索、更新、关系）
- 知识图谱（构建、查询、可视化）
- 知识质量管线（Claims→Evidence→Citations→FAQ→Schema）
- 品牌档案 CRUD · 网站扫描与快照 · 语义管理

### 4.2 移到平台（统一能力）

| 能力 | 当前 | 目标 |
|---|---|---|
| 认证 | Brand 前端手动 `getAuthHeaders()` 从 localStorage | 平台 auth gate/middleware |
| 会员/权限 | 无 | 平台 Membership & Permission |
| 项目中心 | GeoProject 独立 | 本次不合并，后续讨论 |
| 资产中心 | Brand 独立 AssetCenterPage | 平台 Asset Center |
| 存储 | Brand 尚未实现 | 平台 Storage（COS/对象存储） |
| Workspace Runtime | 自建 Runtime | 平台 Workspace Runtime |

### 4.3 路由整合

4 个 route 文件保留扩展，Brand 前端缺失 ~10 个端点：

| Brand 端点 | KMKI 对应 | 行动 |
|---|---|---|
| `POST/GET/DELETE /api/geo/projects` | `geo-project.route.ts` | 验证 payload 兼容 |
| `POST /api/geo/projects/:id/tasks` | 缺失 | 新增 |
| `GET /api/geo/projects/:id/tasks` | 缺失 | 新增 |
| `POST /api/geo/scan` | 缺失 | 新增：网站扫描 |
| `GET /api/geo/scan/:id/status` | 缺失 | 新增 |
| `GET /api/geo/snapshot/:id` | 缺失 | 新增 |
| `GET/PUT /api/geo/brand/:projectId` | 缺失 | 新增：品牌档案 CRUD |
| `POST /api/geo/graph/edges` | `addRelation` endpoint | 修改 payload 匹配 |
| `GET /api/geo/brands/:id/visibility` | 缺失 | 新增 |
| `GET /api/geo/brands` | 缺失 | 新增 |
| `POST /api/geo/dashboard/stats` | 缺失 | 新增 |

### 4.4 后端目录结构（最终）

```
backend/src/services/geo/
├── index.ts
├── types.ts
├── routes/
│   ├── geo-project.route.ts
│   ├── geo-entity.route.ts
│   ├── geo-graph.route.ts
│   ├── geo-knowledge-quality.route.ts
│   ├── geo-brand.route.ts          # 新增
│   ├── geo-scanner.route.ts        # 新增
│   └── geo-dashboard.route.ts      # 新增
├── services/（13 files: 保留 11 + 新增 3）
├── repositories/（8 files: 全部保留）
├── agents/（8 files: 全部保留）
└── registry/（4 files: 全部保留）
```

---

## 5. 数据库收敛计划

### 5.1 GeoProject 表

**不合并到平台 Project Center**。GeoProject 保留为 GEO 领域上下文内的项目概念。分两步：

1. **C2**: 保持现有 schema，添加 Brand 前端需要的缺失字段（`description`、`targetKeywords` 等）
2. **C3+**: 如有需要，讨论是否与平台 `Project` 表统一

`status` 字段对齐为 `draft | active | paused | completed | archived`

### 5.2 Brand 表迁移

| 表 | 操作 |
|---|---|
| `GeoBrandProfile` | 保留，`projectId` FK→GeoProject |
| `WebsiteSnapshot` | 保留，`projectId` FK→GeoProject |
| `GeoGraphNode` | 保留，Entity 概念映射到 type+label |
| `GeoGraphEdge` | 保留，EntityRelation 映射 |
| KMKI 8 领域表 | C2 中在 prisma 创建 |

### 5.3 迁移步骤

1. GeoProject/GeoBrandProfile/WebsiteSnapshot/GeoGraphNode/GeoGraphEdge 保持不变
2. 新增 8 张 KMKI 领域表
3. 添加索引
4. schemaVersion=2
5. 不需要数据迁移

---

## 6. 最终菜单结构

```
■ 核心工作流
  总览仪表盘      dashboard        📊
  项目管理         projects         📋
  品牌档案         brand-profile    🏷️
  网站扫描         website-scanner  🔍
  知识图谱         knowledge-graph  🔗

■ 分析洞察
  语义管理器       semantic-explorer 🧠
  可见性分析       visibility       👁️
  引用追踪         citations        📝
  热门话题         topics           🔥
  实体图谱         entities         🧩

■ 增长执行
  增长目标         growth-dashboard 🚀  (Phase 4)
  目标追踪         goal-timeline    📈  (Phase 4)
  任务中心         tasks            ✅

■ 资产与设置
  资产中心         asset-center     📦
  设置             settings         ⚙️
```

**总数**: 15 个菜单项（全部来自 Brand，部分后端由 KMKI 提供）。去掉 `competitors`（合并到 dashboard）、`reports`、`help`。

---

## 7. Sprint C1-C3 执行计划

### C1: 收敛架构设计（本文档）

- [x] GEO-PLATFORM-CONVERGENCE.md
- [x] Keep/Migrate/Remove 矩阵
- [ ] 架构评审
- [ ] 定稿

### C2: 集成平台能力（估算 10-15 人天）

**前端（5-8 天）**:
1. 重命名 GEO Workspace 组件（Brand→移除前缀）
2. 重命名 Sidebar/Runtime/Store
3. 统一 API 客户端：6→1 个 geoService.ts
4. 对接 KMKI 后端 API
5. 合并 KMKI 前端组件
6. 删除 modules/geo/ 已合并文件

**后端（5-7 天）**:
1. 新增 Brand 缺失端点 ~10 个
2. 替换 createStubLLM → 真实 Capability Provider
3. 实现 Sprint 1A 三个 Agent 的真实 LLM 调用
4. 接入平台 auth middleware
5. prisma schema 补充 8 张领域表 + FK 约束

### C3: 工程清理（估算 3-5 天）

1. 删除废弃 KMKI 前端目录
2. 删除 Brand 重复代码（brandService 等）
3. 删除 Mock/Stub 残余
4. 删除重复 Store
5. 删除重复 API
6. 目录结构最终对齐

---

## 8. 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| Brand GEO 已有数据需要迁移 | C2 延期 | 本次架构收敛不涉及数据迁移，数据模型保持向前兼容 |
| 平台统一能力（auth/permission/asset center）文档不完整 | C2 阻塞 | 先做最短路径集成（auth middleware），其余后续补 |
| KMKI 前端组件与 Brand 组件有样式冲突 | C3 延期 | 迁移时保留原有样式，不做统一主题 |
| Sprint 1A 代理实现需要大量 Prompt Engineering | C2 延期 | 可以先做最小可行版本（调用 LLM 但 prompt 不完美） |

**需要产品架构师决策**:
1. GeoProject 是否最终合并到平台 Project Center？→ 本次不合并，C3+ 讨论
2. Brand GEO 的 Competitor/Topic 分析功能是否需要独立 API？→ 合并到 dashboard
3. 是否保留 `reports` 菜单项？→ 删除，后续 Phase 添加
4. Asset Center 是走平台统一还是 GEO 自建？→ 走平台统一
