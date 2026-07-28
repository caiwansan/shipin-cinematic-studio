# 🔍 企业招聘工作台 SSOT 深度审计报告 (2026-07-28)

**项目**: 昆仑镜 — 企业招聘工作台
**审计目标**: 找出所有重复真相源，确定唯一生产路径，删除废弃模板/旧模型/旧 API/旧页面
**审计范围**: Prisma Schema → Backend Routes → Frontend Pages → API 全链路

---

## 一、SSOT Gate 总表

| # | 模块 | 现状 | 结论 |
|---|------|------|------|
| 1 | 🏢 Workspace | 2 套模型，但为分层关系（平台通用 + 招聘专用） | ⚠️ 注意一致性 |
| 2 | 👤 Member 身份 | `EnterpriseMember` 已废弃迁移到 `OrgMember`，但 **6 处代码仍在使用** | ❌ 未通过 |
| 3 | 📋 Candidate 数据 | 3 套模型，2 套已标记废弃，但 **代码中仍有 5+ 处写操作** | ❌ 未通过 |
| 4 | 📄 JobPosting | `JobPosting` 是唯一生产模型 ✅ | ✅ 通过 |
| 5 | 🧩 招聘模板 | **无招聘专用模板**（仅通用 PromptTemplate/ImagePromptTemplates） | ✅ 通过 |
| 6 | 🤖 AI Provider | 单入口 `EnterpriseLlmConfig` | ✅ 通过 |
| 7 | 🕵️ Agent Identity | 2 套体系（`EnterpriseAgentProfile` + `HermesProfileBinding`） | ⚠️ 注意 |
| 8 | 🚪 页面入口 | **3 套入口群并存** — 客户入口有重复 | ❌ 未通过 |
| 9 | 💰 Plan/Subscription | **3 套模型体系** | ❌ 未通过 |

**总评**: 9 项中通过 3 项，2 项部分通过，**4 项未通过**。

---

## 二、Workspace 真相审计

### 模型对比

| 模型 | 行号 | 用途 | 状态 |
|------|------|------|------|
| `Workspace` | 3011 | 通用平台工作空间 (Project/Storyboard/Asset) | ✅ 保留 |
| `EnterpriseJobWorkspace` | 7627 | **企业招聘工作空间** (岗位/候选人/面试) | ✅ 保留 |

### 谁用谁？

```
Workspace (通用)
  ├─ Project (workspaceId → Workspace)
  ├─ Storyboard
  ├─ Asset
  └─ 通用 platform workspace routes

EnterpriseJobWorkspace (招聘专用)
  ├─ JobPosting
  ├─ RecruitmentPipeline
  ├─ InterviewSession
  ├─ CandidateNote
  ├─ Resume
  └─ RecruitmentPlan
```

### 关键问题

两者不是竞争关系，是分层关系。但存在一个**一致性风险**：

```
EnterpriseJobWorkspace.workspaceId  →  是否等于 Workspace.id？
```

看 Prisma：

```prisma
model EnterpriseJobWorkspace {
  id          String    @id                    // 【独立 ID】
  workspaceId String?                          // 【引用 Workspace.id】
  ...
}
```

`workspaceId` 字段表明设计意图：一个 `EnterpriseJobWorkspace` 关联一个通用 `Workspace`。**但如果这个关联不一致，企业工作台的数据会出问题。**

### 后端 Routes 引用分布

所有招聘路由都引用 `EnterpriseJobWorkspace`：
- `enterprise.routes.ts` ✅
- `job-posting.routes.ts` ✅
- `pipeline.routes.ts` ✅
- `interview.routes.ts` ✅
- `talent.routes.ts` ✅
- `resume.routes.ts` ✅
- `enterprise-dashboard.routes.ts` ✅

### 决策

| 模型 | 应保留 | 原因 |
|------|--------|------|
| `Workspace` | ✅ | 平台级基础，非招聘专属 |
| `EnterpriseJobWorkspace` | ✅ | 招聘专用业务空间 |

**⚠️ 需要验证**: `EnterpriseJobWorkspace.workspaceId` 和 `Workspace.id` 在 onboarding 流程中是否一致。

---

## 三、Member 身份审计

### 模型对比

| 模型 | 行号 | 状态 |
|------|------|------|
| `OrgMember` | 2999 | ✅ **生产 SSOT** |
| `EnterpriseMember` | 7608 | ❌ `@deprecated "EnterpriseMember replaced by OrgMember"` |

### 现状：✅ 模型层已正确

Prisma schema 明确标注：
```prisma
@@deprecated "Sprint 12: EnterpriseMember replaced by OrgMember as single source of truth
              for organization membership. EnterpriseMember retained for historical data
              only — no new writes. Use prisma.orgMember.create() instead."
```

### 但代码中仍有 6 处实际引用

#### 还在读写的文件（需立即清理）：

| 文件 | 行 | 操作 | 风险 |
|------|----|------|------|
| `src/routes/enterprise-onboarding.routes.ts` | 345 | `tx.enterpriseMember.create()` | **创建新记录** |
| `src/routes/enterprise-job-intelligence.routes.ts` | 30 | `prisma.enterpriseMember.findFirst()` | 读旧表 |
| `src/routes/llm-config.ts` | 99/146 | `(prisma as any).enterpriseMember.findFirst()` | 读旧表 |
| `src/services/enterprise-context.service.ts` | 52 | `prisma.enterpriseMember.findFirst()` | 读旧表 |
| `src/middleware/require-capability.ts` | 40 | `EnterpriseMember` 注释提及 | 代码逻辑 |
| `src/seeds/p4-validation-02.ts` | 46/50/51 | 种子数据还在用旧表 | 种子数据 |

#### 严重问题：`enterprise-onboarding.routes.ts:345` 仍在**写入** `EnterpriseMember`！

```typescript
await tx.enterpriseMember.create({...})  // ← 还在写入废弃模型！
```

这意味着：
1. 新注册企业的用户仍然写入 `EnterpriseMember` 表
2. `OrgMember` 表可能根本没创建记录
3. 两个表数据不一致 — 新用户只有旧表数据

### 决策

| 模型 | 应保留 | 操作 |
|------|--------|------|
| `OrgMember` | ✅ | **SSOT** — 所有新代码必须走这个 |
| `EnterpriseMember` | ❌ | **删除** — 或冻结所有写入，迁移存量数据到 `OrgMember` |

### 🔴 风险等级: P0

> **需要立即修复**: `enterprise-onboarding.routes.ts` 必须改为写入 `OrgMember` 而非 `EnterpriseMember`。然后迁移存量 `EnterpriseMember` 数据到 `OrgMember`。

---

## 四、Candidate 模型真相审计

### 模型对比

| 模型 | 行号 | Prisma 标注 | 实际使用 |
|------|------|------------|---------|
| `CareerProfile` | 8339 | 无废弃标记 — **SSOT** | `career-profile.repository.ts` 是唯一写入入口 |
| `JobCandidate` | 7936 | **`@deprecated`** "Use CareerProfile" | **5 处代码还在读写** |
| `TalentProfile` | 7956 | **`@deprecated`** "Use CareerProfile" | **4 处代码在读写** |

### 代码引用情况

**`CareerProfile` (SSOT) → 正确使用:**
- `services/candidate/repositories/career-profile.repository.ts` ✅
- `services/candidate/routes/candidate-card.routes.ts` ✅
- `services/candidate/routes/candidate-profile.routes.ts` ✅

**`JobCandidate` (废弃但仍在使用):**
- `routes/enterprise-job-intelligence.routes.ts:175` — `prisma.jobCandidate.findMany()`
- `routes/enterprise.routes.ts:224` — `prisma.jobCandidate.findMany()`
- `routes/talent.routes.ts:402` — `prisma.jobCandidate.findMany()`
- `routes/job.routes.ts:54` — `prisma.jobCandidate.findFirst()`
- `routes/job.routes.ts:163` — `prisma.jobCandidate.findFirst()`
- `routes/job.routes.ts:365` — `prisma.jobCandidate.findFirst()`

`job.routes.ts` 中有注释说"停止新数据写入"但代码注释掉的是 `create/update`，**读操作还在持续使用**。

**`TalentProfile` (废弃但仍在使用):**
- `routes/talent.routes.ts:93/98` — `prisma.talentProfile.findFirst()` + `create()` 
- `routes/talent.routes.ts:210` — `prisma.talentProfile.findUnique()`
- `routes/talent.routes.ts:447` — `prisma.talentProfile.findMany()`

### 决策

| 模型 | 应保留 | 操作 |
|------|--------|------|
| `CareerProfile` | ✅ | SSOT — 所有新候选人数据走这个 |
| `JobCandidate` | ❌ | 删除模型 + 迁移存量数据 |
| `TalentProfile` | ❌ | 删除模型 + 迁移存量数据 |

### 建议的 Candidate 唯一链路

```
CareerProfile
   ↓
CandidateResume, WorkExperience, Education, Skill
   ↓
CandidateCard (featured/selection card projection)
   ↓
JobApplication (通过 CareerProfile.userId → JobPosting)
   ↓
InterviewSession, InterviewEvaluation
```

### 🟠 风险等级: P1

> 代码中仍然有大量对 `JobCandidate` 和 `TalentProfile` 的读写操作。注释说"停止新数据写入"但实际 `talent.routes.ts:98` 还在 `create()`。

---

## 五、Job 模型真相审计

### 模型对比

| 模型 | 行号 | 用途 | 状态 |
|------|------|------|------|
| `Job` | 2640 | **通用任务/作业** (Pipeline Job = 后台异步任务) | ✅ 不冲突 |
| `JobPosting` | 7835 | **招聘岗位** — 企业发布的职位 | ✅ 唯一生产模型 |

### 确认：两者不是重复关系

```prisma
// Job — 后台异步任务（视频渲染、AI生成等）
model Job {
  id        String   @id
  projectId String?
  type      String   // 任务类型
  status    String   // running/completed/failed
  ...
}

// JobPosting — 招聘岗位
model JobPosting {
  id          String   @id
  workspaceId String
  title       String
  department  String
  description String?
  tags        String[]
  skillRequirements String?
  ...
}
```

**结论**: `Job` 是后台任务系统，`JobPosting` 是招聘岗位。名字相似但领域完全不同，无需合并。

### 后端引用

所有招聘路由只引用 `JobPosting` ✅
- `job-posting.routes.ts` → `prisma.jobPosting.*`
- `enterprise.routes.ts` → `prisma.jobPosting.*`
- `enterprise-dashboard.routes.ts` → `prisma.jobPosting.*`
- `interview.routes.ts` → `prisma.jobPosting.*`
- `recruitment-analytics.routes.ts` → `prisma.jobPosting.*`

### 决策

| 模型 | 应保留 | 原因 |
|------|--------|------|
| `Job` | ✅ | 后台任务系统 |
| `JobPosting` | ✅ | 招聘岗位系统 — **唯一 SSOT** |

✅ **通过**

---

## 六、招聘模板系统审计

### 扫描结果

后端 Prisma 中与"模板"相关的模型：

| 模型 | 行号 | 用途 | 与招聘相关？ |
|------|------|------|------------|
| `ImagePromptTemplates` | 253 | 图片提示词模板 | ❌ |
| `PromptTemplate` | 653 | 通用提示词模板 | ❌ |
| `WorkflowTemplate` | 5376 | 工作流模板 | ❌ |
| `LegalContractTemplate` | 6592 | 法务合同模板 | ❌ |
| `LegalDocumentTemplate` | 6604 | 法务文档模板 | ❌ |
| `LegalCaseTemplate` | 6644 | 法务案例模板 | ❌ |

**结论**: **招聘领域没有独立的 Template 模型**。招聘 JD 生成、面试问题的模板通过 LLM prompt + `JobPosting` 字段直接生成，不需要单独的模板表。

### 前端模板文件

搜索 `*template*` 文件路径，**未找到招聘相关的前端模板组件**。

### 决策

✅ **招聘领域无重复模板问题**，通过。

---

## 七、AI Provider 配置审计

### 模型

```prisma
model EnterpriseLlmConfig {
  id              String   @id
  enterpriseId    String
  provider        String   // deepseek, openai, etc.
  apiKey          String
  baseUrl         String?
  model           String?
  ...
}
```

### 引用分布

- `routes/enterprise-intelligence.ts` ✅
- `services/enterprise-context.service.ts` ✅
- `routes/llm-config.ts` — 也引用 `EnterpriseMember`（需修复，见第三章）

### 决策

✅ **单入口 `EnterpriseLlmConfig`**，通过。

---

## 八、Agent Identity 审计

### 模型

```prisma
model EnterpriseAgentProfile {   // 6707 — 企业 AI 员工模板/身份定义
  id            String   @id
  enterpriseId  String
  name          String
  role          String   // recruiter / interviewer / talent-agent
  config        Json?
  llmConfigId   String?
  ...
}

model HermesProfileBinding {      // 6784 — Hermes 子代理绑定
  id             String   @id
  agentProfileId String
  hermesId       String
  ...
}

model EnterpriseAgentInstance {   // 6751 — 运行实例
  id            String   @id
  profileId     String
  status        String
  config        Json?
  ...
}
```

### 发现：两层体系

```
EnterpriseAgentProfile (模板/身份)
  └─ HermesProfileBinding (Hermes 子代理绑定)
      └─ EnterpriseAgentInstance (运行实例)
```

**但是也有独立的 Agent 路由系统**：

```
routes/enterprise-agent-profiles.ts
routes/enterprise-agent-runtime.ts
routes/enterprise-agents.ts
routes/enterprise-talent-agent.ts
routes/enterprise-interview-agent.ts
```

vs

```
routes/platform/agent/  (平台级 Agent)
routes/agent-plan.ts
routes/agent-daily-report.ts
routes/agent-identity.ts
```

### 决策

| 模型 | 应保留 | 原因 |
|------|--------|------|
| `EnterpriseAgentProfile` | ✅ | 企业 AI 员工身份定义 |
| `HermesProfileBinding` | ✅ | Hermes 子代理绑定 |
| `EnterpriseAgentInstance` | ✅ | 运行实例 |

⚠️ **注意**: 平台级 Agent (`routes/platform/agent/*`) 和企业级 Agent 之间的路由边界需要明确。两者是否共享同一个 Hermes 运行时？

### 🟡 风险等级: P2

> 建议确认 `routes/platform/agent/` 没有直接操作企业招聘 Agent 的数据。

---

## 九、页面入口审计

### 发现：三套客户入口

#### 入口 A: `/enterprise/*` (25 个页面)
```
pages/enterprise/index.vue          → 仪表盘
pages/enterprise/dashboard.vue      → 仪表盘
pages/enterprise/agents.vue         → AI 员工
pages/enterprise/agent/[id].vue     → 员工详情
pages/enterprise/approval.vue       → 审批
pages/enterprise/channels.vue       → 渠道
pages/enterprise/decisions.vue      → 决策
pages/enterprise/execution.vue      → 执行
pages/enterprise/governance.vue     → 治理
pages/enterprise/growth.vue         → 增长
pages/enterprise/health.vue         → 健康
pages/enterprise/intelligence.vue   → 情报
pages/enterprise/knowledge.vue      → 知识库
pages/enterprise/leads.vue          → 线索
pages/enterprise/leads/[id].vue
pages/enterprise/payment.vue        → 支付
pages/enterprise/people.vue         → 人员
pages/enterprise/pricing.vue        → 定价
pages/enterprise/provider-settings.vue → 提供商设置
pages/enterprise/roi.vue            → ROI
pages/enterprise/sales.vue          → 销售
pages/enterprise/settings.vue       → 设置
pages/enterprise/setup.vue          → 设置向导
pages/enterprise/tasks.vue          → 任务
pages/enterprise/intro.vue          → 介绍页
```

#### 入口 B: `/workspace/enterprise/*` (18 个页面)
```
pages/workspace/enterprise/index.vue            → 企业工作台首页
pages/workspace/enterprise/analytics.vue        → 分析
pages/workspace/enterprise/automation.vue       → 自动化
pages/workspace/enterprise/billing.vue          → 账单
pages/workspace/enterprise/capability.vue       → 能力
pages/workspace/enterprise/conversations.vue    → 对话
pages/workspace/enterprise/interview.vue        → 面试列表
pages/workspace/enterprise/interview/[id].vue   → 面试详情
pages/workspace/enterprise/interview/create.vue → 创建面试
pages/workspace/enterprise/jobs.vue             → 岗位
pages/workspace/enterprise/talent.vue           → 人才
pages/workspace/enterprise/candidates/[id].vue  → 候选人
pages/workspace/enterprise/onboarding.vue       → 引导
pages/workspace/enterprise/renewal.vue          → 续费
pages/workspace/enterprise/AgentCapabilityCenter.vue → 代理能力中心
pages/workspace/enterprise/billing.vue
pages/workspace/enterprise/automation.vue
pages/workspace/enterprise/analytics.vue
```

#### 入口 C: `/workspace/recruitment/*` (6 个页面)
```
pages/workspace/recruitment/index.vue          → 招聘首页
pages/workspace/recruitment/jobs/create.vue    → 创建岗位
pages/workspace/recruitment/matches/index.vue  → 匹配
pages/workspace/recruitment/onboarding.vue     → 引导
pages/workspace/recruitment/pipeline.vue       → 管道
pages/workspace/recruitment/resumes/index.vue  → 简历
```

#### 管理后台入口

```
/workspace/enterprise/*          → 客户侧工作台
/workspace/recruitment/*         → 客户侧招聘工作台
```

```
pages/admin/enterprise/*         → 企业管理后台 (7 pages)
pages/admin/recruitment/*        → 招聘管理后台 (15 pages)
```

### 核心问题

**三套客户入口并存意味着什么？**

| 入口 | 前端路由 | 后端 API | 数据模型 | 是否应该保留 |
|------|---------|---------|---------|------------|
| `/enterprise/*` | 旧入口 (可能有) | 可能用旧 API | EnterpriseJobWorkspace | ❌ 删除 |
| `/workspace/enterprise/*` | 工作台统一入口 | EnterpriseJobWorkspace | ✅ 保留 |
| `/workspace/recruitment/*` | 招聘专用入口 | 招聘 API | ⚠️ 需要分析 |

### 解决方案

✅ **保留 `/workspace/enterprise/*`** 作为唯一客户入口
❌ **删除 `/enterprise/*`**（旧入口，应用 middleware 重定向或删除）
❌ **删除 `/workspace/recruitment/*`**（功能应合并到 workspace/enterprise 的 RecruitmentModule）

管理后台：
✅ **保留 `/admin/enterprise/*`**（企业管理）
✅ **保留 `/admin/recruitment/*`**（招聘运营管理）

---

## 十、Plan/Subscription 体系审计

### 模型列表

| 模型 | 行号 | 用途 |
|------|------|------|
| `MemberPlan` | 811 | 个人会员计划 |
| `EnterprisePlan` | 2914 | 企业套餐定义 |
| `EnterpriseSubscription` | 2944 | 企业订阅关系 |
| `SubscriptionPlan` | 5474 | 平台通用订阅计划 |
| `Subscription` | 5495 | 平台通用订阅 |
| `RecruitmentPlan` | 8862 | 招聘计划 |
| `AgentPlan` | 1826 | 代理计划 |
| `PublishPlan` | 6006 | 发布计划 |
| `DistributionPlan` | 6126 | 分发计划 |

### 与企业招聘相关的计划体系

**体系 1: EnterprisePlan + EnterpriseSubscription**
```
EnterprisePlan → EnterpriseSubscription → EnterpriseJobWorkspace
```
- `routes/enterprise-subscription.ts`
- `routes/admin-enterprise-plans.ts`

**体系 2: SubscriptionPlan + Subscription**
```
SubscriptionPlan → Subscription → (通用)
```
- `routes/subscription.ts`
- `routes/admin-subscription-v2.ts`
- `routes/platform/governance/subscription.route.ts`

**体系 3: RecruitmentPlan**
```
RecruitmentPlan → EnterpriseJobWorkspace
```
- `routes/recruitment-campaign.routes.ts` (引用)

### 问题

`EnterpriseSubscription` 和 `RecruitmentPlan` 的关系不明确：
- 企业订阅后自动获得招聘能力？
- 还是招聘需要单独的计划？

**Prisma 中** `EnterpriseSubscription.planId` 指向的是 `EnterprisePlan`，**但** `EnterpriseJobWorkspace.subscriptionTier` 是一个字符串字段，与 `EnterprisePlan` 的 `tier` 字段可能重复定义。

### 🟠 风险等级: P1

> 建议统一为 `EnterprisePlan → EnterpriseSubscription` 体系，删除 `RecruitmentPlan` 或将 `RecruitmentPlan` 降级为 `EnterprisePlan` 的扩展字段。

---

## 十一、DELETE LIST

### 🗑️ 模型层删除

| 模型 | 行号 | 原因 | 替代者 | 影响范围 |
|------|------|------|--------|---------|
| `EnterpriseMember` | 7608 | 已有 `@deprecated`，`OrgMember` 是 SSOT | `OrgMember` | 6 处代码引用，需迁移存量数据 |
| `JobCandidate` | 7936 | 已有 `@deprecated`，`CareerProfile` 是 SSOT | `CareerProfile` | 5 处代码引用，需迁移存量 |
| `TalentProfile` | 7984 | 已有 `@deprecated` | `CareerProfile` | 4 处代码引用 |
| `RecruitmentPlan` | 8862 | 多余的计划体系 | `EnterprisePlan` | 2 处引用 |

### 🗑️ 前端页面删除

| 文件 | 原因 | 替代者 |
|------|------|--------|
| `pages/enterprise/*` (全部 25 页) | 旧入口 | `pages/workspace/enterprise/*` |
| `pages/workspace/recruitment/*` (全部 6 页) | 功能应合并入 workspace/enterprise | RecruitmentModule (workspace/enterprise) |
| `pages/workspace/enterprise/index.vue.old-backup` | 备份文件 | 无 |

### 🗑️ 后端 Route 删除/重构

| 文件 | 原因 | 操作 |
|------|------|------|
| `routes/job.routes.ts` | 仍在读写废弃 `JobCandidate` | 重构为只读 `CareerProfile` |
| `routes/talent.routes.ts` | 仍在读写废弃 `TalentProfile` | 重构为只读 `CareerProfile` |

---

## 十二、最终验收 Gate

### SSOT Gate 验证表

| 模块 | 要求 | 是否达到 |
|------|------|---------|
| 🏢 Workspace | 1 套生产 + 1 套平台基础 | ⚠️ 需验证关联一致性 |
| 👤 Member | `OrgMember` 唯一 | ❌ `EnterpriseMember` 仍在写入 |
| 📋 Candidate | `CareerProfile` 唯一 | ❌ `JobCandidate` + `TalentProfile` 仍在读写 |
| 📄 JobPosting | `JobPosting` 唯一 | ✅ 通过 |
| 🧩 Template | 无招聘模板重复 | ✅ 通过 |
| 🤖 AI Provider | `EnterpriseLlmConfig` 唯一 | ✅ 通过 |
| 🕵️ Agent | `EnterpriseAgentProfile` 唯一 | ⚠️ 注意平台路由边界 |
| 🚪 入口 | `/workspace/enterprise` 唯一客户入口 | ❌ 三套入口并存 |
| 💰 Plan | `EnterprisePlan` 唯一 | ❌ `RecruitmentPlan` 多余 |

### Reality Gate — 核心流程验证

```
用户登录 → OrgMember 身份检查 → /workspace/enterprise
  → 创建岗位 → JobPosting 写入
  → JD 生成 → LLM (EnterpriseLlmConfig)
  → 人才匹配 → CareerProfile + CandidateMatch
  → 候选人进入流程 → CareerProfile → InterviewSession
  → AI 面试助手 → EnterpriseAgentProfile (interviewer)
  → AI 员工执行 → EnterpriseAgentInstance
```

目前这条链路的问题点：
1. **用户登录后身份检查**: 走 `EnterpriseMember` 还是 `OrgMember`？当前两套都有 ✅ 但路径混淆 🟠
2. **候选人进入流程**: `JobCandidate` 还存在于 `CandidateMatch` 关联中 🛑
3. **AI 员工 Agent**: 平台级 Agent 和企业级 Agent 路由边界待确认 🟡

---

## 十三、优先级修复计划

### 🔴 P0 — 本周

| # | 项 | 估计工作量 |
|---|-----|-----------|
| 1 | `enterprise-onboarding.routes.ts` 改为写入 `OrgMember` | 0.5d |
| 2 | 迁移存量 `EnterpriseMember` → `OrgMember` | 1d |
| 3 | `talent.routes.ts:98` 删掉 `TalentProfile.create()` | 0.2d |
| 4 | 删除 `pages/enterprise/index.vue.old-backup` | 0.01d |

### 🟠 P1 — 下个 Sprint

| # | 项 | 估计工作量 |
|---|-----|-----------|
| 5 | 删除 `EnterpriseMember` 模型 + 清理 6 处代码引用 | 2d |
| 6 | 删除 `JobCandidate` 模型 + 迁移 5 处读引用到 `CareerProfile` | 2d |
| 7 | 删除 `TalentProfile` 模型 + 迁移 4 处引用 | 1d |
| 8 | 删除 `RecruitmentPlan` 模型，合并到 `EnterprisePlan` | 1d |
| 9 | 删除 `pages/enterprise/*`（25 页），改为重定向到 `workspace/enterprise` | 1d |
| 10 | 删除 `pages/workspace/recruitment/*`（6 页），合并入 workspace/enterprise | 1d |

### 🟡 P2 — 本季度

| # | 项 | 估计工作量 |
|---|-----|-----------|
| 11 | 确认 `EnterpriseJobWorkspace.workspaceId` 和 `Workspace.id` 一致性 | 0.5d |
| 12 | 确认平台 Agent 路由不操作企业招聘数据 | 0.5d |
| 13 | 统一前端 compose/middleware 引用（EnterpriseMember → OrgMember） | 1d |
| 14 | 前端 `useEnterpriseContext.ts` 等 composable 检查 Member 引用 | 0.5d |

---

## 十四、总结

**这是产品化前必须过的关，不是锦上添花。**

| 严重程度 | 数量 | 影响 |
|---------|------|------|
| 🔴 P0 — Sprint 阻塞 | **4** | 生产数据倾斜 |
| 🟠 P1 — 风险项 | **6** | 维护成本 + 潜在 Bug |
| 🟡 P2 — 清理项 | **4** | 技术债务 |

**最需要立刻动手的**:
1. `enterprise-onboarding.routes.ts` 还在写入 `EnterpriseMember` — 这是你的 P0 数据源问题
2. `talent.routes.ts` 还在创建 `TalentProfile` — 与 `CareerProfile` 重复
3. 三套客户入口并存 — 用户走错页面可能看到不同数据

**好消息**: SSOT 架构的大方向是对的（`OrgMember`、`CareerProfile`、`JobPosting`、`EnterpriseLlmConfig` 都是正确选择），只是**旧代码还没清干净**。这正是清理 Sprint 的意义。

---

_审计方: 小二 (OpenClaw)_
_2026-07-28_
