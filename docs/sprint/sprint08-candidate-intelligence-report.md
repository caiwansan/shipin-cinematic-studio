# Sprint 08 实施报告：候选人智能与招聘决策

**日期**：2026-07-27  
**实施工程师**：Sprint 08 Candidate Intelligence Engineer  
**目标**：从"帮企业管理招聘流程"升级到"帮企业做招聘决策"

---

## 实施概览

| Phase | 优先级 | 状态 | 说明 |
|-------|--------|------|------|
| Phase 1: 候选人详情页 | P0 | ✅ 完成 | AI 招聘决策中心 |
| Phase 2: AI 面试执行 | P0 | ✅ 完成 | 从"生成建议"升级为"执行面试" |
| Phase 3: 招聘决策卡片 | P1 | ✅ 完成 | 决策辅助卡片 + 快速操作 |
| Phase 4: Hiring Intelligence | P1 | ✅ 完成 | 数据沉淀 + Command Center 洞察 |

---

## Phase 1: 候选人详情页（P0）

### 实施内容

**新建文件**：`frontend/pages/workspace/enterprise/candidates/[id].vue`

**功能**：
- 候选人基本信息展示（姓名、职位、阶段、标签、简历）
- AI 匹配分析（综合匹配度环形图 + 分项评分进度条）
- Pipeline 历史时间线（阶段流转可视化）
- 备注管理（添加/展示）
- 快速决策操作（安排面试、推进到 Offer、建议拒绝）

**数据来源**：
- `GET /api/pipeline/:id` — 候选人详情 + 简历信息
- `GET /api/pipeline/:id/timeline` — Pipeline 事件时间线
- `GET /api/enterprise/matches?jobId=X` — AI 匹配数据（matchScore + matchBreakdown）
- `POST /api/pipeline/:id/notes` — 添加备注
- `PATCH /api/pipeline/:id/stage` — 阶段推进

**验收状态**：
- ✅ 候选人详情页可访问（`/workspace/enterprise/candidates/:id`）
- ✅ AI 分析关联真实 CandidateMatch 数据
- ✅ Pipeline 历史完整展示

---

## Phase 2: AI 面试执行（P0）

### 实施内容

**新建文件**：
- `frontend/pages/workspace/enterprise/interview/[id].vue` — 面试执行页
- `frontend/pages/workspace/enterprise/interview/create.vue` — 创建面试会话页

**功能**：
- 创建面试会话（选择候选人 + 岗位）
- AI 生成面试题目（基于 InterviewAgent.generateInterviewPlan）
- 面试执行（逐题回答 + 实时追问建议）
- AI 评估报告（综合评分 + 维度分数 + 优势/风险/建议）
- 录用决策（推荐录用 / 下一轮 / 不推荐）

**数据来源**：
- `POST /api/enterprise/recruitment-interview` — 创建会话
- `POST /api/enterprise/recruitment-interview/:id/generate-questions` — 生成题目
- `POST /api/enterprise/recruitment-interview/:id/start` — 开始面试
- `POST /api/enterprise/recruitment-interview/:id/answer` — 提交单题答案
- `POST /api/enterprise/recruitment-interview/:id/submit-answers` — 批量提交
- `POST /api/enterprise/recruitment-interview/:id/evaluate` — AI 评估
- `POST /api/enterprise/recruitment-interview/:id/decision` — 录用决策

**验收状态**：
- ✅ 可创建面试会话
- ✅ AI 生成面试问题
- ✅ 面试结束后生成报告

---

## Phase 3: 招聘决策卡片（P1）

### 实施内容

**新建文件**：`frontend/components/enterprise/recruitment/HiringDecisionCard.vue`

**功能**：
- 候选人决策摘要卡片
- 匹配度评分 + 分项评分迷你条
- 核心优势 / 风险点标签
- AI 推荐建议
- 快速操作：推荐 Offer / 安排面试 / 建议拒绝
- 查看详情跳转

**集成位置**：
- Pipeline 看板弹窗中显示决策摘要
- 候选人列表可扩展使用

**验收状态**：
- ✅ 决策卡片展示真实数据
- ✅ 一键推进/拒绝操作（通过 Pipeline stage API）

---

## Phase 4: Hiring Intelligence 数据沉淀（P1）

### 实施内容

**新建文件**：
- `backend/src/routes/hiring-intelligence.routes.ts` — Hiring Intelligence API
- `frontend/components/enterprise/recruitment/HiringInsightsCard.vue` — 招聘洞察卡片

**API 端点**：
- `GET /api/enterprise/hiring-intelligence/insights` — 招聘洞察汇总
  - 面试人数、Offer 数、录用数、平均评分
  - Pipeline 各阶段人数
  - 候选人平均匹配度
  - 支持时间范围筛选（本周/本月/本季）
- `GET /api/enterprise/hiring-intelligence/decisions` — 决策历史查询
- `POST /api/enterprise/hiring-intelligence/decisions` — 记录决策

**数据模型**：
- 复用现有 InterviewSession / InterviewDecision / InterviewEvaluation
- 复用 CandidateMatch / RecruitmentPipeline
- 未新增数据库字段

**Command Center 集成**：
- 在 `/workspace/enterprise/index.vue` 增加 HiringInsightsCard 组件
- 展示"本月面试 X 人，Offer Y 人，录用 Z 人，平均匹配度 N"

**验收状态**：
- ✅ 招聘决策数据可查询
- ✅ Command Center 展示招聘洞察

---

## 构建验证

### Frontend Build
```
cd /root/shipin-cinematic-studio/frontend && npx nuxt build
```
**结果**：✅ 成功（exit code 0）
- Nuxt Nitro server built
- Total size: 2.27 MB (496 kB gzip)
- Build complete

### Backend TypeScript Check
```
cd /root/shipin-cinematic-studio/backend && npx tsc --noEmit
```
**结果**：✅ 新代码无错误
- hiring-intelligence.routes.ts 无 TypeScript 错误
- 所有错误均为 pre-existing（video-compiler, truth-repository, xinghuo-ws 等）

---

## 文件清单

### 新建文件（6 个）

| 文件 | 类型 | 说明 |
|------|------|------|
| `frontend/pages/workspace/enterprise/candidates/[id].vue` | 页面 | 候选人详情页（AI 决策中心） |
| `frontend/pages/workspace/enterprise/interview/[id].vue` | 页面 | AI 面试执行页 |
| `frontend/pages/workspace/enterprise/interview/create.vue` | 页面 | 创建面试会话页 |
| `frontend/components/enterprise/recruitment/HiringDecisionCard.vue` | 组件 | 招聘决策卡片 |
| `frontend/components/enterprise/recruitment/HiringInsightsCard.vue` | 组件 | 招聘洞察卡片 |
| `backend/src/routes/hiring-intelligence.routes.ts` | API 路由 | Hiring Intelligence 数据 API |

### 修改文件（3 个）

| 文件 | 修改内容 |
|------|----------|
| `backend/src/index.ts` | 注册 hiringIntelligenceRoutes |
| `frontend/pages/workspace/enterprise/index.vue` | 集成 HiringInsightsCard |
| `frontend/pages/workspace/recruitment/pipeline.vue` | 添加决策摘要 + 跳转链接 |

---

## 架构决策

1. **数据复用**：所有数据来自真实 API，未新增数据库模型
2. **Tenant 隔离**：所有 API 通过 resolveEnterpriseId 验证企业归属
3. **状态管理**：面试状态机复用现有 lifecycle（preparing → question_ready → in_progress → evaluating → completed → decision_made）
4. **UI 一致性**：保持现有暗色主题 + CSS 变量系统

---

## 遗留问题

1. **InterviewDecision.sessionId @unique 约束**：当前决策记录必须关联到 InterviewSession，不支持独立决策记录。如需支持"快速拒绝"等独立决策，需要新增 DecisionLog 表。
2. **Pipeline 候选人 ↔ JobCandidate 关联**：当前 Pipeline 通过 candidateName 关联，未来需要建立正式的 candidateId 外键关联。
3. **实时更新**：面试评估阶段使用 5 秒轮询，未来可升级为 WebSocket 推送。
4. **AI 评分精度**：当前 screeningScore 使用公式计算（Beta），Sprint-09 将接入 ModelRouter 替换。

---

## 下一步建议

- Sprint 09：接入 ModelRouter 实现真实 AI 评分（替换 Beta 公式）
- Sprint 10：建立 Pipeline ↔ Candidate 正式关联
- Sprint 11：增加 DecisionLog 表支持独立决策记录
- Sprint 12：WebSocket 实时推送面试状态变更
