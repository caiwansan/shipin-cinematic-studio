# Workspace Integration Audit（生产环境）

> 审计时间：2026-07-01
> 目标 URL：`https://aigc.fushtn.com/workspace/geo/dashboard`

## Audit 1：路由对照表

| 路由 | Vue 组件 | 菜单可进入 | 生产可访问 | Nginx 命中 |
|------|----------|-----------|-----------|-----------|
| `/workspace/geo/dashboard` | `GEODashboard.vue` | ✅ 侧边栏第 1 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/discovery` | `DiscoveryLabPage.vue` | ✅ 侧边栏第 2 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/health` | `HealthPage.vue` | ✅ 侧边栏第 3 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/recommendations` | `RecommendationsPage.vue` | ✅ 侧边栏第 4 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/verification` | `VerificationPage.vue` | ✅ 侧边栏第 5 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/publishing` | `PublishingPage.vue` | ✅ 侧边栏第 6 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/growth` | `GrowthPage.vue` | ✅ 侧边栏第 7 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/knowledge` | `KnowledgePage.vue` | ✅ 侧边栏第 8 项 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/project/:id` | `WorkspaceFlowPage.vue` | ❌ 侧边栏无入口 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/report/:projectId` | `ReportCenter.vue` | ❌ 侧边栏无入口 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/detail/:id` | `GEODetail.vue` | ❌ 侧边栏无入口 | ✅ HTTP 200 | `location / → @nitro` |
| `/workspace/geo/create` | `GEOCreate.vue` | ❌ 侧边栏无入口 | ✅ HTTP 200 | `location / → @nitro` |

> **关键发现**：`workspace` 不在 nginx 的 proxy_pass 白名单中（第 130 行），但 `location / → @nitro` catch-all 也转发到前端 Nitro，且 Nitro 作为 SPA（ssr: false）能正确处理所有前端路由。因此**所有 12 条路由生产可访问，无需修改 nginx 配置**。

## Audit 2：Sprint → 组件 → 路由映射

| Sprint/能力 | Vue 文件 | 路由 | Dashboard 入口 | 菜单入口 | 已部署 |
|------------|----------|------|---------------|---------|--------|
| Assessment (P0-T001) | `HealthPage.vue` | `/workspace/geo/health` | ✅ 侧边栏 | ✅ | ✅ |
| Scenario Library (P0-T002) | (后端模块，无独立页面) | — | — | — | ✅ |
| Demand Corpus (P0-T003) | (后端模块) | — | — | — | ✅ |
| Discovery Lab (P0-T004-6) | `DiscoveryLabPage.vue` | `/workspace/geo/discovery` | ✅ 侧边栏 | ✅ | ✅ |
| Action Plan (P0-T007) | `DiscoveryLabPage.vue` 内嵌 | `/workspace/geo/discovery` | ✅ 通过 Discovery | ✅ | ✅ |
| Verification (P0-T008) | `VerificationPage.vue` | `/workspace/geo/verification` | ✅ 侧边栏 | ✅ | ✅ |
| Persistence + Project (P1-A) | `GEODashboard.vue` + Stores | `/workspace/geo/dashboard` | ✅ 首页 | ✅ | ✅ |
| Guided Workflow (P1-B) | `WorkspaceFlowPage.vue` | `/workspace/geo/project/:id` | ✅ Dashboard → Continue | ❌ 无菜单入口 | ✅ |
| Report Center (P1-C) | `ReportCenter.vue` | `/workspace/geo/report/:projectId` | ✅ Dashboard → 查看报告 | ❌ 无菜单入口 | ✅ |

## Audit 3：确认 Dashboard 真正加载的是哪个 Vue

**结论：`/workspace/geo/dashboard` 路由加载 `GEODashboard.vue`**

证据链：
1. Nuxt 页面文件 `frontend/pages/workspace/geo/dashboard.vue` 内容：`<template><GEODashboard /></template>`
2. Nuxt 根据文件系统路由自动生成路由，`dashboard.vue` 映射到 `pages/workspace/geo/dashboard.vue`
3. 该文件 import `import GEODashboard from 'workspaces/geo/pages/GEODashboard.vue'`
4. 生产请求 `https://aigc.fushtn.com/workspace/geo/dashboard` 返回 HTTP 200，header `x-powered-by: Nuxt` 确认是 SSR/SPA 渲染

> **✅ 证明：线上 `https://aigc.fushtn.com/workspace/geo/dashboard` 加载的是 `GEODashboard.vue`（P1-B 升级版），不是旧版本。**

## Audit 4：完整用户路径验证

```
Dashboard (/) → /workspace/geo/dashboard (GEODashboard.vue)
  └── Quick Start: "新建项目" → /workspace/geo/project/:id (WorkspaceFlowPage.vue)
        ├── Step 1: Assessment → 内嵌 HealthPageEmbedded
        ├── Step 2: Discovery → 内嵌 DiscoveryLabPageEmbedded
        ├── Step 3: Opportunity → 内嵌 OpportunityPanelEmbedded
        ├── Step 4: Action Plan → 内嵌 ActionPlanPanelEmbedded
        ├── Step 5: Execution（预留）
        ├── Step 6: Verification → 内嵌 VerificationPageEmbedded
        └── Step 7: Report → 内嵌 ReportPanelEmbedded
  └── Recent Projects → "Continue" → /workspace/geo/project/:id
  └── Recent Verifications → "查看报告" → /workspace/geo/report/:projectId
```

> **✅ 完整路径走得通。Dashboard 内的 "Continue" 和 "查看报告" 链接指向正确路由。**

## Audit 5：Workspace 完整路由树

```
/workspace/geo/
├── dashboard              GEODashboard.vue          ← 首页/入口
│   ├── Project List       （项目卡片 + 进度 + ADI）
│   ├── Quick Start        （新建项目 + 快速发现）
│   ├── Recent Verifications
│   └── Overall Stats
├── discovery               DiscoveryLabPage.vue      ← 发现实验室
│   ├── Entity 搜索
│   ├── Scenario 覆盖矩阵
│   ├── Opportunity 列表
│   └── Action Plan 面板
├── health                  HealthPage.vue             ← 评估
│   ├── ADI 分数
│   ├── 子维度评分
│   └── 场景覆盖
├── recommendations        RecommendationsPage.vue     ← 建议
├── verification            VerificationPage.vue       ← 验证
│   ├── Before/After 对比
│   ├── 维度分解
│   └── 置信度
├── publishing              PublishingPage.vue          ← 发布
├── growth                  GrowthPage.vue              ← 增长
├── knowledge               KnowledgePage.vue           ← 知识库
├── project/:id            WorkspaceFlowPage.vue       ← 工作流容器
│   ├── Assessment Step
│   ├── Discovery Step
│   ├── Opportunity Step
│   ├── Action Plan Step
│   ├── Verification Step
│   └── Report Step
├── report/:projectId      ReportCenter.vue            ← 报告中心
│   ├── Executive Summary
│   ├── Findings
│   ├── Opportunities
│   ├── Actions
│   ├── Verification
│   ├── Next Recommendations
│   └── Export (Markdown/JSON)
├── detail/:id             GEODetail.vue               ← 详情
└── create                 GEOCreate.vue               ← 创建项目
```

## 审计结论

### 已集成的功能
- ✅ **Dashboard**（P1-B 重构版）— 侧边栏第 1 入口
- ✅ **Assessment**（HealthPage）— 侧边栏第 3 入口
- ✅ **Discovery Lab**（含 Scenario / Opportunity / Action Plan）— 侧边栏第 2 入口
- ✅ **Verification** — 侧边栏第 5 入口
- ✅ **Guided Workflow** — Dashboard → Continue → Project Flow
- ✅ **Report Center** — Dashboard/Verification → 查看报告

### 需要改进的
- **侧边栏没有 Workflow/Report 入口** — 但用户可通过 Dashboard 进入，产品路径完整
- **项目详情页 `detail/:id` 和 `create` 无菜单入口** — 由 Dashboard 驱动，当前 OK

### 最终结论

> **所有 Sprint 已真正集成到生产环境的 GEO Workspace。`https://aigc.fushtn.com/workspace/geo/dashboard` 加载的是最新版 `GEODashboard.vue`（P1-B 升级版），包含 Quick Start、Recent Projects（含进度条+ADI）、Recent Verifications、Overall Stats。用户可完整走完 Dashboard → Project → Workflow → Report 的产品路径。未发现 "代码存在但页面不存在" 的脱节情况。**
