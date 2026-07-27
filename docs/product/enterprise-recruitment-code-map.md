# 企业招聘工作台 — 产品到代码映射

## 映射表

| 产品模块 | 前端页面 | 后端路由 | 数据模型 | 当前状态 | 缺口 | 下一步 |
|---|---|---|---|---|---|---|
| Onboarding | `frontend/pages/workspace/enterprise/onboarding.vue` | `enterprise-onboarding.routes.ts` → `/api/enterprise/onboarding/*` | EnterpriseJobWorkspace, EnterpriseOnboardingState, JobCompanyProfile, EnterpriseAgentWorkforce, EnterpriseRecruitmentNeeds | ✅ 已完成 / 🔄 路由 hotfix 已合并 | 冒烟验证 | staging 冒烟 |
| Dashboard | `frontend/pages/enterprise/dashboard.vue` | `enterprise-dashboard.routes.ts` / `enterprise-dashboard.ts` → `/api/enterprise/dashboard/*` | EnterpriseProfile, EnterpriseSubscription | ✅ 已完成 | 待验证 | staging 冒烟 |
| Resume Center | ❌ 无独立页面 | `resume.routes.ts` → `/api/resume/*` | ❌ 无 Resume 模型 | ⚠️ 缺失 | 前端页面 + 数据模型 | 待规划 |
| Pipeline | ❌ 无独立页面 | `enterprise-pipeline.routes.ts` → `/api/enterprise/pipeline/*` | PipelineStage, PipelineJob | ⚠️ 部分完成 | 前端页面 | 待规划 |
| Interview | `frontend/pages/workspace/enterprise/interview.vue` | `interview.routes.ts` / `interview-workspace.routes.ts` → `/api/interview/*` | ❌ 无 Interview 模型 | ⚠️ 部分完成 | 数据模型 | 待规划 |
| Job Posting | `frontend/pages/workspace/enterprise/jobs.vue` | `job-posting.routes.ts` → `/api/job-posting/*` | Job, JobQueue | ⚠️ 部分完成 | 待补全字段 | 下一阶段 |
| Talent Pool | ❌ 无独立页面 | `talent.routes.ts` → `/api/talent/*` | ❌ 无 TalentPool 模型 | ⚠️ 缺失 | 前端页面 + 数据模型 | 下一阶段 |
| Billing | `frontend/pages/workspace/enterprise/billing.vue` / `frontend/pages/enterprise/payment.vue` | `enterprise-billing.ts` / `enterprise-billing-extended.ts` → `/api/enterprise/billing/*` | SubscriptionPlan, Subscription, BillingRecord | ✅ 已完成 | 持续优化 | staging 冒烟 |
| Admin 后台 | `frontend/pages/admin/enterprise/*.vue` (9个) | `admin-enterprise-plans.ts` / `admin-enterprises.ts` → `/api/admin/*` | EnterpriseProfile, EnterprisePlan, EnterpriseSubscription | ✅ 已完成 | 待验证 | staging 冒烟 |

## 路由注册状态

| 路由文件 | 注册位置 | 状态 |
|---|---|---|
| enterprise-onboarding.routes.ts | index.ts (hotfix) | ✅ 已注册 / prefix: /api |
| enterprise-dashboard.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| enterprise-pipeline.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| enterprise-billing.ts | index.ts 动态导入 | ✅ 已注册 |
| resume.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| interview.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| interview-workspace.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| job-posting.routes.ts | index.ts 动态导入 | ✅ 已注册 |
| talent.routes.ts | index.ts 动态导入 | ✅ 已注册 |

## ID 关系说明

| ID | 关系 | 说明 |
|---|---|---|
| `enterprise` | 工作台主入口 | 企业工作台主路由前缀 `/workspace/enterprise/*` |
| `job` / `recruitment` | 业务域 | 企业招聘工作台业务域 `/workspace/job/*` |
| `enterprise-onboarding` | 开通流程 | 企业开通流程，仅首次使用 |

当前问题：`enterprise` 和 `job` 两个 ID 存在重叠，建议统一为 `enterprise` 作为工作台 ID，`recruitment` 作为业务域。

## 缺口总结

| 缺口 | 优先级 | 说明 |
|---|---|---|
| Resume 模型 | P1 | Prisma 无 Resume/Candidate 实体 |
| Resume 前端页面 | P1 | 无独立 Resume Center 页面 |
| Pipeline 前端页面 | P1 | 无 Kanban 视图 |
| Interview 模型 | P1 | 无 Interview/InterviewNote 实体 |
| TalentPool 模型 | P2 | 下一阶段 |
| Talent Pool 前端页面 | P2 | 下一阶段 |
| Candidate 模型 | P1 | 无 Candidate 实体 |
