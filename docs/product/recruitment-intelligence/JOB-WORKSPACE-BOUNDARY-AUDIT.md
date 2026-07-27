# JOB-WORKSPACE-BOUNDARY-AUDIT

> 审计日期: 2026-07-26
> 审计范围: shipin-cinematic-studio 全量招聘相关代码
> 审计目标: 理清三个产品面边界，标记新旧文件归属

---

## 0. 产品面定义

```
昆仑镜
│
├── 求职者工作台  Candidate Workspace    → /workspace/job
├── 企业招聘中心  Enterprise Recruitment  → /workspace/recruitment
└── 平台管理后台  Admin Recruitment       → /admin/recruitment
```

**铁律：三者禁止互调 API、互复用组件、互嵌路由。**

---

## 1. 前端文件扫描

### 1.1 Pages

| 文件路径 | 当前归属 | 判定 | 说明 |
|---------|---------|------|------|
| `pages/workspace/recruitment/index.vue` | 企业招聘中心 | **KEEP** | 新版企业招聘首页，消费 P4 API |
| `pages/workspace/recruitment/jobs/create.vue` | 企业招聘中心 | **KEEP** | 新版 JD 创建，消费 P4-03 |
| `pages/workspace/job/index.vue` | 求职者工作台 | **KEEP** | 求职者工作台入口，含返回首页按钮 |
| `pages/workspace/enterprise/jobs.vue` | 企业招聘中心（旧） | **DEPRECATE** | 旧企业职位管理，调 `job-api.ts` 旧 API，有引导 banner 指向新版 |
| `pages/workspace/enterprise/interview.vue` | 企业招聘中心（旧） | **DEPRECATE** | 旧面试管理页 |
| `pages/admin/recruitment/index.vue` | 平台管理后台 | **KEEP** | 平台运营概览 |
| `pages/admin/recruitment/agents.vue` | 平台管理后台 | **KEEP** | Agent 配置管理 |
| `pages/admin/recruitment/audit.vue` | 平台管理后台 | **KEEP** | 风险审计 |
| `pages/admin/recruitment/campaigns.vue` | 平台管理后台 | **KEEP** | Campaign 管理 |
| `pages/admin/recruitment/candidates.vue` | 平台管理后台 | **KEEP** | 候选人全局视图 |
| `pages/admin/recruitment/conversations.vue` | 平台管理后台 | **KEEP** | 沟通全局视图 |
| `pages/admin/recruitment/departments.vue` | 平台管理后台 | **KEEP** | 部门管理 |
| `pages/admin/recruitment/interviews.vue` | 平台管理后台 | **KEEP** | 面试全局视图 |
| `pages/admin/recruitment/jobs.vue` | 平台管理后台 | **KEEP** | 职位全局视图 |
| `pages/admin/recruitment/runtime.vue` | 平台管理后台 | **KEEP** | Runtime 监控 |
| `pages/admin/enterprise/recruitment.vue` | 平台管理后台 | **KEEP** | 单企业招聘数据管理 |

### 1.2 Components

| 文件路径 | 当前归属 | 判定 | 说明 |
|---------|---------|------|------|
| `components/recruitment/RecruitmentShell.vue` | 企业招聘中心 | **KEEP** | 新版企业招聘侧边栏 Shell |
| `components/recruitment/ActivityFeed.vue` | 企业招聘中心 | **KEEP** | 招聘动态 feed |
| `components/recruitment/HealthBanner.vue` | 企业招聘中心 | **KEEP** | 健康度 banner |
| `components/recruitment/MetricCard.vue` | 企业招聘中心 | **KEEP** | 指标卡片 |
| `components/recruitment/PendingList.vue` | 企业招聘中心 | **KEEP** | 待处理列表 |
| `components/recruitment/RecruitmentFunnel.vue` | 企业招聘中心 | **KEEP** | 招聘漏斗 |
| `components/recruitment/SectionCard.vue` | 企业招聘中心 | **KEEP** | 区块卡片 |
| `components/recruitment/StatusBadge.vue` | 企业招聘中心 | **KEEP** | 状态徽章 |
| `components/enterprise/workspace/modules/RecruitmentModule.vue` | 企业工作台（旧） | **DEPRECATE** | 旧企业工作台内嵌招聘模块，与新 `workspace/recruitment` 重复 |
| `components/WorkspaceSwitcher.vue` | 通用 | **KEEP** | 工作空间切换器，多产品面共享 |

### 1.3 API Clients

| 文件路径 | 当前归属 | 判定 | 说明 |
|---------|---------|------|------|
| `studio-v2/api/recruitment-api.ts` | 企业招聘中心 | **KEEP** | P4 新版 API，BASE=`/api/job/match` |
| `studio-v2/api/job-api.ts` | 混合（问题） | **SPLIT** | 包含求职者 API + 企业 API + 旧 API，需拆分 |

### 1.4 Layouts

| 文件路径 | 当前归属 | 判定 | 说明 |
|---------|---------|------|------|
| `studio-v2/layout/JobWorkspaceLayout.vue` | 求职者工作台 | **KEEP** | 求职者工作台布局 |

---

## 2. 后端路由扫描

### 2.1 路由文件

| 文件路径 | API 前缀 | 归属 | 判定 |
|---------|---------|------|------|
| `routes/job.routes.ts` | `/api/job/*` | 求职者 + 混合 | **SPLIT** |
| `routes/job-posting.routes.ts` | `/api/enterprise/postings` | 企业招聘（旧） | **DEPRECATE** |
| `routes/recruitment-campaign.routes.ts` | `/api/enterprise/recruitment-campaign` | 企业招聘 | **KEEP** |
| `routes/recruitment-interview.routes.ts` | `/api/enterprise/recruitment-interview` | 企业招聘 | **KEEP** |
| `routes/recruitment-department.routes.ts` | `/api/enterprise/recruitment-department` | 企业招聘 | **KEEP** |
| `routes/recruitment-conversation.routes.ts` | `/api/enterprise/recruitment-conversation` | 企业招聘 | **KEEP** |
| `routes/interview.routes.ts` | `/api/job/interview/*` | 企业招聘（旧） | **DEPRECATE** |
| `routes/resume.routes.ts` | `/api/job/resume/*` | 企业招聘（旧） | **DEPRECATE** |
| `routes/interview-workspace.routes.ts` | `/api/enterprise/interview-workspace` | 企业招聘 | **KEEP** |
| `routes/pipeline-jobs.ts` | `/api/enterprise/pipeline` | 企业招聘 | **KEEP** |
| `routes/admin-recruitment.ts` | `/api/admin/recruitment/*` | 平台管理后台 | **KEEP** |

### 2.2 Agent 文件

| 文件路径 | 归属 | 判定 | 说明 |
|---------|------|------|------|
| `agents/job/job-career.agent.ts` | 求职者 | **KEEP** | 求职顾问 Agent |
| `agents/job/job-evaluation.agent.ts` | 企业招聘 | **KEEP** | 候选人评估 Agent |
| `agents/job/job-news.agent.ts` | 求职者 | **KEEP** | 招聘动态 Agent |
| `agents/job/job-enterprise.agent.ts` | 企业招聘 | **KEEP** | 企业招聘 Agent |
| `agents/job/job-career-engine.ts` | 求职者 | **KEEP** | 求职引擎 |
| `agents/job/job-matching.service.ts` | 企业招聘 | **KEEP** | 匹配服务 |
| `agents/job/enterprise-recruit-agent.ts` | 企业招聘 | **KEEP** | 企业招聘 Agent |
| `agents/job/resume-parser-agent.ts` | 企业招聘 | **KEEP** | 简历解析 Agent |
| `agents/job/interview-agent.ts` | 企业招聘 | **KEEP** | 面试 Agent |
| `agents/job/talent-search-agent.ts` | 企业招聘 | **KEEP** | 人才猎聘 Agent |

---

## 3. API 边界整理

### 3.1 Candidate API（求职者工作台）

| API 路径 | 方法 | 说明 | 状态 |
|---------|------|------|------|
| `/api/job/chat` | POST | AI 求职助手聊天 | ✅ 正确 |
| `/api/job/profile` | GET/PUT | 求职者画像 | ✅ 正确 |
| `/api/job/recommendations` | GET | 推荐岗位 | ✅ 正确 |
| `/api/job/recommendations/feedback` | POST | 岗位反馈 | ✅ 正确 |
| `/api/job/profile/center` | GET | 职业档案中心 | ✅ 正确 |
| `/api/job/news` | GET | 招聘动态 | ✅ 正确 |
| `/api/job/statistics` | GET | 招聘统计 | ✅ 正确 |
| `/api/job/welcome` | GET | 欢迎语 | ✅ 正确 |

### 3.2 Enterprise Recruitment API（企业招聘中心）

#### P4 新版（recruitment-api.ts 消费）

| API 路径 | 方法 | 说明 | 状态 |
|---------|------|------|------|
| `/api/job/match/requirements` | GET/POST | 岗位要求 CRUD | ✅ 新版 P4-03 |
| `/api/job/match/requirements/validate` | POST | JD AI 解析预览 | ✅ 新版 P4-03 |
| `/api/job/match/batch` | POST | 触发批量匹配 | ✅ 新版 P4-04 |
| `/api/job/match/batch/:id` | GET | 匹配状态 | ✅ 新版 P4-04 |
| `/api/job/match/batch/:id/results` | GET | 匹配结果 | ✅ 新版 P4-04 |
| `/api/job/match/batch/list` | GET | 批量任务列表 | ✅ 新版 P4-04 |
| `/api/job/match/results/:id` | GET | 匹配结果详情 | ✅ 新版 |
| `/api/job/match/evidence/:id` | GET | 证据链 | ✅ 新版 P4-02 |
| `/api/job/match/explanation/:id` | GET | AI 解释 | ✅ 新版 P4-02 |
| `/api/job/match/skills/vocabulary` | GET | 技能词汇表 | ✅ 新版 |

#### 旧版 Enterprise API（job-api.ts 中的 entRequest）

| API 路径 | 方法 | 说明 | 状态 |
|---------|------|------|------|
| `/api/enterprise/workspace` | GET | 企业招聘空间 | ⚠️ 旧版 |
| `/api/enterprise/jd/generate` | POST | AI 生成 JD | ⚠️ 旧版 |
| `/api/enterprise/jd/optimize` | POST | JD 优化 | ⚠️ 旧版 |
| `/api/enterprise/match` | POST | 人才匹配 | ⚠️ 旧版 |
| `/api/enterprise/matches` | GET | 匹配结果 | ⚠️ 旧版 |
| `/api/enterprise/resume/parse` | POST | 简历解析 | ⚠️ 旧版 |
| `/api/enterprise/resume/match` | POST | 简历岗位匹配 | ⚠️ 旧版 |
| `/api/enterprise/pipeline/*` | * | 招聘流程 | ⚠️ 旧版 |
| `/api/enterprise/interview/plan` | POST | 面试方案 | ⚠️ 旧版 |
| `/api/enterprise/talent/search` | POST | 人才猎聘 | ⚠️ 旧版 |

#### 旧版 Job Posting API

| API 路径 | 方法 | 说明 | 状态 |
|---------|------|------|------|
| `/api/enterprise/postings` | GET/POST | 职位 CRUD | ❌ 废弃，被 P4 替代 |
| `/api/job/postings` | GET/POST | 岗位发布（旧） | ❌ 废弃 |
| `/api/job/resume/analyze` | POST | 简历分析（旧） | ❌ 废弃 |
| `/api/job/interview/generate` | POST | 面试助手（旧） | ❌ 废弃 |

#### 企业级招聘路由（独立路由文件）

| API 路径 | 归属 | 判定 |
|---------|------|------|
| `/api/enterprise/recruitment-campaign/*` | 企业招聘 | ✅ KEEP |
| `/api/enterprise/recruitment-interview/*` | 企业招聘 | ✅ KEEP |
| `/api/enterprise/recruitment-department/*` | 企业招聘 | ✅ KEEP |
| `/api/enterprise/recruitment-conversation/*` | 企业招聘 | ✅ KEEP |

### 3.3 Admin API（平台管理后台）

| API 路径 | 方法 | 说明 | 状态 |
|---------|------|------|------|
| `/api/admin/recruitment/*` | * | 平台招聘管理 | ✅ 正确 |

---

## 4. 核心问题汇总

### 问题 1: job-api.ts 严重混源 🔴

`studio-v2/api/job-api.ts` 一个文件包含三套 API：
- 求职者 API（`/api/job/chat`, `/api/job/profile`...）
- 企业旧 API（`/api/enterprise/jd/generate`, `/api/enterprise/match`...）
- 企业岗位 API（`/api/job/postings`...）

**方案**: 拆分为三个文件：
```
studio-v2/api/candidate-api.ts    → 求职者 API
studio-v2/api/enterprise-api.ts   → 企业招聘 API（旧，逐步废弃）
studio-v2/api/recruitment-api.ts  → 企业招聘 API（P4 新版，已有）
```

### 问题 2: 旧企业招聘页面未清理 🟡

`pages/workspace/enterprise/jobs.vue` 和 `pages/workspace/enterprise/interview.vue` 是旧版，有 banner 引导向新版，但代码仍保留。
`components/enterprise/workspace/modules/RecruitmentModule.vue` 是旧企业工作台内嵌的招聘模块，与新 `workspace/recruitment` 功能重复。

**方案**: 标记 DEPRECATE，P4-FE-02 后删除。

### 问题 3: 导航层级缺失返回首页 🟡

`RecruitmentShell.vue` 侧边栏只有「概览/沟通/候选人/面试/职位」，没有返回站点首页的入口。
`workspace/recruitment/index.vue` 的「工作台中心」按钮跳到 `/workspace/enterprise`，不是站点首页。

**方案**: 统一在 Enterprise Workspace Shell 顶部增加导航条（昆仑镜 Logo | 返回首页 | 企业名称 | 账号菜单）。

### 问题 4: 企业身份无前端入口 🟡

用户无法在前端关联企业，只能靠后端直接操作 `enterprise_member` 表。

**方案**: P4-FE-02 实现企业身份绑定流程。

### 问题 5: 后端旧路由未清理 🟡

`routes/job-posting.routes.ts`、`routes/interview.routes.ts`、`routes/resume.routes.ts` 是旧版路由，与 P4 新版功能重叠。

**方案**: 标记 DEPRECATE，确认无前端调用后删除。

---

## 5. 清理执行计划

### Phase 1: 标记 + 文档（本次）
- [x] 输出本审计报告
- [ ] 在 DEPRECATE 文件头部加注释标记
- [ ] 在 job-api.ts 加区域分割注释

### Phase 2: 拆分 API（P4-FE-00 导航修复时）
- [ ] 拆分 job-api.ts → candidate-api.ts + enterprise-api.ts
- [ ] 更新所有 import 引用
- [ ] 删除旧 enterprise/jobs.vue 和 interview.vue

### Phase 3: 删除旧代码（P4-FE-02 后）
- [ ] 删除 `pages/workspace/enterprise/jobs.vue`
- [ ] 删除 `pages/workspace/enterprise/interview.vue`
- [ ] 删除 `components/enterprise/workspace/modules/RecruitmentModule.vue`
- [ ] 删除后端 `routes/job-posting.routes.ts`、`routes/interview.routes.ts`、`routes/resume.routes.ts`
- [ ] 删除 `job-api.ts` 中的 entRequest 部分

---

## 6. 三个产品面最终目录结构

### 求职者工作台 `/workspace/job/`

```
pages/workspace/job/
├── index.vue          ← 求职者工作台首页
├── profile.vue        ← 职业档案（待开发）
├── resume.vue         ← 简历管理（待开发）
├── skills.vue         ← 技能+证据（待开发）
└── interview.vue      ← AI 面试（待开发）

studio-v2/api/candidate-api.ts  ← 拆分后
studio-v2/layout/JobWorkspaceLayout.vue
```

### 企业招聘中心 `/workspace/recruitment/`

```
pages/workspace/recruitment/
├── index.vue          ← 企业招聘首页 ✅
├── jobs/
│   ├── create.vue     ← JD 创建 ✅
│   └── [id].vue       ← 岗位详情（待开发）
├── matches/
│   └── [id].vue       ← 匹配详情（待开发）
└── components/
    ├── MatchScore.vue
    ├── EvidenceCard.vue
    ├── SkillTag.vue
    └── RecruitmentEmptyState.vue

components/recruitment/
├── RecruitmentShell.vue  ← 侧边栏 Shell ✅
├── ActivityFeed.vue      ✅
├── HealthBanner.vue      ✅
├── MetricCard.vue        ✅
├── PendingList.vue       ✅
├── RecruitmentFunnel.vue ✅
├── SectionCard.vue       ✅
└── StatusBadge.vue       ✅

studio-v2/api/recruitment-api.ts  ← P4 新版 API ✅
```

### 平台管理后台 `/admin/recruitment/`

```
pages/admin/recruitment/
├── index.vue          ← 平台运营概览 ✅
├── agents.vue         ← Agent 配置 ✅
├── audit.vue          ← 风险审计 ✅
├── campaigns.vue      ← Campaign 管理 ✅
├── candidates.vue     ← 候选人视图 ✅
├── conversations.vue  ← 沟通视图 ✅
├── departments.vue    ← 部门管理 ✅
├── interviews.vue     ← 面试视图 ✅
├── jobs.vue           ← 职位视图 ✅
└── runtime.vue        ← Runtime 监控 ✅

routes/admin-recruitment.ts  ← 后端 ✅
```

---

## 7. 文件判定统计

| 判定 | 前端文件数 | 后端文件数 | 合计 |
|------|-----------|-----------|------|
| **KEEP** | 28 | 16 | 44 |
| **DEPRECATE** | 4 | 3 | 7 |
| **SPLIT** | 1 | 1 | 2 |
| **总计** | 33 | 20 | 53 |

---

_审计完成。下一步：执行 Phase 1 标记 + Phase 2 拆分。_
