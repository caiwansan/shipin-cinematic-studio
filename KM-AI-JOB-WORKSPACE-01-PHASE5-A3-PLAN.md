# KM-AI-JOB-WORKSPACE-01-PHASE5-A3-PLAN.md

**日期**: 2026-07-23  
**状态**: Planning → Development  
**前提**: A2-R PASS ✅

---

## 🔥 双 Gate 制度（从 A3 开始执行）

每个 Phase 必须通过两个 Gate：

### Reality Gate（技术真实性）
| 检查项 | 标准 |
|--------|------|
| Build | 0 errors |
| Deploy | PM2 online, HTTP 200 |
| Database | 所有表存在，数据正确 |
| API | 所有端点返回 200/正确数据 |
| Tenant Isolation | 无跨租户泄露 |

### Product Gate（业务闭环）
| 检查项 | 标准 |
|--------|------|
| Business Flow | 完整业务链路跑通 |
| Data Sync | 操作 → Dashboard 实时联动 |
| AI Actions | 所有按钮调用真实 API |
| State Machine | 状态流转正确 |
| User Value | 用户能完成核心任务 |

### 报告格式
```
Reality Gate：PASS / FAIL
Product Gate：PASS / FAIL
Technical Debt：
Known Issues：
Risk：
是否允许进入下一 Phase：YES / NO
```

---

## 🎯 Phase 5-A3: Pipeline MVP（精简版）

### 不在 A3 范围内
- 完整 ATS 系统
- 简历解析
- 薪酬管理
- 多轮面试安排
- 背景调查

### A3 核心：招聘 Pipeline MVP

---

## 📋 A3 开发清单

### ① Candidate Timeline（最高优先级）
- 候选人卡片：姓名 + 当前阶段 + 时间线
- 时间线节点：投递 → AI评分 → AI面试 → Offer → 录用
- 节点状态：已完成 / 进行中 / 待处理

### ② Kanban 五列
```
待筛选 → 筛选中 → 面试中 → Offer → 已入职
```
- 拖拽移动候选人
- 列计数自动更新
- 移动触发状态变更 API

### ③ AI Actions（真实 API 调用）
- AI重新评分 → 调用 `/api/ai/rescore`
- AI生成面试题 → 调用 `/api/ai/gen-interview`
- AI发送邀约 → 调用 `/api/ai/send-invite`
- AI生成Offer → 调用 `/api/ai/gen-offer`

### ④ Dashboard 联动
- Pipeline 操作 → Dashboard 数字自动更新
- 不允许：数据库变了但 Dashboard 不刷新

---

## 🗄️ 数据库变更

### RecruitmentPipeline 表（已存在，需确认字段）
```prisma
model RecruitmentPipeline {
  id          String   @id @default(uuid())
  workspaceId String
  candidateName String
  stage       String   // discovered/screening/interview/offer/hired/rejected
  priority    String   // high/medium/low
  source      String   // referral/linkedin/direct
  resumeId    String?
  matchScore  Int?
  assignedTo  String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### PipelineEvent 表（新增）— 时间线数据
```prisma
model PipelineEvent {
  id          String   @id @default(uuid())
  pipelineId  String
  type        String   // stage_change/score_update/note_added
  fromStage   String?
  toStage     String?
  actor       String   // user/ai/system
  metadata    Json?
  createdAt   DateTime @default(now())
}
```

---

## 🔌 API 设计

### Pipeline CRUD
- `GET /api/pipeline/:workspaceId` — 获取所有 Pipeline 记录
- `POST /api/pipeline` — 创建 Pipeline 记录
- `PATCH /api/pipeline/:id/stage` — 更新阶段（用于 Kanban 拖拽）
- `DELETE /api/pipeline/:id` — 删除

### AI Actions
- `POST /api/pipeline/:id/ai-rescore` — AI 重新评分
- `POST /api/pipeline/:id/ai-interview` — AI 生成面试题
- `POST /api/pipeline/:id/ai-invite` — AI 发送邀约
- `POST /api/pipeline/:id/ai-offer` — AI 生成 Offer

### Timeline
- `GET /api/pipeline/:id/events` — 获取候选人时间线

---

## 📱 前端组件

### PipelineBoard.vue
- 五列 Kanban
- 拖拽排序
- 列计数
- 候选人卡片

### CandidateCard.vue
- 姓名 + 头像
- 当前阶段标签
- AI 评分
- 快速操作按钮

### CandidateTimeline.vue
- 垂直时间线
- 节点图标
- 时间戳
- 操作人

### AIPipelineActions.vue
- 操作按钮组
- Loading 状态
- 结果展示

---

## ✅ A3 Reality Gate 检查清单

- [ ] Build 0 errors
- [ ] Deploy PM2 online
- [ ] Database 表存在
- [ ] API 所有端点 200
- [ ] Tenant isolation

## ✅ A3 Product Gate 检查清单

- [ ] 创建 Pipeline 记录 → 出现在 Kanban
- [ ] 拖拽移动 → 阶段更新 → Dashboard 数字变化
- [ ] AI 评分按钮 → 调用 API → 分数更新
- [ ] AI 面试按钮 → 调用 API → 面试题生成
- [ ] 完整业务链路跑通
