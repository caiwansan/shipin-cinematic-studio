# Enterprise Activation Layer Product Specification v1.0

**Doc ID**: P4.1-SPEC-V1
**Date**: 2026-07-15
**Author**: Engineering Agent (Spec Design Mode — NO CODE)
**Review**: CTO / Product Owner
**Status**: 🟡 DRAFT — Awaiting CTO Review

---

## Ch0 — Product Objective

### 0.1 为什么需要 Activation Layer

当前产品状态：

```
Phase 3:   Runtime 能力     → "AI 能做事情"           ✅
Phase 4.0: Workspace 展示层   → "客户看到 AI 正在工作"    ✅
Phase 4.1: Activation Layer  → "客户拥有 AI 数字部门"    ❌
```

**核心差距**：

Phase 4.0 解决了 `Runtime Productization` —— 把 AI 增长 Runetime 包装成企业数字部门 Workspace。但没有解决 `Customer Activation` —— 一个真实企业客户如何从 0 开始，拥有属于自己的 AI 数字部门。

当前用户旅程断裂：

```
现在：
  注册 → 登录 → CEO驾驶舱 → 看到Tesla模拟数据
  （用户困惑："这些数据是谁的？"）

应该：
  注册 → 登录 → Onboarding Guard → Setup Wizard
  → 创建企业 → 配置AI员工 → 连接渠道 → 加载知识
  → 启动 → CEO驾驶舱（真实自有数据）
```

### 0.2 产品定位

**Phase 4.1 不是**：
- 不是 Decision Intelligence（Phase 4.3）
- 不是 Dashboard Enhancement
- 不是 Channel Integration v2

**Phase 4.1 是**：
> 让每一个新企业客户，第一次打开昆仑镜时，
> 能在 30 秒内理解 "这是我的 AI 部门"，
> 并在 5 分钟内完成属于自己的数字部门初始化。

### 0.3 核心命题

| Phase 4.0 命题 | Phase 4.1 命题 |
|---------------|---------------|
| AI 部门**已经存在** | 客户**可以创建**自己的 AI 部门 |
| 展示层（View Layer） | 创建层（Activation Layer） |
| 系统展示 → 用户观看 | 用户操作 → 系统生成 |
| Tesla Demo 数据 | 客户自有数据 |

### 0.4 产品成功指标

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| Setup Wizard 完成率 | ≥80% | 进入Wizard → 完成全部步骤 |
| 首次激活时间 | ≤5分钟 | 注册 → CEO驾驶舱（真实数据） |
| 数据认同率 | ≥90% | 用户明确"这是我的数据" |
| Demo污染率 | 0% | 真实客户账号无Tesla数据 |

---

## Ch1 — Customer Activation Journey

### 1.1 唯一客户路径

```
用户注册 Kunlun
    ↓
登录成功
    ↓
Onboarding Guard 检测
    ├── 已初始化 → CEO驾驶舱（正常路径）
    └── 未初始化 → Setup Wizard
                        ↓
                    Step 1: 企业身份
                       企业名称 / 行业 / 目标 / 市场 / 品牌
                        ↓
                    Step 2: 配置AI员工
                       选择员工 / 自定义 / 确认
                        ↓
                    Step 3: 连接渠道
                       可选跳过，支持后续补充
                        ↓
                    Step 4: 加载企业知识
                       可选跳过，支持后续补充
                        ↓
                    Step 5: 启动AI部门
                       确认 + 生成初始配置
                        ↓
                    CEO驾驶舱（真实自有数据）
```

### 1.2 Onboarding Guard 规则

```javascript
// 伪代码 — 展示逻辑判断
function onEnterEnterprise(user) {
  const status = getOnboardingStatus(user.tenantId)
  
  if (!status.tenant || !status.isComplete) {
    return redirect('/enterprise/setup')
  }
  
  if (status.agents < 5) {
    return redirect('/enterprise/setup?step=agents')
  }
  
  return redirect('/enterprise') // CEO驾驶舱
}
```

### 1.3 验收标准 — Ch1

| # | 测试 | 通过条件 |
|---|------|----------|
| AC1.1 | 新注册用户进入 `/enterprise` | 重定向至 Setup Wizard |
| AC1.2 | 企业在 Setup Wizard 中完成后 | 进入 CEO驾驶舱，看到真实自有数据 |
| AC1.3 | 用户关闭浏览器后再次登录 | 直接进入 CEO驾驶舱（不重新进入 Wizard） |
| AC1.4 | Setup Wizard 中途退出 | 下次进入时从上次断点续填 |
| AC1.5 | 用户完成 Setup Wizard 全程 | 总耗时 ≤5分钟 |

---

## Ch2 — Tenant Birth Model

### 2.1 Tenant 生命周期

```
CREATED → INITIALIZING → READY → ACTIVE → OPERATING
  ↓           ↓            ↓        ↓          ↓
 用户      系统创建      配置     AI部门     完成
 点击     组织+AI员工    完成     启动      首次增长
 "创建"    +Quota+角色            运行       闭环
```

| 状态 | 含义 | 触发条件 | 用户可见性 |
|------|------|----------|-----------|
| CREATED | 企业记录已创建，系统正在初始化 | POST /enterprise 返回 | "正在创建您的企业..." |
| INITIALIZING | 正在创建AI员工和默认资源 | Onboarding进行中 | Setup Wizard 展示中 |
| Ready | AI部门配置完成，AI员工待激活 | Setup Wizard Step5 完成 | "您的AI部门已就绪" |
| ACTIVE | AI员工已启动，渠道连接确认中 | 用户点击"启动AI部门" | CEO驾驶舱（初始数据） |
| OPERATING | 完成首次增长闭环 | 首次有真实渠道互动 | CEO驾驶舱（活跃运营） |

### 2.2 企业身份定义

| 字段 | 类型 | 必填 | 用途 |
|------|------|------|------|
| name | String | ✅ | 企业名称（显示在CEO驾驶舱） |
| industry | Enum | ✅ | 行业（用于内容策略默认值） |
| businessGoal | Enum | ✅ | 主要目标（获客/品牌/销售） |
| primaryMarket | String | ✅ | 主要市场（中国/海外/全球） |
| brandIntro | Text | ❌ | 品牌介绍（用于AI内容生成） |
| website | URL | ❌ | 官网（用于知识抓取） |
| logo | Image | ❌ | 品牌Logo |

### 2.3 默认资源创建（系统自动）

用户点击"创建企业"后，系统自动创建：

```
Tenant (type=enterprise)
    ├── Organization (name="{企业名} AI部门", type=enterprise)
    ├── 5 × AgentProfile (来自模板，初始status=active)
    ├── 20 × Schedule (每位AI员工4个定时任务)
    ├── 1 × Quota (企业配额)
    └── 3 × Role (enterprise_owner/admin/member)
```

### 2.4 验收标准 — Ch2

| # | 测试 | 通过条件 |
|---|------|----------|
| AC2.1 | 用户名为 "Foo Inc" 创建企业 | Tenant.name = "Foo Inc", Organization.name = "Foo Inc AI部门" |
| AC2.2 | 用户名为 "Foo Inc" 创建后 | 数据库中有 5个 AI员工记录，tenant_id = Foo Inc 的tenant_id |
| AC2.3 | 用户完成 Setup Wizard | Tenant 进入 ACTIVE 状态 |
| AC2.4 | 用户在 Setup Wizard 中刷新页面 | 不丢失已填写的信息 |

---

## Ch3 — AI Employee Ownership Model

### 3.1 从 NPC 到团队成员

**当前问题**：
```
用户看到：AI增长总监（系统默认）
用户感觉：这是一个展示机器人
用户不知道：谁创建的？能不能调整？
```

**目标感觉**：
```
用户看到：AI增长总监（我的增长总监）
用户感觉：这是我的团队成员
用户知道：我选的，我配置的，我需要他
```

### 3.2 AI 员工生命周期

```
TEMPLATE → SELECTED → CONFIGURED → ACTIVATED → WORKING
   ↓          ↓            ↓            ↓           ↓
 系统       用户         用户         系统         正在
 默认模板    选择员工     确认配置     创建实例     执行工作
```

| 阶段 | 动作 | 用户感知 | 系统行为 |
|------|------|----------|----------|
| TEMPLATE | 系统预置5个模板 | 无 | 加载 `getDefaults()` |
| SELECTED | 用户在 Wizard 中勾选/调整 | "我选择我的团队" | 记录选中状态 |
| CONFIGURED | 用户确认名称/职责/目标 | "这是我配置的员工" | 生成 AgentProfile |
| ACTIVATED | 用户点击启动 | "AI部门上线了" | 创建 Schedule，启动 Runtime |
| WORKING | AI开始执行工作 | "正在产生数据" | 写入 Timeline，更新 Dashboard |

### 3.3 每个 AI 员工的展示

**Setup Wizard Step 2 中展示**：

```
┌─────────────────────────────────────────┐
│  👔 AI增长总监                           │
│  岗位：增长总监                           │
│  职责：负责企业增长策略制定、市场分析      │
│  目标：日均产出策略报告，监控3个竞品       │
│                                         │
│  ☑ 启用    [编辑职责]  [调整目标]         │
└─────────────────────────────────────────┘
```

**CEO 驾驶舱中展示**：

```
┌─────────────────────────────────────────┐
│  👔 我的增长总监  🟢 工作中              │
│  📋 今日：3项任务  |  💰 今日贡献：+¥2,340│
│  💬 126互动  |  🎯 54线索                │
│                                         │
│  [暂停]  [CEO指令]                        │
└─────────────────────────────────────────┘
```

### 3.4 用户可调配置

| 配置项 | 是否可调 | 默认值 | UI 位置 |
|--------|----------|--------|---------|
| 是否启用 | ✅ | 全部启用 | Wizard Step 2 勾选 |
| 员工名称 | ✅ | 系统默认名 | Wizard Step 2 编辑 |
| 职责描述 | ✅ | 系统模板 | Wizard Step 2 编辑 |
| 工作目标 | ✅ | 系统模板 | Wizard Step 2 编辑 |
| 能力标签 | ❌（固定） | 系统模板 | 展示用 |
| 启用/暂停 | ✅ | active | CEO驾驶舱按钮 |

### 3.5 验收标准 — Ch3

| # | 测试 | 通过条件 |
|---|------|----------|
| AC3.1 | 用户取消勾选"AI销售助理" | 企业只有4个AI员工，该员工不存在 |
| AC3.2 | 用户修改"AI增长总监"名称为"王总" | 该员工展示名称 = "王总" |
| AC3.3 | 用户点击"暂停"某个AI员工 | 该员工状态 = idle，不再出现在执行队列 |
| AC3.4 | 用户完成 Setup Wizard | 所有选中的AI员工状态 = active，并开始执行任务 |

---

## Ch4 — Reality Layer & Demo Isolation

### 4.1 问题诊断 — 最高风险

**当前状态**：
```
Tesla模拟数据 (tenant_id = 4ecfe9d8-...)
    ↓
所有用户进入CEO驾驶舱
    ↓
看到Tesla数据
    ↓
无法区分"是我的数据"还是"演示数据"
```

**风险等级**: 🔴 CRITICAL

**后果**：
1. 客户看到假线索，打电话给客户发现不存在 → 信任崩塌
2. 客户看到假ROI，做决策后损失 → 法律风险
3. 客户向朋友展示"你们系统有假数据" → 口碑崩塌

### 4.2 Demo/Production 隔离架构

```
┌─────────────────────────────────────────┐
│           Kunlun Mirror System           │
├─────────────────────────────────────────┤
│                                         │
│  Demo Tenant (id=固定)                   │
│  ├── Tesla 模拟数据                      │
│  ├── 5个 AI员工（演示版）                 │
│  ├── Mock 渠道（仅内部可见）              │
│  └── 展示用途，禁止外部用户              │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Customer Tenant (动态创建)              │
│  ├── 用户自有数据                        │
│  ├── 用户自有AI员工                      │
│  ├── 真实渠道连接（或明确显示"未授权"）   │
│  └── 用户拥有所有权                      │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 数据隔离规则

| 规则 | 实现方式 |
|------|----------|
| Tesla Demo Tenant ID 硬编码 | `DEMO_TENANT_ID = '4ecfe9d8-6fc7-4909-bee4-af9a07ce05a9'` |
| 所有用户可调用的 API 禁止返回 Demo Tenant 数据 | API 层 `if (tenantId === DEMO_TENANT_ID) throw` |
| 用户进入 Enterprise namespace 时自动过滤 Demo 数据 | `userId NOT IN demo_user_ids` |
| Demo 数据仅在 intro.vue（介绍页）中展示 | 介绍页明确标注"演示数据" |

### 4.4 Demo访问控制

**当前**：所有用户读取Tesla → 无隔离

**目标**：

```
场景1：游客（未登录）
  → /enterprise/intro → 展示Tesla模拟数据（标注"演示案例"）

场景2：注册用户（新企业，本Spec）
  → /enterprise/setup → Setup Wizard
  → /enterprise → CEO驾驶舱（真实自有数据，初始为空/样本）

场景3：Demo展示（销售/演示专用）
  → /enterprise/demo → Demo驾驶舱（明确标注"演示模式"）
```

### 4.5 数据所有权验证

| 检查项 | 方法 |
|--------|------|
| 用户只能看到自己的Leads | `WHERE tenantId = :currentTenantId` |
| 用户只能看到自己的Interaction | `WHERE tenantId = :currentTenantId` |
| Dashboard API 总返回当前租户数据 | ` tenantId = request.user.tenantId` |
| 覆盖率100% | 所有 Enterprise API 都经过租户隔离验证 |

### 4.6 验收标准 — Ch4

| # | 测试 | 通过条件 |
|---|------|----------|
| AC4.1 | 用户A登录进入CEO驾驶舱 | 看不到Tesla的任何线索/内容/互动 |
| AC4.2 | 用户B（新注册）创建企业 | 数据库中tenant_id = 用户B的ID，不是Tesla的 |
| AC4.3 | API `GET /api/enterprise/dashboard` | 永远不返回 `tenant_id = 4ecfe9d8-...`（Tesla）的数据 |
| AC4.4 | 用户在 Setup Wizard 中没有点击查看Demo | 任何页面不自动展示 Tesla 模拟数据 |
| AC4.5 | 用户在 Setup Wizard 中没有点击查看Demo | 任何页面不自动展示 任何"示例线索"（除非用户主动点击"加载示例"） |

---

## Ch5 — Channel Activation Model

### 5.1 重新定义渠道状态

**当前问题**：
```
CEO驾驶舱显示：
  公众号   ✅ 已连接
  抖音     ✅ 已连接
  小红书   ✅ 已连接
  
但实际上：
  Mock.adapter 硬编码 connected = true
  无真实OAuth，无真实Token，无真实Content发布
```

**产品信任危机**：用户以为已经连接了，实际上什么都没连。

### 5.2 渠道连接生命周期

```
DISCONNECTED → AUTH_PENDING → AUTHORIZING → CONNECTED → HEALTHY → OPERATING
    ↓             ↓              ↓             ↓          ↓          ↓
  未授权       用户点击       正在跳转      认证成功    心跳检测    正常发布
  [连接]      "连接"        OAuth回调     Token存储   数据同步
```

| 状态 | 用户可见信息 | 建议行动 |
|------|------------|----------|
| DISCONNECTED | "未授权" + "连接账号"按钮 | 点击授权 |
| AUTH_PENDING | "等待授权..." | 完成OAuth回调 |
| AUTHORIZING | "正在认证..." | 等待 |
| CONNECTED | "已连接" | 开始使用 |
| HEALTHY | "正常运行" | 无 |
| OPERATING | "正在发布" | 无 |
| ERROR | "连接异常" | 重新授权 |

### 5.3 产品文案规范

**当前** | **目标**
--- | ---
"8渠道已连接" | "支持8渠道增长编排，1个已授权"
"渠道矩阵" | "渠道连接"
"渠道健康度" | "渠道状态"
`connected: true`（Mock） | `disconnected`（默认真实） |

### 5.4 真实OAuth（未来能力）

Phase 4.1 不做真实OAuth接入，但需要**为真实接入预留架构**：

| 渠道 | 架构预留 | 接入方式 |
|------|----------|----------|
| 微信公众号 | `WechatOfficialAdapter`（已定义接口） | OAuth2.0 + AppID/Secret |
| 企业微信 | WecomAdapter | 企业ID + Agent配置 |
| 抖音 | DouyinAdapter | OAuth + 开发者账号 |
| 小红书 | RedBookAdapter | OAuth + 品牌主账号 |
| 其他 | ChannelAdapter统一接口 | 实现统一接口 |

**Phase 4.1 必须做**：渠道状态真实化（移除默认 `connected: true` Mock）
**Phase 4.3+ 再做**：真实OAuth接入

### 5.5 验收标准 — Ch5

| # | 测试 | 通过条件 |
|---|------|----------|
| AC5.1 | 新用户进入 CEO 驾驶舱 | 渠道状态显示"未授权"，而非"已连接" |
| AC5.2 | 用户点击"连接微信公众号" | 跳转至微信授权页（或显示"预留"提示） |
| AC5.3 | 用户取消授权 | 渠道状态回到"未授权" |
| AC5.4 | 未授权的渠道尝试发布 | 提示"请先连接渠道" |

---

## Ch6 — Enterprise Activation Architecture

### 6.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    用户设备（浏览器）                      │
│                                                         │
│  Activation Layer (Phase 4.1)  ← 新增                   │
│  ├── frontend/pages/enterprise/setup.vue               │
│  ├── Onboarding Guard (路由守卫)                        │
│  └── Setup Wizard 5步组件                              │
│                                                         │
│  Enterprise Workspace (Phase 4.0)                       │
│  ├── CEO驾驶舱 / AI员工 / 任务 / 审批 / 增长收益         │
│  └── frontend/pages/enterprise/*.vue                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    API Gateway                          │
│  All routes: authenticate → authorize → route           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                   后端服务                                │
│                                                         │
│  Enterprise Activation Service (Phase 4.1 新增)         │
│  ├── /api/enterprise/setup（Setup Wizard数据提交）       │
│  └── /api/enterprise/step/:step（分步保存）              │
│                                                         │
│  Enterprise Runtime Services (Phase 3 冻结)              │
│  ├── dashboard / leads / sales / roi                    │
│  ├── agent-profiles / agent-schedule                    │
│  ├── channel / knowledge / approval / command           │
│  └── 不修改任何 Runtime 服务                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                   数据层                                  │
│                                                         │
│  Phase 3 数据库（冻结，不修改）                           │
│  ├── enterprise_* 表                                    │
│  ├── governance_* 表                                    │
│  └── 不新增表                                            │
│                                                         │
│  Phase 4.1 仅使用现有表                                  │
│  ├─ enterprise_agent_profile（已有）                     │
│  ├─ tenant（已有）                                      │
│  ├─ governance_organization（已有）                     │
│  └─ enterprise_command（已有）                           │
└─────────────────────────────────────────────────────────┘
```

### 6.2 关键架构原则

**Rule 1: Phase 3 Runtime 冻结**
- Channel Runtime (`channel.adapter.ts` / `mock.adapter.ts`) **不修改**
- Agent Runtime (`enterprise-agent.service.ts`) **不修改**
- Gateway Runtime (Decision / Invocation / Replay) **不修改**

**Rule 2: Activation Layer 是上层包装**
- Setup Wizard 调用现有 API（`POST /api/enterprise`已存在）
- 数据写入使用现有表结构
- 不新增任何数据库表
- 不新增任何 Runtime Service

**Rule 3: Demo 隔离是数据安全**
- API 层增加 `tenantId !== DEMO_TENANT_ID` 过滤
- 不修改现有 Runtime
- 仅修改 API Route 层的查询条件

### 6.3 新增文件清单（实现时）

```
新增（实现时）：
├── frontend/pages/enterprise/setup.vue          — Setup Wizard 主页面
├── frontend/components/enterprise/StepIndicator.vue — 步骤指示器
├── frontend/components/enterprise/AgentSelector.vue — AI员工选择卡片
├── frontend/components/enterprise/ChannelConnector.vue — 渠道连接卡片
├── frontend/guards/enterprise-onboarding.ts     — 路由守卫
└── backend/src/routes/enterprise-setup.ts        — Setup API（如需拆分）

不新增：
├── 数据库表（全部使用现有表）
├── Runtime Service（全部使用现有服务）
└── Gateway Modification
```

### 6.4 验收标准 — Ch6

| # | 测试 | 通过条件 |
|---|------|----------|
| AC6.1 | 实现 Phase 4.1 后 | `channel.adapter.ts` 代码无变化 |
| AC6.2 | 实现 Phase 4.1 后 | `agent-scheduler.runtime.ts` 代码无变化 |
| AC6.3 | 实现 Phase 4.1 后 | 数据库Migration数量为0 |
| AC6.4 | 实现 Phase 4.1 后 | `scripts/check-constitution.sh` 全部Phase 3 Runtime检查通过 |

---

## Ch7 — GO Gate

### 7.1 Product Gate

**问题**：客户能否自己创建AI部门？

**通过标准**：

| 测试项 | 条件 | 权重 |
|--------|------|------|
| Setup Wizard 完整流程 | 注册 → Setup → CEO驾驶舱（自有数据） | 必须 |
| 首次激活时间 | ≤5分钟 | 必须 |
| AI员工选择 | 至少1个员工可选/可禁用 | 必须 |
| 企业身份保存 Setup Wizard 完成后 | CEO驾驶舱头部显示企业名称 | 必须 |
| 用户感知测试 | 用户能明确回答"我的AI员工是谁" | 建议 |

**判定**：全部"必须"通过 → Product Gate PASS

### 7.2 Architecture Gate

**问题**：是否保持 Phase 3 Runtime 冻结？

**通过标准**：

| 检查项 | 条件 |
|--------|------|
| Phase 3 Runtime 代码变动 | 0 文件修改 |
| 数据库Migration | 0 新增表 |
| Gateway Protocol | 0 新增 Gateway 协议 |
| Channel Adapter | 0 修改 |
| Agent Scheduler | 0 修改 |
| 新增组件位置 | 仅限前端页面 + API Route |

**判定**：全0 → Architecture Gate PASS

### 7.3 Trust Gate

**问题**：用户看到的数据是否属于自己？

**通过标准**：

| 测试项 | 条件 | 权重 |
|--------|------|------|
| Demo数据不出现在用户租户 | 用户A的Dashboard永远没有Tesla数据 | 必须 |
| 所有API按租户过滤 | `WHERE tenantId = :currentTenant` 覆盖率100% | 必须 |
| 渠道状态真实 | 默认Mock `connected: true` 已移除 | 必须 |
| ROI三分离保持 | AI投入/已产生/预测 不混淆 | 必须 |
| 线索来源可追溯 | 每个Lead有evidence chain | 建议 |

**判定**：全部"必须"通过 → Trust Gate PASS

### 7.4 GO Gate 决策矩阵

| Gate | 权重 | 通过条件 |
|------|------|----------|
| Product Gate | 33% | 客户自己创建AI部门 |
| Architecture Gate | 33% | Phase 3 Runtime 零修改 |
| Trust Gate | 34% | 数据100%用户自有 |

**最终决策**：
- 全部 PASS → Phase 4.1 Implementation Authorized
- 任一 FAIL → 返工 Spec，重新 Review

---

## Appendix A — 术语表

| 术语 | 含义 |
|------|------|
| Activation Layer | Phase 4.1 新增层，负责将陌生用户转化为拥有AI租户的客户 |
| Tenant Birth | 从"用户"到"企业租户"的创建过程 |
| Onboarding Guard | Enterprise进入路由守卫，检测企业是否已初始化 |
| Setup Wizard | 5步初始化引导页面 |
| Demo Isolation | Tesla Demo数据与真实客户数据的隔离机制 |
| Trust Gate | Phase 4.1 特有的验收门，验证数据归属 |
| Reality Layer | 区分Demo环境和生产环境的系统层 |

---

## Appendix B — 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Setup Wizard 用户放弃 | 中 | 中 | 保存进度，断点续填 |
| Demo 数据未完全隔离 | 低 | **极高** | AC4.1-4.5 强验证 |
| 用户不理解"连接渠道"vs"已连接" | 中 | 中 | 清晰文案 + tooltip |
| Onboarding Guard 误判 | 低 | 低 | 手动跳过机制 |

---

## Appendix C — 后续阶段（不启动）

- **Phase 4.1.1**: Setup Wizard + Onboarding Guard (P0)
- **Phase 4.1.2**: Demo isolation (P0)
- **Phase 4.1.3**: Channel Activation (P1, 依赖真实OAuth)
- **Phase 4.3**: Decision Intelligence (不启动)

---

*Spec v1.0 DRAFT · P4.1-SPEC-V1 · CTO Review Required · NO CODE*
