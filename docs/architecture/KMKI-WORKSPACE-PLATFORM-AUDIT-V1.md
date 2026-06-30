# KMKI Workspace Platform Architecture Audit v1

> **Audit Date:** 2026-04-08  
> **Scope:** 昆仑镜 (Kunlun Mirror) Frontend Platform — Full Coverage  
> **Project Root:** `/root/shipin-cinematic-studio`

---

## Executive Summary

昆仑镜前端从 Nuxt3 + Pinia 起步，经过多轮演进（短剧工作台→Director OS→GEO→导演驾驶舱），架构复杂度已显著增长。当前存在 **5 个独立的 Layout 系统、3 套 Sidebar/Nav 实现、2 套后台管理入口、2 个 Project 模型**，以及 **kmki-ui 组件库未被标准化采用** 的问题。

**核心发现：GEO 是唯一完全独立于平台 Layout 体系的工作台**，拥有自己的 Layout、Sidebar、Store、Project 模型、API 客户端和 UI 组件体系。

---

## 1. Layout 统一性审计

### 1.1 Layout 清单

| Layout 文件 | 路径 | 用途 | Sidebar/导航 |
|---|---|---|---|
| `workbench.vue` | 盘古斧 Workbench | 盘古斧 AI Execution OS | ✅ 内置 5 项导航 |
| `admin-aigc.vue` | Director OS Admin | 后台管理系统 | ✅ 内置 15+ 项管理菜单 |
| `user.vue` | 用户中心 | 个人控制台 | ✅ 内置 9 项导航 |
| `vip.vue` | VIP 套餐 | VIP 购买页 | ❌ 仅顶栏 |
| `default.vue` | 默认 | 通用空壳 | ❌ 仅 slot |

### 1.2 Layout 使用分析 (Pages→Layout Mapping)

通过审计每个 pages/*.vue 的 `definePageMeta({layout: ...})` 情况：

**确定使用 `admin-aigc` layout** (Director OS Admin 路由):
- `/admin/aigc/*` 所有页面（overview, models, members, payment, vip, admins, cos, community, messages, sms, wechat, qq, agents, market）
- `/director-os/aigc/*` 镜像路由（与 admin 路由功能重复，参见 1.4）

**确定使用 `workbench` layout** (盘古斧路由):
- `/workbench/console`
- `/workbench/dag`
- `/workbench/health`
- `/workbench/repair`
- `/workbench/trace`

**确定使用 `user` layout**:
- `/user/profile`, `/user/projects`, `/user/membership`, `/user/credits`
- `/user/messages`, `/user/library`, `/user/promo`, `/user/agent`
- `/user/download`, `/user/gallery`, `/user/storage`, `/user/wallet`

**确定使用 `vip` layout**:
- 未在 pages 中直接检测到固定使用 `vip` layout 的页面

**未检测到 layout 声明的页面（使用 Nuxt 默认 `default.vue`）**:
- `/` (index.vue) — 首页（但首页实际使用 `<KunlunNav>` 组件，非 layout）
- `/register.vue`
- `/mobile.vue`
- `/studio/v2` — **关键：studio-v2 页面使用额外样式覆盖 html/body 高度**
- `/workspace/geo` — **关键：GEO 页面使用额外样式覆盖 html/body 高度**
- `/projects` — 使用 `definePageMeta({middleware: 'auth'})` 但无 layout
- `/hdz/*` — 火星工作台
- `/novel/*` — 小说工作台
- `/director/*` — 导演工作台
- `/director-os/*` — Director OS 非 aigc 子页面
- `/p0/*` — P0 页面
- `/community/*` — 社区页面
- 部分 `/studio-v2/m/creative` 移动端

### 1.3 关键发现：GEO Layout 完全独立

**GEO 不使用任何平台 Layout**。

`/workspace/geo` 页面源码：
```vue
<template>
  <div style="width: 100%; height: 100%;">
    <BrandGEOWorkspace />
  </div>
</template>
```

同样，`/studio/v2` 页面直接使用 `StudioWorkspaceLayout`：
```vue
<template>
  <div style="width:100%;height:100%">
    <StudioWorkspaceLayout />
  </div>
</template>
```

两者都绕过 Nuxt Layout 系统，自行处理整页面布局。

### 1.4 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| L1 | **GEO 完全独立于 Layout 体系** | 🔴 高 | 使用自定义 `GeoWorkspaceLayout`，与平台 5 个 Layout 完全脱节 |
| L2 | **Login 路由镜像** | 🟡 中 | `/admin/aigc/login` 和 `/director-os/aigc/login` 功能重复，后者内容注释为"废弃" |
| L3 | **layout 声明不一致** | 🟡 中 | 多页面无显式 layout 声明，依赖 Nuxt 默认行为 |
| L4 | **首页 Layout 未使用** | 🟢 低 | 首页 `KunlunNav` 直接编写在 Page 中，未使用 layout |

---

## 2. Navigation / Sidebar 审计

### 2.1 Sidebar/Nav 实现清单

| 实现 | 所在文件 | 菜单项数 | 设计模式 |
|---|---|---|---|
| 盘古斧 Nav | `layouts/workbench.vue` | 5 | 内联定义 `navItems` |
| 用户中心 Nav | `layouts/user.vue` | 9 | 内联定义 `navItems` |
| Admin 侧栏 | `layouts/admin-aigc.vue` | 15 | 内联定义 `menu` |
| GEO 侧栏 | `studio-v2/workspace/brand-geo/components/BrandGEOSidebar.vue` | 7 (Consumer) + 5 (Advanced) + 5 (Developer) | 配置分离 `config/sidebar.ts` |

### 2.2 GEO Sidebar 结构

GEO 使用最成熟的 Navigation 设计：

```
├── 🌐 品牌GEO
├── Consumer 菜单 (always visible)
│   ├── 🌐 GEO 工作台
│   ├── 📊 工作台 (Dashboard)
│   ├── 🚀 品牌分析 (Wizard)
│   ├── 🏢 品牌 (Brands)
│   ├── 📄 报告 (Report)
│   ├── 📜 历史 (History)
│   └── ⚙️ 设置 (Settings)
├── 高级功能 (toggleable)
│   ├── 📚 知识内容
│   ├── 📋 事实
│   ├── 📄 来源
│   ├── 🔗 关系图
│   └── 🔑 搜索词
├── Developer 菜单 (URL only)
│   ├── 🎬 执行工作室
│   ├── 📋 分析记录
│   ├── 🔬 系统镜头
│   ├── ⚙️ 系统控制
│   └── 🌐 配置信息
├── 模式切换 (简易/专家)
└── 返回首页
```

**GEO 是唯一实现了 `consumer/advanced/developer` 三级渐进披露导航的工作台。**

### 2.3 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| N1 | **三个独立 Nav 定义** | 🟡 中 | workbench/user/admin 各有自己的 navItems/menu 数组，无统一菜单注册机制 |
| N2 | **GEO 导航配置最成熟** | 🟢 信息 | GEO 已从 `config/sidebar.ts` 分离配置，可作为平台标准参考 |
| N3 | **Admin 导航中隐藏废弃项** | 🟢 低 | 使用注释保留废弃菜单（coins, customer-service） |
| N4 | **无平台级菜单注册表** | 🟡 中 | 新工作台要注册菜单必须修改 layout 代码，缺乏插件化机制 |

---

## 3. Project 模型统一性审计

### 3.1 后端 Prisma 模型

| 模型 | 表名 | 用途 |
|---|---|---|
| `Project` | `Project` | 统一项目模型（Phase 1a），含 `type: 'geo' \| 'video' \| 'novel' \| 'ppt' \| 'custom'` |
| `GeoProjectProfile` | `GeoProjectProfile` | Project 的 GEO 扩展（website, domain, brand, language, country, industry） |
| `GeoProject` | `GeoProject` | **独立** GEO 项目模型（userId, name, website, industry, language, country, status） |

### 3.2 前端 Store

| Store | 文件 | 项目模型 | 数据来源 |
|---|---|---|---|
| `useProjectStore` | `stores/project.ts` | `Project { id, title, status, ... }` | Mock / `projectService` API |
| `useBrandGeoStore` | `studio-v2/workspace/brand-geo/stores/useBrandGeoStore.ts` | `GeoProject` + `GeoProjectV2` | 自有 API 客户端 |

### 3.3 关键发现：双 Project 模型

后端存在两种项目模型：

```prisma
// 统一模型 (Phase 1a)
model Project {
  id     String   @id @default(uuid()) @db.Uuid
  name   String
  type   String?  // 'geo' | 'video' | 'novel' | 'ppt' | 'custom'
  ...
}

// 遗留模型 (GEO v3)
model GeoProject {
  id     String   @id @default(uuid())
  userId String
  name   String
  website String?
  ...
}
```

`GeoProject` 是一个**独立自洽的项目模型**，未通过外键关联到统一的 `Project` 模型。`GeoProjectProfile` 被设计为 `Project` 的扩展，但 `GeoProject` 并未被废弃。

### 3.4 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| P1 | **双 Project 模型** | 🔴 高 | `Project` (统一) 与 `GeoProject` (独立) 共存，数据流通断裂 |
| P2 | **GeoProject 无外键关联** | 🔴 高 | `GeoProject` 的 `projectId` 未通过 FK 关联到统一 `Project` |
| P3 | **前端 project store 与 GEO store 分离** | 🟡 中 | `useProjectStore` 和 `useBrandGeoStore` 各自管理项目列表 |
| P4 | **Project 类型枚举未统一** | 🟡 中 | 后端用 `type: 'geo'\|'video'\|'novel'\|'ppt'\|'custom'`，但 GEO 使用独立模型不遵循此枚举 |

---

## 4. Permission / VIP 体系审计

### 4.1 后端认证体系

**Auth Plugin** (`plugins/auth.ts`):
- 使用 Fastify JWT 认证
- `authenticate` 装饰器：单设备登录检查（`tokenVersion` 比对）
- 全局 `onRequest` 钩子：检查 AI API 路由的 VIP 限权
- 定义 10+ 个 AI API 前缀用于 VIP 检查

**VIP/Permission 模型**（3 个独立模型）：

| 模型 | 表 | 用途 | 字段 |
|---|---|---|---|
| `MemberPlan` | `MemberPlan` | 会员套餐定义 | level, price, months, storageLimit, dailyQuota, maxResolution, maxDuration, concurrentTasks, apiAccess... |
| `AgentPlan` | `AgentPlan` | 代理计划定义 | level, price, months, commissionRate, benefits |
| `SubscriptionPlan` | `governance_subscription_plan` | 统一订阅计划 (Governance) | code, billingCycle, capabilities (JSON), grants |

### 4.2 前端 Auth Store

`useAuthStore` (`stores/auth.ts`):
- Token 管理：Pinia state + localStorage + Cookie 三写机制
- 登录方式：email + password / phone + password
- `memberTier` 属性：`'free'` (default)
- 无 VIP 计划查询、套餐选择、权限级别枚举

### 4.3 关键发现：三套支付/套餐体系并存

| 体系 | 模型 | 前端集成 | 状态 |
|---|---|---|---|
| MemberPlan | 原始会员体系 | 通过 `useAuthStore.memberTier` | 活跃 |
| AgentPlan | 代理计划 | 独立页面 `/admin/aigc/market` | 活跃 |
| SubscriptionPlan | Governance 订阅计划 | 后端 `CapabilityGrant` 关联 | 新建，未与前端集成 |

### 4.4 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| A1 | **三套套餐模型并存** | 🟡 中 | MemberPlan (原始)、AgentPlan (代理)、SubscriptionPlan (治理)，缺乏统一抽象 |
| A2 | **VIP 检查逻辑分散** | 🟡 中 | 后端 AI API 前缀写死 10+ 个，缺乏权限规则注册表 |
| A3 | **GEO 无独立权限体系** | 🟢 低 | GEO 使用平台 auth 中间件，未自建权限系统 ✅ |
| A4 | **前端无 VIP 计划查询** | 🟢 低 | `useAuthStore` 不包含 VIP 套餐列表、定价、购买逻辑 |

---

## 5. kmki-ui 使用情况审计

### 5.1 kmki-ui 组件库清单

`components/kmki-ui/` 目录：

```
Badge/index.vue
Metric/index.vue
Timeline/index.vue
ExplainPanel/index.vue
DiffViewer/index.vue
HealthIndicator/index.vue
ActivityFeed/index.vue
Card/index.vue
EmptyState/index.vue
Skeleton/index.vue
README.md
```

共 **10 个** 可复用组件。

### 5.2 kmki-ui 使用范围

| 使用位置 | 使用的组件 | 文件数 |
|---|---|---|
| `studio-v2/workspace/brand-geo-v2/` | Timeline, Metric, HealthIndicator, ExplainPanel, Badge, DiffViewer | 6 个文件 |
| `pages/` | **未使用** | 0 |
| `components/` | **未引用自身** | 0 |
| 其他 workspace | **未使用** | 0 |

### 5.3 关键发现

- kmki-ui **仅被 brand-geo-v2 工作台使用**
- 其他 workspace (script-analysis, character-design, scene-design, storyboard, video-generation, music-generation 等) **完全未使用** kmki-ui 组件
- 所有 kmki-ui 组件通过 `~/components/kmki-ui/...` 路径导入，路径前缀统一 ✅

### 5.4 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| K1 | **kmki-ui 采用率极低** | 🔴 高 | 10 个组件仅 1 个工作台使用，其余工作台完全未采用 |
| K2 | **kmki-ui 未标准化** | 🟡 中 | 无统一的组件选择指南、无 SSR 兼容性检查 |
| K3 | **无全局 kmki-ui 注册** | 🟢 低 | 每个文件手动 import，未使用 Nuxt 自动导入或组件注册 |

---

## 6. Workspace 入口审计

### 6.1 所有 Workspace/Studio/Director 入口

| 页面路由 | 使用的组件 | Workspace 系统 |
|---|---|---|
| `/studio/v2` | `StudioWorkspaceLayout` | **短剧工作台** (核心) |
| `/workspace/geo` | `GeoWorkspaceV1` (brand-geo-v2) | **GEO 工作台** |
| `/projects` | 独立项目列表页 | 项目选择器 |
| `/director/index` | — | 导演工作台 |
| `/director/workbench` | — | 导演驾驶舱 |
| `/director/observatory` | — | 导演观测台 |
| `/hdz/workspace/[id]` | — | 火星工作台 |
| `/hdz/m/workspace/[id]` | — | 火星移动端工作台 |
| `/novel/index` | — | 小说工作台 |
| `/novel/[id]` | — | 小说详情 |
| `/studio-v2/m/creative` | — | 移动端创意 |

### 6.2 Workspace 注册机制

短剧工作台使用 `WorkspaceRenderer.vue` 作为**工作台路由分发器**：

```vue
<ScriptAnalysisWorkspace v-if="workspaceId === 'script-analysis'" />
<CharacterWorkspace v-else-if="workspaceId === 'character-design'" />
<SceneWorkspace v-else-if="workspaceId === 'scene-design'" />
<StoryboardWorkspace v-else-if="workspaceId === 'storyboard'" />
<VideoGenerationWorkspace v-else-if="workspaceId === 'video-generation'" />
<MusicGenerationWorkspace v-else-if="workspaceId === 'music-generation'" />
<AdvertisementWorkspace v-else-if="workspaceId === 'voice-generation'" />
```

这是一个**硬编码的 workspace 注册表**，新的 workspace 需要修改 `WorkspaceRenderer.vue` 添加 else-if 分支。

### 6.3 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| W1 | **Workspace 注册硬编码** | 🟡 中 | `WorkspaceRenderer.vue` 使用 if/else-if 分发，非可注册式 |
| W2 | **缺少统一 Workspace Registry** | 🟡 中 | 无集中注册表，新工作台需修改 3+ 文件（renderer, layout, router） |
| W3 | **GEO 入口独立** | 🟡 中 | `/workspace/geo` 完全不经过 `WorkspaceRenderer`，直接渲染 GeoWorkspaceV1 |
| W4 | **多个 Page 路由无关联组件** | 🟢 低 | `/director/*`、`/hdz/*` 等路由尚未与 StudioWorkspaceLayout 关联 |

---

## 7. 后台管理菜单审计

### 7.1 Admin 菜单结构 (`admin-aigc.vue`)

```
📊 总控制台         → /admin/aigc/overview
🤖 大模型列表       → /admin/aigc/models
👥 会员模块         → /admin/aigc/members
💳 支付设置         → /admin/aigc/payment
💎 VIP套餐管理      → /admin/aigc/vip
🛡️ 管理员设置       → /admin/aigc/admins
🗄️ COS用户存储      → /admin/aigc/cos
💬 社区管理         → /admin/aigc/community
✉️ 发私信           → /admin/aigc/messages
📱 短信配置         → /admin/aigc/sms
💬 微信登录配置     → /admin/aigc/wechat
🐧 QQ登录配置       → /admin/aigc/qq
🤖 Agent管理        → /admin/aigc/agents
📈 市场代理管理     → /admin/aigc/market
```

### 7.2 关键发现：路由镜像

存在两条平行的管理路由：

| 路径前缀 | Layout | 备注 |
|---|---|---|
| `/admin/aigc/...` | `admin-aigc` | 活跃 |
| `/director-os/aigc/...` | 无 layout 声明 | 镜像路由，内容含"废弃"注释 |

在同一项目内保留两套后台管理入口，增加了维护复杂度。

### 7.3 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| M1 | **管理路由镜像** | 🟡 中 | `/admin/aigc/*` 和 `/director-os/aigc/*` 具有相同的菜单项 |
| M2 | **菜单缺失父级分组** | 🟢 低 | 15 项扁平的菜单列表，无分组/子菜单结构 |
| M3 | **废弃项保留在代码中** | 🟢 信息 | 使用注释隐藏废弃菜单项，可作为清理参考 |

---

## 8. Workspace 共享组件清单

### 8.1 各工作台组件目录

#### 8.1.1 GEO 工作台组件 (brand-geo/components/)

```
核心布局:          GeoWorkspaceLayout.vue, BrandGEOSidebar.vue, GeoTopBar.vue, GeoStatusBar.vue, GeoToast.vue
状态组件:          GeoDashboard.vue, GeoLoadingSkeleton.vue, GeoLoadingState.vue, GeoEmptyState.vue, GeoErrorState.vue, GeoPlaceholderPanel.vue
Brand 模块:        BrandTable.vue, BrandFormModal.vue, BrandDeleteModal.vue, BrandInfoCard.vue, BrandWebsiteCard.vue, BrandKeywordsCard.vue, BrandStatusCard.vue, BrandWorkflowNav.vue
Evidence 模块:     EvidenceScoreBadge.vue, EvidenceSourceTable.vue, EvidenceCard.vue
Claim 模块:        ClaimCard.vue, ClaimEvidencePanel.vue, ClaimCitationPanel.vue
Knowledge 模块:    KnowledgeStats.vue, KnowledgeObjectList.vue, KnowledgeObjectDetail.vue
Keyword 模块:      KeywordFilters.vue, KeywordTable.vue
Report 模块:       ReportCard.vue, ReportViewer.vue, ReportExportDialog.vue
History 模块:      HistoryEventCard.vue, HistoryFilter.vue, HistoryTimeline.vue
Execution 模块:    ExecutionOutputPanel.vue, TraceTimeline.vue, ExecutionTraceViewer.vue
Workflow 模块:     WorkflowTimeline.vue
```

**GEO 组件总量：~40 个组件**（含子目录），是组件最丰富的工作台。

#### 8.1.2 GEO V2 工作台 (brand-geo-v2/)

```
GeoWorkspaceV1.vue        — 主入口：三栏布局 (Projects | Workspace | Insights)
GeoProjectsPanel.vue      — 项目列表面板
GeoOverview.vue           — 概览面板 (kmki-ui: Metric, HealthIndicator, ExplainPanel)
GeoTimeline.vue           — 时间线面板 (kmki-ui: Timeline)
GeoEvidence.vue           — 验证面板 (kmki-ui: Badge, ExplainPanel)
GeoPublish.vue            — 发布面板 (kmki-ui: Badge, ExplainPanel, DiffViewer)
GeoInsights.vue           — 洞察面板 (kmki-ui: Badge, ExplainPanel)
GeoInsightsPanel.vue      — 洞察子面板
```

#### 8.1.3 短剧工作台 Workspace 子工作台

| 子工作台 | 目录 | 组件数 |
|---|---|---|
| 剧本分析 | `workspace/script-analysis/` | ~5 |
| 角色设计 | `workspace/character-design/` | ~5 |
| 场景设计 | `workspace/scene-design/` | ~5 |
| 分镜设计 | `workspace/storyboard/` | ~5 |
| 视频生成 | `workspace/video-generation/` | ~5 |
| 音乐创作 | `workspace/music-generation/` | ~5 |
| 配音合成 | `workspace/dubbing-render/` | ~5 |
| 广告创作 | `workspace/advertisement/` | ~5 |
| 最终渲染 | `workspace/final-render/` | ~5 |
| 视频编辑器 | `workspace/video-editor/` | ~8 (PreviewPanel, TimelineRuler, TrackRow, VideoEditorWorkspace 等) |
| 导演驾驶舱 | `workspace/director-workbench/` | ~3 |
| 导演工作台 | `workspace/director/` | ~5 (SegmentCardGrid, TimelineHeader, TimelineTable, DirectorWorkspace 等) |

每个子工作台有自己独立的组件，**无跨 workspace 共享组件机制**。

### 8.2 问题清单

| # | 问题 | 严重程度 | 说明 |
|---|---|---|---|
| C1 | **GEO 组件最多但隔离度最高** | 🟡 中 | GEO 有 40+ 组件，完全在独立目录中，不可被其他工作台复用 |
| C2 | **Workspace 组件无共享层** | 🟡 中 | 每个子工作台有自己独立组件重复实现（Loading/Empty/Error 等状态组件） |
| C3 | **GEO 状态组件不可复用** | 🟢 低 | GeoLoadingState, GeoEmptyState, GeoErrorState 可供平台使用但未导出 |
| C4 | **V1 与 V2 GEO 实现并存** | 🟡 中 | brand-geo (v3) 和 brand-geo-v2 平行存在，含相同概念的组件但实现不同 |

---

## 9. 平台架构整体评估

### 9.1 架构演进阶段

```
Phase 0   ─── 原始架构 (Nuxt3 + 基础 Layout)
              ├── default.vue, user.vue, vip.vue
              ├── Project Model (基础)
              └── kmki-ui 组件库 (10 个组件)

Phase 1   ─── 短剧工作台 (Studio V2)
              ├── StudioWorkspaceLayout (独立于 Nuxt Layout)
              ├── WorkspaceRenderer (硬编码 if/else-if 分发)
              ├── 10 个 Pipeline 子工作台
              └── useStudioStore (短剧专属)

Phase 2   ─── 盘古斧 Execution OS
              ├── workbench.vue layout
              ├── 盘古斧 Nav + 系统状态
              └── WorkbenchStore

Phase 3   ─── Director OS Admin
              ├── admin-aigc.vue layout
              ├── Director OS Nav
              └── Admin 路由 /admin/aigc/*

Phase 4   ─── Brand GEO
              ├── GeoWorkspaceLayout (完全独立)
              ├── BrandGEOSidebar (渐进披露三级菜单)
              ├── 独立 Project 模型 (GeoProject)
              ├── 自有 Store + API 客户端
              └── brand-geo-v2 (kmki-ui 采用者)
```

### 9.2 架构问题热图

| 维度 | 🔴 高 | 🟡 中 | 🟢 低 |
|---|---|---|---|
| Layout | L1 (GEO 独立) | L2, L3 | L4 |
| Navigation | — | N1, N4 | N2, N3 |
| Project | P1, P2 | P3, P4 | — |
| Permission | — | A1, A2 | A3, A4 |
| kmki-ui | K1 | K2 | K3 |
| Workspace | — | W1, W2, W3 | W4 |
| Admin | — | M1 | M2, M3 |
| Components | — | C1, C2, C4 | C3 |

---

## 10. 推荐优先级清单 (Implementation Roadmap)

### P0 — 修复 (Critical, 影响开发效率)

| # | Issue | 操作 | 预估工时 |
|---|---|---|---|
| P0-1 | **废弃 /director-os 管理路由** | 清理 `/director-os/aigc/*` 镜像路由，统一到 `/admin/aigc/*` | 2d |
| P0-2 | **迁移 GEO 到平台 Layout** | 将 `GeoWorkspaceLayout` 适配为 Nuxt Layout 或注册到 `StudioWorkspaceLayout` | 3d |
| P0-3 | **统一 Project 模型** | 将 `GeoProject` 废弃，统一使用 `Project` + `GeoProjectProfile` | 5d |

### P1 — 统一 (Should Have, 架构健康度)

| # | Issue | 操作 | 预估工时 |
|---|---|---|---|
| P1-1 | **创建 Workspace Registry** | `packages/workspace-registry.ts`，取代 `WorkspaceRenderer` 的硬编码 if/else | 3d |
| P1-2 | **kmki-ui 推广** | 在所有 Workspace 中替换重复的状态/骨架组件使用 kmki-ui | 3d |
| P1-3 | **Navigation 注册表** | 统一 NavItems 定义到 `config/navigation.ts` | 2d |
| P1-4 | **简化套餐体系** | MemberPlan / AgentPlan → SubscriptionPlan 迁移 | 5d |

### P2 — 优化 (Nice to Have)

| # | Issue | 操作 | 预估工时 |
|---|---|---|---|
| P2-1 | **Admin 导航分组** | 增加二级菜单（系统管理/支付/营销/用户等分组） | 1d |
| P2-2 | **GEO v1 废弃** | 清理 `brand-geo/` v3 遗留代码，只保留 `brand-geo-v2` | 2d |
| P2-3 | **全局 kmki-ui Auto-import** | 配置 Nuxt 自动导入 kmki-ui 组件 | 1d |

---

## Appendix A: GEO 架构独立度评分

| 维度 | 独立程度 | 评估 |
|---|---|---|
| Layout | 🔴 完全独立 | 自有 `GeoWorkspaceLayout`，平台 5 个 layout 中无 GEO 适配 |
| Sidebar | 🟡 配置分离 | 使用 `config/sidebar.ts`，但独立于平台 navigation 体系 |
| Project Model | 🔴 完全独立 | 自有 `GeoProject` 模型，未关联 `Project` + `GeoProjectProfile` |
| Store/State | 🟡 部分独立 | 自有 `useBrandGeoStore`，但使用平台 `useAuthStore` |
| Auth | 🟢 平台复用 | 使用平台 `definePageMeta({middleware: 'auth'})` |
| UI 组件 | 🟡 部分复用 | v1 使用自有组件库，v2 已开始采用 `kmki-ui` |
| API | 🔴 完全独立 | 自有 API 客户端 (`clients/`)，独立于平台 API 调用 |

**GEO 独立度评分：5/7 项独立 → 架构隔离度 71%**

---

*Report generated by KMKI Architecture Audit Pipeline v1.0*
*Next audit recommended: 2026-05-08 (30-day follow-up)*
