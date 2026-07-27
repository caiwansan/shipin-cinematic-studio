# 企业招聘工作台 — 产品 vs 代码现实核验

> 核验时间：2026-07-24
> 产品基线：`docs/product/enterprise-recruitment-workspace-v1.md`
> 代码映射：`docs/product/enterprise-recruitment-code-map.md`
> 数据模型：`docs/product/enterprise-recruitment-data-model.md`

---

## 核验方法

每个模块按 6 个维度核验：

1. **前端页面**：是否有可访问的 Vue 页面
2. **后端路由**：是否有注册的路由文件
3. **数据模型**：Prisma schema 是否建模
4. **数据库表**：PostgreSQL 是否有对应表
5. **Prisma Client**：`prisma.xxx` 是否可调用
6. **业务闭环**：前端→后端→数据库是否可跑通

---

## 总览

| 模块 | 产品状态 | 前端 | 后端 | Schema | DB表 | Prisma Client | 工程结论 |
|---|---|---:|---:|---:|---:|---:|---|
| Onboarding | ✅ 完成 | ✅ | ✅ | ✅ | ✅ | ✅ | **可发布** |
| Dashboard | ✅ 完成 | ✅ | ✅ | ✅ | ✅ | ✅ | **需冒烟** |
| Resume Center | ✅ 完成 | ❌ | ✅ | ❌ | ✅ | ❌ | **🔴 运行崩溃** |
| Pipeline | ✅ 完成 | ❌ | ✅ | ❌ | ✅ | ❌ | **🔴 运行崩溃** |
| Interview | ✅ 完成 | ✅ | ✅ | ❌ | ✅ | ❌ | **🔴 运行崩溃** |
| Job Posting | ⬜ 下一阶段 | ✅ | ✅ | ❌ | ✅ | ❌ | **🔴 运行崩溃** |
| Talent Pool | ⬜ 下一阶段 | ❌ | ✅ | ❌ | ✅ | ❌ | **🔴 运行崩溃** |
| Billing | 🔄 持续优化 | ✅ | ✅ | ✅ | ✅ | ✅ | **可复用** |
| Admin | ✅ 完成 | ✅ | ✅ | ✅ | ✅ | ✅ | **需权限核验** |

---

## 关键发现：Prisma 模型大面积缺失

### 问题

后端路由引用了 **17+ 个 Prisma 模型**，但这些模型**全部不在 `schema.prisma` 中**。

路由使用：

```ts
prisma.resume.findFirst()
prisma.recruitmentPipeline.create()
prisma.interviewSession.findUnique()
prisma.jobPosting.update()
```

但 Prisma Client 中不存在这些属性。

### 后果

| 层面 | 状态 |
|---|---|
| TypeScript 编译 | ❌ 报错 TS2339: Property 'xxx' does not exist |
| 运行时调用 | ❌ 崩溃：Cannot read property of undefined |
| 数据库表 | ✅ PostgreSQL 中已存在 |
| Prisma schema | ❌ 未建模 |

### 受影响路由

| 路由文件 | 引用缺失模型数 | 崩溃风险 |
|---|---|---|
| resume.routes.ts | 5 (Resume, ResumeProfile, RecruitmentPipeline, PipelineEvent, JobPosting) | 🔴 高 |
| enterprise-pipeline.routes.ts | 5 (RecruitmentPipeline, PipelineEvent, ResumeProfile, Resume, CandidateNote) | 🔴 高 |
| interview.routes.ts | 4 (InterviewSession, InterviewQuestion, InterviewEvaluation, ResumeProfile) | 🔴 高 |
| job-posting.routes.ts | 3 (JobPosting, RecruitmentChannel, RecruitmentChannelMapping) | 🔴 高 |
| talent.routes.ts | 2 (TalentProfile, CandidateMatch) | 🔴 高 |

### 根因

1. 数据库表由其他迁移脚本或外部系统创建
2. Prisma schema 从未同步这些模型
3. 路由文件假设模型存在，直接调用 `prisma.xxx`
4. 缺少 `prisma generate` 后的验证步骤

### 修复方案

| 步骤 | 操作 | 风险 |
|---|---|---|
| 1 | 在 schema.prisma 中添加缺失模型（与现有表结构匹配） | 低 |
| 2 | 运行 `prisma generate` 生成 Client | 低 |
| 3 | 验证路由 TS 编译通过 | 低 |
| 4 | 运行时冒烟测试 | 中 |

---

## 分模块核验

### Onboarding ✅ 可发布

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/workspace/enterprise/onboarding.vue` |
| 后端 | ✅ | `enterprise-onboarding.routes.ts` |
| Schema | ✅ | 5 个模型已添加（hotfix） |
| DB 表 | ✅ | `enterprise_job_workspace`, `enterprise_onboarding_state` 等 |
| Prisma Client | ✅ | 已验证可调用 |
| 鉴权 | ✅ | `preHandler: [fastify.authenticate]` |
| 闭环 | 待冒烟 | step1-4 + complete 流程需 staging 验证 |

### Dashboard ✅ 需冒烟

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/enterprise/dashboard.vue` |
| 后端 | ✅ | `enterprise-dashboard.routes.ts` |
| Schema | ✅ | EnterpriseProfile, EnterpriseSubscription |
| Prisma Client | ✅ | 已验证可调用 |
| 闭环 | 待冒烟 | 需验证 API 返回真实数据 |

### Resume Center 🔴 运行崩溃

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ❌ | 无独立 Resume Center 页面 |
| 后端 | ✅ | `resume.routes.ts` |
| Schema | ❌ | **Resume, ResumeProfile 未建模** |
| DB 表 | ✅ | `resume`, `resume_profile` 存在 |
| Prisma Client | ❌ | **调用即崩溃** |

### Pipeline 🔴 运行崩溃

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ❌ | 无独立 Pipeline Kanban 页面 |
| 后端 | ✅ | `enterprise-pipeline.routes.ts` |
| Schema | ❌ | **RecruitmentPipeline, PipelineEvent 未建模** |
| DB 表 | ✅ | `recruitment_pipeline`, `pipeline_event` 存在 |
| Prisma Client | ❌ | **调用即崩溃** |

### Interview 🔴 运行崩溃

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/workspace/enterprise/interview.vue` |
| 后端 | ✅ | `interview.routes.ts` |
| Schema | ❌ | **InterviewSession, InterviewQuestion, InterviewEvaluation 未建模** |
| DB 表 | ✅ | `interview_session`, `interview_question` 等存在 |
| Prisma Client | ❌ | **调用即崩溃** |

### Job Posting 🔴 运行崩溃

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/workspace/enterprise/jobs.vue` |
| 后端 | ✅ | `job-posting.routes.ts` |
| Schema | ❌ | **JobPosting, RecruitmentChannel 未建模** |
| DB 表 | ✅ | `job_posting`, `recruitment_channel` 存在 |
| Prisma Client | ❌ | **调用即崩溃** |

### Talent Pool 🔴 运行崩溃

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ❌ | 无独立 Talent Pool 页面 |
| 后端 | ✅ | `talent.routes.ts` |
| Schema | ❌ | **TalentProfile, CandidateMatch 未建模** |
| DB 表 | ✅ | `talent_profile`, `candidate_match` 存在 |
| Prisma Client | ❌ | **调用即崩溃** |

### Billing ✅ 可复用

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/workspace/enterprise/billing.vue` |
| 后端 | ✅ | `enterprise-billing.ts`, `enterprise-billing-extended.ts` |
| Schema | ✅ | Subscription, BillingRecord, EnterpriseSubscription |
| Prisma Client | ✅ | 已验证可调用 |

### Admin ✅ 需权限核验

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端 | ✅ | `frontend/pages/admin/enterprise/*.vue` (9个页面) |
| 后端 | ✅ | `admin-enterprises.ts`, `admin-enterprise-plans.ts` |
| Schema | ✅ | EnterpriseProfile, EnterprisePlan, EnterpriseSubscription |
| Prisma Client | ✅ | 已验证可调用 |
| 闭环 | 待核验 | 需验证权限校验是否生效 |

---

## 修正后的完成度

### 产品基线声称 vs 工程现实

| 模块 | 产品声称 | 工程现实 | 差异 |
|---|---|---|---|
| Onboarding | 完成 | ✅ 可发布 | 一致 |
| Dashboard | 完成 | ✅ 需冒烟 | 基本一致 |
| Resume Center | 完成 | 🔴 运行崩溃 | **严重偏差** |
| Pipeline | 完成 | 🔴 运行崩溃 | **严重偏差** |
| Interview | 完成 | 🔴 运行崩溃 | **严重偏差** |
| Job Posting | 下一阶段 | 🔴 运行崩溃 | **超预期偏差** |
| Talent Pool | 下一阶段 | 🔴 运行崩溃 | **超预期偏差** |
| Billing | 持续优化 | ✅ 可复用 | 一致 |
| Admin | 完成 | ✅ 需权限核验 | 基本一致 |

### 修正后状态

| 模块 | 修正状态 | 说明 |
|---|---|---|
| Onboarding | ✅ 完成 | hotfix 可进入 release |
| Dashboard | ✅ 完成 | 需冒烟验证 |
| Resume Center | 🔴 partial / preview | 前端缺失 + Prisma 崩溃 |
| Pipeline | 🔴 partial / preview | 前端缺失 + Prisma 崩溃 |
| Interview | 🔴 partial / preview | Prisma 崩溃 |
| Job Posting | 🔴 partial / preview | Prisma 崩溃 |
| Talent Pool | 🔴 partial / preview | 前端缺失 + Prisma 崩溃 |
| Billing | ✅ 持续优化 | 可复用 |
| Admin | ✅ 完成 | 需权限核验 |

### 企业招聘工作台整体状态

```
产品基线：Beta（5/9 模块完成）
工程现实：Preview（2/9 可发布，5/9 运行崩溃）
```

---

## 修复优先级

### P0：Prisma 模型补齐（阻塞发布）

| 模型 | 对应表 | 影响路由 | 工作量 |
|---|---|---|---|
| Resume | resume | resume.routes.ts | 1h |
| ResumeProfile | resume_profile | resume.routes.ts, enterprise-pipeline.routes.ts, interview.routes.ts | 1h |
| RecruitmentPipeline | recruitment_pipeline | enterprise-pipeline.routes.ts | 2h |
| PipelineEvent | pipeline_event | enterprise-pipeline.routes.ts | 1h |
| JobPosting | job_posting | job-posting.routes.ts | 2h |
| RecruitmentChannel | recruitment_channel | job-posting.routes.ts | 1h |
| RecruitmentChannelMapping | recruitment_channel_mapping | job-posting.routes.ts | 1h |
| InterviewSession | interview_session | interview.routes.ts | 2h |
| InterviewQuestion | interview_question | interview.routes.ts | 1h |
| InterviewEvaluation | interview_evaluation | interview.routes.ts | 1h |
| CandidateNote | candidate_note | enterprise-pipeline.routes.ts | 1h |
| TalentProfile | talent_profile | talent.routes.ts | 1h |
| CandidateMatch | candidate_match | talent.routes.ts | 1h |

**总计：~16h 工作量**

### P1：前端页面补齐

| 页面 | 影响 | 工作量 |
|---|---|---|
| Resume Center | 简历上传/管理 | 1d |
| Pipeline Kanban | 招聘管道可视化 | 2d |
| Talent Pool | 人才库管理 | 1d |

### P2：鉴权和企业归属校验

确保所有企业数据接口校验 workspace 归属。

---

## 结论

### 掌柜产品基线 ≠ 工程现实

1. **产品基线声称 5 个模块完成**，但工程上只有 2 个可发布
2. **Resume / Pipeline / Interview 不是"完成"状态**，而是"运行崩溃"状态
3. **数据库有表但 Prisma 没建模**——这是最大的技术债务
4. 路由直接调用 `prisma.xxx` 但模型不存在——**任何请求都会 500**

### 建议修正

1. 企业招聘工作台整体状态从 `beta` 下调为 `preview`
2. 产品基线标注的工程完成度需要与代码现实对齐
3. P0 优先补齐 13 个 Prisma 模型（~16h）
4. 前端页面可后续迭代补齐
5. 在 Prisma 模型补齐前，禁止对外发布企业招聘功能
