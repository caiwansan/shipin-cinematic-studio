# ADMIN-IA-REALITY-04 T01 — 昆仑镜数据罗盘 Reality Dashboard — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜指令启动（「现在正是做数据罗盘的最佳时机」）

---

## 目标

> 管理员打开后台第一眼，就知道昆仑镜现在运行状态、商业状态、AI 状态、用户状态。

将数据罗盘升级为**昆仑镜 AI Operating Center**——不是普通报表，是老板级驾驶舱。

---

## 核心原则

**全部 DB 真实聚合，零 mock。**

### 关键发现：脏数据排除

`usage_logs` 中存在 **633,676 条 `dag_execution`（provider=pangu_axe_runtime）脏数据**——盘古斧调试台的假调用，cost=1 写入。

- 修复前：总成本显示 $633,676（完全失真）
- 修复后：**真实 AI 调用 627 次 / 总成本 $12.79 / 3.01M tokens**

罗盘中显式标注排除，并在 ai-health 端点返回 `dirtyData.dagExecutionCount` 供前端展示。

---

## 交付物

### 后端：6 个聚合 API（`admin-dashboard-center.routes.ts`）

```
GET /api/admin/dashboard/overview     — 平台健康总览（用户/企业/AI/Agent + 14天趋势 + TOP任务）
GET /api/admin/dashboard/ai-health    — AI 基础设施（Provider 健康 + Runtime + 脏数据提示）
GET /api/admin/dashboard/workspaces   — Workspace 运营地图（业务线排行 + workspaceType）
GET /api/admin/dashboard/agents       — AI 员工运营中心（Agent 排行 + 成功率 + 审计成本）
GET /api/admin/dashboard/revenue      — 商业数据（收入/订阅/转化漏斗/月度趋势）
GET /api/admin/dashboard/activity     — 实时事件流（近 72h 用户/支付/调用/审计）
```

### 前端：组件化驾驶舱（`/admin/dashboard`）

```
components/admin/dashboard/
├── MetricCard.vue         — 玻璃拟态指标卡（渐变光晕/徽章/子指标）
├── AiHealthPanel.vue      — Provider 健康点阵 + Agent Runtime 四格 + 脏数据提示
├── WorkspaceChart.vue     — ECharts 渐变柱状图 + 业务线排行
├── AgentRanking.vue       — AI 员工排行（🥇🥈🥉 + 成功率进度条）
├── RevenuePanel.vue       — 收入三卡 + 订阅徽章 + 转化漏斗
└── ActivityTimeline.vue   — LIVE 事件流时间线
pages/admin/dashboard.vue  — 驾驶舱主页面（背景 #070B16 + 玻璃拟态 + ECharts）
```

### 页面布局（对应掌柜设计）

```
昆仑镜 AI Operating Center | 今日运行状态 2026-08-01
┌────────┬────────┬────────┬────────┐
│ 用户124 │ 企业11 │ AI调用 │ 成功率 │   ← 4 指标卡
│        │ AI员工7│ 627次  │ 70%   │
└────────┴────────┴────────┴────────┘
┌────────────────────────┬─────────────┐
│ AI 调用趋势(14天 柱+线)  │ AI 基础设施  │
│                        │ 健康中心     │
├────────────────────────┴─────────────┤
│ Workspace 运营地图      │ AI 员工排行  │
├────────────────────────┬─────────────┤
│ 商业增长               │ 实时事件流   │
└────────────────────────┴─────────────┘
```

---

## 真实数据（2026-08-01 线上实测）

| 指标 | 值 |
|------|-----|
| 注册用户 | 124 |
| 今日新增 / DAU | 0 / 3 |
| VIP 用户 | 10（付费用户 2） |
| 企业 | 11（活跃 3） |
| AI 员工实例 | 7（全部活跃） |
| AI 任务成功率 | 70%（30 任务 / 9 失败） |
| 今日 AI 调用 | 23 次 / $0.63 |
| 累计 AI 调用 | 627 次 / $12.79 / 3.01M tokens |
| 本月业务线 TOP | hdz_reviewer 17 / hdz_generic 6 |
| 脏数据排除 | 633,676 条 dag_execution ✅ |

---

## Reality Gate

| Gate | 要求 | 状态 |
|------|------|------|
| G1 数据真实 | 全部 DB 聚合，无 mock + 脏数据排除 | ✅ PASS |
| G2 AI 可视化 | 模型健康 / Runtime / Agent 成功率 / 成本 | ✅ PASS |
| G3 商业可视化 | 收入 / 订阅 / 转化漏斗 | ✅ PASS |
| G4 Workspace 隔离 | 业务线独立统计排行 | ✅ PASS |
| G5 UI 品质 | 深色科技驾驶舱 #070B16 + 玻璃拟态 + ECharts | ✅ PASS |
| G6 权限隔离 | 无 token 401 / 页面可访问 | ✅ PASS |
| G7 Build PASS | nuxt build ✅（49 路由登记，无孤儿） | ✅ PASS |

---

## 修复的坑（记录）

| 问题 | 修复 |
|------|------|
| `usageLog.aggregate _sum: {tokens}` 报错 | tokens 是 String 列，改 `$queryRawUnsafe` + 正则过滤非数字 |
| tokens 混入 JSON 字符串（`{"input":1025,...}`） | `CASE WHEN tokens ~ '^[0-9]+$' THEN CAST...ELSE 0` |
| PG 列名大小写 | 实际列名 `"createdAt"`/`"taskType"`（camelCase），SQL 需双引号 |
| ai-health 解构 5 变量 vs 4 Promise | 拆分 enterpriseAgentInstance groupBy 独立查询 |
| num() 定义在 revenue 内 overview 不可见 | 提升到模块顶层 |
| 路由孤儿告警 | AdminRouteRegistry 登记 `/admin/dashboard` |

---

## 职责边界

- 数据罗盘是**平台 Admin 专属**（requireAdmin），不暴露租户数据
- Workspace 隔离：业务线聚合基于 usage_logs.taskType 前缀映射，不跨租户
- 脏数据策略：`pangu_axe_runtime` / `dag_execution` 全局排除（罗盘口径），业务口径不受影响
