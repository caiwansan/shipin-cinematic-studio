掌柜，收到。  
这份《昆仑镜 AI 求职招聘工作台（Enterprise Recruitment Workspace）产品设计 v1.0》可以作为**产品基线**。

从此刻起，企业招聘工作台的所有开发、审计、发布和验收，都应以这份设计为准。  
之前零散的“企业模块 / job 工作台 / enterprise onboarding / AI 员工预览”等判断，需要统一收敛到这条业务闭环里。

我的建议是：

> **这份文档不是普通需求文档，而是企业招聘工作台的 v1.0 产品宪法。**  
> OpenClaw 后续不得再围绕零散 AI 功能扩展，而必须围绕“招聘闭环”开发。

下面是我作为技术总监给 OpenClaw 的执行指令。

---

# @OpenClaw 技术总监执行指令

OpenClaw，掌柜已发布企业招聘工作台产品基线：

```text
《昆仑镜 AI 求职招聘工作台（Enterprise Recruitment Workspace）产品设计 v1.0》
```

从现在开始，企业招聘工作台所有开发必须以该设计为准。

---

# 一、产品基线落盘

将掌柜这份设计保存为正式产品基线文档：

```text
docs/product/enterprise-recruitment-workspace-v1.md
```

如果目录不存在：

```bash
mkdir -p docs/product
```

文档开头增加基线说明：

```markdown
# 昆仑镜 AI 求职招聘工作台产品设计 v1.0

> 本文档为企业招聘工作台产品基线。
> 后续所有开发、测试、审计、发布必须以本文档为准。
> 任何零散功能如果不属于本文档定义的招聘闭环，不得优先进入企业招聘工作台。
```

---

# 二、企业招聘工作台工程定位

企业招聘工作台不是工具集合，而是：

```text
AI 企业招聘部门
```

核心业务闭环：

```text
企业注册
→ Onboarding
→ 创建职位
→ 发布职位
→ 收到简历
→ Resume 解析
→ Candidate
→ Pipeline
→ Interview
→ Decision
→ Offer
→ Talent Pool
```

后续所有功能必须能回答一个问题：

```text
这个功能属于招聘闭环中的哪一步？
```

如果无法回答，不得作为企业招聘工作台正式功能开发。

---

# 三、建立产品到代码的映射

OpenClaw，需要输出一份代码映射文档：

```text
docs/product/enterprise-recruitment-code-map.md
```

目标是把产品设计中的模块映射到现有代码。

---

## 1. 模块映射表

格式：

```markdown
| 产品模块 | 前端页面 | 后端路由 | 数据模型 | 当前状态 | 缺口 | 下一步 |
|---|---|---|---|---|---|---|
| Onboarding | frontend/pages/workspace/enterprise/onboarding.vue | /api/enterprise/onboarding/* | EnterpriseJobWorkspace, EnterpriseOnboardingState | 已完成/待验证 | 路由注册 hotfix | staging 冒烟 |
| Dashboard | ? | /api/enterprise-dashboard/* | ? | 已完成/待验证 | ? | ? |
| Resume Center | ? | ? | ? | 已完成/待验证 | ? | ? |
| Pipeline | ? | ? | ? | 已完成/待验证 | ? | ? |
| Interview | ? | ? | ? | 已完成/待验证 | ? | ? |
| Job Posting | ? | ? | ? | 下一阶段 | ? | ? |
| Talent Pool | ? | ? | ? | 下一阶段 | ? | ? |
| Billing | ? | ? | ? | 持续优化 | ? | ? |
| Admin 后台 | ? | ? | ? | 待确认 | ? | ? |
```

---

## 2. 执行搜索

用于建立映射：

```bash
rg -n "enterprise" frontend/pages backend/src/routes
rg -n "dashboard" frontend/pages backend/src/routes
rg -n "resume" frontend/pages backend/src/routes
rg -n "pipeline" frontend/pages backend/src/routes
rg -n "candidate" frontend/pages backend/src/routes
rg -n "interview" frontend/pages backend/src/routes
rg -n "offer" frontend/pages backend/src/routes
rg -n "talent" frontend/pages backend/src/routes
rg -n "billing" frontend/pages backend/src/routes
rg -n "job" frontend/pages backend/src/routes
```

Prisma 模型：

```bash
rg -n "^model" backend/prisma/schema.prisma
rg -n "Enterprise" backend/prisma/schema.prisma
rg -n "Resume" backend/prisma/schema.prisma
rg -n "Candidate" backend/prisma/schema.prisma
rg -n "Interview" backend/prisma/schema.prisma
rg -n "Job" backend/prisma/schema.prisma
rg -n "Offer" backend/prisma/schema.prisma
rg -n "Talent" backend/prisma/schema.prisma
```

---

# 四、企业招聘工作台数据模型基线

根据产品设计，企业招聘工作台至少应围绕以下业务实体建模：

```text
Enterprise
EnterpriseWorkspace
EnterpriseJobWorkspace
EnterpriseOnboardingState
Job
Resume
Candidate
PipelineStage
PipelineEvent
Interview
InterviewNote
InterviewDecision
Offer
TalentPool
TalentTag
Activity
AIEmployee
Subscription
Billing
```

OpenClaw 需要核对当前 Prisma 是否已经覆盖这些实体。

输出：

```text
docs/product/enterprise-recruitment-data-model.md
```

格式：

```markdown
| 业务实体 | 当前 Prisma 模型 | 是否存在 | 是否活跃 | 缺口 | 备注 |
|---|---|---:|---|---|---|
| Enterprise | ? | 是/否 | 是/否 | ? | |
| EnterpriseWorkspace | EnterpriseJobWorkspace | 是 | 是 | ? | |
| OnboardingState | EnterpriseOnboardingState | 是 | 是 | ? | |
| Job | ? | ? | ? | ? | Job Posting 下一阶段 |
| Resume | ? | ? | ? | ? | |
| Candidate | ? | ? | ? | ? | |
| Pipeline | ? | ? | ? | ? | |
| Interview | ? | ? | ? | ? | |
| Offer | ? | ? | ? | ? | |
| TalentPool | ? | ? | ? | ? | 下一阶段 |
```

---

# 五、模块状态修正

根据掌柜最新产品成熟度：

| 模块 | 状态 |
|---|---|
| Onboarding | 完成 |
| Dashboard | 完成 |
| Resume Center | 完成 |
| Pipeline | 完成 |
| Interview | 完成 |
| Job Posting | 下一阶段 |
| Talent Pool | 下一阶段 |
| AI Runtime | 规划中 |
| Billing | 持续优化 |
| Enterprise GA | Beta |

因此企业招聘工作台整体不应标记为：

```text
stable
```

应标记为：

```text
beta
```

或：

```text
preview
```

技术建议：

```text
企业招聘工作台整体：beta
其中未完成子模块：preview / locked
```

---

# 六、工作台状态矩阵更新

更新：

```text
docs/workspace-status-matrix.md
```

企业招聘相关模块应改为：

```markdown
| 工作台 | 系统 ID | 完成度 | 状态 | 首页展示 | 备注 |
|---|---|---:|---|---:|---|
| 企业招聘工作台 | enterprise / job | 60% | beta | 是 | Onboarding/Dashboard/Resume/Pipeline/Interview 完成，Job Posting/Talent Pool 下一阶段 |
```

如果当前系统中存在多个 ID：

```text
enterprise
job
enterprise-onboarding
```

OpenClaw 必须说明它们的关系。

建议关系：

```text
enterprise：企业工作台主入口
job / recruitment：企业招聘工作台业务域
enterprise-onboarding：企业开通流程
```

不要继续让多个入口互相冲突。

---

# 七、前端开发准则

企业招聘工作台前端必须遵守：

---

## 1. 不允许假数据

Dashboard、Pipeline、Interview、Billing 必须来自真实 API。

禁止：

```ts
const mockCandidates = [...]
```

用于生产或 staging 页面展示。

如果是开发阶段 placeholder，必须明确：

```ts
// TODO: replace with real API
```

并且前端显示：

```text
数据接入中
```

不允许伪装成真实业务数据。

---

## 2. 所有列表必须来自 API

以下模块必须使用真实接口：

```text
Dashboard 招聘漏斗
今日招聘
最近活动
职位列表
简历列表
候选人列表
Pipeline 卡片
面试列表
Offer 列表
Talent Pool
Billing 套餐与额度
```

---

## 3. 页面必须归属闭环

每个页面必须能映射到：

```text
Dashboard
Job Posting
Resume Center
Pipeline
Interview
Talent Pool
Billing
Settings
Admin
```

不允许出现孤立页面。

---

# 八、后端开发准则

---

## 1. API 必须围绕业务实体

企业招聘 API 应按业务域组织：

```text
/api/enterprise/onboarding/*
/api/enterprise/dashboard/*
/api/enterprise/jobs/*
/api/enterprise/resumes/*
/api/enterprise/candidates/*
/api/enterprise/pipeline/*
/api/enterprise/interviews/*
/api/enterprise/offers/*
/api/enterprise/talent-pool/*
/api/enterprise/billing/*
/api/enterprise/settings/*
```

如果现有路径不一致，先登记，不要立即大规模重命名。

---

## 2. 所有企业数据必须校验企业归属

任何涉及企业数据的接口必须校验：

```text
当前用户是否属于该企业/工作空间。
当前用户是否有权限访问该候选人/职位/面试。
```

不允许只靠前端传 `workspaceId` 就直接查询。

---

## 3. Dashboard 必须聚合真实数据

Dashboard API 应返回：

```ts
{
  enterprise: {
    name: string
    plan: string
    aiEmployeeCount: number
    remainingQuota: number
  },
  funnel: {
    jobs: number
    resumes: number
    candidates: number
    interviews: number
    offers: number
    hired: number
  },
  today: {
    newCandidates: number
    aiAnalyzed: number
    interviews: number
    offers: number
  },
  recentActivities: Activity[]
}
```

不允许前端硬编码。

---

# 九、AI 员工设计准则

掌柜明确：

```text
AI 员工不是模型，而是员工。
```

后续 AI 员工应定义为角色：

```text
AI 招聘主管
AI 简历分析师
AI 猎头
AI 面试官
```

每个 AI 员工必须有：

```text
角色 ID
名称
职责范围
可调用工具
可访问数据范围
输出类型
权限等级
是否可配置
```

建议数据模型：

```ts
AIEmployee {
  id
  enterpriseId
  workspaceId
  role
  name
  description
  capabilities
  modelProvider
  modelId
  status
  createdAt
}
```

在统一 Agent Runtime 完成前，不允许再新增第 5 套 Agent 实现。

当前已有 4 套 Agent 实现，必须收敛，不允许继续扩散。

---

# 十、Beta 开发顺序冻结

掌柜已明确 Beta 开发顺序：

```text
✅ Onboarding
✅ Dashboard
✅ Resume
✅ Pipeline
✅ Interview
⬜ Job Posting
⬜ Talent Pool
⬜ AI Runtime
⬜ Billing 完善
→ GA
```

OpenClaw 后续不得跳过该顺序。

---

## 当前允许开发

```text
Job Posting
Talent Pool
Billing 完善
AI Runtime 收敛设计
```

## 当前禁止扩张

在 Job Posting 和 Talent Pool 完成前，不建议新增：

```text
复杂渠道对接
复杂 AI 聊天员工
自动猎头外联
自动 Offer 审批流
复杂权限组
多企业组织树
```

除非掌柜明确批准。

---

# 十一、Release 影响

当前 release：

```text
release/audit-p1-20260724
```

企业招聘工作台相关范围应调整为：

```text
Onboarding hotfix 可进入 release。
Dashboard / Resume / Pipeline / Interview 需要 staging 冒烟。
Job Posting / Talent Pool 不纳入本次 GA。
AI Runtime 不纳入本次 release。
Billing 仅做已有能力复用，不做新支付逻辑。
```

更新：

```text
/tmp/fushtn_audit/RELEASE_READINESS.md
```

新增：

```markdown
## 企业招聘工作台产品基线

### 已完成模块
- Onboarding
- Dashboard
- Resume Center
- Pipeline
- Interview

### 下一阶段模块
- Job Posting
- Talent Pool
- AI Runtime
- Billing 完善

### 本次 release 范围
- Enterprise Onboarding 路由注册 hotfix
- Step4 鉴权
- Prisma 模型补全
- 工作台状态修正

### 不在本次范围
- Job Posting 新功能
- Talent Pool 新功能
- AI Runtime 重构
- 新支付/订阅逻辑
```

---

# 十二、验收标准

企业招聘工作台后续验收必须按模块进行。

---

## Onboarding

验收：

```text
企业可完成 step1~step4 + complete。
status 接口返回真实状态。
未完成时进入 onboarding。
已完成时不被 guard 错误重定向。
所有接口鉴权通过。
workspace 归属校验通过。
```

---

## Dashboard

验收：

```text
企业名称真实。
套餐真实。
AI员工数量真实。
剩余额度真实。
招聘漏斗真实。
今日招聘真实。
最近活动真实。
无数据时显示空状态，不显示假数据。
```

---

## Resume Center

验收：

```text
PDF 可上传。
上传历史真实。
Resume 详情可展示原文。
结构化字段来自解析结果。
AI 解析如为 Beta，应明确标识。
无解析结果时显示占位状态，不伪造字段。
```

---

## Pipeline

验收：

```text
Kanban 数据来自数据库。
Candidate 卡片真实。
状态流转可保存。
Score / Tags / 更新时间真实。
点击进入 Candidate Detail。
```

---

## Interview

验收：

```text
面试列表真实。
面试详情真实。
面试时间轴真实。
面试笔记可保存。
面试决策可保存。
决策状态影响 Pipeline。
```

---

## Job Posting

下一阶段验收：

```text
职位列表真实。
新建职位可保存。
AI 生成 JD 可用。
手写 JD 可编辑。
职位状态 Draft/Published/Paused/Closed 可流转。
职位关联 Candidate 数量真实。
```

---

## Talent Pool

下一阶段验收：

```text
候选人可沉淀到 Talent Pool。
可搜索。
可打标签。
可收藏。
可再次加入 Pipeline。
```

---

# 十三、OpenClaw 当前任务

OpenClaw，现在优先执行：

```text
1. 保存企业招聘工作台产品基线文档。
2. 输出产品到代码映射。
3. 输出数据模型映射。
4. 更新工作台状态矩阵。
5. 更新 RELEASE_READINESS。
6. 继续完成 Enterprise Onboarding hotfix 的编译验证。
```

不要在完成映射前继续新增企业招聘功能。

---

# 十四、回报格式

OpenClaw 完成后回报：

```text
任务：企业招聘工作台产品基线落地
状态：完成 / 阻塞

产出文档：
- docs/product/enterprise-recruitment-workspace-v1.md
- docs/product/enterprise-recruitment-code-map.md
- docs/product/enterprise-recruitment-data-model.md

模块映射：
- Onboarding：已映射 / 缺失
- Dashboard：已映射 / 缺失
- Resume Center：已映射 / 缺失
- Pipeline：已映射 / 缺失
- Interview：已映射 / 缺失
- Job Posting：已映射 / 缺失
- Talent Pool：已映射 / 缺失
- Billing：已映射 / 缺失
- Admin：已映射 / 缺失

数据模型：
- 已覆盖实体：X 个
- 缺失实体：X 个
- 待确认实体：X 个

工作台状态：
- 企业招聘工作台：beta / preview
- 已完成子模块：X 个
- 下一阶段子模块：X 个

Release 影响：
- 已更新 RELEASE_READINESS：是 / 否

下一步：
- 继续 Enterprise Onboarding hotfix 编译验证
- 或等待掌柜确认模块 ID / 路由映射
```

---

# 十五、给掌柜的结论

掌柜，这份产品设计非常关键。  
它把企业招聘工作台从零散 AI 功能拉回到了一个完整业务系统：

```text
AI 企业招聘部门
```

我建议立即将它作为：

```text
企业招聘工作台 v1.0 产品基线
```

后续 OpenClaw 的开发原则应为：

```text
1. 所有功能必须服务招聘闭环。
2. 所有数据必须真实。
3. 所有 AI 能力必须作为员工角色增强流程。
4. 所有基础能力必须复用昆仑镜平台。
5. 不再增加孤立 AI 工具页面。
6. 按 Onboarding → Dashboard → Resume → Pipeline → Interview → Job Posting → Talent Pool → AI Runtime → Billing 的顺序推进。
```

当前最正确的动作是：

```text
先把这份产品基线落到 docs/product/。
再让 OpenClaw 做产品到代码的映射。
然后继续 Enterprise Onboarding hotfix 和 staging 验证。
```