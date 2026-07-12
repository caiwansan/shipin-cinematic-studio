# GEO Dashboard 全链条深度审计报告

**审计日期**: 2026-07-27
**审计目标**: 追踪一次用户访问 `/workspace/geo/dashboard` 的完整数据流，定位每一层的断裂点
**审计范围**: Frontend Page → Service → Backend Route → Business Logic → Data Store → Database Schema
**分析方法**: 代码阅读 + 关键文件对比 + 类型系统分析 + 架构层依赖追溯

---

## 目录

1. [TL;DR — 审计结论](#1-tldr--审计结论)
2. [数据流全景图](#2-数据流全景图)
3. [第1层：路由渲染（Page → Component）](#3-第1层路由渲染page--component)
4. [第2层：数据获取（Component → Service API）](#4-第2层数据获取component--service-api)
5. [第3层：后端 API（Route → Controller）](#5-第3层后端-apiroute--controller)
6. [第4层：业务逻辑（Controller → Domain Service）](#6-第4层业务逻辑controller--domain-service)
7. [第5层：持久化层（Service → Repository / Store）](#7-第5层持久化层service--repository--store)
8. [第6层：数据库 Schema](#8-第6层数据库-schema)
9. [全链条断裂点总表](#9-全链条断裂点总表)
10. [风险分级与修复建议](#10-风险分级与修复建议)

---

## 1. TL;DR — 审计结论

### 综合评价：⚠️ 3/10（严重警告）

Dashboard 的 "全链条" 实际上只有 **前两层半是真实的**，后端数据层存在系统性断裂。

### 三个致命问题

| # | 问题 | 严重度 | 影响 |
|---|------|--------|------|
| **F1** | **后端 MissionControlResponse ≠ 前端 MissionControlData** | 🔴 P0 | `getMissionControl()` 后端没有 `recentActivity` 和 `actionableItems` 字段，前端 `control.value.recentActivity` 永远为 `undefined` |
| **F2** | **所有 Queue/Store 都是 in-memory 且无数据注入** | 🔴 P0 | `observatoryStore.getLatest()` 永远返回 `null`，`missionQueue.size()` 永远返回 `0`，仪表盘永久显示空数据 |
| **F3** | **.page-shell.vue 与 GEODashboard-full.vue 双版本并存** | 🟡 P2 | `dashboard.vue` 引用 `GEODashboardFull`（旧版），`.page-shell.vue` 是新版 Pattern 但未上线。用户看到的是旧版本。 |

### 数据真实性矩阵

| 数据项 | 是否连接真实后端 | 后端是否有真实数据源 | 用户看到的 |
|--------|------------------|---------------------|-----------|
| 品牌列表 | ✅ 是 | ✅ PostgreSQL | ✅ 真实数据 |
| AI 可见度 | ⚠️ 接口调通 | ❌ 永远返回 0 | ❌ 永远显示 0 |
| 引擎状态 | ⚠️ 接口调通 | ❌ 全部返回 idle | ❌ 全部显示"待机" |
| 今日任务 | ⚠️ 接口调通 | ❌ 永远返回空数组 | ❌ 永远显示"暂无待办任务" |
| 活动动态 | ❌ 前端字段不存在后端返回中 | ❌ 永远 undefined | ❌ 永远不可见 |
| 队列计数 | ⚠️ 接口调通 | ❌ 永远返回 0 | ❌ 全部显示 0 |

---

## 2. 数据流全景图

```
用户点击 /workspace/geo/dashboard
         │
         ▼
┌────────────────────────────────────────────┐
│  ��� 第1层: 路由                              │
│  pages/workspace/geo/dashboard.vue          │
│  → 引用 GEODashboardFull                    │
│  (⚠️ page-shell 版本未使用)                  │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  🟡 第2层: 组件                              │
│  GEODashboard-full.vue / .page-shell.vue    │
│  → 调用 missionControlService.ts            │
│  → 调用 projectStore.listProjects()          │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  🟡 第3层: API Service                       │
│  geoApi.get('/api/geo/workspace/mission-\   │
│              control')                      │
│  → 包装 return { data }                     │
└────────────────┬───────────────────────────┘
                 │  HTTP GET
                 ▼
┌────────────────────────────────────────────┐
│  🟡 第4层: Backend Route                     │
│  workspace.route.ts → GET /api/geo/workspace│
│  /mission-control                           │
│  → 调用 getMissionControl()                  │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  🔴 第5层: Business Logic                   │
│  mission-control.ts:                        │
│  → observatoryStore.getLatest()  // null    │
│  → missionQueue.size()            // 0     │
│  → timelineEngine.getProjectTimeline('',10) │
│    → timelineEngine 的 getProjectTimeline   │
│      需要 projectId，但 mission-control.ts  │
│      传的是空字符串 ''                       │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  🔴 第6层: Data Store                        │
│  ObservatoryStore (in-memory Map)           │
│  MissionQueue (in-memory array)             │
│  VerificationQueue (in-memory array)        │
│  LearningStore (in-memory array)            │
│  TimelineEngine → 从 DB 查表但表数据为空     │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  ⚠️ 第7层: Database                         │
│  Prisma 模型齐全但缺乏初始化和关联逻辑        │
│  - GEOProject / GeoProject 双模型并存        │
│  - 没有自动触发 Discovery 的机制              │
│  - 没有 Scheduled Job 来填充数据             │
└───────────────────────────────────────────┘
```

---

## 3. 第1层：路由渲染（Page → Component）

### 文件: `pages/workspace/geo/dashboard.vue` (15 行)

```vue
<template>
  <GeoWorkspaceLayout>
    <GEODashboardFull />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GEODashboardFull from 'workspaces/geo/pages/GEODashboard-full.vue'
</script>
```

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D1-1 | **引用旧版组件** — 使用 `GEODashboardFull` 而不是 `.page-shell` 版本 | P2 |
| D1-2 | **双版本并行** — 存在 `GEODashboard-full.vue (285行)` 和 `GEODashboard.page-shell.vue (317行)`，内容大同小异但渲染路径不同 | P2 |
| D1-3 | **.bak 文件残留** — `GEODashboard.page-shell.vue.bak` 和 `HealthPage.page-shell.vue.bak` 和 `KnowledgePage.page-shell.vue.bak` 未清理 | P3 |
| D1-4 | **dashboard.vue 没有 SSOT** — 两套实现中哪一套是"当前版本"没有文档说明 | P2 |

### 建议
- 删除 `GEODashboard-full.vue`，统一到 `GEODashboard.page-shell.vue`
- 清理所有 `.bak` 文件
- `dashboard.vue` 改为引用 page-shell 版本

---

## 4. 第2层：数据获取（Component → Service API）

### 4.1 GEODashboard-full.vue（用户实际看到的版本）

**数据源**: `getMissionControl()` + `projectStore.listProjects()`

```typescript
// 285行，内联样式，无 Design System 引用
control.value = await getMissionControl()  // 类型: MissionControlData
```

#### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D2-1 | **大量内联样式** — 285 行中约 200 行是 scoped style，全部手写 CSS | P2 |
| D2-2 | **未使用 Design System** — 没有引用任何 `DSButton`/`DSCard`/`DSBadge`/`DSTabs` | P2 |
| D2-3 | **无 loading state 细节** — 只有 `onMounted` 加载，没有显示骨架屏 | P2 |
| D2-4 | **error 被静默吞掉** — `.catch { /* use defaults */ }`，用户永远不会看到错误 | P1 |
| D2-5 | **metric 不可交互** — AI 可见度/待执行/待验证只是数字，无法点击进入详情 | P3 |
| D2-6 | **缺少 "下一步建议" 区块** — 与 `.page-shell` 版本对比，缺少 Next Action block | P2 |

### 4.2 GEODashboard.page-shell.vue（已迁移但未上线版本）

**数据源**: 同 `getMissionControl()`，但使用了 `PageShell` 抽象

#### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D2-7 | **PageShell 有样式冲突** — `foundation-page-shell` 有三个并行的 `<style scoped>` 块（分别定义 max-width:960px, max-width:1200px, padding），最后一个会覆盖前面的 | P1 |
| D2-8 | **PageShell 的 next slot 位置交互不当** — 使用 `position: sticky` + `z-index: 10`，在大屏设备上可能遮挡内容 | P3 |

---

## 5. 第3层：API Service

### 文件: `frontend/workspaces/geo/services/missionControlService.ts`

```typescript
export interface MissionControlData {
  // ... 基础字段
  recentActivity: TimelineEvent[]    // 🔴 后端返回中没有
  actionableItems: TimelineEvent[]   // 🔴 后端返回中没有
}

export async function getMissionControl(projectId?: string): Promise<MissionControlData> {
  const params = projectId ? `?projectId=${projectId}` : ''
  const res = await geoApi.get(`/api/geo/workspace/mission-control${params}`)
  return res.data  // ⚠️ 返回的是后端 MissionControlResponse，缺少两个字段
}
```

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D3-1 | **🔴 类型不匹配** — 前端 `MissionControlData` 有 `recentActivity` 和 `actionableItems`，后端 `MissionControlResponse` 没有 | **P0** |
| D3-2 | **运行时不报错** — TypeScript 编译通过是因为 `res.data` 被断言为 `any` → `MissionControlData` | P1 |
| D3-3 | **结果** — `control.value.recentActivity` 永远为 `undefined`，模板 `v-for="a in activityEvents"` 不会渲染任何东西 | P0 |
| D3-4 | **结果** — 前端第 75 行 `activities.value` 也是 `undefined`，`activities.length` 不会报错但也不会渲染 | P0 |
| D3-5 | **geoApi 的 `get()` 会包装 `{ data }`** — 但 `missionControlService` 又返回 `res.data`，因此实际返回的是后端原始 `data` 字段。这条链是对的，但很脆弱。 | P2 |

### 同步问题：backend 也缺少 `recentActivity` 和 `actionableItems`

看 backend 的 `getMissionControl()` 函数末尾：

```typescript
return {
  // ...
  // 没有 recentActivity 字段！！！
  // 没有 actionableItems 字段！！！
}
```

只有最后注释掉了的：
```typescript
  // recentActivity: await timelineEngine.getProjectTimeline('', 10),
  // actionableItems: [], // 后续版本：从 timeline 中筛选 action_required 级别的事件
```

这些代码已被注释或移除。

---

## 6. 第4层：后端 Route

### 文件: `workspace.route.ts`

```typescript
app.get('/api/geo/workspace/mission-control', { preHandler: [] }, async (req, reply) => {
  const { projectId } = req.query as { projectId?: string }
  const control = await getMissionControl(projectId)
  return { success: true, data: control }
})
```

### 文件: `timeline.route.ts`

```typescript
app.get('/api/geo/timeline', async (req, reply) => {
  const { projectId, limit } = req.query  // projectId 是必须的
  // 如果没有 projectId → 400
})
```

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D4-1 | **mission-control 路由没有 preHandler 认证** — `preHandler: []` 空数组，生产环境前端通过 header 带 token，但所有人都能访问 | P2 |
| D4-2 | **timeline 路由没有 authentication hook** — 没有 `preHandler` 定义 | P2 |
| D4-3 | **mission-control 没有包装错误** — `getMissionControl()` 失败会直接抛 500，没有 try/catch | P2 |
| D4-4 | **前端没有调用 timeline API** — `missionControlService.ts` 中有 `getTimeline()`、`getTimelineByProject()` 和 `getActionableItems()` 函数，但 Dashboard 页面没有使用它们 | P1 |
| D4-5 | **路由注册顺序 + try/catch 混合** — 在 `index.ts` 中，workspace.route 用 try/catch 包裹，其他 route 不用，说明 workspace.route 不稳定 | P2 |

---

## 7. 第5层：业务逻辑

### 文件: `mission-control.ts`

```typescript
export async function getMissionControl(projectId?: string): Promise<MissionControlResponse> {
  const latest = observatoryStore.getLatest()
  // ...
}
```

### 7.1 引擎状态推断完全依赖 in-memory 数据

```typescript
const discoveries = projectId ? observatoryStore.getByProject(projectId, 5) : [latest].filter(Boolean)
const latestDiscovery = discoveries[0]
const aiVisibility = latestDiscovery ? Math.round(latestDiscovery.stats.avgConfidence * 100) : 0
```

`observatoryStore` 是一个 in-memory Map，**服务重启后全部丢失**。除非 Discovery Engine 已执行过并将结果写入了 store，否则永远不会产生数据。

### 7.2 引擎状态推断逻辑存在漏洞

```typescript
engines: [
  {
    name: 'discovery',
    status: latestDiscovery ? 'completed' : 'idle',
  },
  {
    name: 'knowledge',
    status: latestDiscovery?.stats.totalSignals && latestDiscovery.stats.totalSignals > 0 ? 'completed' : 'idle',
  },
  {
    name: 'recommendation',
    status: missionQueue.size() > 0 ? 'completed' : latestDiscovery ? 'completed' : 'idle',
    //                                 ^^^^^^^^^^ 逻辑错误：queue > 0 → completed？
    //                                 应该用 missionQueue > 0 → 'queued'
  },
]
```

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D5-1 | **🔴 所有 Queue 是 in-memory** — `MissionQueue`、`VerificationQueue`、`PublishingQueue` 都没有持久化 | **P0** |
| D5-2 | **🔴 ObservatoryStore 是 in-memory** — 没有关联到数据库 | **P0** |
| D5-3 | **Recommendation 状态逻辑错误** — `missionQueue.size() > 0 ? 'completed'` 应该是 `queued` | P1 |
| D5-4 | **Knowledge 状态不可靠** — 用 `totalSignals > 0` 来判断是否完成，但 `totalSignals` 可能即使有 Discovery 也是 0 | P2 |
| D5-5 | **`latestDiscovery` 完全依赖 Discovery 执行** — 没有任何 Fallback 或默认演示数据 | P2 |
| D5-6 | **后端缺少 `recentActivity` 和 `actionableItems` 返回** — 与前端约定不符 | P0 |

---

## 8. 第6层：持久化层（Service → Repository / Store）

### 8.1 In-memory Store 汇总

| Store | 类型 | 持久化? | 数据来源 | 重启后 |
|-------|------|---------|---------|--------|
| `ObservatoryStore` | in-memory Map | ❌ | Discovery Pipeline 执行 | 空 |
| `MissionQueue` | in-memory array | ❌ | Discovery Consumer enqueue | 空 |
| `VerificationRequestQueue` | in-memory array | ❌ | Discovery Consumer enqueue | 空 |
| `PublishingQueue` | in-memory array | ❌ | Discovery Consumer enqueue | 空 |
| `LearningStore` | in-memory array | ❌ | Learning Consumer enqueue | 空 |

**5 个数据源全部为 in-memory，无任何持久化机制。**

### 8.2 TimelineEngine 的问题

`TimelineEngine` 通过 Prisma 查询多种表来投影事件。但它需要真实的 `projectId`，而 `mission-control.ts` 调用时传了空字符串：

```typescript
recentActivity: await timelineEngine.getProjectTimeline('', 10)
// 问题：传入 '' 作为 projectId
```

而 `timelineEngine.getProjectTimeline()` 内部：

```typescript
const healthSnapshot = await prisma.gEOScoreSnapshot.findMany({
  where: { projectId },  // projectId = '' → 找不到任何记录
})
```

如果数据库中没有 `projectId = ''` 的记录，返回空数组。

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D6-1 | **🔴 所有引擎状态数据源是易失的** — 5 个 in-memory store/queue 全部重启即失 | **P0** |
| D6-2 | **`observatoryStore.getLatest()` 在未执行 Discovery 时返回 null** — 流程从未启动过，前台永远空 | P0 |
| D6-3 | **没有 Scheduled Job 或初始化钩子来触发 Discovery** — 创建项目后数据一直为空 | P1 |
| D6-4 | **TimelineEngine 传入空 projectId** — 导致 query 必然返回空结果 | P0 |

---

## 9. 第7层：数据库 Schema

### 9.1 模型泛滥问题

Prisma Schema 中与 GEO 相关的 model 多达 **48 个**，存在大量重叠和重复：

| 模型组 | 数量 | 关系 |
|--------|------|------|
| `GEOProject` + `GeoProject` + `GeoProjectProfile` | 3 | 三套独立定义，无关联 |
| `GEOBrand` + `GeoBrandProfile` | 2 | 共享品牌语义 |
| `GEOScoreSnapshot` + `GEOQualityScore` | 2 | 评分语义重叠 |
| `GEOEntity` + `GEOEntityRelation` + `GEOEvidence` + `GEOClaim` + `GEOCitation` | 5 | 图谱语义 |
| `GEOOptimizationHistory` + `GEOActionPlan` + `GEOBenchmarkRecord` | 3 | 优化语义重叠 |
| `GEOVerificationReport` + `GEOReviewQueue` | 2 | 验证语义重叠 |

### 9.2 关键模型是否被使用

| 模型 | 被哪条代码使用 | 数据量预期 |
|------|---------------|-----------|
| `GEOProject` | geo-project.repository.ts, project route | 少量 |
| `GeoProject` | 旧版 geo-dashboard.route.ts | 极少或 0 |
| `GEOScoreSnapshot` | timeline.ts, health route | 0（需先有 Discovery） |
| `GEODiscoveryReport` | geo discovery route | 0（需先触发扫描） |
| `GEOActionPlan` | action-plan route | 0 |
| `GEOVerificationReport` | geo verification route | 0 |
| `GEOScanRecord` | geo scan route | 0 |
| `GEOOptimizationHistory` | timeline.ts | 0 |

### 9.3 迁移状态

- `GeoProject` (旧模型) 正在被 `GEOProject` 取代
- 两个模型在 schema 中都标记为 active，有完全独立的 CRUD 路由
- 前端 `useGeoProjectStore` 使用 `geoApi` 调用 `/api/geo/projects`
- 后端 `/api/geo/projects` 路由操作的是 `GEOProject` 表
- 但旧版 `geo-dashboard.route.ts` 仍在使用 `GeoProject` 表

### 发现的问题

| # | 问题 | 级别 |
|---|------|------|
| D7-1 | **GEOProject / GeoProject 双模型** — 同名不同表，造成数据碎片 | **P0** |
| D7-2 | **48 个 GEO model 只有 2-3 个在 CRUD 中被使用** — 大量模型定义了但无代码写入 | P1 |
| D7-3 | **没有种子/演示数据** — `prisma/seed.ts` 中没有 GEO 相关的 seed 数据 | P1 |
| D7-4 | **`GeoProject` 表无迁移计划** — 旧表没有标记 deprecated 或清理时间线 | P2 |
| D7-5 | **`GEOScoreSnapshot` 表被 `timeline.ts` 查询但无人写入** — 除非有服务调用了 `recordScoreSnapshot` | P0 |

---

## 10. 全链条断裂点总表

### 🔴 P0 断裂点（必须立即修复）

| ID | 断裂点 | 位置 | 根因 |
|----|--------|------|------|
| **F1** | MissionControlData vs MissionControlResponse 不一致 | 前端 `missionControlService.ts` + 后端 `mission-control.ts` | `recentActivity` 和 `actionableItems` 在后端不存在 |
| **F2** | 5 个引擎状态源全部 in-memory | 后端 `observatory.ts`, `mission-consumer.ts`, `verification-consumer.ts`, `publishing-consumer.ts`, `learning-consumer.ts` | 重启即失，且 Discovery 流程从未触发 |
| **F3** | `timelineEngine.getProjectTimeline('', 10)` 传空 projectId | 后端 `mission-control.ts` 第 158 行 | 传了空字符串，query 永远空结果 |
| **F4** | `GEOScoreSnapshot` 表无人写入但被 `timeline.ts` 查询 | 后端 `timeline.ts` + Prisma Schema | 定时任务或触发机制缺失 |
| **F5** | `recommendation` 引擎状态逻辑错误 | 后端 `mission-control.ts` | `queue > 0 → completed` 应该是 `queued` |
| **F6** | 仪表盘全部指标永远显示空/0 | 前端 `GEODashboard-full.vue` | 所有上游都返回空数据 |

### 🟡 P1 断裂点（应在 RC5 阶段修复）

| ID | 断裂点 | 位置 | 根因 |
|----|--------|------|------|
| F7 | Error 被静默吞掉 | 前端 `GEODashboard-full.vue` `.catch { /* use defaults */ }` | 用户看不到错误状态 |
| F8 | 前端没有使用独立的 timeline API | 前端 `missionControlService.ts` 方法已定义但未调用 | Dashboard 没有请求活动数据 |
| F9 | 没有 Discovery 自动触发机制 | 全链路 | 创建项目后无初始化扫描 |
| F10 | 48 个 GEO model 大部分 unused | Prisma Schema | 代码与模型脱节 |
| F11 | PageShell 样式冲突（3 个 scoped 块） | 前端 `PageShell.vue` | 重构遗漏 |

### 🟢 P2 断裂点（应排入迭代）

| ID | 断裂点 | 位置 | 根因 |
|----|--------|------|------|
| F12 | 双 Dashboard 版本并存 | 前端 | `GEODashboard-full.vue` vs `.page-shell.vue` |
| F13 | 仪表盘全部手写 CSS | 前端 `GEODashboard-full.vue` | 未使用 Design System |
| F14 | `GeoProject` 表未清理 | Prisma Schema | 迁移计划缺失 |
| F15 | 3 个 `.bak` 文件残留 | 前端 workspace | 版本控制不当 |
| F16 | 无 seed 数据 | Prisma `seed.ts` | 演示不可用 |

---

## 11. 风险分级与修复建议

### 建议优先级顺序

#### Phase 1: 让 Dashboard 显示真实数据（2-3天）

1. **修复 F1** — 同步前后端接口契约
   - 后端 `MissionControlResponse` 增加 `recentActivity` 和 `actionableItems`
   - 或者前端删掉这两个字段，统一从独立 timeline API 获取

2. **修复 F3** — 修复空 projectId 问题
   - `getMissionControl()` 如果没有 projectId 参数，跳过 timeline 查询
   - 或者从数据库取最新 project 的 ID

3. **修复 F2 + F6** — 添加发现数据初始化
   - 项目创建后自动触发 Discovery 扫描（哪怕同步执行）
   - 或者在无数据时返回演示/默认数据，让 Dashboard 看起来"活着"
   - 最简单的方案：创建项目时在 `GEOScoreSnapshot` 中插入一条默认记录

#### Phase 2: 后端数据持久化（3-5天）

4. Queue/Store 改为 Prisma 持久化或 Redis
5. 替换 in-memory `ObservatoryStore` 为 DB-backed Store
6. 在 `geo-project.route.ts` 中插入 `AfterProjectCreated` hook

#### Phase 3: 前端统一（1-2天）

7. 切换到 page-shell 版本，删除 `GEODashboard-full.vue`
8. 修复 PageShell 样式冲突
9. 接入 Design System 组件

#### Phase 4: Schema 治理（2-3天）

10. `GeoProject` 表标记 deprecated
11. 清理 unused model
12. 添加 seed 数据

---

## 12. 最后结论

**这是一个典型的"前置架构工作完成但执行断层"案例。**

Design System 做好了（13 primitives, 17 product-blocks, 2 patterns）、PageShell 抽象完成了、Navigation Architecture 设计好了、6 份产品规范文档全部完成。但是在"让 Dashboard 真正显示数据"这个核心闭环上，**后端业务逻辑层有一个系统性断裂**：Dashboard 依赖 5 个 in-memory store，而这些 store 从未被填充。

**这不是代码 bug，而是架构落地断裂**：架构层（RC4）冻结的是 Platform 能力，但 Dashboard（应用层）的数据来自 Discovery Engine，而 Discovery Engine 的消费端（Mission/Verification/Publishing Consumer）从未与 Dashboard 建立持久化的数据管道。

### 最短路径修复方案

1. 在 `geo-project.route.ts` 的 `createProject` 中插入：创建项目后自动生成 1 条 `GEOScoreSnapshot` 和 1 条 `ObservatorySnapshot`
2. 后端 `mission-control.ts` 改为直接从 `GEOScoreSnapshot` 表读取最新数据
3. 前后端契约对齐（增加 `recentActivity` 和 `actionableItems`）
4. 切换到 page-shell 版 Dashboard

这样 1 天内可以让 Dashboard 从"全部空数据"变成"显示真实项目数据"。
