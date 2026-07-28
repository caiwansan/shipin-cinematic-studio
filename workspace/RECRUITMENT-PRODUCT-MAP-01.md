# RECRUITMENT-PRODUCT-MAP-01.md

> Generated: 2026-07-28 18:30 CST
> Phase 1 of TASK-PRODUCT-REALITY-REBUILD-01

---

## 0. 核心问题

```
当前:
前端显示         → useAgentWorkforce         → /api/enterprise/media-department/agents
"AI 招聘部门"        (通用Agent组合)              (所有企业 Agent，含影视制作)
                     ↓
                  agent.length = 在招岗位数  ❌
                  agent.usage = 候选人数    ❌
                  getAgentLabel() 硬编码映射  ❌

应该:
前端显示         → useRecruitmentHome()       → /api/enterprise/home
"AI 招聘部门"        (真实招聘数据)               (JobPosting + CandidateMatch +
                                                   InterviewSession + Offer 等)
                     ↓
                  totalJobs = count(JobPosting)  ✅
                  totalCandidates = count(CandidateMatch)  ✅
                  funnel: 职位→简历→筛选→沟通→面试→Offer→录用  ✅
```

**修复路径: `useAgentWorkforce → useRecruitmentHome` — 只改一行 composable 就能换掉整个数据层。**

---

## 1. 用户真实流程地图

### 理想闭环（企业招聘 13 步）

```
登录
 ↓
[1] 进入招聘部门           → /workspace/enterprise
[2] 创建岗位 + AI生成JD    → CreateJobModal (当前跳转断裂)
[3] 发布岗位               → 后端 JobPosting API
[4] AI寻找人才             → TalentSearch Agent
[5] 人才匹配               → CandidateMatch 数据
[6] 沟通候选人             → RecruitmentConversation
[7] 评估简历               → ResumeParser
[8] AI面试                 → InterviewSession
[9] 面试评估               → 评估报告
[10] Offer                → Offer 管理
[11] 录用                  → Hire
[12] 入职                  → Onboarding (外部)
[13] 复盘分析              → Analytics
```

### 当前真实状态

| 步骤 | 前端 | 后端 API | 数据真实性 | 可用性 |
|------|------|----------|-----------|--------|
| ① 进入招聘部门 | RecruitmentModule | `/api/enterprise/home` ✅ 已注册 | ✅ 真实数据 (已就绪) | ⚠️ 前端未对接 |
| ② 创建岗位 | goToCreateJob() → 跳转迷路 | `/job-posting` 已注册 | ✅ 后端已就绪 | ❌ 跳转断裂 |
| ③ 发布岗位 | ❌ 无页面 | `/job-posting` 已注册 | ✅ 后端已就绪 | ❌ |
| ④ AI寻找人才 | AiTeamDisplay (假的) | enterprise-recruit-agent | ⚠️ Agent已定义未路由 | ❌ |
| ⑤ 人才匹配 | Pipeline 假数据 | `/pipeline` 已注册 | ✅ Pipeline API 已就绪 | ❌ 前端未对接 |
| ⑥ 沟通候选人 | ❌ 无页面 | `/api/enterprise/recruitment-conversation` | ⚠️ 注册了可能空路由 | ❌ |
| ⑦ 评估简历 | ❌ 无页面 | `/resume` 已注册 | ✅ Resume API 已就绪 | ❌ |
| ⑧ AI面试 | ❌ 无页面 | `/interview` 已注册 | ✅ Interview API 已就绪 | ❌ |
| ⑨ 面试评估 | ❌ 无页面 | (评估报告) | ❌ | ❌ |
| ⑩ Offer | Pipeline"Offer"假数字 | `/offer` | ❌ 可能不存在 | ❌ |
| ⑪ 录用 | ❌ | ❌ | ❌ | ❌ |
| ⑫ 入职 | ❌ | ❌ | ❌ | ❌ |
| ⑬ 分析 | ❌ | recruitment-analytics (空路由) | ❌ | ❌ |

---

## 2. 后端 API 全量清单

### ✅ 就绪可用（企业端）

| API 路径 | 文件 | 状态 | 说明 |
|----------|------|------|------|
| `GET /api/enterprise/home` | enterprise-home.ts | ✅ 已注册有endpoint | 企业首页仪表盘数据 |
| `GET /api/resume/*` | resume.routes.ts | ✅ Phase 5-B1 | 简历中心 |
| `GET /api/pipeline/*` | pipeline.routes.ts | ✅ Phase 5-B2 | Pipeline 阶段 |
| `GET /api/interview/*` | interview.routes.ts | ✅ Phase 5-B3 | 面试记录 |
| `GET /api/dashboard/*` | dashboard.routes.ts | ✅ Phase 5-B4 | 仪表盘 |
| `POST /api/job-posting/*` | job-posting.routes.ts | ✅ Phase 5-B5 | 岗位发布 |
| `POST /api/enterprise/job-intelligence` | enterprise-job-intelligence.routes.ts | ✅ | AI职位描述生成 |
| `POST /api/enterprise/agents/talent/*` | enterprise-talent-agent.ts | ✅ | 人才搜索/分析 |

### ⚠️ 已注册但可能空路由（企业端）

| API 路径 | 文件 | 行数 | 状态 |
|----------|------|------|------|
| `recruitmentDepartmentRoutes` (无prefix) | recruitment-department.routes.ts | 792行 | ❌ 0个endpoint |
| `recruitmentDirectorRoutes` (无prefix) | recruitment-director.routes.ts | ? | ❌ 0个endpoint |
| `/api/enterprise/recruitment-conversation` | recruitment-conversation.routes.ts | ? | ❌ 0个endpoint |
| `/api/enterprise/recruitment-campaign` | recruitment-campaign.routes.ts | ? | ❌ 0个endpoint |
| `/api/enterprise/recruitment-interview` | recruitment-interview.routes.ts | ? | ❌ 0个endpoint |
| `recruitmentAnalyticsRoutes` | recruitment-analytics.routes.ts | ? | ❌ 0个endpoint |

### 🔒 仅管理员（企业不可见）

#### /api/admin/recruitment/* (admin-recruitment.ts) — 100+ endpoints

| 端点 | 用途 | 包含的数据 |
|------|------|-----------|
| `GET /overview` | 平台总览 | 企业数、岗位数、候选人、面试数 |
| `GET /enterprises` | 企业列表 | 所有注册企业 |
| `GET /departments` | 招聘部门 | 所有企业的招聘部门 |
| `GET /agents` | AI员工管理 | 所有企业的Agent、状态统计 |
| `GET /agents/:id/model-binding` | Agent-模型绑定 | 各Agent绑定详情 |
| `GET /jobs` | 岗位管理 | 分页、筛选、企业隔离 |
| `GET /candidates` | 候选人管理 | 质量、状态、排序 |
| `GET /candidates/stats` | 候选人统计 | 各阶段分布 |
| `GET /reviews` | 审核列表 | 待审核、审核历史 |
| `POST /pipelines/:id/stage` | Pipeline阶段推进 | 阶段变更记录 |
| `GET /campaigns` | 招聘活动 | 各企业活动 |
| `GET /conversations` | 沟通记录 | 招聘互动 |
| `GET /interviews` | 面试记录 | 各企业面试 |
| `GET /audit` | 审计日志 | 操作审计 |
| `GET /revenue` | 收入分析 | 订阅收入漏斗 |
| `GET /revenue/ai-roi` | AI ROI 分析 | 节约成本和效率提升 |

### 📦 后端数据模型（已存在，可直接复用）

Recruitment Prisma models:
- `JobPosting` — 岗位发布
- `JobCandidate` — 候选人
- `CandidateMatch` — 候选人匹配
- `RecruitmentPipeline` — 招聘Pipeline
- `PipelineEvent` — Pipeline事件
- `RecruitmentConversation` — 沟通记录
- `InterviewSession` — 面试记录
- `RecruitmentCampaign` — 招聘活动
- `Offer` — Offer记录
- `EnterpriseAgentInstance` — AI员工实例
- `EnterpriseAgentProfile` — AI员工资料
- `EnterpriseAgentWorkforce` — AI员工工位

### 📁 Repository 层（可直接复用，已注入 enterpriseId 隔离）

| 文件 | 功能 |
|------|------|
| `repositories/recruitment/enterprise-home.repository.ts` | 企业首页查询（已按 enterpriseId 隔离） |
| `repositories/recruitment/job.repository.ts` | 岗位查询 |
| `repositories/recruitment/candidate.repository.ts` | 候选人查询 |
| `repositories/recruitment/pipeline/...` | Pipeline数据 |
| `repositories/recruitment/interview.repository.ts` | 面试查询 |
| `repositories/recruitment/conversation.repository.ts` | 沟通记录 |
| `repositories/recruitment/campaign/...` | 活动查询 |
| `repositories/recruitment/audit.repository.ts` | 审计日志 |

---

## 3. 前端组件 ↔ 真实数据映射（修正方案）

### 当前 RecruitmentModule

| 区块 | 当前数据来源 | 问题 | 修正后数据来源 |
|------|-------------|------|---------------|
| KPI网格(在招/候选人/待处理/AI在办) | agent.length + agent.usage | ❌ Agent数=岗位数 | `/api/enterprise/home` → todayMetrics: jobs, resumes, screening |
| Pipeline(岗位→匹配中→候选人→待处理→Offer) | 前端computed默认值 | ❌ 全是假数字 | `/api/enterprise/home` → funnel 7段: 职位→简历→筛选→沟通→面试→Offer→录用 |
| AI建议 | 前端if判断 | ❌ 静态条件 | `/api/enterprise/home` → needsAttention: 待确认摘要/待审核评估/待发送Offer |
| AI招聘团队 | media-department/agents 通用Agent | ❌ 含影视Agent | 新建 `GET /api/enterprise/recruitment/agents` 3个招聘类型Agent |
| Agent卡片 | agent.type硬编码映射 | ❌ labels不真实 | 后端AgentProfile.agentType: marketing/recruiter/interview |
| 今日任务 | agent.usage(伪) | ❌ 假任务数 | `/api/enterprise/home` → todayMetrics.pending* |

### 企业首页数据结构（EnterpriseHomeDTO — 来自 enterprise-home.mapper.ts）

```typescript
// 这就是前端应该展示的数据
interface EnterpriseHomeDTO {
  todayMetrics: {
    conversations: number    // 今日沟通
    interviews: number      // 今日面试
    campaigns: number       // 今日活动
    newResumes: number      // 今日新简历
    offers: number          // 今日Offer
    hires: number           // 今日录用
    pendingCandidates: number  // 待处理候选人
    pendingJobs: number        // 待处理岗位
    pendingResumes: number     // 待处理简历
  }
  funnel: [
    { label: '职位', value: N },
    { label: '收到简历', value: N },
    { label: '筛选', value: N },
    { label: '沟通', value: N },
    { label: '面试', value: N },
    { label: 'Offer', value: N },
    { label: '录用', value: N },
  ]
  needsAttention: [
    { label: '候选人摘要待确认', count: N },
    { label: '面试评估待审核', count: N },
    { label: 'Offer 待发送', count: N },
  ]
  activityFeed: [
    { time: '09:30', text: '新沟通开始', type: 'conversation' },
    { time: '10:15', text: '面试通过', type: 'interview' },
  ]
  departmentHealth: {
    status: 'healthy' | 'warning' | 'critical'
    message: string
    activeCount: number
    pausedCount: number
  }
}
```

---

## 4. 创建岗位跳转断裂

### 当前流程

```
RecruitmentModule
  ↓ 点击「创建岗位」
  ↓ goToCreateJob()
  ↓ window.location.href = '/workspace/enterprise/jobs'
  ↓ Layout enterprise.vue 载入
  ↓ initFromRoute('jobs') → 不匹配任何模块 → fallback to dashboard
  ↓ 用户看到 DashboardModule (完全无关)
```

### 修复方案

```
点击「创建岗位」
  ↓
打开 CreateJobModal（inline overlay，不跳页）
  ↓
输入: 岗位名称 + 部门 + 描述
  ↓
AI 生成 JD → POST /api/enterprise/job-intelligence
  ↓
展示生成结果 → 用户确认
  ↓
发布 → POST /api/job-posting
  ↓
关闭 Modal → 刷新 RecruitmentModule 首页数据
```

**或者**：修复 Layout 匹配，让 `enterprise/jobs` 显示招聘模块。

---

## 5. Agent 链路

### 后端已定义的 3 个招聘Agent

```typescript
const RECRUITMENT_AGENT_TYPES = {
  marketing: {
    code: 'marketing',
    name: 'AI Recruitment Marketing Agent',
    shortName: '招聘宣传官',
    capabilities: ['岗位发布', '社交媒体宣发', '社群运营', '招聘互动', '活动推广'],
  },
  recruiter: {
    code: 'recruiter',
    name: 'Enterprise Recruiter Agent',
    shortName: 'AI 招聘官',
    capabilities: ['人才扫描', '候选人排序', '主动沟通', '资料收集', 'Candidate Brief'],
  },
  interview: {
    code: 'interview',
    name: 'AI Interview Agent',
    shortName: 'AI 面试官',
    capabilities: ['初面', '技术面', '英语测试', '行为面试', '自动纪要', '面试报告'],
  },
}
```

### 路怎么修

```typescript
// 在 recruitment-department.routes.ts 中加入:
fastify.get('/api/enterprise/recruitment/agents', async (request, reply) => {
  const enterpriseId = getEnterpriseContext(userId)
  const workforce = await prisma.enterpriseAgentWorkforce.findMany({
    where: { workspace: { enterpriseId } },
    include: { profile: true, modelBinding: true },
  })
  return { data: workforce }
})
```

### 不需要新建数据库模型、不需要新建 Agent

已有 `EnterpriseAgentProfile`、`EnterpriseAgentInstance`、`EnterpriseAgentWorkforce`。只需要把 workforce 查出来返回。

---

## 6. 死代码清单

### 可删除（先check是否被任何API catch）

| 文件 | 行数 | 原因 |
|------|------|------|
| `routes/recruitment-department.routes.ts` | 792 | 已注册但0 endpoint，纯定义 |
| `routes/recruitment-director.routes.ts` | ? | 同上 |
| `routes/recruitment-campaign.routes.ts` | ? | 同上 |
| `routes/recruitment-interview.routes.ts` | ? | 同上 |
| `routes/recruitment-analytics.routes.ts` | ? | 同上 |
| `services/recruitment-orchestrator.service.ts` | ? | 未被任何 route 调用 |
| `services/recruitment-action.service.ts` | ? | 未被任何 route 调用 |
| `services/recruitment-context-builder.ts` | ? | 未被任何 route 调用 |

### 如果这些死代码将来要用，保留 route 定义但增加 endpoint 注册

---

## 7. 决策路径图

```
当前
  │
  ├── Option A: 最小修复 (2天)
  │   ├── ① Register 3个招聘Agent endpoint → GET /api/enterprise/recruitment/agents
  │   ├── ② 创建 useRecruitmentHome() composable → 对接 /api/enterprise/home
  │   ├── ③ RecruitmentModule 换数据源 (删除 useAgentWorkforce)
  │   ├── ④ CreateJobModal inline (不跳转)
  │   └── ⑤ 删除 getAgentLabel() 假映射
  │   └── → KPI真实、Agent真实、创建岗位闭环
  │
  ├── Option B: 完整修复 (5天)
  │   ├── ①+②+③+④+⑤ (同上)
  │   ├── ⑥ 加入 candidate → pipeline → interview 页面
  │   ├── ⑦ Offer 管理页面
  │   └── ⑧ 删除死代码 (recruitment-department 等)
  │   └── → 招聘流程 4/13 → 7/13 步可走通
  │
  └── Option C: 重写 (不推荐)
      └── 掌柜说不要重写
```

**推荐: Option A — 最小修复。** 后端 80% 的数据已就绪，只需要前端换连线和几个浅 endpoint。

---

## 附录: 当前前端正在显示的假数据一览

### RecruitmentModule.vue stats computed

```typescript
stats = computed(() => {
  const instances = workforceState.value.instances
  return {
    totalJobs: instances.length,              // ❌ Agent数 = 在招岗位数
    matchingTasks: instances.filter(i => i.status === 'active').length, // ❌ 活跃Agent = 匹配中
    totalCandidates: instances.reduce((sum, i) => sum + (i.usage || 0), 0), // ❌ usage总和 = 候选人数
    pendingReview: instances.reduce((sum, i) => sum + (i.usage || 0), 0), // ❌ 同一个usage = 待处理
  }
})
```

### pipelineFlow

```typescript
pipelineFlow = computed(() => {
  return [
    { label: '岗位', icon: '📋', count: stats.value.totalJobs },         // agent.length
    { label: '匹配中', icon: '🔍', count: stats.value.matchingTasks },   // active agent数
    { label: '候选人', icon: '📄', count: stats.value.totalCandidates }, // usage总和
    { label: '待处理', icon: '🎤', count: stats.value.pendingReview },   // usage总和
    { label: 'Offer', icon: '📨', count: 0 },                           // ❌ 硬编码0
  ]
})
```

### getAgentLabel

```typescript
function getAgentLabel(type: string): string {
  const map: Record<string, string> = {
    recruiter: '招聘经理',        // ❌ 通用类型 → 招聘标签
    recruiter_director: '招聘总监',
    talent_scout: '猎聘顾问',
    talent_researcher: '人才研究员',
    interviewer: '面试官',
    screener: '简历筛选',
    coordinator: '招聘协调员',
    campaign: '招聘活动经理',
    analyst: '招聘分析师',
  }
  return map[type] || 'AI 员工'
}
```
这些 type 只是通用 AgentProfile.agentType 的值，不是招聘部门定义的值。

---

### 综述

后端有招聘数据。后端有招聘模型。后端有招聘API。

**唯一缺的是一层薄薄的 enterprise-facing route，和一个用对了的 composable。**

这不是重写工程，是指路工程。
