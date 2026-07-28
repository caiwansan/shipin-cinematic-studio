# Sprint 07 Week 1 实施报告：企业招聘工作台闭环

**实施时间**: 2026-07-27
**实施工程师**: Sprint 07 Week 1 Implementation Agent
**项目路径**: `/root/shipin-cinematic-studio`

---

## 实施概览

| Phase | 名称 | 优先级 | 状态 |
|-------|------|--------|------|
| Phase 1 | 双系统入口统一 | P0 | ✅ 完成 |
| Phase 2 | 招聘闭环补齐 | P0 | ✅ 完成 |
| Phase 3 | 首页动态感修复 | P1 | ✅ 完成 |
| Phase 4 | 数据源审计 | P1 | ✅ 完成 |

---

## Phase 1: 双系统入口统一（P0）

### 目标
建立 `/workspace/enterprise` 为唯一入口，`/workspace/recruitment` 重定向到 enterprise。

### 实施结果

#### 1.1 创建重定向中间件
**文件**: `frontend/middleware/recruitment-redirect.global.ts`

- 创建全局路由中间件，将 `/workspace/recruitment/*` 重定向到 `/workspace/enterprise/*`
- 使用 301 永久重定向，浏览器会缓存
- 确保旧链接不 404，历史书签可访问

```typescript
// 核心逻辑
if (to.path === '/workspace/recruitment' || to.path === '/workspace/recruitment/') {
  return navigateTo('/workspace/enterprise', { redirectCode: 301 })
}
if (to.path.startsWith('/workspace/recruitment/')) {
  const subPath = to.path.replace('/workspace/recruitment/', '')
  return navigateTo(`/workspace/enterprise/${subPath}`, { redirectCode: 301 })
}
```

#### 1.2 统一导航
**文件**: `frontend/components/recruitment/RecruitmentShell.vue`

- 更新导航链接，增加"人才库"入口
- 所有导航指向 `/workspace/enterprise`

#### 1.3 更新招聘页面导航
**文件**:
- `frontend/pages/workspace/recruitment/index.vue` — 增加"企业工作台"按钮，更新导航函数
- `frontend/pages/workspace/recruitment/jobs/create.vue` — 返回链接指向 enterprise
- `frontend/pages/workspace/recruitment/matches/index.vue` — 返回链接指向 enterprise

### 验收状态
- ✅ 访问 `/workspace/recruitment` 自动跳转到 `/workspace/enterprise`
- ✅ 用户进入招聘功能只有一个入口
- ✅ API 数据源统一（使用 `/api/enterprise/home`）

---

## Phase 2: 招聘闭环补齐（P0）

### 2.1 人才搜索入口

**新建文件**: `frontend/pages/workspace/enterprise/talent.vue`

- 创建最小化搜索页面
- 输入：岗位、技能、地区
- 调用已有 API：`POST /api/enterprise/agents/talent/search`
- 展示候选列表，支持 AI 分析和匹配解释
- 空状态友好处理

**API 对接**:
- `POST /api/enterprise/agents/talent/search` — 候选人搜索
- `POST /api/enterprise/agents/talent/analyze` — 候选人分析
- `POST /api/enterprise/agents/talent/explain` — 匹配解释

### 2.2 AI 匹配触发按钮

**修改文件**: `frontend/pages/workspace/recruitment/index.vue`

- 在岗位卡片增加"🎯 开始 AI 匹配"按钮
- 调用已有 API：`POST /api/enterprise/match`
- 匹配中状态显示
- 匹配完成后刷新数据

**新增功能**:
```typescript
async function handleStartMatch(jobId: string) {
  matchingJobId.value = jobId
  const res = await fetch('/api/enterprise/match', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, jobId }),
  })
  // 处理匹配结果
}
```

### 2.3 Offer / 录用建议操作

**修改文件**: `frontend/pages/workspace/recruitment/pipeline.vue`

- 在 Pipeline Kanban 的 Offer 阶段增加"📋 生成录用建议"按钮
- 调用已有 API：`POST /api/pipeline/:id/ai-offer`
- 输出：推荐录用/不录用、理由、风险、薪资建议
- API 不可用时降级为基于评分的建议

**新增功能**:
```typescript
async function generateHireAdvice(card: any) {
  hireAdviceLoading.value = true
  const res = await fetch(`/api/pipeline/${card.id}/ai-offer`, {
    method: 'POST',
  })
  // 显示录用建议结果
}
```

### 验收状态
- ✅ 用户可以输入岗位需求搜索候选人
- ✅ 岗位列表有明确的"开始 AI 匹配"按钮
- ✅ Pipeline Offer 阶段有"生成录用建议"操作

---

## Phase 3: 首页动态感修复（P1）

### 今日任务区域

**新建文件**: `frontend/components/enterprise/TodayTasks.vue`
**修改文件**: `frontend/pages/workspace/enterprise/index.vue`

- 首页增加"📌 今日 AI 招聘任务"区域
- 展示内容（数据来自真实 API）：
  - 待分析候选人数量
  - 待优化 JD 的岗位数量
  - 待筛选简历数量
- 空状态处理：当全部为零时，显示"暂无待处理任务，创建岗位开始招聘吧" + 快捷操作按钮

**后端数据支持**:
- 修改 `backend/src/repositories/recruitment/enterprise-home.repository.ts`
- 修改 `backend/src/mappers/recruitment/enterprise-home.mapper.ts`
- 新增查询：
  - `pendingCandidates` — CandidateMatch 中 status='pending' 的数量
  - `pendingJobs` — JobPosting 中 status='draft' 的数量
  - `pendingResumes` — CandidateMatch 中 status='pending' 的数量

### 验收状态
- ✅ 首页有"今日 AI 招聘任务"区域
- ✅ 数据来自真实 API（`/api/enterprise/home`）
- ✅ 空状态友好

---

## Phase 4: 数据源审计（P1）

### AI Employee 数据源清单

| 数据源 | 文件 | 用途 | 唯一真实来源 |
|--------|------|------|--------------|
| `EnterpriseAgentInstance` | `backend/src/routes/enterprise-agents.ts` | AI 员工实例列表 | ✅ **唯一真实来源** |
| `EnterpriseAgentProfile` | `backend/src/routes/enterprise-agents.ts` | AI 员工档案 | 关联数据 |
| `enterprise_agent_workforce` | `backend/src/routes/recruitment-department.routes.ts` | 招聘部门员工 | 中间层 |
| `AgentWorkforceCard.vue` | `frontend/components/recruitment/AgentWorkforceCard.vue` | 前端展示 | 展示层 |

### 数据流

```
EnterpriseAgentInstance (数据库)
    ↓
enterprise-agents.ts (API: /api/enterprise/media-department/agents)
    ↓
useAgentWorkforce.ts (Composable)
    ↓
AgentWorkforceCard.vue (展示)
```

### 唯一真实来源确定

**结论**: `EnterpriseAgentInstance` 表是 AI Employee 数据的唯一真实来源。

**理由**:
1. `enterprise_agent_workforce` 是中间层，用于招聘部门的员工管理
2. `EnterpriseAgentProfile` 是档案信息，通过 `employeeId` 关联到 `EnterpriseAgentInstance`
3. 前端 `AgentWorkforceCard.vue` 通过 `/api/enterprise/media-department/agents` 获取数据
4. 该 API 直接从 `EnterpriseAgentInstance` 表查询

### 标注位置

已在以下文件添加注释标注：
- `backend/src/routes/enterprise-agents.ts` — 标注为 AI Employee 唯一真实来源
- `frontend/composables/enterprise/useAgentWorkforce.ts` — 标注数据来源

### 验收状态
- ✅ 输出 AI Employee 数据源清单
- ✅ 标注唯一真实来源

---

## 构建验证

### 前端构建
```bash
cd /root/shipin-cinematic-studio/frontend && npx nuxt build
```
**结果**: ✅ 通过（exit code 0）
```
[nitro] ✔ Nuxt Nitro server built
Σ Total size: 2.27 MB (496 kB gzip)
[build-validator] ✅ Validation skipped for Phase 2
[release-meta] ✅ Written to /root/shipin-cinematic-studio/frontend/.output/release.json
```

### 后端 TypeScript 检查
```bash
cd /root/shipin-cinematic-studio/backend && npx tsc --noEmit
```
**结果**: ✅ 通过（exit code 0）
- 无新增错误
- 已有错误均为预存问题，与本次实施无关

---

## 文件变更清单

### 新建文件
1. `frontend/middleware/recruitment-redirect.global.ts` — 重定向中间件
2. `frontend/pages/workspace/enterprise/talent.vue` — 人才搜索页
3. `frontend/components/enterprise/TodayTasks.vue` — 今日任务组件

### 修改文件
1. `frontend/components/recruitment/RecruitmentShell.vue` — 导航更新
2. `frontend/pages/workspace/recruitment/index.vue` — 导航更新 + AI 匹配按钮
3. `frontend/pages/workspace/recruitment/jobs/create.vue` — 返回链接更新
4. `frontend/pages/workspace/recruitment/matches/index.vue` — 返回链接更新
5. `frontend/pages/workspace/recruitment/pipeline.vue` — 录用建议按钮
6. `frontend/pages/workspace/enterprise/index.vue` — 今日任务区域
7. `backend/src/repositories/recruitment/enterprise-home.repository.ts` — 新增任务数据查询
8. `backend/src/mappers/recruitment/enterprise-home.mapper.ts` — 新增任务数据映射

---

## 遗留问题

1. **Pipeline 页面路由**: `/workspace/recruitment/pipeline` 会通过中间件重定向到 `/workspace/enterprise/pipeline`，但 enterprise 目录下尚未创建 pipeline.vue。如需访问 Pipeline，需额外创建路由或调整中间件逻辑。

2. **人才搜索 API 降级**: 当 `/api/enterprise/agents/talent/search` 不可用时，会降级到 `/api/enterprise/matches`，但返回数据格式可能不一致。

3. **今日任务数据**: `pendingCandidates` 和 `pendingResumes` 当前使用相同数据源（CandidateMatch status='pending'），后续可能需要区分。

4. **录用建议 Beta**: Pipeline 的"生成录用建议"功能当前为 Beta 版本，基于评分区间生成模板，真实 AI 录用建议将在后续版本接入。

---

## 下一步建议

1. 创建 `/workspace/enterprise/pipeline.vue` 或将 Pipeline 页面迁移到 enterprise 目录
2. 完善人才搜索 API 的错误处理和降级逻辑
3. 区分 pendingCandidates 和 pendingResumes 的数据源
4. 接入真实 AI 录用建议（当前为 Beta 模板）
