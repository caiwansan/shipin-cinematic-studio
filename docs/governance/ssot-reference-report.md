# SSOT Reference Audit — 全库引用报告

> Sprint 12.6 Governance Closure  
> 扫描日期：2026-07-28  
> 扫描范围：backend/src/ + backend/prisma/ + frontend/  
> 原则：只审计引用状态，不修改代码

---

## 一、JobCandidate → CareerProfile 迁移

**SSOT 状态**：`CareerProfile` ✅   |   `JobCandidate` ❌ Deprecated

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `repositories/recruitment/candidate.repository.ts` | 63 | `prisma.jobCandidate.findMany` | **MIGRATION** |
| `repositories/recruitment/candidate.repository.ts` | 84 | `prisma.jobCandidate.count` | **MIGRATION** |
| `repositories/recruitment/candidate.repository.ts` | 142 | `prisma.jobCandidate.findUnique` | **MIGRATION** |
| `repositories/recruitment/candidate.repository.ts` | 247 | `prisma.jobCandidate.count` | **MIGRATION** |
| `repositories/recruitment/candidate.repository.ts` | 258 | `prisma.jobCandidate.findMany` | **MIGRATION** |
| `repositories/recruitment/conversation.repository.ts` | 92-130 | Manual join via JobCandidate | **MIGRATION** |
| `repositories/recruitment/enterprise-home.repository.ts` | 13 | Comment reference | **MIGRATION** |
| `routes/job.routes.ts` | 54, 116, 163, 321, 365, 417 | `prisma.jobCandidate.*` | **MIGRATION** |
| `routes/job.routes.ts` | 77-84 | ✅ 已注释不再写入 | **DEPRECATED** |
| `routes/dashboard.routes.ts` | 18 | `prisma.jobCandidate.count` | **MIGRATION** |
| `routes/enterprise-job-intelligence.routes.ts` | 175, 259, 261, 350 | `prisma.jobCandidate.*` | **MIGRATION** |
| `routes/enterprise.routes.ts` | 224 | `prisma.jobCandidate.findMany` | **MIGRATION** |
| `routes/talent.routes.ts` | 402, 406 | `prisma.jobCandidate.*` | **MIGRATION** |
| `services/enterprise/interview-agent.service.ts` | 83 | `prisma.jobCandidate.findUnique` | **MIGRATION** |
| `services/enterprise/talent-agent.service.ts` | 82 | `prisma.jobCandidate.findUnique` | **MIGRATION** |
| `mappers/recruitment/conversation.mapper.ts` | 8-9 | Comment reference | — |
| `prisma/schema.prisma` | 7936-7953 | Model definition + @@deprecated | ✅ |
| `prisma/schema.prisma` | 66 | `User.jobCandidates` relation | ✅ |
| `prisma/schema.prisma` | 7998 | `CandidateMatch.candidate → JobCandidate` | **MIGRATION** |
| `migrations/...job_workspace_01.sql` | — | Migration SQL | 保留 |

**动作**：14 处运行时引用需迁移到 `CareerProfile`。`candidate.repository.ts` 是核心瓶颈。

---

## 二、TalentProfile → CareerProfile 迁移

**SSOT 状态**：`CareerProfile` ✅   |   `TalentProfile` ❌ Deprecated

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `repositories/recruitment/candidate.repository.ts` | 138-233 | `prisma.talentProfile.*` 主数据源之一 | **MIGRATION** |
| `routes/admin-recruitment.ts` | 774-819 | 管理后台候选人详情 | **MIGRATION** |
| `routes/talent.routes.ts` | 93-98 | `prisma.talentProfile.*` 含 create | **MIGRATION** |
| `routes/talent.routes.ts` | 210 | `prisma.talentProfile.findUnique` | **MIGRATION** |
| `routes/talent.routes.ts` | 336 | `prisma.talentProfile.count` | **MIGRATION** |
| `routes/talent.routes.ts` | 447-451 | `prisma.talentProfile.findMany` | **MIGRATION** |
| `agents/job/talent-search-agent.ts` | 52-260 | `TalentProfileInput` 接口 + 方法 | **MIGRATION** |
| `frontend/pages/admin/recruitment/candidates.vue` | 210-228 | 展示 talentProfile 字段 | **MIGRATION** |
| `frontend/pages/admin/recruitment/candidates/[id].vue` | 173-190 | 展示 talentProfile 字段 | **MIGRATION** |
| `prisma/schema.prisma` | 7956-7981 | Model definition + @@deprecated | ✅ |

**动作**：10 处引用需迁移，`talent.routes.ts` 仍有写入（`talentProfile.create`），立即停止。

---

## 三、EnterpriseAgentWorkforce → EnterpriseAgentProfile + Instance

**SSOT 状态**：`EnterpriseAgentProfile`(6707) + `EnterpriseAgentInstance`(6751) ✅  
`EnterpriseAgentWorkforce` ❌ 需 Deprecated

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `routes/enterprise-dashboard.routes.ts` | 74 | `prisma.enterpriseAgentWorkforce.findMany` | **MIGRATION** |
| `routes/enterprise-onboarding.routes.ts` | 564-572 | `prisma.enterpriseAgentWorkforce.*` 含 create | **MIGRATION** |
| `routes/enterprise-onboarding.routes.ts` | 652, 806 | `prisma.enterpriseAgentWorkforce.*` | **MIGRATION** |
| `routes/recruitment-analytics.routes.ts` | 300 | `prisma.enterpriseAgentWorkforce.findMany` | **MIGRATION** |
| `routes/recruitment-campaign.routes.ts` | 145 | `prisma.enterpriseAgentWorkforce.findFirst` | **MIGRATION** |
| `routes/recruitment-conversation.routes.ts` | 225 | `prisma.enterpriseAgentWorkforce.findFirst` | **MIGRATION** |
| `routes/recruitment-department.routes.ts` | 73, 77, 103, 249, 401, 420, 456, 463, 497, 504, 539, 620, 698 | **13 处引用** | **MIGRATION** |
| `prisma/schema.prisma` | 7695-7716 | Model definition | ❌ 需加 @@deprecated |
| `prisma/schema.prisma` | 8241 | `RecruitmentCampaign.marketingAgentId` 引用 | **MIGRATION** |

**动作**：`recruitment-department.routes.ts` 是最大引用方（13 处），与 Agent 路由高度耦合。需整文件迁移到 Profile + Instance。

---

## 四、EnterpriseMember → OrgMember

**SSOT 状态**：`OrgMember`(2999) ✅ | `EnterpriseMember`(7608) ❌ Deprecated

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `services/enterprise-context.service.ts` | 52 | `prisma.enterpriseMember.findFirst` | **MIGRATION** |
| `routes/enterprise-job-intelligence.routes.ts` | 30 | `prisma.enterpriseMember.findFirst` | **MIGRATION** |
| `routes/enterprise-onboarding.routes.ts` | 345 | `prisma.enterpriseMember.create` | **MIGRATION** |
| `routes/llm-config.ts` | 99, 146 | `prisma.enterpriseMember.findFirst` | **MIGRATION** |
| `seeds/p4-validation-02.ts` | 46-51 | 种子数据引用 | **MIGRATION** |
| `prisma/schema.prisma` | 67 | `User.enterpriseMemberships` | ✅ |
| `prisma/schema.prisma` | 7605 | `JobCompanyProfile.members` | ❌ 需解除 |
| `prisma/schema.prisma` | 7608-7624 | Model + @@deprecated | ✅ |

**动作**：6 处活跃引用需迁移。`JobCompanyProfile` 与 `EnterpriseMember` 的关联也需解除。

---

## 五、Resume + ResumeProfile → CandidateResume

**SSOT 状态**：`CandidateResume`(8451) ✅ | `Resume`(7739) ❌ | `ResumeProfile`(7761) ❌

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `routes/resume.routes.ts` | 34-296 | **全文件** `prisma.resume.*` + `prisma.resumeProfile.*` | **MIGRATION** |
| `routes/enterprise-billing-extended.ts` | 33, 183 | `prisma.resume.count` | **MIGRATION** |
| `routes/enterprise-dashboard.routes.ts` | 129, 241 | `prisma.resume.*` | **MIGRATION** |
| `routes/enterprise-pipeline.routes.ts` | 230-279, 439 | `prisma.resume.*` + `prisma.resumeProfile.*` | **MIGRATION** |
| `routes/dashboard.routes.ts` | 14 | `prisma.resume.count` | **MIGRATION** |
| `prisma/schema.prisma` | 7739-7790 | Resume + ResumeProfile | ❌ 需加 @@deprecated |

**动作**：`resume.routes.ts` 整文件 ~300 行需迁移。两张表的引用广泛分布在 5 个路由文件中。

---

## 六、InterviewRecord → InterviewSession

**SSOT 状态**：`InterviewSession`(7867) ✅ | `InterviewRecord`(8034) ❌ 重叠

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `services/enterprise/interview-agent.service.ts` | 57 | Comment knowledge scope | — |
| `prisma/schema.prisma` | 7999 | `CandidateMatch.interviewRecords` relation | ❌ |
| `prisma/schema.prisma` | 8034-8048 | Model definition | ❌ 需 @@deprecated |

**动作**：Model 定义驻留但代码引用极少。确认 `interview_record` 表有无数据后再处理。

---

## 七、SubscriptionPlan + Subscription → EnterpriseSubscription

**SSOT 状态**：`EnterprisePlan`(2914) + `EnterpriseSubscription`(2944) + `EnterpriseEntitlement`(2974) ✅  
`SubscriptionPlan`(5474) + `Subscription`(5495) ❌ 平台 Gov 体系

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `services/platform/governance/repositories/plan.repository.ts` | 2-15 | `SubscriptionPlan` CRUD | **DEPRECATED** |
| `services/platform/governance/repositories/subscription.repository.ts` | — | `Subscription` CRUD | **DEPRECATED** |
| `services/platform/governance/subscription/subscription-runtime.ts` | — | `Subscription` 运行时 | **DEPRECATED** |
| `services/platform/governance/billing/billing-runtime.ts` | — | Billing 逻辑 | **DEPRECATED** |
| `routes/recruitment-department.routes.ts` | 85, 144, 277 | 字符串 `subscriptionPlan` (非模型) | **MIGRATION** |
| `routes/enterprise-onboarding.routes.ts` | 581, 654 | 字符串 `subscriptionPlan` | **MIGRATION** |
| `payment/controllers/index.ts` | 82 | 排序引用 | **DEPRECATED** |

**动作**：平台 Gov 体系（SubscriptionPlan + Subscription）与企业域（EnterprisePlan + EnterpriseSubscription）是两套独立体系。确认企业域是否实际使用 Gov 体系的数据后再处理。

---

## 八、RecruitmentPlan → EnterprisePlan

**SSOT 状态**：`EnterprisePlan`(2914) ✅ | `RecruitmentPlan`(8862) ❌

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `routes/recruitment-director.routes.ts` | 352-833 | **全文件** `prisma.recruitmentPlan.*` + `prisma.recruitmentPlanTask.*` | **MIGRATION** |

**动作**：`recruitment-director.routes.ts` 是全量引用方，~400 行。需整体迁移到 `EnterprisePlan` 体系。

---

## 九、AgentExecution + AgentExecutionLog → AgentAuditTrail

**SSOT 状态**：`AgentAuditTrail`(6964) ✅ | `AgentExecution`(1648) ❌ | `AgentExecutionLog`(1747) ❌

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `prisma/schema.prisma` | 1614 | `AgentDef.executions` relation | ❌ |
| `prisma/schema.prisma` | 1648-1666 | Model + @@deprecated | ✅ |
| `prisma/schema.prisma` | 1747-1763 | Model + @@deprecated | ✅ |
| `routes/enterprise-timeline.ts` | 14, 32, 72 | 注释 + 已迁移到 AgentAuditTrail | ✅ |

**动作**：代码中已基本迁移完成。模型驻留但无活跃运行时引用。

---

## 十、JobCompanyProfile → EnterpriseProfile

**SSOT 状态**：`EnterpriseProfile`(2874) ✅ | `JobCompanyProfile`(7593) ❌

### 引用清单

| 文件 | 行号 | 引用方式 | 状态 |
|------|------|---------|------|
| `prisma/schema.prisma` | 7593-7605 | Model + `EnterpriseMember` relation | ❌ |
| `prisma/schema.prisma` | 7835 | `JobPosting.enterprise → JobCompanyProfile` | ❌ |
| `repositories/recruitment/job.repository.ts` | — | 推断引用 `JobPosting.enterprise` | **MIGRATION** |

**动作**：`JobPosting` 直接关联了 `JobCompanyProfile` 而非 `EnterpriseProfile`。这是核心引用。需将 `JobPosting.enterpriseId` 重定向到 `Organization` 或 `EnterpriseProfile`。

---

## 总结：按文件拆分的工作项

| 优先级 | 文件 | 涉及模型 | 预估工时 |
|--------|------|---------|---------|
| P0 | `routes/talent.routes.ts` | TalentProfile（含 create） | 2h |
| P0 | `routes/recruitment-department.routes.ts` | EnterpriseAgentWorkforce（13 处） | 4h |
| P1 | `repositories/recruitment/candidate.repository.ts` | JobCandidate + TalentProfile | 3h |
| P1 | `routes/job.routes.ts` | JobCandidate | 1h |
| P1 | `routes/resume.routes.ts` | Resume + ResumeProfile | 2h |
| P2 | `routes/enterprise-onboarding.routes.ts` | EnterpriseAgentWorkforce + EnterpriseMember | 2h |
| P2 | `routes/recruitment-director.routes.ts` | RecruitmentPlan | 3h |
| P2 | `routes/enterprise-job-intelligence.routes.ts` | JobCandidate + EnterpriseMember | 1h |
| P3 | Schema 注释标注 | 16 个模型 | 1h |

---

*报告生成：2026-07-28*  
*扫描命令：grep -rn 全库 200+ 文件*
