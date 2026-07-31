# Sprint-ADMIN-IA-REALITY-01 — 昆仑镜后台管理 IA Reality Audit

**Date:** 2026-08-01
**Gate:** 掌柜指令启动（P0: 后台导航重构 / Workspace 一级入口统一 / 求职招聘 10 栏合并）
**状态:** Task 01-03 进行中

---

## 核心规则（冻结）

> **一个前台 Workspace，在后台只能有一个一级导航入口。**
> 新增功能只能进入 Workspace 内部 Tab，禁止新增一级菜单。
> 一级菜单数量控制：10~15 个以内。

---

## Task 01 — 后台导航树审计 ✅

### 现状（layouts/admin-aigc.vue menu 数组）

一级菜单 **27 项**（含注释隐藏 2 项）：

| 组 | 菜单项 | 数量 |
|----|--------|------|
| 平台公共 | 总控制台/大模型/会员/支付/VIP/管理员/COS/社区/私信/商城/法律/短信/微信/QQ/Agent/市场代理 | 16 |
| 招聘 Workspace | 求职招聘管理 | 1 |
| 企业（同属招聘域！） | 订阅/套餐/模型健康/AI员工活动/ROI/试运营/日报/额度/收入/入驻审核 | **10** |

### ❌ 反模式实锤

1. **招聘 Workspace 被拆成 11 个一级入口**（1 recruitment + 10 enterprise-*）
2. **重复入口**：
   - `/admin/enterprise/plans`（套餐定义）vs `/admin/recruitment/plans`（套餐管理）
   - `/admin/enterprise/subscriptions`（企业订阅管理）vs `/admin/recruitment/subscriptions`（订阅管理）
   - `/admin/enterprise/recruitment`（企业招聘管理）vs `/admin/recruitment/*`
3. **孤儿页面（无导航入口）**：
   - `/admin/aigc/styles`、`/admin/aigc/enterprises`、`/admin/aigc/beta-customers`、`/admin/aigc/vip-orders`、`/admin/aigc/runtime`
   - `/admin/enterprises`、`/admin/enterprise/recruitment`
   - `/admin/recruitment/plans`、`/admin/recruitment/subscriptions`、`/admin/recruitment/reviews`、`/admin/recruitment/config`
4. **recruitment 子页仅靠 index 快捷入口**（jobs/candidates/interviews/conversations/campaigns/audit/departments/agents/runtime 有卡片入口，plans/subscriptions/reviews/config 无任何入口）
5. **平台公共与 Workspace 混排**：法律工作台⚖️混在平台公共区

### 前台 Workspace 清单（产品域）

| code | 名称 | 前台路由 | 后台一级入口现状 |
|------|------|----------|-----------------|
| recruitment | 求职招聘 | /workspace/enterprise/* | ❌ 11 个 |
| short-drama | 短剧 | /hdz/*, /studio* | ❌ 无 |
| novel | 小说 | /novel/* | ❌ 无 |
| legal | 法律 | /workspace/legal* | ✅ /admin/aigc/legal（位置错） |
| geo | GEO优化 | /workspace/geo/* | ❌ 无 |
| ecom-image | 电商图片 | /workspace/ecom-image/* | ❌ 无 |
| ad-create | 广告制作 | /workspace/ad-create/* | ❌ 无 |
| mall | 商城 | /mall/* | ⚠️ 混在平台公共 |

---

## Task 02 — AdminWorkspaceRegistry ✅

`frontend/config/admin-workspace-registry.ts`

```ts
export interface AdminWorkspaceEntry {
  code: string            // 唯一码：recruitment / short-drama / novel / legal / geo / ...
  name: string            // 一级导航名：求职招聘管理
  icon: string
  entry: string           // 后台入口路由（唯一）
  children: AdminWorkspaceChild[]  // 内部子页（Tabs / 二级导航）
}

export const ADMIN_WORKSPACE_REGISTRY: AdminWorkspaceEntry[] = [ ... ]
```

**新增 Workspace 的唯一方式：往 Registry 加一项。禁止直接往 menu 数组塞一级菜单。**

---

## Task 03 — 后台导航重构

### 目标结构（一级导航 ≤ 15）

```
昆仑镜管理后台
├── 🏠 控制台
├── 🔐 平台公共管理（大模型/会员/支付/VIP/管理员/... 全部折叠）
├── 💼 求职招聘管理（唯一入口 → 内部 Tabs）
├── ⚖️ 法律工作台管理
├── 🎬 短剧工作台管理
├── 📖 小说工作台管理
├── 🌎 GEO优化管理
├── 🎵 音乐制作管理
├── 🖼 电商图片管理
├── 📣 广告制作管理
├── 🛒 商城管理
└── ⚙️ 系统设置
```

### 求职招聘管理（内部结构）

```
💼 求职招聘管理
├── 概览（/admin/recruitment）
├── 企业管理（departments / validation / subscriptions）
├── 求职用户（candidates / reviews / conversations）
├── AI员工（agents / runtime / llm-health / agent-activity / daily-report / quotas）
├── 岗位与候选人（jobs / campaigns / interviews）
├── 能力与套餐（plans / config）
├── 使用统计（revenue / roi-report / pilot-dashboard）
└── 审计日志（audit）
```

---

## Task 04 — 孤儿页面治理（清单待执行）

| 页面 | 处置建议 |
|------|----------|
| /admin/aigc/styles | 归档或接入平台公共 |
| /admin/aigc/enterprises, /admin/enterprises | 合并去重 |
| /admin/aigc/beta-customers, /admin/aigc/vip-orders | 归档（废弃） |
| /admin/aigc/runtime | 接入平台公共 |
| /admin/recruitment/plans, subscriptions, reviews, config | 接入招聘 Tabs |

---

## Reality Gate（本次验收）

| Gate | 要求 | 状态 |
|------|------|------|
| G1 | 一级菜单 ≤ 15 | 待验证 |
| G2 | 招聘 Workspace 仅 1 个一级入口 | 待验证 |
| G3 | 全部现有路由可达（无回归 404） | 待验证 |
| G4 | Registry 落地，新增 Workspace 走 Registry | 待验证 |
| G5 | 前端 build PASS | 待验证 |
