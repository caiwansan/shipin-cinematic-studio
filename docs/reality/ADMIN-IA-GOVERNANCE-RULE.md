# ADMIN-IA-GOVERNANCE-RULE — 昆仑镜后台治理规则（永久约束）

**Date:** 2026-08-01
**Gate:** 掌柜修正指令（ADMIN-IA-REALITY-04 修正指令）
**性质:** 永久约束，后续任何 Workspace / 任何开发迭代都不得绕过。

---

## 一、数据罗盘定位

> 数据罗盘 = 昆仑镜平台经营驾驶舱（CEO / 平台管理员视角）

不是 AI 调用监控页。必须覆盖平台经营的八个维度：

1. 平台规模（用户 / 企业 / VIP / 收入 / AI员工 / Workspace）
2. 用户增长
3. 商业收入
4. AI 使用情况
5. Agent 运营情况
6. Workspace 生态情况
7. 基础设施健康
8. 风险事件

页面：`/admin/dashboard`（唯一入口，后台首页）

### 七层布局（标准结构）

```
第一层：核心经营指标（数字大屏）
  用户总数 / 企业客户 / VIP会员 / 累计收入 / AI员工数量 / Workspace数量

第二层：AI基础设施
  模型调用趋势 / Token消耗趋势 / 模型成本排行 / Provider健康状态 / 模型成功率 / 平均响应时间

第三层：Agent运营中心
  AI员工排行榜 / Agent成功率 / Agent成本 / Agent活跃企业

第四层：Workspace生态地图
  🎬 短剧工作台 / 📖 小说工作台 / 💼 求职招聘 / ⚖️ 法律 / ...（按业务线卡片）

第五层：商业增长
  VIP收入趋势 / 企业订阅趋势 / 套餐分布 / 续费率 / 客户生命周期

第六层：系统健康
  数据库 / Redis / 任务队列 / COS / API / 模型服务

第七层：实时事件流（LIVE）
```

---

## 二、禁止后台新增孤岛页面

### ❌ 禁止

```
新增：
/admin/new-feature          ← 禁止
```

任何新增管理能力，必须：

### ✅ 必须

```
已有模块内部增加 Tab / 子菜单
```

### 后台固定一级模块（唯一清单，≤8 个）

```
后台
│
├── 数据罗盘        /admin/dashboard
├── 系统设置        /admin/system
├── 公共信息设置    /admin/settings
├── VIP套餐管理     /admin/vip
├── 用户与权限      /admin/users
├── 大模型管理      /admin/models
├── AI Agent管理    /admin/agents
└── Workspace工作台管理 /admin/workspaces
```

**不得新增一级模块。** 需要新能力时，挂到上述模块内作为 Tab / 子菜单。

---

## 三、右栏统一管理模式

后台页面结构：

```
Admin Layout

┌──────────────────────┐
│ 左侧固定导航 │
│ │
│ │
│ │
│ │
├──────────┬───────────┤
│ │ │
│ │ 右侧内容区 │
│ │ │
│ │ │
└──────────┴───────────┘
```

### 示例：大模型管理

❌ 不是：`/admin/providers` + `/admin/models` + `/admin/model-health` + `/admin/model-statistics`

✅ 应该：`/admin/models`（Tabs: Provider管理 / 模型列表 / 默认模型 / 健康检测 / 调用统计）

### 示例：AI Agent管理

❌ 不是：`/admin/agents` + `/admin/runtime` + `/admin/capabilities`

✅ 应该：`/admin/agents`（Tabs: Agent列表 / 模板管理 / 能力管理 / 风格库 / Runtime状态 / 使用统计）

### 示例：Workspace管理

❌ 不是：`/admin/recruitment` + `/admin/novel` + `/admin/drama`

✅ 应该：`/admin/workspaces`

```
工作台列表
├── 求职招聘
│   概览 / AI员工 / 企业 / 订阅 / ROI
├── 短剧
│   ...
├── 小说
│   ...
├── GEO
│   ...
└── 音乐
```

---

## 四、Admin UI Reality Rule v1.0

1. **后台一级导航 ≤ 8 个**
2. **一个管理对象一个入口**（对象内部用 Tabs 组织子能力）
3. **禁止业务能力进入平台一级菜单**
   - ❌ 招聘套餐管理 / 招聘模型管理 / 招聘ROI / 招聘额度
   - ✅ Workspace管理 → 求职招聘 → 套餐 / 模型 / ROI / 额度
4. **后台所有页面必须嵌入 Admin Layout**
5. **不允许创建脱离后台壳的新管理页面**
6. **新路由必须登记** AdminRouteRegistry，禁止孤儿路由

---

## 五、UI Reality Gate G8（用户视觉验证，强制）

> 来源：ADMIN-IA-REALITY-04-B-FIX（掌柜纠偏）—— 报告完成 ≠ 用户可见。
> 后台类任务验收必须以下为准：**浏览器里用户真正看到的页面**。

**验收前必须全部通过：**

1. ✅ **登录链路走通**：从登录页登录 → 落在正确落地页（本次修复：登录成功 → /admin/dashboard，禁止旧落地页）
2. ✅ **打开实际入口**：按掌柜操作路径（后台管理 → 数据罗盘）进入
3. ✅ **页面组件真实渲染**：浏览器 evaluate 检查页面文本含关键模块标题 + 真实数据（非 loading/空白/残缺）
4. ✅ **截图存档**：整页截图保存到 docs/reality/，作为验收证据
5. ✅ **九层/模块与需求一致**：逐层核对

**部署链检查（每次 build 后）：**

```
nuxt build → patch-manifest → asset-sync(_nuxt → nginx root) → pm2 restart nuxt-frontend
→ 浏览器强刷（Ctrl+F5）验证资源 hash 更新
```

**已知坑（写入记忆）：**

- Nuxt3 组件默认 pathPrefix 命名（components/admin/dashboard/KpiOverview.vue = AdminDashboardKpiOverview），模板用短名必须显式 import，否则自定义组件零渲染（SSR 壳正常但内容空）
- 登录落地页被旧页面劫持时，用户永远看不到新页面——登录跳转是后台验收第一检查项

**任何后台任务，未完成 G8 不得标 PASS。**

---

## 七、Dashboard Reality Rule v1.1（首屏信息密度，强制）

> 来源：ADMIN-IA-REALITY-04-C（掌柜纠偏：数据罗盘 ≠ 长报表，是 CEO 驾驶舱）

**数据罗盘 = 后台首页驾驶舱，不是数据报告长页面。**

### 布局标准（1920×1080）

```
┌──────────────────────────────┐
│ 昆仑镜 AI Operating Center   │  ← 顶部控制栏（时间范围联动）
├────┬────┬────┬────┬────┬────┤
│用户│企业│VIP │收入│AI员工│调用│  ← KPI 6 列，120px 高
├────┴────┴────┴────┴────┴────┤
│ 用户趋势     │ 收入趋势      │
├──────────────┼───────────────┤
│ Workspace生态 │ Agent运营     │
├──────────────┼───────────────┤
│ VIP经营       │ AI健康        │
├──────────────────────────────┤
│ 实时事件流（横向条）          │
└──────────────────────────────┘
```

### 强制规则

1. **首屏密度 ≥70%**：1920×1080 首屏必须展示全部核心经营指标（用户/企业/VIP/收入/AI员工/调用 + 用户趋势 + 收入趋势 + Workspace + Agent + 健康状态 + 事件流），**零滚动**
2. **禁止单卡独占整行**：所有图表卡 2 列并排，高度 ≤230px
3. **长页面数据必须拆为卡片/Tab/Drawer/二级详情页**：首页只放概览，完整分析（漏斗/来源构成/套餐分布/区域/Provider 排行）进右侧 Drawer「查看详情」
4. **顶部时间控制栏**：数据范围（今天/7天/30天/90天/今年）必须真实联动全部卡片（后端 range 参数），禁止假控件
   - 存量指标（总用户/企业/VIP/AI员工）主值不变，sub 显示窗口新增
   - 流量指标（收入/调用）主值随窗口变化
5. **企业/Workspace 筛选**：数据层未绑定（usage_logs/payment 无 enterpriseId）时禁止做假选择器；待 05 Agent 管理打通后接入

### 技术要点

- Nuxt3 组件必须显式 import（pathPrefix 命名坑，见 G8）
- ECharts 卡片高度压缩（110-130px 图表区），数字用 fmtMoney/fmt 紧凑格式
- 详情复用完整分析组件（UserGrowthPanel/RevenueCockpit 等）包进 DetailDrawer

---

## 八、执行检查

| 检查项 | 标准 |
|--------|------|
| 一级导航数量 | ≤ 8 |
| 新增能力 | 只能进已有模块 Tab |
| 页面外壳 | 必须 Admin Layout |
| 路由登记 | 无孤儿页面 |
| 数据口径 | DB 真实聚合，零 mock，脏数据排除 |
| **G8 视觉验证** | **登录链路 + 实际入口 + 组件渲染 + 截图存档** |
| **G8.1 Admin Layout** | **pages/admin/* 必须声明 `definePageMeta({ layout: 'admin-aigc' })`（登录页除外），禁止独立新页面** |
| **v1.1 首屏密度** | **1920×1080 零滚动见全部核心指标，详情进 Drawer** |

---

## 附：当前后台模块对照（2026-08-01 冻结）

| 模块 | 路由 | 状态 |
|------|------|------|
| 数据罗盘 | /admin/dashboard | ✅（T01 完成，待 04-A 升级） |
| 大模型管理 | /admin/models | ✅（03-T02 完成，Tabs 化待验） |
| AI Agent管理 | /admin/agents | ⏳ ADMIN-IA-REALITY-05 |
| 系统设置 / 公共信息 / VIP / 用户权限 / Workspace | — | ⏳ 后续按此规则统一 |

**此规则生效后，任何代码评审首先检查：是否违反 ADMIN-IA-GOVERNANCE-RULE。**
