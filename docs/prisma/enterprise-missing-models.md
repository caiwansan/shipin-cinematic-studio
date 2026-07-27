# 企业招聘缺失 Prisma 模型清单

> 分支：`hotfix/prisma-schema-sync-enterprise`
> 原则：**只同步 schema，不改数据库**（禁止 migrate/push/reset）

---

## 缺失模型总览

| 模型 | 数据库表 | 使用路由 | 影响模块 | 优先级 | 状态 |
|---|---|---|---|---:|---|
| Resume | resume | resume.routes.ts | Resume Center | P0 | 待补 |
| ResumeProfile | resume_profile | resume.routes.ts, enterprise-pipeline.routes.ts, interview.routes.ts | Resume Center | P0 | 待补 |
| RecruitmentPipeline | recruitment_pipeline | enterprise-pipeline.routes.ts | Pipeline | P0 | 待补 |
| PipelineEvent | pipeline_event | enterprise-pipeline.routes.ts | Pipeline | P1 | 待补 |
| JobPosting | job_posting | job-posting.routes.ts | Job Posting | P0 | 待补 |
| RecruitmentChannel | recruitment_channel | job-posting.routes.ts | Job Posting | P1 | 待补 |
| RecruitmentChannelMapping | recruitment_channel_mapping | job-posting.routes.ts | Job Posting | P1 | 待补 |
| InterviewSession | interview_session | interview.routes.ts | Interview | P0 | 待补 |
| InterviewQuestion | interview_question | interview.routes.ts | Interview | P1 | 待补 |
| InterviewEvaluation | interview_evaluation | interview.routes.ts | Interview | P1 | 待补 |
| CandidateNote | candidate_note | enterprise-pipeline.routes.ts | Pipeline | P1 | 待补 |
| InterviewRecord | interview_record | interview.routes.ts | Interview | P1 | 待补 |
| InterviewDecision | interview_decision | interview.routes.ts | Interview | P1 | 待补 |
| InterviewNote | interview_note | interview.routes.ts | Interview | P1 | 待补 |
| JobCandidate | job_candidate | job-posting.routes.ts | Job Posting | P1 | 待补 |
| TalentProfile | talent_profile | talent.routes.ts | Talent Pool | P1 | 待补 |
| CandidateMatch | candidate_match | talent.routes.ts | Talent Pool | P1 | 待补 |

**总计：17 个缺失模型**

- P0：8 个
- P1：9 个
- P2：0 个

---

## 不影响的已有模型

| 模型 | 数据库表 | 说明 |
|---|---|---|
| EnterpriseJobWorkspace | enterprise_job_workspace | ✅ 已建模 |
| EnterpriseOnboardingState | enterprise_onboarding_state | ✅ 已建模 |
| Job | job | ✅ 已建模 |
| JobQueue | job_queue | ✅ 已建模 |
| PipelineStage | pipeline_stage | ✅ 已建模 |
| PipelineJob | pipeline_job | ✅ 已建模 |
| BillingRecord | billing_record | ✅ 已建模 |
| Subscription | subscription | ✅ 已建模 |
| EnterpriseProfile | enterprise_profile | ✅ 已建模 |

---

## 分批补齐计划

### 第一批：Onboarding / Dashboard 稳定（2h）

目标：Onboarding complete 不崩溃，Dashboard 基础统计不崩溃。

不涉及新增模型（Onboarding 已补齐）。

### 第二批：Resume + Candidate + Pipeline（6h）

| 模型 | 对应表 | 路由 |
|---|---|---|
| Resume | resume | resume.routes.ts |
| ResumeProfile | resume_profile | resume.routes.ts |
| RecruitmentPipeline | recruitment_pipeline | enterprise-pipeline.routes.ts |
| PipelineEvent | pipeline_event | enterprise-pipeline.routes.ts |
| CandidateNote | candidate_note | enterprise-pipeline.routes.ts |

### 第三批：Interview + Job Posting + Talent Pool（8h）

| 模型 | 对应表 | 路由 |
|---|---|---|
| InterviewSession | interview_session | interview.routes.ts |
| InterviewQuestion | interview_question | interview.routes.ts |
| InterviewEvaluation | interview_evaluation | interview.routes.ts |
| InterviewRecord | interview_record | interview.routes.ts |
| InterviewDecision | interview_decision | interview.routes.ts |
| InterviewNote | interview_note | interview.routes.ts |
| JobPosting | job_posting | job-posting.routes.ts |
| RecruitmentChannel | recruitment_channel | job-posting.routes.ts |
| RecruitmentChannelMapping | recruitment_channel_mapping | job-posting.routes.ts |
| JobCandidate | job_candidate | job-posting.routes.ts |
| TalentProfile | talent_profile | talent.routes.ts |
| CandidateMatch | candidate_match | talent.routes.ts |

---

## 执行约束

```bash
# 允许
npx prisma validate
npx prisma generate
npx prisma db pull --print > /tmp/fushtn_audit/prisma-db-pull-preview.txt  # 只读

# 禁止
npx prisma migrate dev
npx prisma migrate reset
npx prisma db push
npx prisma db push --force-reset
```
