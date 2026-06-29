# KMKI-GEO-INTEGRATION-AUDIT-001

**日期：** 2026-07-18
**范围：** Platform Integration Audit — GEO Workspace 是否是昆仑镜平台的一部分
**命今来源：** 熊大

---

## 总体融合评分

| 项目 | 评分 | 等级 |
|------|------|------|
| 首页与导航融合 | **30/100** | ⛔ FAIL |
| Layout 融合 | **WARNING** | ⚠️ 部分融合 |
| 会员体系融合 | **FAIL** | ❌ |
| VIP 权限融合 | **FAIL** | ❌ |
| SaaS 多租户融合 | **FAIL** | ❌ |
| Project Center 融合 | **FAIL** | ❌ |
| 统一认证 | **WARNING** | ⚠️ 部分融合 |
| 资产中心融合 | **FAIL** | ❌ |
| Execution 融合 | **WARNING** | ⚠️ 半融合 |
| Capability 融合 | **WARNING** | ⚠️ 半融合 |
| SDK引用 | **FAIL** | ❌ |
| Platform UI引用 | **FAIL** | ❌ |

**总体判断：不允许进入 GEO Workspace 正式开发。**
**当前融合等级：独立产品（非平台组件）**

---

## 第一部分：首页与导航融合 — 30/100 ⛔

### ✅ 正确部分
1. `pages/workspace/geo.vue` 是唯一的 GEO 入口路由，无重复入口
2. 导航栏已精简为 6 项（7/17 Navigation Freeze）
3. sidebar.ts 只保留已交付面板

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **首页导航未统一注册**：`pages/workspace/geo.vue` 是独立路由，未通过首页注册；`KunlunNav.vue` 的导航配置中不包含 GEO 入口 | P0 |
| 2 | **存在第二套 GEO 页面**：`frontend/modules/geo/` 下仍有完整的独立 GEO 页面（GEOProjectList.vue / GEOProjectWorkspace.vue / FlowPipeline.vue / TopicResearchPanel.vue / EntityDiscoveryPanel.vue / KnowledgeGraphViewer.vue / ProvenanceTimeline.vue），共 7 个文件 | P0 |
| 3 | **存在旧 modules/geo 路由**：`modules/geo/pages/GEOProjectList.vue` 和 `GEOProjectWorkspace.vue` 仍是完整页面，可能通过未知路由可访问 | P0 |
| 4 | **无首页加速入口**：首页的快捷面板（统计数据卡片、最近项目）中没有任何指向 GEO 工作台的入口 | P1 |

### 复现
```bash
# 检查 modules/geo 是否被路由引用
grep -rn "modules/geo" frontend/pages/ --include="*.vue" --include="*.ts"
# 检查首页导航
cat frontend/components/kunlun/business/KunlunNav.vue | grep -i geo
```

---

## 第二部分：Layout 融合 — WARNING ⚠️

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **未使用昆仑镜 Header**：BrandGEOWorkspace 使用自己的 `<header class="geo-topbar">`，而非 `platform/ui/workspace/WorkspaceHeader.ts` | P0 |
| 2 | **未使用昆仑镜 Sidebar**：使用自己的 `BrandGEOSidebar.vue`，而非 `platform/ui/workspace/WorkspaceSidebar.ts` | P0 |
| 3 | **未使用 Platform UI Shell**：`BrandGEOWorkspace.vue` 从零搭建 layout (`display:flex; height:100vh`)，未使用 `WorkspaceShell.ts` | P0 |
| 4 | **无 Breadcrumb**：无面包屑导航，不支持跨 Workspace 浏览路径 | P1 |
| 5 | **无 Theme 引用**：硬编码 `#0b0f14` `#e2e8f0` 等颜色值，未使用 ThemeProvider | P1 |

### 复现
```bash
# 确认没有引用 Platform UI
grep -rn "WorkspaceShell\|WorkspaceHeader\|WorkspaceSidebar" frontend/studio-v2/workspace/brand-geo/
# 空的
```

---

## 第三部分：会员体系融合 — FAIL ❌

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **未读取会员等级**：前端 `frontend/constants/membership.ts` 定义了会员系统（free/gold/pro/director），但 GEO 中任何代码均未引用 | P0 |
| 2 | **未调用 useMembership()**：GEO 前端未导入或使用 `useMembership()` | P0 |
| 3 | **所有用户无差别**：免费用户和付费用户在 GEO 中能力完全相同，没有任何限制 | P0 |
| 4 | **无升级提示**：GEO 没有任何"升级会员享更多功能"的 UI | P1 |

### 复现
```bash
grep -rn "membership\|MEMBER_LEVEL\|useMembership\|会员" frontend/studio-v2/workspace/brand-geo/
# 空的
```

---

## 第四部分：VIP 权限融合 — FAIL ❌

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **无任何权限检查**：GEO 功能（Research / Knowledge / Optimization / Export / API / Automation）没有按会员等级做权限划分 | P0 |
| 2 | **无 Permission Check**：前端没有 `v-if="canAccess('geo.research')"` 这类逻辑 | P0 |
| 3 | **后端无权限校验**：GEO 后端路由不包含 `authenticate` 中间件调用 | P0 |

### 复现
```bash
# 后端路由确认没有 auth
grep -rn "authenticate" backend/src/services/geo/routes/
# 空的
```

---

## 第五部分：SaaS 多租户融合 — FAIL ❌

### ❌ 问题（严重度：P0 — 最重要）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **GEOProject 使用 `userId` 而非 `tenantId`**：与平台 `Tenant` 模型（`governance_tenant`）无关联 | P0 |
| 2 | **所有子表无 tenantId**：GEOEntity / GEOEntityRelation / GEOProjectVersion / GEOClaim / GEOEvidence / GEOCitation / GEOFAQ / GEOSchemaMarkup / GEOReviewQueue / GEOQualityScore / GEOFreshnessRecord — 全部没有 `userId` 或 `tenantId` | P0 |
| 3 | **平台 Tenant 模型存在但 GEO 不使用**：`model Tenant` 在 `governance_tenant` 表中已定义，但 GEO 完全不引用 | P0 |
| 4 | **跨租户数据隔离风险**：GEOEntity / GEOClaim 等表只通过 `projectId` 关联，没有租户隔离层 | P1 |

### 范围
```
GEO 11 张表：10/11 没有 userId，11/11 没有 tenantId
只有 GEOProject 有 userId（但那是 userId，不是 tenantId）
```

---

## 第六部分：Project Center 融合 — FAIL ❌

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **存在独立的 `GEOProject` 类型和表**：Prisma 中的 `GEOProject`（`kmki_geo_projects`）与平台 `Project` 完全无关 | P0 |
| 2 | **前端存在三个 Project 类型**：`frontend/stores/project.ts` 的 `Project`、`frontend/studio-v2/types/geo/brand.ts` 的 `GeoProject`、`frontend/modules/geo/types/index.ts` 的 `GEOProject` | P0 |
| 3 | **无统一 Project Center**：没有基于平台 `Project` 表构建的统一项目中心 | P0 |

---

## 第七部分：统一认证 — WARNING ⚠️

### ✅ 正确部分
1. `frontend/middleware/auth.ts` 存在并保护 `/workspace/geo` 路由（通过 `defineNuxtRouteMiddleware`）
2. 后端 `backend/src/plugins/auth.ts` 已在平台注册 `authenticate` 装饰器

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **后端 GEO 路由未使用 `authenticate`**：4 个 GEO 路由文件（geo-project / geo-entity / geo-graph / geo-knowledge-quality）没有任何一个调用了 `authenticate` | P0 |
| 2 | **GEO 路由的 user 来源不统一**：`geo-project.route.ts` 中 `(request as any).user || { id: body.userId || 'anonymous' }` — 允许绕过认证 | P0 |
| 3 | **`pages/workspace/geo.vue` 无 `definePageMeta` 配置**：未显式声明 middleware，依赖全局 Nuxt middleware 可能不够 | P1 |

---

## 第八部分：资产中心融合 — FAIL ❌

### ❌ 问题（严重度：P1）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **GEO 数据未进入平台 Asset 模型**：GEOClaim / GEOEvidence / GEOCitation / GEOFAQ / GEOSchemaMarkup 全部写入 `kmki_geo_*` 表，未写入平台 `Asset` 表 | P1 |
| 2 | **GEO 使用自建存储逻辑**：代码中无任何 `AssetService` / `AssetRepository` 调用 | P1 |
| 3 | **无 Resource Platform 接入**：GEO 的数据不经过 Resource Identity (RID) 或 Resource Graph | P2 |

---

## 第九部分：Execution 融合 — WARNING ⚠️

### ✅ 正确部分
1. 后端 `geo-workflow.ts` 的 `WorkflowContext` 中 `capabilities` 字段与 `AgentContext` 的设计参考了 Execution Kernel 模式
2. `ctx.capabilities.llm.generate()` 抽象良好，agent 代码不直接调用 LLM provider

### ❌ 问题（严重度：P1）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **Research/Entity/KG Agent 是 Stub**：`research.agent.ts` / `entity.agent.ts` / `knowledge-graph.agent.ts` 使用 `generateStub*()` 函数生成模拟数据，未经过任何 AI 或 Execution Kernel | P0 |
| 2 | **GEO Workflow 自建编排**：`geo-workflow.ts` 有 `WorkflowRuntime.execute()` 自建执行循环，未调用 `ExecutionEngine` | P1 |
| 3 | **`ExecutionEngine`（SDK）已存在但未被 GEO 使用**：`packages/studio-platform/src/execution/execution-engine.ts` 已冻结，GEO 绕过 | P1 |
| 4 | **没有 `ExecutionId` 的传递**：GEO 有自己的 `executionId` 字段，但与平台 Execution 体系无关 | P2 |

---

## 第十部分：Capability 融合 — WARNING ⚠️

### ✅ 正确部分
1. KQ Agents（Claim/Evidence/Citation/FAQ/Schema）使用 `ctx.capabilities.llm.generate()` 而非直接调用 OpenAI
2. `AgentContext` 中的 `capabilities` 接口清晰

### ❌ 问题（严重度：P1）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **GEO 的 capabilities 是本地构造的**：`geo-workflow.ts` 构造 `capabilities.llm.generate` 是闭包函数，非通过 `CapabilityOrchestrator` | P1 |
| 2 | **未注册到 Capability Registry**：GEO Agent 未在 `CapabilityRegistry` 中注册 | P1 |
| 3 | **无 Policy 路由**：没有通过 `PolicyEngine` 做模型选择/Provider 路由 | P1 |
| 4 | **`CapabilityOrchestrator` / `CapabilityRuntime` 已存在（C2.0.5完成）但未被 GEO 使用** | P1 |

---

## 第十一部分：SDK 引用 — FAIL ❌

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **`@studio/platform` SDK 未在 GEO 中引用**：GEO 前端和后端均无 `import from '@studio/platform'` | P0 |
| 2 | 所有 `CapabilityOrchestrator` / `ExecutionEngine` / `WorkspaceShell` / `WorkspaceSidebar` 等平台组件均未被 GEO 导入 | P0 |

---

## 第十二部分：Platform UI 引用 — FAIL ❌

### ❌ 问题（严重度：P0）

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | **GEO 完全未使用 Platform UI 组件**：`platform/ui/workspace/WorkspaceShell.ts / WorkspaceHeader.ts / WorkspaceSidebar.ts / WorkspaceMain.ts / WorkspaceInspector.ts / WorkspaceCopilot.ts` 全部存在但 GEO 不使用 | P0 |
| 2 | G EO 自行构建全部 UI（从 `display:flex` 开始） | P0 |

---

## 总结：修复优先级

### P0 — 必须在进入 GEO 正式开发前修复

| # | 项目 | 修复难度 | 预估工作量 |
|---|------|----------|-----------|
| 1 | **多租户**：GEOProject 加 `tenantId`，子表加 `userId` 或 `tenantId` | ⭐⭐⭐ | 2-3天 |
| 2 | **Platform UI**：替换 GEO Layout 为 `WorkspaceShell`/`WorkspaceSidebar`/`WorkspaceHeader` | ⭐⭐ | 1天 |
| 3 | **认证**：后端 GEO 路由加 `authenticate` 中间件 | ⭐ | 0.5天 |
| 4 | **SDK**：GEO 引用 `@studio/platform` | ⭐ | 0.5天 |
| 5 | **Project Center**：统一 Project 模型 | ⭐⭐⭐⭐ | 3-5天 |
| 6 | **会员/VIP**：接入 Membership 和 Permission Check | ⭐⭐ | 1-2天 |
| 7 | **首页导航**：GEO 入口注册到首页导航 | ⭐ | 0.5天 |
| 8 | **清理 modules/geo**：删除旧 GEO 页面 | ⭐ | 0.5天 |

### P1 — 建议在 v4.2 阶段修复

| # | 项目 | 修复难度 | 预估工作量 |
|---|------|----------|-----------|
| 1 | **Execution 融合**：GEO Workflow 迁移到 `ExecutionEngine` | ⭐⭐⭐ | 2-3天 |
| 2 | **Capability 融合**：GEO Agent 注册到 `CapabilityRegistry` | ⭐⭐ | 1-2天 |
| 3 | **资产中心**：GEO 数据写入平台 Asset 表 | ⭐⭐⭐ | 2天 |
| 4 | **首页加速入口**：Dashboard 快捷卡片指向 GEO | ⭐ | 0.5天 |

### P2 — 后续优化

| # | 项目 | 说明 |
|---|------|------|
| 1 | Resource Platform 接入 | 等 RID 完成后再做 |
| 2 | Research/Entity/KG Agent 非 Stub | 需要 AI 能力集成 |
| 3 | Breadcrumb | 跨 Workspace 导航 |

---

## 🎯 修复顺序（熊大批准版）

### 核心原则：数据根优先
- Tenant 和 Project 是整个系统的数据根，必须先统一
- 不修地基就往上盖墙，后面通通返工
- Membership/Permission 做成 Feature Gate 体系，不要写死 `if (vip)`

### Phase 0 — 阻断项修复（立即执行，1天）

**这是在 Phase 1 之前必须完成的"允许继续开发的前提条件"：**

| # | 任务 | 原因 |
|---|------|------|
| 0.1 | **首页融合**：GEO 的唯一入口注册到首页导航 | 确保用户从首页能进 GEO |
| 0.2 | **Auth**：`pages/workspace/geo.vue` 加 `definePageMeta` middleware，后端 4 个 GEO 路由加 `authenticate` | 当前后端路由可直接调用，无任何认证 |
| 0.3 | **Legacy 清理**：删除 `modules/geo/` 旧页面、旧路由、孤立入口 | 保持唯一 GEO |
| 0.4 | **暂停 GEO 数据模型扩展**：在 Phase 1 完成前，不新增 GEO 表/字段 | 迁移成本控制 |

### Phase 1 — 平台融合（3天）⛔ 阻塞

**这一阶段不做 UI。先做数据根的统一：**

| # | 任务 | 说明 |
|---|------|------|
| 1.1 | **Tenant 统一**：`GEOProject` 加 `tenantId`，所有子表（GEOEntity / GEOEntityRelation / GEOProjectVersion / GEOClaim / GEOEvidence / GEOCitation / GEOFAQ / GEOSchemaMarkup / GEOReviewQueue / GEOQualityScore / GEOFreshnessRecord）加 `userId` 或 `tenantId` | 11 张表，平台 `Tenant` 模型已存在 |
| 1.2 | **Project Center 统一**：不要 `GeoProject` 作为长期实体。改为 `Project` + `type=geo`。如果确实有 GEO 特有字段，建立 `GeoProjectProfile` 而非第二套 Project | 前端 3 套 Project 类型合并为 1 套 |

> **Phase 1 完成前，不扩展 GEO 业务页面和数据库模型。**

### Phase 2 — 平台能力接入（3天）

| # | 任务 | 说明 |
|---|------|------|
| 2.1 | **Membership/VIP**：Feature Gate 体系（`geo.research` / `geo.knowledge` / `geo.optimization` / `geo.export` / `geo.monitor`），统一 `PermissionService` + `FeatureGate`，不写 `if (vip)` | 短剧/小说/PPT 全部复用 |
| 2.2 | **SDK**：GEO 引用 `@studio/platform`，不再自写 utils/api/permission | 平台 SDK 已存在 |
| 2.3 | **Platform UI**：GEO Layout 替换为 `WorkspaceShell`/`WorkspaceSidebar`/`WorkspaceHeader` | Tenant+Project 统一后 UI 才稳定 |

### Phase 3 — Runtime 深度融合（后续演进）

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | **Execution 融合**：GEO Workflow 迁移到 `ExecutionEngine` | SDK 已冻结 |
| 3.2 | **Capability 融合**：GEO Agent 注册到 `CapabilityRegistry`，走 Policy 路由 | SDK 已冻结 |
| 3.3 | **资产中心**：GEO 输出（Claim/Evidence/Citation）写入平台 Asset 表 | 等 Resource Platform 就绪 |
| 3.4 | **Agent Runtime**：Research/Entity/KG Agent 从 Stub 转为真实 AI 调用 | 依赖 Phase 3.1 + 3.2 |

### 依赖关系图

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3
（入口+认证） （数据根） （能力+UI） （Runtime）
     ↓            ↓            ↓
  阻断一切    阻断页面     高优先级     后续演进
  开发        扩展
```
