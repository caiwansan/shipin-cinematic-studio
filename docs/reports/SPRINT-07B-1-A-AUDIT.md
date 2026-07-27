# SPRINT-07B-1-A AUDIT REPORT

> 生成时间: 2026-07-27 06:35 CST
> 审计范围: 企业招聘工作台 `/workspace/recruitment` 全链路
> 审计原则: 只读，不改代码

---

## 1. 前端页面现状

### 1.1 页面文件清单

| 页面 | 行数 | 状态 | 说明 |
|------|------|------|------|
| `recruitment/index.vue` | 731 | ✅ 已存在 | 企业招聘工作台主页（身份验证+岗位列表+AI Workforce Card） |
| `recruitment/onboarding.vue` | ~400 | ✅ 已存在 | 企业身份认证 4 步流程 |
| `recruitment/jobs/create.vue` | 938 | ⚠️ 有缺陷 | 创建岗位页，但只创建 `JobRequirement`，不创建 `JobPosting` |
| `recruitment/pipeline.vue` | ~600 | ✅ 已存在 | Kanban Pipeline 看板 |
| `recruitment/matches/index.vue` | ~400 | ✅ 已存在 | 匹配结果页 |
| `recruitment/resumes/index.vue` | ~350 | ✅ 已存在 | 简历管理页 |

### 1.2 页面流转逻辑

```
用户登录
  ↓
GET /api/identity/context
  ↓
hasEnterprise?
  ├─ No → 显示 onboarding 引导 → POST /api/enterprise/onboarding/*
  └─ Yes → 加载工作台主页
              ↓
         GET /api/enterprise/postings (岗位列表)
              ↓
         ┌─────┴─────┐
         ↓           ↓
    无岗位        有岗位
     ↓              ↓
  引导创建      ┌────┴────┐
  ↓            ↓         ↓
创建页    岗位列表   AI Workforce Card
  ↓
POST /api/job/match/requirements  ← ⚠️ 只创建要求，不创建岗位
```

---

## 2. 后端 API 现状

### 2.1 岗位 CRUD API（job-posting.routes.ts）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/enterprise/postings` | 岗位列表（含 candidateCount） | ✅ 完整 |
| GET | `/api/enterprise/postings/:id` | 岗位详情（含 recentCandidates） | ✅ 完整 |
| POST | `/api/enterprise/postings` | 创建岗位（需 JWT + enterpriseId 自动解析） | ✅ 完整 |
| PUT | `/api/enterprise/postings/:id` | 更新岗位 | ✅ 完整 |
| PATCH | `/api/enterprise/postings/:id/status` | 状态变更 | ✅ 完整 |
| DELETE | `/api/enterprise/postings/:id` | 删除岗位 | ✅ 完整 |

### 2.2 身份认证 API（identity-context.routes.ts）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/identity/context` | 返回 user + enterprise + workspace + subscription |

### 2.3 其他招聘相关 API

| 路径前缀 | 文件 | 说明 |
|----------|------|------|
| `/api/enterprise/recruitment-conversation` | recruitment-conversation.routes.ts | 沟通记录 |
| `/api/enterprise/recruitment-interview` | recruitment-interview.routes.ts | 面试管理 |
| `/api/enterprise/recruitment-campaign` | recruitment-campaign.routes.ts | 招聘活动 |
| `/api/enterprise/postings` | enterprise.routes.ts | 旧版岗位列表（部分重叠） |

---

## 3. 数据库现状

### 3.1 核心模型记录数

| 模型 | 记录数 | 说明 |
|------|--------|------|
| `JobPosting` | 6 | 岗位（3 个 enterprise） |
| `EnterpriseProfile` | 3 | 企业档案 |
| `EnterpriseJobWorkspace` | 3 | 企业工作空间 |
| `RecruitmentPipeline` | 3 | Pipeline 阶段记录 |
| `CandidateMatch` | 3 | 候选人匹配 |
| `CandidateResume` | **0** | ⚠️ 无简历数据 |
| `JobCandidate` | 5 | 候选人基础信息 |
| `InterviewSession` | 4 | 面试记录 |
| `EnterpriseMember` | 2 | 企业成员（旧模型） |
| `Organization` | 59 | 组织 |
| `GovUser` | 47 | 政府用户 |
| `User` | 91 | 总用户 |

### 3.2 岗位样例

```json
[
  { "id": "45cc...", "title": "Python开发工程师", "status": "paused", "enterpriseId": "5ba4..." },
  { "id": "516f...", "title": "数据分析师", "status": "published", "enterpriseId": "5ba4..." },
  { "id": "7e1f...", "title": "AI应用工程师", "status": "published", "enterpriseId": "5ba4..." },
  { "id": "808b...", "title": "高级前端工程师", "status": "published", "enterpriseId": "4566..." },
  { "id": "8312...", "title": "机器学习工程师", "status": "closed", "enterpriseId": "5ba4..." }
]
```

### 3.3 JobPosting 字段

```
id, enterpriseId, title, salary, location, description, requirements,
qualityScore, status, careerPath, industry, promotionPath, relatedSkills,
skillRequirements[], tags[], createdAt, updatedAt
```

---

## 4. 身份链路分析

### 4.1 身份解析顺序（resolveEnterpriseFromUser）

```
JWT userId
  ↓
1. EnterpriseProfile.organizationId == userId?
  ↓ Yes → 返回
  ↓ No
2. User.email → GovUser.tenantId → Organization(slug=migrated-xxx) → EnterpriseProfile
  ↓ Yes → 返回
  ↓ No
3. Organization.slug LIKE 'onboard-%' → EnterpriseProfile
  ↓ Yes → 返回
  ↓ No
4. EnterpriseMember(userId, ACTIVE) → JobCompanyProfile → EnterpriseProfile
  ↓ Yes → 返回
  ↓ No
返回 null (无企业身份)
```

### 4.2 隔离验证

- `GET /api/enterprise/postings` 的 `resolveEnterpriseFromUser()` 确保只返回当前企业的岗位
- `resolveEnterpriseId(workspaceId)` 作为备选
- ✅ 数据隔离链路完整

---

## 5. 核心问题

### 🔴 P0: 创建岗位功能断裂

**现状**: `jobs/create.vue` → `createRequirement()` → `POST /api/job/match/requirements`
**问题**: 这个端点创建的是 `JobRequirement`（岗位要求/职位描述），不是 `JobPosting`（岗位）
**影响**: 用户点击"创建岗位"，填了 JD，保存后岗位不会出现在岗位列表中

**修复方向**:
- 方案 A：`create.vue` 改为调用 `POST /api/enterprise/postings` 创建 JobPosting
- 方案 B：后端 `POST /api/job/match/requirements` 在创建 Requirement 的同时创建 JobPosting

### 🟡 P1: API 路由前缀混乱

**现状**:
- `job-posting.routes.ts`: `/api/enterprise/postings`（正确）
- `recruitment-api.ts`: `/api/job/match/requirements`（不一致）
- `enterprise.routes.ts`: `/api/enterprise/workspace`（有岗位列表片段）

**问题**: 前端 `recruitment-api.ts` 的 `BASE = '/api/job/match'` 和 `enterprise.postings` 是两套路由

### 🟡 P2: 候选人数据为种子数据

**现状**: CandidateResume=0, CandidateMatch=3, Pipeline=3, JobCandidate=5
**影响**: 候选人展示页全是硬编码种子数据，无法反映真实业务

### 🟢 P3: 前端 onboarding 页面引用旧 API

`onboarding.vue` 中的 `<select>` 标签存在白字黑底问题（已在 Sprint-07A.3 修复 CSS，但需确认是否生效）

---

## 6. 现状结论

| 维度 | 状态 | 说明 |
|------|------|------|
| 身份认证链路 | ✅ 完整 | JWT → EnterpriseProfile 4 级 fallback |
| 岗位 CRUD 后端 | ✅ 完整 | job-posting.routes.ts 6 个端点 |
| 岗位列表前端 | ✅ 可用 | 正确调用 `/api/enterprise/postings` |
| 岗位创建前端 | ❌ 断裂 | 调用了错误的 API |
| Pipeline 看板 | ✅ 可用 | Kanban + 阶段推进 |
| 匹配结果页 | ⚠️ 可用 | 无真实候选人数据 |
| 简历管理页 | ⚠️ 可用 | CandidateResume=0 |
| 数据隔离 | ✅ 安全 | enterpriseId 隔离 |
| 岗位状态流 | ✅ 完整 | draft/published/paused/closed |

---

## 7. Sprint-07B-1 Phase B/C/D 建议执行顺序

### Phase B：修复岗位创建闭环（P0）
1. 修改 `jobs/create.vue` 的 `handleSave()` → 调用 `POST /api/enterprise/postings`
2. 创建成功后跳转到岗位详情页
3. 创建表单映射：title, description, salary, location, skillRequirements, requirements

### Phase C：岗位状态流转
1. 岗位列表显示状态 badge（draft/published/paused/closed）
2. 状态变更操作（发布/暂停/关闭）
3. 调用 `PATCH /api/enterprise/postings/:id/status`

### Phase D：候选人展示
1. Pipeline 页面展示真实 RecruitmentPipeline 数据
2. 排序：按 lastActivityAt 或 screeningScore
3. 无 AI Score（遵守 Sprint 边界）

---

## 8. 风险评估

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 创建岗位 API 修复引入新 bug | 中 | 高 | Reality Gate 全量验证 |
| 现有种子数据导致测试误判 | 高 | 中 | 测试前清种子或标记测试数据 |
| JobPosting 字段变更影响已有功能 | 低 | 中 | 只增不改已有字段 |

---

## 9. 下一步

**掌柜确认审计结果后，立即进入 Phase B：岗位创建闭环修复。**

修复方案：
1. 将 `jobs/create.vue` 保存逻辑从 `createRequirement` 切换为 `POST /api/enterprise/postings`
2. AI 解析保留（仍可解析 JD → 提取技能/经验），但最终保存为 JobPosting
3. Build → Deploy → Reality Gate → 确认后再进 Phase C
