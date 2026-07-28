# Deprecated Model Registry

> Sprint 12.6 Governance Closure
> 生效日期：2026-07-28
> 治理原则：Deprecated → 停写 → 验证 → 删除，至少观察一个 Sprint

---

## 总览

| 模型 | 替代 SSOT | 活跃引用 | 状态 |
|------|----------|---------|------|
| `JobCandidate` | `CareerProfile` | 14 处 | **DEPRECATED** - 停止写入 |
| `TalentProfile` | `CareerProfile` | 10 处 | **DEPRECATED** - 停止写入 |
| `EnterpriseMember` | `OrgMember` | 6 处 | **DEPRECATED** - 停止写入 |
| `EnterpriseAgentWorkforce` | `EnterpriseAgentInstance` | 19 处 | **DEPRECATE CANDIDATE** |
| `Resume` | `CandidateResume` | 8 处 | **DEPRECATE CANDIDATE** |
| `ResumeProfile` | `CareerProfile` | 5 处 | **DEPRECATE CANDIDATE** |
| `InterviewRecord` | `InterviewSession` | 1 处 | **DEPRECATE CANDIDATE** |
| `SubscriptionPlan` | `EnterprisePlan` | 3 文件 | **OBSERVE** - 平台层独立 |
| `Subscription` | `EnterpriseSubscription` | 3 文件 | **OBSERVE** - 平台层独立 |
| `BillingRecord` | `PaymentOrder` | — | **OBSERVE** |
| `RecruitmentPlan` | `EnterprisePlan` | 1 文件 | **DEPRECATE CANDIDATE** |
| `AgentExecution` | `AgentAuditTrail` | 0 活跃 | **OBSERVE** |
| `AgentExecutionLog` | `AgentAuditTrail` | 0 活跃 | **OBSERVE** |
| `MemberPlan` | `EnterprisePlan` | — | **OBSERVE** |
| `AgentPlan` | `EnterprisePlan` | — | **OBSERVE** |
| `JobCompanyProfile` | `EnterpriseProfile` | 2 处（核心引用） | **DEPRECATE CANDIDATE** |

---

## 状态定义

```mermaid
graph LR
    DEPRECATED --> STOP_WRITING
    STOP_WRITING --> OBSERVE
    OBSERVE --> DELETE_CANDIDATE
    DELETE_CANDIDATE --> DELETED
```

| 状态 | 含义 | 条件 |
|------|------|------|
| **DEPRECATED** | 已标注，停止新写入 | |
| **DEPRECATE CANDIDATE** | 待标注，有活跃引用需先迁移 | 迁移任务完成后标注 |
| **STOP_WRITING** | 已停止所有 prisma.create() 调用 | 代码审查确认 |
| **OBSERVE** | 观察一个 Sprint，确认无回归 | 至少 2 周 |
| **DELETE_CANDIDATE** | 可删除，待迁移脚本确认 | 表空 + 无引用 + migration 依赖确认 |

---

## 一、DEPRECATED — 停止写入

### JobCandidate

```yaml
model: JobCandidate
table: job_candidate
deprecated_at: "Sprint 12"
status: DEPRECATED
replaced_by: CareerProfile
active_references: 14
has_active_writes: false  # ✅ 已注释
owner: recruitment
notes: >
  job.routes.ts 中的写入已在 Sprint 12.5 注释。 
  只读引用分布在 candidate.repository.ts 等 8 个文件，
  需迁移到 CareerProfile。
delete_prerequisites:
  - "candidate.repository.ts 迁移到 CareerProfile"
  - "conversation.repository.ts 迁移到 CareerProfile"
  - "CandidateMatch.candidateId 从 JobCandidate 改为 CareerProfile"
```

### TalentProfile

```yaml
model: TalentProfile
table: talent_profile
deprecated_at: "Sprint 12"
status: DEPRECATED - 仍有活跃写入 ⚠️
replaced_by: CareerProfile
active_references: 10
has_active_writes: true  # ❌ talent.routes.ts:98 → prisma.talentProfile.create()
owner: recruitment
notes: >
  talent.routes.ts:93-98 中仍有 prisma.talentProfile.create() 调用，
  这是 `@@deprecated` 标注生效的阻碍。需立即删除该写入路径。
delete_prerequisites:
  - "talent.routes.ts:98 移除 create 调用"
  - "admin-recruitment.ts 迁移到 CareerProfile"
  - "candidate.repository.ts 迁移"
```

### EnterpriseMember

```yaml
model: EnterpriseMember
table: enterprise_member
deprecated_at: "Sprint 12"
status: DEPRECATED - 仍有活跃写入 ⚠️
replaced_by: OrgMember
active_references: 6
has_active_writes: true  # ❌ enterprise-onboarding.routes.ts:345 → create
owner: recruitment
notes: >
  企业 onboarding 流程中仍在写入 EnterpriseMember。
  需改为 OrgMember.create()
delete_prerequisites:
  - "enterprise-onboarding.routes.ts 改为 OrgMember"
  - "enterprise-context.service.ts 改为 OrgMember"
  - "llm-config.ts 改为 OrgMember"
```

---

## 二、DEPRECATE CANDIDATE — 待标注

### EnterpriseAgentWorkforce

```yaml
model: EnterpriseAgentWorkforce
table: enterprise_agent_workforce
status: DEPRECATE CANDIDATE
replaced_by: EnterpriseAgentProfile + EnterpriseAgentInstance
active_references: 19  # 最高
has_active_writes: true  # onboarding.routes.ts + recruitment-department.routes.ts
owner: recruitment
risk: HIGH
notes: >
  19 处活跃引用，recruitment-department.routes.ts 占 13 处。
  是最大的迁移工作项。需先完成 Profile + Instance 接入再标注。
recommended_sprint: "Sprint 13 治理"
```

### Resume

```yaml
model: Resume
table: resume
status: DEPRECATE CANDIDATE
replaced_by: CandidateResume
active_references: 8
has_active_writes: true  # resume.routes.ts
owner: recruitment
notes: >
  resume.routes.ts 整文件 ~300 行需迁移。
  resume_profile 表与 resume 表耦合
recommended_sprint: "Sprint 13"
```

### ResumeProfile

```yaml
model: ResumeProfile
table: resume_profile
status: DEPRECATE CANDIDATE
replaced_by: CareerProfile
active_references: 5
has_active_writes: true  # resume.routes.ts
owner: recruitment
notes: 与 Resume 同时处理
```

### InterviewRecord

```yaml
model: InterviewRecord
table: interview_record
status: DEPRECATE CANDIDATE
replaced_by: InterviewSession
active_references: 1 (prisma schema relation)
has_active_writes: false
owner: recruitment
notes: 代码引用极少，确认表数据后可直接标注
```

### RecruitmentPlan + RecruitmentPlanTask

```yaml
model: RecruitmentPlan, RecruitmentPlanTask
table: recruitment_plan, recruitment_plan_task
status: DEPRECATE CANDIDATE
replaced_by: EnterprisePlan
active_references: 1 文件 (recruitment-director.routes.ts, ~30 处)
has_active_writes: true  # director.routes.ts → create
owner: recruitment
notes: >
  recruitment-director.routes.ts 全文件需迁移到 EnterprisePlan 体系。
  Sprint 10 引入的招聘 Director 体系与商品套餐重叠
```

### JobCompanyProfile

```yaml
model: JobCompanyProfile
table: job_company_profile
status: DEPRECATE CANDIDATE
replaced_by: EnterpriseProfile
active_references: 2 (JobPosting + EnterpriseMember 关联)
has_active_writes: false  # 推断无直接写入
owner: recruitment
notes: >
  JobPosting.enterpriseId 指向 JobCompanyProfile 而非 EnterpriseProfile。
  这是核心数据模型缺陷，需将 JobPosting 的 enterprise 引用改为 Organization
risk: HIGH（Enterprise 身份路由关键路径）
```

---

## 三、OBSERVE — 观察后决定

### SubscriptionPlan + Subscription (Gov Platform)

```yaml
model: SubscriptionPlan, Subscription
table: subscription_plan, subscription
status: OBSERVE
replaced_by: EnterprisePlan, EnterpriseSubscription
active_references: 3 文件（platform/governance/ 下）
notes: >
  这是平台治理层的独立套餐体系，与企业域 EnterprisePlan 并行。
  如果两套体系有数据通道关系，不能直接废弃。
  需确认 enterprise-subscription.ts 是否依赖 Gov 层数据。
```

### AgentExecution + AgentExecutionLog

```yaml
model: AgentExecution, AgentExecutionLog
table: AgentExecution, AgentExecutionLog
status: OBSERVE - 代码中已无活跃引用
replaced_by: AgentAuditTrail
active_references: 0 活跃运行时引用
notes: 代码引用已迁移到 AgentAuditTrail，模型定义安全驻留。
```

---

## 四、删除流程规范

```
Step 1: 添加 @@deprecated 注释 + 代码红线
         prisma.schema 中加入 @@deprecated "..."
         architecture-rules.md 中加入对应红线
         ↓
Step 2: 停止所有写入
         全局搜索 prisma.modelName.create()
         全部替换为 SSOT 模型的写入
         ↓
Step 3: 停止所有读取
         全局搜索 prisma.modelName.find*()
         全部替换为 SSOT 模型的读取
         ↓
Step 4: 观察一个 Sprint (至少 2 周)
         确认日志中无该表写入
         确认无功能回归
         ↓
Step 5: 确认表无数据
         SELECT COUNT(*) FROM table_name
         如果有历史数据，编写迁移脚本
         ↓
Step 6: 编写删除 migration
         prisma migrate dev 生成 drop table
         确认无其他 migration 依赖
         ↓
Step 7: 删除模型定义 + 相关代码
         代码审查 + 回归测试
```

---

*注册登记时间：2026-07-28*  
*涉及模型：16 个 | 活跃引用：~100 处*
