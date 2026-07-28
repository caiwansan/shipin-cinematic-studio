# Enterprise Recruitment — 架构红线

> Sprint 12.6 Governance Closure
> 生效日期：2026-07-28
> 适用范围：企业招聘工作台及关联域的所有后端/前端代码

---

## Rule 001 — 企业身份唯一源

```
❌ 禁止：
  prisma.jobCompanyProfile.create()
  prisma.jobCompanyProfile.findMany()
  prisma.enterprise.create()
  prisma.companyProfile.create()

✅ 允许：
  prisma.organization.findFirst()
  prisma.enterpriseProfile.findUnique()
  prisma.enterpriseProfile.update()
```

**原因**：`Organization` + `EnterpriseProfile` 是企业身份 SSOT。`JobCompanyProfile`(7593) 已被标记 deprecated，`JobPosting.enterpriseId` 应指向 `EnterpriseProfile` 而非旧表。

---

## Rule 002 — 候选人身份唯一源

```
❌ 禁止：
  prisma.jobCandidate.create()
  prisma.jobCandidate.find*()    ← 只读历史数据
  prisma.talentProfile.create()
  prisma.talentProfile.find*()   ← 只读历史数据
  prisma.resume.create()         ← 企业侧旧简历
  prisma.resumeProfile.create()  ← 旧简历画像

✅ 允许：
  prisma.careerProfile.create()
  prisma.careerProfile.findUnique()
  prisma.candidateResume.create()
  prisma.candidateCard.findFirst()
```

**原因**：`CareerProfile`(8339) 是候选人唯一真相源。`JobCandidate` 和 `TalentProfile` 已 `@@deprecated`，仅允许只读访问历史数据。新数据必须写入 `CareerProfile` 体系。

---

## Rule 003 — 招聘岗位唯一源

```
❌ 禁止：
  prisma.job.create()              ← 非招聘岗位（平台任务调度）
  prisma.mockJob.create()
  prisma.recruitmentJob.create()

✅ 允许：
  prisma.jobPosting.create()
  prisma.jobPosting.findMany()
  prisma.jobPosting.update()
```

**原因**：`JobPosting`(7835) 是招聘岗位唯一源。`Job`(2640) 是平台通用任务调度，名称易混淆但后者 `@@map("jobs")` 非招聘岗位。

---

## Rule 004 — 套餐唯一源

```
❌ 禁止：
  prisma.subscriptionPlan.create()   ← Gov 平台体系
  prisma.subscription.create()       ← Gov 平台体系
  prisma.memberPlan.create()         ← 旧会员体系
  prisma.agentPlan.create()          ← Agent 体系
  prisma.recruitmentPlan.create()    ← 招聘域体系
  prisma.recruitmentPlanTask.create()

✅ 允许：
  prisma.enterprisePlan.findUnique()
  prisma.enterprisePlan.create()
  prisma.enterpriseSubscription.create()
  prisma.enterpriseSubscription.findUnique()
  prisma.enterpriseEntitlement.checkAvailability()
```

**原因**：套餐定义散落在 **5 套体系、10+ 模型** 中。`EnterprisePlan`(2914) + `EnterpriseSubscription`(2944) + `EnterpriseEntitlement`(2974) 是企业域商业模型唯一真相源。

---

## Rule 005 — AI Employee 唯一源

```
❌ 禁止：
  prisma.enterpriseAgentWorkforce.create()  ← 招聘域重叠模型
  prisma.enterpriseAgentWorkforce.find*()   ← 只读历史数据
  prisma.agentLevelConfig.create()
  prisma.agentPlan.create()
  prisma.agentDefinition.create()           ← 平台层，非企业域

✅ 允许：
  prisma.enterpriseAgentProfile.create()
  prisma.enterpriseAgentInstance.create()
  prisma.enterpriseAgentProfile.findUnique()
  prisma.enterpriseAgentInstance.findMany()
```

**原因**：AI 员工有 4 套体系重叠。`EnterpriseAgentProfile`(6707) + `EnterpriseAgentInstance`(6751) 是企业域 AI 员工唯一真相源。

---

## Rule 006 — 面试唯一源

```
❌ 禁止：
  prisma.interviewRecord.create()    ← 与 InterviewSession 重叠
  prisma.interviewRecord.find*()     ← 只读历史数据

✅ 允许：
  prisma.interviewSession.create()
  prisma.interviewSession.findUnique()
  prisma.interviewEvaluation.create()
  prisma.interviewDecision.create()
```

**原因**：`InterviewSession`(7867) 是面试唯一源。`InterviewRecord`(8034) 功能重叠且关联路径不一致（通过 `CandidateMatch` 而非直接通过 `Workspace`）。

---

## Rule 007 — 前端入口唯一源

```
❌ 禁止：
  /workspace/recruitment/*         → 已 301 redirect
  /enterprise/*                    → 已 301 redirect（走 media-department）
  新增独立的前端入口前缀

✅ 允许：
  /workspace/enterprise/*          — 唯一入口
  /workspace/recruitment/*         — 仅保留 redirect，禁止新增页面
```

**原因**：历史原因有三套前端入口。`recruitment-redirect.global.ts` 和 `enterprise-redirect.global.ts` 已实现 301 跳转。禁止创建第四套。

---

## Rule 008 — API 前缀唯一源

```
❌ 禁止：
  /api/job/*                        → 旧求职者端，加 410
  /api/talent/*                     → 合并入 /api/enterprise/
  /api/resume/*                     → 合并入 /api/enterprise/
  /api/matching/*                   → 合并入 /api/enterprise/
  /api/candidate/*                  → 合并入 /api/enterprise/

✅ 允许：
  /api/enterprise/*                 — 唯一前缀
  /api/admin/recruitment/*          — 管理后台（独立入口）
```

**原因**：API 路由散落在 5+ 个前缀下。新功能必须使用 `/api/enterprise/*`。

---

## Rule 009 — 禁止绕过认证

```
❌ 禁止：
  routes/enterprise-talent-agent.ts — 当前无 preHandler 认证钩子
  routes/enterprise-interview-agent.ts — 当前无 preHandler 认证钩子
  任何新路由跳过 fastify.authenticate

✅ 必须：
  每个 route 文件开头有 fastify.addHook('preHandler', fastify.authenticate)
  或逐路由添加 preHandler: [fastify.authenticate]
```

---

## Rule 010 — 禁止裸写 API Key 和凭据

```
❌ 禁止：
  在 .env 文件中保存生产数据库密码
  在 docker-compose.yml 中硬编码 MinIO 凭据
  将 .env.bak.* 文件保留在工作目录
  在日志/错误消息中输出 API Key 原文

✅ 必须：
  .env 文件设置 chmod 600
  密钥管理走 CRYPTO_ENCRYPTION_KEY 加密
  备份文件及时删除
```

---

## 架构红线违背处理流程

```
发现违背
    ↓
立即标注 @deprecated
    ↓
通知技术负责人
    ↓
PR 必须附带说明为什么不能使用 SSOT
    ↓
架构委员会审批
    ↓
合入
```

---

*红线建立时间：2026-07-28*  
*共 10 条架构红线，覆盖企业招聘全链路*
