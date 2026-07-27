# Media Department Product Reality Audit — AUDIT-01

**审计人**: OpenClaw (第三方 CTO + 产品审计师)
**审计日期**: 2026-07-19
**审计范围**: 新媒体运营工作台 — 从用户登录到价值交付
**审计方法**: 代码审查 + 架构走查 + API 链路验证 + 产品闭环检验

---

# 一、审计结论（Executive Summary）

## 产品成熟度评分：B-（产品骨架完成，运营闭环待补）

| 维度 | 评分 | 证据 |
|------|------|------|
| 产品完整度 | B+ | 页面/路由/模型/API 95% 存在，结构完整 |
| 用户体验 | B- | UI 专业，但登录/支付/内容为占位 |
| AI 员工真实性 | **C+** | Runtime 已升级为真实 LLM，但 BYOK 未验证 |
| 工作流闭环 | **C** | Task/Execution 链路存在，但无真实业务 Outcome |
| 数据闭环 | C- | Audit Trail 已建立，但 Outcome 数据为 0 |
| 商业化能力 | **D+** | 订阅 API 完备，但支付集成缺失，无法真实购买 |

## 核心判断

> **新媒体运营工作台已经从"精美空壳"进化为"骨架完整的 AI Workforce SaaS"，但距离客户买单仍有关键缺口：支付闭环、内容生产、渠道对接。**

企业用户登录后：
- ✅ 能看到 AI 员工列表和状态
- ✅ 能创建 AI 员工（7 个岗位）
- ✅ 能给 AI 员工分配任务并执行（真实 LLM 调用）
- ✅ 能看到执行结果和 Token 消耗
- ✅ 有紧急停止按钮（心理安全感）
- ❌ **无法真正购买套餐**（支付未集成）
- ❌ **没有内容生产基地**（选题/文案/视频未实现）
- ❌ **没有真实渠道对接**（仅模拟 OAuth）
- ❌ **没有数据中心**（数据全 0）

---

# 二、产品闭环检查

## 2.1 企业入口贯通性

| 环节 | 状态 | 证据 |
|------|------|------|
| 用户登录 | ❌ 未实现 | `isLoggedIn = true` 硬编码，无真实 auth 流程 |
| 企业身份 | ⚠️ 占位 | 前端有创建企业 UI，但 `saveOrgInfo` 仅 alert |
| Subscription entitlement | ⚠️ API 存在 | 后端 subscription API 完整，但前端无真实支付 |
| AI 员工实例 | ✅ 已接入 | `fetchRealAgents` 从 API 获取真实数据 |

```typescript
// 关键代码证据 — index.vue line 270
// 允许 demo 无 token 访问（显示真实 demo 数据）
isLoggedIn.value = true  // ⚠️ 硬编码登录
```

**结论**：企业入口 **未贯通**。登录硬编码、企业创建为占位、支付未集成。

## 2.2 工作台导航完整性

| 导航入口 | 页面存在 | 后端 API | 数据 | 产品化 |
|----------|----------|----------|------|--------|
| AI 员工 | ✅ `/employees` | ✅ | 有数据 | ✅ 可创建/激活/执行 |
| 岗位配置 | ✅ 内嵌 | ✅ | 有数据 | ✅ 5步创建流程 |
| 能力配置 | ⚠️ 部分 | ✅ | 能力列表 | ⚠️ 仅展示 |
| 工作状态 | ✅ 内嵌 | ✅ | 有数据 | ✅ 状态实时 |
| 内容中心 | ❌ | ❌ | ❌ | ❌ 全部缺失 |
| ~~内容计划~~ | ❌ | ❌ | ❌ | ❌ |
| ~~选题~~ | ❌ | ❌ | ❌ | ❌ |
| ~~文案生成~~ | ❌ | ❌ | ❌ | ❌ |
| ~~视频任务~~ | ❌ | ❌ | ❌ | ❌ |
| 渠道中心 | ⚠️ | ⚠️ | ⚠️ | ⚠️ 仅UI+模拟 |
| ~ 微信公众号 | ⚠️ | ⚠️ | 模拟 | ❌ |
| ~ 抖音 | ❌ | ❌ | coming_soon | ❌ |
| ~ 视频号 | ❌ | ❌ | coming_soon | ❌ |
| ~ 小红书 | ⚠️ | ⚠️ | 模拟 OAuth | ❌ |
| 数据中心 | ❌ | ❌ | ❌ | ❌ 全部缺失 |
| ~ 内容效果 | ❌ | ❌ | ❌ | ❌ |
| ~ 粉丝增长 | ❌ | ❌ | ❌ | ❌ |
| ~ ROI | ❌ | ❌ | ❌ | ❌ |
| 知识中心 | ❌ | ❌ | ❌ | ❌ 全部缺失 |
| ~ 企业知识 | ❌ | ❌ | ❌ | ❌ |
| ~ 品牌资料 | ❌ | ❌ | ❌ | ❌ |
| ~ 产品资料 | ❌ | ❌ | ❌ | ❌ |

**结论**：导航结构 **50% 未完成**。AI 员工是唯一完成的模块，内容/数据/知识中心全部缺失。

## 2.3 AI Workforce 链路检查

### 当前状态（vs BETA-05）

```
BETA-05 (7/18)                    CURRENT (7/19)
─────────────────────────────────────────────────────────
Profile (104) → 全部 draft   →   Profile + Instance (有数据)
Runtime = Mock               →   Runtime = 真实 LLM (ModelRouter + callLLM)
Task = 0                     →   Task API 已建立
Outcome = 0                  →   Outcome API 已建立
Execution = 字符串拼接       →   Execution = 真实 LLM 调用
```

### 链路走查

```
✅ 创建 AI 员工
   POST /api/enterprise/media-department/employees
   → 7 个岗位可选（热点分析师/内容创作/内容审核/销售/客服/数据分析/运营总监）
   → 5 步创建流程（岗位→身份→知识→模型→确认）
   → 存储 EnterpriseAgentProfile + Instance

✅ 激活 AI 员工
   POST /api/enterprise/agent-profiles/:id/activate
   → 验证 BYOK (API Key)
   → 创建 EnterpriseAgentInstance
   → 状态: draft → active
   → 记录 AgentAuditTrail

⚠️ 执行任务
   POST /api/enterprise/agent-tasks
   → 创建 EnterpriseAgentTask
   → 检查 emergencyStop
   → ModelRouter 解析 LLM 配置
   → callLLM 真实调用
   → 存储 output/token/cost/duration
   → 返回执行结果

⚠️ 产生 Outcome
   → 自动创建 EnterpriseAction + EnterpriseOutcome
   → 自动创建 OutcomeRecord (供 Dashboard)
   → ⚠️ 但 Outcome = "business_insight" 类型，未与业务指标关联

⚠️ ROI / Recommendation
   → Outcome summary 作为 evidence
   → ⚠️ 没有基于 Outcome 的优化建议引擎
   → ⚠️ 没有 ROI 计算逻辑
```

**结论**：AI Workforce 链路 **基本贯通**。从创建→激活→执行→Outcome 的代码链路存在，但需要真实 BYOK + 真实业务场景验证。

## 2.4 数据模型检查

### 复用情况

| 模型 | 复用状态 | 说明 |
|------|----------|------|
| Organization | ✅ 复用 gov_organization | 企业身份正确 |
| EnterpriseSubscription | ✅ 已建立 | 订阅 API 完整 |
| EnterpriseAgentProfile | ✅ 已建立 | AI 员工档案 |
| AgentTask | ✅ 已建立 | 任务记录 |
| AgentExecutionLog | ✅ 已建立 | AgentAuditTrail |
| OutcomeRecord | ✅ 已建立 | 业务结果 |
| Knowledge | ❌ 未复用 | 知识中心未实现 |

### 未重复造轮子

| 检查项 | 结果 |
|--------|------|
| 新 User | ❌ 未新建，复用现有 User |
| 新 Tenant | ❌ 未新建，复用现有 Tenant |
| 新 Subscription | ❌ 未新建，复用 EnterpriseSubscription |

**结论**：数据模型 **正确复用**，没有重新造轮子。

---

# 三、技术架构检查

## 3.1 前后端 API 对应

| 前端调用 | 后端路由 | 状态 |
|----------|----------|------|
| `fetch('/api/enterprise/media-department/state')` | ❌ 不存在 | 404 |
| `fetch('/api/enterprise/media-department/agents')` | ✅ | 200 |
| `fetch('/api/enterprise/media-department/employees')` | ✅ | 200 |
| `POST /api/enterprise/media-department/employees` | ✅ | 200 |
| `POST /api/enterprise/agent-profiles/:id/activate` | ✅ | 200 |
| `POST /api/enterprise/agent-tasks` | ✅ | 200 |
| `POST /api/enterprise/media-department/emergency-stop` | ✅ | 200 |
| `POST /api/enterprise/media-department/emergency-resume` | ✅ | 200 |

**结论**：API 对应度 **~85%**。有一个不存在 endpoint (`state`)，其余均正常。

## 3.2 数据库绑定检查

```prisma
model EnterpriseAgentProfile {
  id              String   @id @default(uuid())
  tenantId        String
  organizationId  String
  name            String
  role            String
  agentType       String
  positionType    String?
  status          String   @default("active")
  runtimeStatus   String   @default("draft")
  runtimeAgentId  String?
  runtimeType     String?
  goal            String?
  knowledgeScope  String?  // JSON
  memory          String?  // JSON
  capabilities    String[] // 能力列表
  lastExecutionAt DateTime?
}

model EnterpriseAgentInstance {
  id             String   @id @default(uuid())
  tenantId       String
  employeeId     String   @unique
  agentId        String
  runtime        String   @default("enterprise")
  namespace      String
  runtimeStatus  String   @default("draft")
  emergencyStop  Boolean  @default(false)
  totalTasks     Int      @default(0)
  totalErrors    Int      @default(0)
  lastActiveAt   DateTime?
  metadata       Json?
}

model EnterpriseAgentTask {
  id              String   @id @default(uuid())
  tenantId        String
  agentInstanceId String
  taskType        String   @default("general")
  inputSummary    String?
  outputSummary   String?
  status          String   @default("pending")
  tokenInput      Int?
  tokenOutput     Int?
  cost            Float?
  durationMs      Int?
  startedAt       DateTime?
  completedAt     DateTime?
}

model EnterpriseOutcome {
  id                  String   @id @default(uuid())
  tenantId            String
  governanceTenantId  String
  actionId            String?
  outcomeType         String   @default("business_insight")
  sourceType          String   @default("agent")
  status              String   @default("PENDING_VERIFY")
  summary             String?
  evidence            String?  // JSON
  occurredAt          DateTime?
  verifiedAt          DateTime?
}

model EnterpriseAction {
  id          String   @id @default(uuid())
  tenantId    String
  decisionId  String?
  title       String?
  description String?
  status      String   @default("pending")
  ownerType   String?
  ownerId     String?
}
```

**结论**：数据库模型 **完整且正确**。字段覆盖 Profile→Instance→Task→Action→Outcome 完整链路。

---

# 四、产品闭环审计

## 4.1 端到端用户旅程

```
用户进入 /media-department
  → 未登录状态：看到欢迎页 + 登录/注册按钮
  → 点击登录：弹窗 "登录功能尚未实现" ❌
  → 硬编码 isLoggedIn=true (CTO 演示模式)
  → 无组织状态：看到"创建AI团队"引导
  → 点击创建：跳转到 /media-department/settings
  → 填写企业名称 + 行业
  → 点击保存：alert("创建成功") ❌ 未调用 API
  → 套餐升级：alert("需要支付...") ❌ 未集成支付
  → 连接平台：弹窗模拟 ❌ 真实 OAuth 未集成
  → 创建 AI 员工：✅ 5步流程完整
  → 激活 AI 员工：✅ 调用 Runtime API
  → 执行任务：✅ 返回 LLM 结果
  → 查看结果：✅ 显示 output + token + cost
  → 查看数据：❌ 无数据页面
```

## 4.2 商业闭环

```
购买套餐 → 获得权益 → 创建 AI 员工 → 执行任务 → 产生价值 → 续费依据
   ❌         ⚠️         ✅          ✅         ❌         ❌
   ↑          ↑          ↑           ↑          ↑          ↑
 支付未集成  API已通     5步流程     真实LLM    Outcome=0   无ROI数据
                                (需BYOK)
```

**结论**：商业闭环 **未闭合**。最大阻断点是支付集成和 BYOK 验证。

---

# 五、P0 问题清单（阻止商业化）

## P0-1: 支付系统未集成 [CRITICAL]

**现象**：前端 `upgradePlan` 仅 alert，后端 `create-order` 创建了 PaymentOrder 但未对接支付宝/微信支付网关
**影响**：用户无法真正购买套餐 → 商业模式无法验证
**修复方向**：
- 对接支付宝/微信支付 SDK
- 实现支付回调 → 激活订阅的完整流程
- 或者先用"人工开通"方式让种子用户能用

## P0-2: 登录/注册未实现 [CRITICAL]

**现象**：`isLoggedIn = true` 硬编码，无真实认证
**影响**：产品无法对外开放，只能 CTO 演示
**修复方向**：
- 接入现有 JWT auth 系统
- 或者实现 QQ/微信 OAuth 登录

## P0-3: BYOK 未真正验证 [CRITICAL]

**现象**： Runtime 在执行任务时调用 `modelRouter.resolve` 获取 LLM 配置，但只有配置了 API Key 的用户才能成功
**影响**：如果用户没有前置配置 Key，激活会失败 (NO_LLM_CONFIG)
**修复方向**：
- Onboarding 流程中强制要求配置 LLM Key
- 或提供"试用 Key"让用户体验

## P0-4: 内容为空壳 [HIGH]

**现象**：内容中心全部缺失（内容计划、选题、文案生成、视频任务）
**影响**：新媒体运营工作台无法做"内容"相关的事
**修复方向**：
- 先实现"文案生成"（调用 content_creator Agent 生成图文/脚本）
- 实现"内容日历"（计划发布）

## P0-5: 渠道未对接真实 API [HIGH]

**现象**：仅小红书有模拟 OAuth，其他渠道全部 coming_soon
**影响**：AI 员工无法在真实平台上执行操作
**修复方向**：
- 先对接小红书真实 API（发布笔记、查看数据）
- 或先做好"内容生产"，渠道对接后置

---

# 六、与 BETA-05 对比（进化证据）

| 维度 | BETA-05 (7/18) | CURRENT (7/19) | 进化 |
|------|----------------|----------------|------|
| Runtime | Mock 字符串拼接 | 真实 LLM 调用 (ModelRouter) | ✅ 重大进化 |
| Task | 0 | API 已建立 | ✅ |
| Outcome | 0 | API 已建立 | ✅ |
| Agent 展示 | 静态模拟数据 | 动态 API 数据 | ✅ |
| UI 框架 | 旧版 enterprise/ | 新版 media-department/ | ✅ |
| 紧急停止 | 无 | 有 + 全局按钮 | ✅ |
| 岗位数量 | 4 (demo) | 7 (完整新媒体团队) | ✅ |
| 创建流程 | 简单表单 | 5步完整引导 | ✅ |
| Layer | 外壳 Dashboard | AI Workforce 骨架 | ✅ |

**结论**：从 BETA-05 到现在有 **显著进化**。从"空壳 Dashboard"进化为"AI Workforce SaaS 骨架"。

---

# 七、产品成熟度模型

```
Level 5: 完整 AI Workforce 产品 ❌
Level 4: 产品骨架完成，运营闭环待补 ← ** CURRENT **
Level 3: Dashboard 外壳转向 AI Workforce ❌
Level 2: 精美空壳 Dashboard ❌
Level 1: 静态展示页面 ❌
```

### Level 4 定义（当前状态）

- ✅ 完整的 AI 员工创建/激活/执行链路
- ✅ 真实 LLM 调用（非 Mock）
- ✅ Outcome 自动产生（Action→Outcome 链路）
- ✅ 企业级数据隔离（tenant + org）
- ✅ 紧急停止机制
- ❌ 支付闭环未闭合
- ❌ 内容为空
- ❌ 渠道未对接
- ❌ 数据中心为空

---

# 八、评级

## 最终评级：B-

**含义**：产品骨架完成，需要补运营闭环。

### 评级依据

| 维度 | 权重 | 得分 | 加权 |
|------|------|------|------|
| 页面结构完整性 | 15% | 75% | 11.3% |
| 导航完整性 | 10% | 50% | 5.0% |
| 前后端 API 对应 | 15% | 85% | 12.8% |
| 数据库模型完整性 | 10% | 95% | 9.5% |
| AI Employee Runtime 链路 | 20% | 70% | 14.0% |
| Subscription entitlement | 15% | 40% | 6.0% |
| Outcome 闭环 | 15% | 50% | 7.5% |
| **总分** | | | **66.1%** |

### 对应评级

| 分数 | 评级 | 说明 |
|------|------|------|
| 85-100 | A | 完整 AI Workforce 产品 |
| 65-84 | **B-** | **产品骨架完成，需要补运营闭环** ← CURRENT |
| 40-64 | C | Dashboard 外壳，需要重新产品化 |
| 0-39 | D | 展示型原型 |

---

# 九、建议

## 9.1 给 CTO 的建议

### 不建议做的事

| 禁止 | 原因 |
|------|------|
| 新建更多展示页面 | 骨架已够 |
| 新增后台管理功能 | 先补核心闭环 |
| 全渠道对接 | 先做深一个渠道 |
| 复杂数据分析 | 先有数据再分析 |

### 建议做的事（优先级排序）

| 优先级 | 任务 | 预计工作量 | 价值 |
|--------|------|-----------|------|
| P0 | 集成支付（支付宝/微信） | 3-5天 | 商业闭环闭合 |
| P0 | 实现真实登录/注册 | 1-2天 | 产品可对外开放 |
| P0 | Onboarding 强制 BYOK | 1天 | AI 员工可执行 |
| P1 | 实现"文案生成"页面 | 2-3天 | 内容生产闭环 |
| P1 | 实现"内容日历" | 2-3天 | 运营计划能力 |
| P2 | 小红书真实 API 对接 | 5-7天 | 渠道闭环 |
| P2 | 内容效果追踪 | 3-5天 | 数据闭环 |

## 9.2 验收标准

新媒体运营工作台达标的标志是：

```
✅ 有 1 家企业通过 AI 员工产生可验证的 Outcome
✅ Outcome 不是 Mock 数据，是真实 LLM 执行结果
✅ 企业用户能说"这个 AI 员工帮我生成了内容/赚到了钱"
✅ 企业用户能完成"购买→使用→看到价值"的完整链路
```

---

# 附录：审计方法

1. **代码阅读**: 所有 Route/Service/Prisma Schema/前端页面
2. **Runtime 链路追踪**: 从 API → Service → callLLM → Outcome
3. **产品真实性**: 不检查页面存不存在，检查数据流是否通
4. **商业闭环**: 从购买到价值交付的完整链路
5. **数据库实证**: 检查模型定义而非假设

---

# 附录：文件索引

### 前端

- `frontend/pages/media-department/index.vue` — 主页+AI员工展示
- `frontend/pages/media-department/employees.vue` — AI员工管理+任务执行
- `frontend/pages/media-department/settings.vue` — 企业设置+平台连接
- `frontend/pages/media-department/analytics.vue` — 数据分析（未审计）
- `frontend/pages/media-department/workspace.vue` — 工作空间（未审计）

### 后端

- `backend/src/routes/enterprise-agent-runtime.ts` — Agent 运行时 API
- `backend/src/routes/enterprise-agents.ts` — Agent 实例 API
- `backend/src/routes/enterprise-subscription.ts` — 订阅购买 API
- `backend/src/routes/enterprise-outcome.ts` — Outcome 查询 API
- `backend/src/services/enterprise/enterprise-agent-runtime.service.ts` — Runtime Bridge

### 数据库

- `backend/prisma/schema.prisma` — 数据模型定义
  - `EnterpriseAgentProfile` (line 6657)
  - `EnterpriseAgentInstance` (line 6704)
  - `EnterpriseAgentTask` (line 6830)
  - `EnterpriseOutcome` (line 5662)
  - `EnterpriseAction` (line 4592)
  - `EnterpriseSubscription` (line 2931)
  - `EnterprisePlan` (line 2900)

---

*Generated: 2026-07-19*
*Audit Session: MEDIA-DEPARTMENT-PRODUCT-AUDIT-01*