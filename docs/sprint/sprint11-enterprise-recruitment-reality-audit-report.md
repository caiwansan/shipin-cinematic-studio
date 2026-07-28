# Sprint 11 — Enterprise Recruitment Full Reality Audit Report

**审计时间**: 2026-07-28  
**审计人**: 技术总监 / 产品经理  
**审计范围**: 企业招聘全链路 — 后台套餐、Single Source of Truth、AI Workforce 数据链、代码地图、数据库 Reality  

---

## 执行摘要

| Phase | 名称 | 结论 |
|-------|------|------|
| Phase 1 | 后台招聘套餐 Reality | ⚠️ PARTIAL PASS |
| Phase 2 | Single Source of Truth 审计 | ⚠️ PARTIAL PASS |
| Phase 3 | AI Workforce 数据链 | ⚠️ PARTIAL PASS |
| Phase 4 | 全流程代码地图 | ✅ PASS |
| Phase 5 | 数据库 Reality | ⚠️ PARTIAL PASS |

**最终结论**: **CONDITIONAL GO** — 核心链路完整，但存在身份系统分裂和孤立数据风险，需在 Sprint 12 前修复 P0 问题。

---

## Phase 1: 后台招聘套餐 Reality (P0)

### 1.1 前端 `/admin/recruitment` 套餐管理功能

**状态**: ⚠️ **缺失独立套餐管理页面**

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 套餐列表页 | ❌ 缺失 | `/admin/recruitment` 下无 `plans.vue` |
| 套餐创建/编辑表单 | ❌ 缺失 | 前端无套餐 CRUD 界面 |
| 套餐启用/停用 | ❌ 缺失 | 前端无操作入口 |
| 订阅管理页 | ❌ 缺失 | 前端无订阅列表/详情页 |
| 收入看板 | ✅ 存在 | `revenue` API 有前端消费 |

**发现**: 后端 `admin-recruitment.ts` 和 `admin-enterprise-plans.ts` 均实现了套餐 CRUD API，但前端 `/admin/recruitment/` 目录下没有对应的 `plans.vue` 或 `subscriptions.vue` 页面。套餐管理功能仅能通过 API 直接调用，无运营操作界面。

### 1.2 后端 `/admin/recruitment` 套餐 CRUD

**状态**: ✅ **PASS — 双路由实现**

| 路由 | 文件 | 完整性 |
|------|------|--------|
| `GET/POST/PUT/DELETE /api/admin/recruitment/plans` | `admin-recruitment.ts` | ✅ 完整 |
| `PATCH /api/admin/recruitment/plans/:id/toggle` | `admin-recruitment.ts` | ✅ 完整 |
| `GET/GET:id/PATCH:status /api/admin/recruitment/subscriptions` | `admin-recruitment.ts` | ✅ 完整 |
| `GET/POST/PUT/DELETE /api/admin/enterprise/plans` | `admin-enterprise-plans.ts` | ✅ 完整 |
| `GET/GET:id /api/admin/enterprise/subscriptions` | `admin-enterprise-plans.ts` | ✅ 完整 |

**发现**: 套餐 CRUD 存在两套路由（`admin-recruitment.ts` 和 `admin-enterprise-plans.ts`），功能重叠。`admin-recruitment.ts` 中的实现更完整（含 toggle），而 `admin-enterprise-plans.ts` 是独立模块。需统一为单一入口。

### 1.3 Prisma 模型：EnterprisePlan / EnterpriseSubscription / EnterpriseEntitlement

**状态**: ✅ **PASS — 模型完整**

| 模型 | 表名 | 关键字段 | 状态 |
|------|------|----------|------|
| `EnterprisePlan` | `enterprise_plan` | name, displayName, price, yearlyPrice, maxEmployees, maxChannels, maxMembers, features, enabled, sortOrder | ✅ |
| `EnterpriseSubscription` | `enterprise_subscription` | organizationId, planId, status, snapshotPrice, snapshotCycle, snapshotMaxEmployees, expireAt | ✅ |
| `EnterpriseEntitlement` | `enterprise_entitlement` | organizationId, subscriptionId, maxAgents, maxChannels, maxMembers, features, status | ✅ |

**关键设计**: Subscription 使用 snapshot 字段（snapshotPrice, snapshotCycle 等）做快照冻结，避免套餐变更影响现有订阅。Entitlement 作为实时权益层，连接 Subscription 与 Agent Instance。

### 1.4 默认套餐数据

**状态**: ❌ **FAIL — 无 Seed 数据**

| 检查项 | 结果 |
|--------|------|
| `prisma/seed.ts` 中 EnterprisePlan 种子 | ❌ 无 |
| `prisma/seed-*.ts` 中套餐种子 | ❌ 无 |
| `scripts/` 中套餐初始化脚本 | ❌ 无 |
| `config/plans/` 中套餐 JSON | ⚠️ 存在 `ep-image-seedream-auto.json`（非招聘套餐） |

**风险**: 新部署环境无默认套餐数据，管理员必须手动创建套餐后才能开通企业订阅。这会导致：
1. 首次部署无法购买
2. 测试环境搭建成本高
3. 套餐配置不一致

### 1.5 购买链路完整性

**状态**: ✅ **PASS — 链路完整**

| 步骤 | API | 状态 |
|------|-----|------|
| 1. 查看套餐列表 | `GET /api/enterprise/subscription/plans` | ✅ |
| 2. 创建订阅订单 | `POST /api/enterprise/subscription/create-order` | ✅ |
| 3. 支付订单 | 复用 `PaymentOrder` + 支付回调 | ✅ |
| 4. 激活订阅 | `POST /api/enterprise/subscription/activate` | ✅ |
| 5. 创建 Entitlement | `entitlementService.createFromSubscription()` | ✅ |
| 6. 取消订阅 | `POST /api/enterprise/subscription/cancel` | ✅ |

**安全特性**:
- 事务 + 唯一约束防止并发创建多个订阅
- 订单归属验证（organizationId 匹配）
- Entitlement 状态同步（active/suspended/expired）

### Phase 1 结论

| 维度 | 评分 | 说明 |
|------|------|------|
| 后端 API | ✅ 完整 | 双路由实现，功能覆盖 |
| 前端 UI | ❌ 缺失 | 无套餐管理页面 |
| 数据模型 | ✅ 完整 | 三表设计合理 |
| Seed 数据 | ❌ 缺失 | 无默认套餐 |
| 购买链路 | ✅ 完整 | 事务安全 |

**Phase 1: PARTIAL PASS** — 后端完整，前端缺失，无 Seed 数据。

---

## Phase 2: Single Source of Truth 审计 (P0)

### 2.1 企业身份：Organization → EnterpriseProfile → EnterpriseWorkspace

**状态**: ⚠️ **PASS with Risk — 存在双身份系统**

| 实体 | 模型 | 唯一源 | 问题 |
|------|------|--------|------|
| 企业身份 | `Organization` | ✅ 唯一 | — |
| 企业档案 | `EnterpriseProfile` | ✅ 唯一（organizationId unique） | — |
| 招聘工作区 | `EnterpriseJobWorkspace` | ⚠️ 双系统 | 同时存在 `enterprise_job_workspace` 和 `Workspace` |
| 企业成员 | `EnterpriseMember` + `OrgMember` | ❌ 分裂 | 两套成员表 |

**关键问题**:

1. **双工作区系统**:
   - `EnterpriseJobWorkspace`（招聘专用，表名 `enterprise_job_workspace`）
   - `Workspace`（通用，表名 `workspace`，含 `workspaceType` 字段）
   - 两者通过 `organizationId` 关联，但数据可能不一致

2. **双成员系统**:
   - `OrgMember`（`org_member` 表，关联 `Organization`）
   - `EnterpriseMember`（`enterprise_member` 表，关联 `JobCompanyProfile`）
   - 两者角色定义不同（OrgMember: member/owner; EnterpriseMember: OWNER/HR/RECRUITER/VIEWER）

3. **双企业档案**:
   - `Organization` + `EnterpriseProfile`（新体系）
   - `JobCompanyProfile`（旧体系，`enterpriseId` 指向 `Organization`）

### 2.2 AI Employee：EnterpriseAgentInstance → Hermes Binding → Runtime

**状态**: ✅ **PASS — 链路清晰**

| 实体 | 模型 | 关系 | 状态 |
|------|------|------|------|
| Agent 配置 | `EnterpriseAgentProfile` | — | ✅ |
| Agent 实例 | `EnterpriseAgentInstance` | employeeId → EnterpriseAgentProfile.id | ✅ |
| Hermes 绑定 | `HermesProfileBinding` | agentInstanceId → EnterpriseAgentInstance.id | ✅ |
| 运行时 | `runtime` 字段 | openclaw（默认） | ✅ |
| 模型绑定 | `AgentModelBinding` | agentId → EnterpriseAgentProfile.id | ✅ |
| 任务记录 | `EnterpriseAgentTask` | agentInstanceId → EnterpriseAgentInstance.id | ✅ |
| 审计日志 | `AgentAuditTrail` | agentId → EnterpriseAgentProfile.id | ✅ |

**隔离性**: `EnterpriseAgentInstance.tenantId` 做租户隔离，`HermesProfileBinding.namespace` 做 memory 隔离。

### 2.3 岗位：JobPosting

**状态**: ✅ **PASS — 唯一源**

| 检查项 | 结果 |
|--------|------|
| LegacyJob 模型 | ❌ 不存在 |
| RecruitmentJob 模型 | ❌ 不存在 |
| MockJob 模型 | ❌ 不存在 |
| JobPosting 唯一源 | ✅ 是 |

**关联**: `JobPosting.enterpriseId` → `JobCompanyProfile.id`（非直接 Organization），通过 `JobCompanyProfile.enterpriseId` 间接关联 Organization。

### 2.4 候选人：Candidate

**状态**: ❌ **FAIL — 多源并存**

| 模型 | 表名 | 用途 | 是否活跃 |
|------|------|------|----------|
| `JobCandidate` | `job_candidate` | 求职者画像（旧） | ✅ 有数据 |
| `TalentProfile` | `talent_profile` | 人才档案（新） | ✅ 有数据 |
| `CareerProfile` | `career_profile` | 职业档案（最新） | ✅ 有数据 |
| `CandidateResume` | `candidate_resume` | 简历（派生） | ✅ 有数据 |
| `CandidateCard` | `candidate_card` | 候选人投影 | ✅ 有数据 |

**问题**:
1. 三套候选人模型并存，数据可能不一致
2. `JobCandidate` 通过 `userId` 关联，`TalentProfile` 独立存在，`CareerProfile` 通过 `candidateId` + `userId` 关联
3. 无统一 Candidate 唯一标识

### 2.5 匹配：CandidateMatch

**状态**: ✅ **PASS — 唯一源**

| 检查项 | 结果 |
|--------|------|
| 唯一匹配模型 | ✅ `CandidateMatch` |
| 关联岗位 | `jobId` → `JobPosting.id` |
| 关联候选人 | `candidateId` → `JobCandidate.id` |
| 关联工作区 | `workspaceId` → `EnterpriseJobWorkspace.id` |

### 2.6 Pipeline：RecruitmentPipeline / PipelineEvent

**状态**: ✅ **PASS — 唯一源**

| 检查项 | 结果 |
|--------|------|
| Pipeline 模型 | ✅ `RecruitmentPipeline` |
| 事件模型 | ✅ `PipelineEvent` |
| 关联岗位 | `jobId` → `JobPosting.id` |
| 关联工作区 | `workspaceId` → `EnterpriseJobWorkspace.id` |
| 关联简历 | `resumeId` → `Resume.id`（可选） |
| 关联会话 | `RecruitmentConversation.pipelineId` → `RecruitmentPipeline.id`（unique） |

### Phase 2 结论

| 实体 | 唯一源 | 状态 |
|------|--------|------|
| 企业身份 | Organization | ✅ |
| 企业档案 | EnterpriseProfile | ✅ |
| 工作区 | EnterpriseJobWorkspace + Workspace | ⚠️ 双系统 |
| 成员 | OrgMember + EnterpriseMember | ❌ 双系统 |
| AI Employee | EnterpriseAgentInstance | ✅ |
| Hermes Binding | HermesProfileBinding | ✅ |
| 岗位 | JobPosting | ✅ |
| 候选人 | JobCandidate + TalentProfile + CareerProfile | ❌ 三系统 |
| 匹配 | CandidateMatch | ✅ |
| Pipeline | RecruitmentPipeline | ✅ |

**Phase 2: PARTIAL PASS** — 核心实体基本唯一，但候选人和成员/工作区存在多系统分裂。

---

## Phase 3: AI Workforce 数据链 (P0)

### 3.1 链路审计：AI Director → AgentTask → AgentExecution → EnterpriseAgentInstance → UsageLog → Billing

| 步骤 | 模型/服务 | 存在 | 完整性 |
|------|-----------|------|--------|
| AI Director | `EnterpriseAgentProfile`（agentType=director） | ✅ | ⚠️ 无独立 Director 模型 |
| AgentTask | `EnterpriseAgentTask` | ✅ | ✅ 完整 |
| AgentExecution | `AgentExecution`（旧）/ `AgentAuditTrail`（新） | ✅ | ⚠️ 双系统 |
| EnterpriseAgentInstance | `EnterpriseAgentInstance` | ✅ | ✅ 完整 |
| UsageLog | `UsageLog` | ✅ | ✅ 完整 |
| Billing | `BillingRecord` | ✅ | ⚠️ 使用 governance_tenant |

### 3.2 AI Director 实现

**状态**: ⚠️ **无独立 Director 模型**

AI Director 功能通过 `EnterpriseAgentProfile.agentType = 'career_advisor'` 或 `'director'` 实现，无独立 Director 模型。Director 任务通过 `RecruitmentOrchestratorService` 编排：

```
RecruitmentOrchestratorService.executeOrchestration(planId)
  ├── EnterpriseRecruitAgent (JD 优化)
  ├── TalentSearchAgent (人才搜索)
  ├── InterviewAgent (面试计划)
  └── ResumeParserAgent (简历分析)
```

### 3.3 AgentExecution 双系统

| 模型 | 表名 | 关联 | 用途 |
|------|------|------|------|
| `AgentExecution` | `AgentExecution` | `AgentDef`（旧 Agent 系统） | 旧工作流执行 |
| `AgentAuditTrail` | `agent_audit_trail` | `EnterpriseAgentProfile` | 新 AI 员工审计 |
| `AgentExecutionLog` | `AgentExecutionLog` | `AgentExecution` | 旧执行日志 |

**风险**: 两套执行记录并存，新数据写入 `AgentAuditTrail`，但旧 `AgentExecution` 可能仍有数据。

### 3.4 Billing 链路

**状态**: ⚠️ **链路断裂风险**

| 检查项 | 结果 |
|--------|------|
| `BillingRecord.tenantId` → `Tenant.id` | ✅ 关联治理租户 |
| `UsageLog.tenantId` | ✅ 存在 |
| `AgentAuditTrail` 无 tenantId | ❌ 无直接关联 |
| `EnterpriseAgentInstance.tenantId` | ✅ 存在但类型不一致（Text vs Uuid） |

**问题**:
1. `BillingRecord` 关联 `governance_tenant`，而 `EnterpriseAgentInstance.tenantId` 是 Text 类型
2. `AgentAuditTrail` 无 `tenantId` 字段，无法直接关联到租户
3. 成本归集依赖 `UsageLog.tenantId` + `AgentAuditTrail.agentId` 间接关联

### 3.5 HiringKnowledge 隔离性

**状态**: ✅ **PASS — 隔离完整**

| 检查项 | 结果 |
|--------|------|
| `HiringKnowledge.workspaceId` | ✅ 存在 |
| `HiringKnowledge.enterpriseId` | ✅ 存在 |
| `HiringKnowledge.knowledgeType` | ✅ candidate_profile / interview_standard / hiring_preference / success_pattern |
| 索引 | ✅ `[workspaceId, knowledgeType]` + `[enterpriseId]` |

**隔离性**: 通过 `workspaceId` + `enterpriseId` 双重隔离，知识资产严格按企业边界划分。

### Phase 3 结论

| 链路环节 | 状态 |
|----------|------|
| AI Director | ⚠️ 无独立模型，通过 agentType 区分 |
| AgentTask | ✅ 完整 |
| AgentExecution | ⚠️ 双系统（AgentExecution + AgentAuditTrail） |
| EnterpriseAgentInstance | ✅ 完整 |
| UsageLog | ✅ 完整 |
| Billing | ⚠️ 关联断裂风险 |
| HiringKnowledge 隔离 | ✅ 完整 |

**Phase 3: PARTIAL PASS** — 数据链基本完整，但 Billing 链路存在断裂风险，AgentExecution 双系统需整合。

---

## Phase 4: 全流程代码地图 (P0)

### 4.1 页面入口 → API 路由 → Service 层 → Prisma 模型映射

#### 4.1.1 后台管理端（`/admin/recruitment/*`）

| 页面 | API 路由 | Service | Prisma 模型 |
|------|----------|---------|-------------|
| `index.vue` (运营概览) | `GET /api/admin/recruitment/overview` | `overviewRepository` | 多表聚合 |
| `agents.vue` (AI 员工) | `GET /api/admin/recruitment/agents` | 直接 Prisma | `EnterpriseAgentInstance` |
| `jobs.vue` (岗位池) | `GET /api/admin/recruitment/jobs` | `jobRepository` | `JobPosting` |
| `candidates.vue` (候选人) | `GET /api/admin/recruitment/candidates` | `candidateRepository` | `JobCandidate` + `TalentProfile` |
| `conversations.vue` (会话) | `GET /api/admin/recruitment/conversations` | `conversationRepository` | `RecruitmentConversation` |
| `interviews.vue` (面试) | `GET /api/admin/recruitment/interviews` | `interviewRepository` | `InterviewSession` |
| `reviews.vue` (审核) | `GET /api/admin/recruitment/reviews` | 直接 Prisma | `HumanReviewItem` |
| `runtime.vue` (监控) | `GET /api/admin/recruitment/runtime` | `runtimeRepository` | `EnterpriseAgentInstance` |
| `audit.vue` (审计) | `GET /api/admin/recruitment/audit` | `auditRepository` | `AuditLog` |
| `campaigns.vue` (活动) | `GET /api/admin/recruitment/campaigns` | 直接 Prisma | `RecruitmentCampaign` |
| `departments.vue` (部门) | `GET /api/admin/recruitment/departments` | `departmentRepository` | `EnterpriseAgentWorkforce` |
| ❌ 套餐管理 | `GET/POST/PUT/DELETE /api/admin/recruitment/plans` | 直接 Prisma | `EnterprisePlan` |
| ❌ 订阅管理 | `GET/PATCH /api/admin/recruitment/subscriptions` | 直接 Prisma | `EnterpriseSubscription` |

#### 4.1.2 企业工作台端（`/workspace/recruitment/*`）

| 页面 | API 路由 | Service | Prisma 模型 |
|------|----------|---------|-------------|
| `index.vue` (首页) | `GET /api/enterprise/home` | `enterpriseHomeRepository` | 多表聚合 |
| `pipeline.vue` (Pipeline) | `GET /api/pipeline/kanban` | 直接 Prisma | `RecruitmentPipeline` |
| `jobs/create.vue` (创建岗位) | `POST /api/enterprise/postings` | 直接 Prisma | `JobPosting` |
| `matches/index.vue` (匹配) | `GET /api/enterprise/jobs/match` | `jobUnderstandingService` | `CandidateMatch` |
| `resumes/index.vue` (简历) | `GET /enterprise/resumes` | 直接 Prisma | `Resume` |
| `onboarding.vue` (入职) | `POST /api/enterprise/onboarding/*` | `enterpriseOnboarding` | `EnterpriseProfile` |

#### 4.1.3 企业 AI 部门端（`/api/enterprise/*`）

| 功能域 | 路由文件 | 核心 Service | 核心模型 |
|--------|----------|--------------|----------|
| 企业基础 | `enterprise-foundation.ts` | `enterpriseProfileService` | `EnterpriseProfile` |
| AI 员工 | `enterprise-agents.ts` | `enterpriseAgentService` | `EnterpriseAgentInstance` |
| Agent 配置 | `enterprise-agent-profiles.ts` | `enterpriseAgentProfileService` | `EnterpriseAgentProfile` |
| Agent 运行时 | `enterprise-agent-runtime.ts` | `enterpriseAgentRuntime` | `EnterpriseAgentInstance` |
| 订阅 | `enterprise-subscription.ts` | 直接 Prisma | `EnterpriseSubscription` |
| 权益 | `entitlement.ts` | `entitlementService` | `EnterpriseEntitlement` |
| 岗位 | `job-posting.routes.ts` | 直接 Prisma | `JobPosting` |
| Pipeline | `enterprise-pipeline.routes.ts` | 直接 Prisma | `RecruitmentPipeline` |
| 会话 | `recruitment-conversation.routes.ts` | 直接 Prisma | `RecruitmentConversation` |
| 面试 | `recruitment-interview.routes.ts` | `InterviewAgent` | `InterviewSession` |
| 活动 | `recruitment-campaign.routes.ts` | 直接 Prisma | `RecruitmentCampaign` |
| 人才 | `talent.routes.ts` | `TalentSearchAgent` | `TalentProfile` |
| 招聘 Director | `recruitment-director.routes.ts` | `RecruitmentOrchestratorService` | `RecruitmentPlan` |
| 知识 | `enterprise-knowledge.ts` | `enterpriseKnowledgeService` | `EnterpriseKnowledge` |
| 招聘知识 | `hiring-intelligence.routes.ts` | 直接 Prisma | `HiringKnowledge` |
| 计费 | `enterprise-billing.ts` | 直接 Prisma | `EnterpriseSubscription` |
| 分析 | `recruitment-analytics.routes.ts` | 直接 Prisma | 多表聚合 |

### 4.2 关键 Service 层映射

| Service 文件 | 职责 | 关联模型 |
|--------------|------|----------|
| `enterprise-agent-runtime.service.ts` | Agent 激活 + 任务执行 | `EnterpriseAgentInstance`, `AgentAuditTrail` |
| `enterprise-entitlement.service.ts` | 权益计算 + 限额检查 | `EnterpriseEntitlement` |
| `enterprise-llm.service.ts` | LLM 配置管理 | `EnterpriseLlmConfig` |
| `recruitment-orchestrator.service.ts` | 招聘编排 | `RecruitmentPlan`, `RecruitmentPlanTask` |
| `talent-agent.service.ts` | 人才分析 | `TalentProfile`, `CandidateMatch` |
| `interview-agent.service.ts` | 面试管理 | `InterviewSession` |
| `recruitment-action.service.ts` | 招聘 Action | `RecruitmentConversation` |

### Phase 4 结论

**Phase 4: PASS** — 代码地图完整，页面 → API → Service → Model 映射清晰。存在双路由问题（套餐管理），但整体架构合理。

---

## Phase 5: 数据库 Reality (P0)

### 5.1 外键（FK）完整性

| 模型 | FK 字段 | 引用 | 状态 |
|------|---------|------|------|
| `EnterpriseProfile` | `organizationId` | `Organization.id` | ✅ |
| `EnterpriseSubscription` | `organizationId` | `Organization.id` | ✅ |
| `EnterpriseSubscription` | `planId` | `EnterprisePlan.id` | ✅ |
| `EnterpriseEntitlement` | `organizationId` | `Organization.id` | ✅ |
| `EnterpriseEntitlement` | `subscriptionId` | `EnterpriseSubscription.id` | ✅ |
| `EnterpriseAgentInstance` | `tenantId` | 无直接 FK（Text 类型） | ⚠️ |
| `EnterpriseAgentProfile` | `tenantId` | 无直接 FK（Text 类型） | ⚠️ |
| `EnterpriseJobWorkspace` | `enterpriseId` | `JobCompanyProfile.id` | ✅ |
| `JobPosting` | `enterpriseId` | `JobCompanyProfile.id` | ✅ |
| `RecruitmentPipeline` | `workspaceId` | `EnterpriseJobWorkspace.id` | ✅ |
| `RecruitmentPipeline` | `jobId` | `JobPosting.id` | ✅ |
| `CandidateMatch` | `jobId` | `JobPosting.id` | ✅ |
| `CandidateMatch` | `candidateId` | `JobCandidate.id` | ✅ |
| `RecruitmentConversation` | `workspaceId` | `EnterpriseJobWorkspace.id` | ✅ |
| `RecruitmentConversation` | `pipelineId` | `RecruitmentPipeline.id` | ✅ |
| `HiringKnowledge` | `workspaceId` | `EnterpriseJobWorkspace.id` | ✅ |

### 5.2 tenantId / organizationId 隔离

| 模型 | tenantId | organizationId | 隔离方式 |
|------|----------|----------------|----------|
| `EnterpriseAgentInstance` | ✅ (Text) | ❌ | tenantId |
| `EnterpriseAgentProfile` | ✅ (Text) | ✅ (Text, 可选) | tenantId |
| `EnterpriseLlmConfig` | ✅ (Text) | ❌ | tenantId |
| `EnterpriseKnowledge` | ✅ (Text) | ❌ | tenantId |
| `AgentAuditTrail` | ✅ (Text) | ❌ | tenantId |
| `EnterpriseAgentTask` | ✅ (Text) | ❌ | tenantId |
| `EnterpriseSubscription` | ❌ | ✅ (Uuid) | organizationId |
| `EnterpriseEntitlement` | ❌ | ✅ (Uuid) | organizationId |
| `EnterpriseJobWorkspace` | ❌ | ✅ (Uuid, enterpriseId) | enterpriseId |
| `JobPosting` | ❌ | ✅ (Uuid, enterpriseId) | enterpriseId |
| `RecruitmentPipeline` | ❌ | ❌ | workspaceId |
| `HiringKnowledge` | ❌ | ✅ (enterpriseId) | workspaceId + enterpriseId |

**问题**: 隔离字段不统一 — 部分模型用 `tenantId`（Text），部分用 `organizationId`（Uuid），部分用 `enterpriseId`（Uuid）。`tenantId` 类型不一致（Text vs Uuid），存在隐式转换风险。

### 5.3 索引完整性

| 模型 | 索引 | 状态 |
|------|------|------|
| `EnterpriseSubscription` | `[status]`, `[expireAt]` | ✅ |
| `EnterpriseEntitlement` | `[organizationId]`, `[status]` | ✅ |
| `EnterpriseAgentInstance` | 无索引（除 PK） | ⚠️ |
| `EnterpriseAgentProfile` | 无索引（除 PK） | ⚠️ |
| `EnterpriseLlmConfig` | `[tenantId, provider, modelName]` unique | ✅ |
| `AgentAuditTrail` | 无索引（除 PK） | ⚠️ |
| `AgentModelBinding` | `[agentId, llmConfigId, taskType]` unique | ✅ |
| `HermesProfileBinding` | `[tenantId]`, `[agentInstanceId]` | ✅ |
| `JobPosting` | `[enterpriseId]`, `[enterpriseId, status]`, `[status]` | ✅ |
| `RecruitmentPipeline` | `[workspaceId]`, `[jobId]`, `[stage]`, `[workspaceId, stage]` | ✅ |
| `CandidateMatch` | `[workspaceId]`, `[jobId]`, `[candidateId]` | ✅ |
| `RecruitmentConversation` | `[workspaceId, status]`, `[enterpriseId, status]`, `[recruiterAgentId]`, `[status, reviewPriority]` | ✅ |
| `HiringKnowledge` | `[workspaceId, knowledgeType]`, `[enterpriseId]` | ✅ |

**缺失索引**:
- `EnterpriseAgentInstance.tenantId` — 高频查询字段，无索引
- `EnterpriseAgentProfile.tenantId` — 高频查询字段，无索引
- `AgentAuditTrail.agentId` + `createdAt` — 审计查询常用

### 5.4 孤立数据风险

| 风险点 | 描述 | 严重程度 |
|--------|------|----------|
| 无 FK 的 tenantId | `EnterpriseAgentInstance.tenantId` 无 FK 约束，可能指向不存在的租户 | 🔴 P0 |
| 双身份系统 | `OrgMember` vs `EnterpriseMember`，同一用户可能在两套系统中重复 | 🟡 P1 |
| 候选人三源 | `JobCandidate`、`TalentProfile`、`CareerProfile` 可能指向同一人但数据不同步 | 🟡 P1 |
| AgentExecution 双系统 | `AgentExecution`（旧）与 `AgentAuditTrail`（新）并存 | 🟡 P1 |
| Billing 关联断裂 | `BillingRecord.tenantId` → `Tenant.id`，但 `EnterpriseAgentInstance.tenantId` 是 Text | 🟡 P1 |

### Phase 5 结论

| 维度 | 状态 |
|------|------|
| FK 完整性 | ⚠️ tenantId 无 FK 约束 |
| 隔离字段 | ⚠️ 不统一（tenantId/organizationId/enterpriseId） |
| 索引 | ⚠️ 高频字段缺失索引 |
| 孤立数据 | 🔴 存在风险 |

**Phase 5: PARTIAL PASS** — 数据库结构基本完整，但存在隔离字段不统一、索引缺失、孤立数据风险。

---

## 最终结论

### GO / NO-GO 判定

| 条件 | 状态 |
|------|------|
| 核心购买链路完整 | ✅ |
| 核心招聘流程完整 | ✅ |
| 数据模型覆盖完整 | ✅ |
| 前端套餐管理 UI | ❌ |
| 默认套餐 Seed 数据 | ❌ |
| 身份系统统一 | ❌ |
| 候选人唯一源 | ❌ |
| 数据库隔离字段统一 | ❌ |

### 最终判定: **CONDITIONAL GO**

**理由**:
1. ✅ 核心业务链路（购买 → 订阅 → 权益 → Agent 激活 → 招聘执行）完整
2. ✅ 代码架构清晰，Service 层职责明确
3. ✅ 关键模型设计合理（Snapshot 订阅、Entitlement 权益层）
4. ⚠️ 前端缺失套餐管理页面（仅 API 可用）
5. ⚠️ 无默认套餐 Seed 数据
6. ❌ 身份系统分裂（双工作区、双成员、三候选人）
7. ❌ 数据库隔离字段不统一

### Sprint 12 必做项（P0）

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | 创建默认套餐 Seed 数据 | 至少 3 套默认套餐（免费版/专业版/企业版） |
| P0 | 统一 tenantId 类型 | 全部改为 Uuid + FK 约束 |
| P0 | 添加缺失索引 | `EnterpriseAgentInstance.tenantId`, `AgentAuditTrail.agentId` |
| P1 | 前端套餐管理页面 | `/admin/recruitment/plans.vue` + `subscriptions.vue` |
| P1 | 候选人唯一源整合 | 统一为 `CareerProfile`，废弃 `JobCandidate` 和 `TalentProfile` |
| P1 | 身份系统统一 | 合并 `OrgMember` 和 `EnterpriseMember` |
| P2 | AgentExecution 双系统整合 | 统一为 `AgentAuditTrail` |
| P2 | Billing 链路修复 | 确保 `BillingRecord` 与 `UsageLog` 租户关联一致 |

---

**报告结束**

*Generated by Sprint 11 Reality Audit Agent*
