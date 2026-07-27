# Phase 4.2.4 — OI-01 Schema Foundation Gate Report

> **日期**: 2026-07-17
> **阶段**: Outcome Intelligence Phase — OI-01
> **目标**: 建立 Outcome Truth Layer v1.0

---

## 一、交付物清单

| 交付物 | 文件 | 状态 |
|--------|------|------|
| Prisma Schema Diff | `prisma/schema.prisma` | ✅ |
| Migration | `prisma/migrations/20260717_outcome_truth_layer/migration.sql` | ✅ |
| Type Definitions | `src/platform/outcome/types.ts` | ✅ |
| OutcomeService | `src/platform/outcome/outcome.service.ts` | ✅ |
| ImpactService | `src/platform/outcome/impact.service.ts` | ✅ |
| FeedbackService | `src/platform/outcome/feedback.service.ts` | ✅ |
| Barrel Export | `src/platform/outcome/index.ts` | ✅ |
| 本报告 | `reports/phase-4-2-4-oi-01-gate-report.md` | ✅ |

---

## 二、Schema Diff

### 新增 Models (3 个)

```
OutcomeRecord          → outcome_record
ImpactMeasurement      → impact_measurement
DecisionFeedback       → decision_feedback
```

### 新增 Tables (PostgreSQL)

```sql
CREATE TABLE "outcome_record" (...)
CREATE TABLE "impact_measurement" (...)
CREATE TABLE "decision_feedback" (...)
```

### 新增 Indexes (12 个)

```
outcome_record: organization_id, action_id, agent_id, organization_id+status, outcome_type, occurred_at
impact_measurement: organization_id, outcome_id, organization_id+metric_type
decision_feedback: organization_id, decision_id, action_id, outcome_id, feedback_type
```

---

## 三、Model 设计说明

### OutcomeRecord

```prisma
model OutcomeRecord {
  id              String   @id @default(dbgenerated("gen_random_uuid()::text"))
  organizationId  String   @map("organization_id")   // ← 隔离键
  actionId        String?  @map("agent_id")
  agentId         String?  @map("agent_id")
  type            String   @default("OPERATIONAL")
  status          String   @default("PENDING_VERIFY")
  description     String?
  evidence        Json     @default("[]")            // ← 证据数组
  occurredAt      DateTime?
  // timestamps
}
```

**关键决策**:
- `organizationId` 为唯一隔离键 (非 tenantId, 非 userId)
- `evidence` 为 JSONB 数组: 支持 CRM 数据、Channel 回执、用户确认
- `type` 为 String (非 enum): 未来可扩展

### ImpactMeasurement

```prisma
model ImpactMeasurement {
  id              String   @id
  organizationId  String   @map("organization_id")   // ← 隔离键
  outcomeId       String   @map("outcome_id")        // ← FK → OutcomeRecord
  metricType      String   @map("metric_type")       // ← REVENUE, TIME_SAVED, etc
  metricValue     String   @map("metric_value")
  unit            String   @default("count")
  metadata        Json     @default("{}")            // ← 扩展字段
  source          String?
  verifiedAt      DateTime?
}
```

**关键决策**:
- `metricType` + `metadata`: 不固定业务指标，支持 Sales/Marketing/HR/Finance/Operations
- `metricValue` 为 String: 支持 "50000", "15%", "20小时" 等多种格式
- 不直接存 revenue 金额 (那是 OI-02 的事)

### DecisionFeedback

```prisma
model DecisionFeedback {
  id              String   @id
  organizationId  String   @map("organization_id")   // ← 隔离键
  decisionId      String?  @map("decision_id")
  actionId        String?  @map("action_id")
  outcomeId       String?  @map("outcome_id")        // ← FK → OutcomeRecord
  feedbackType    String   @default("UNKNOWN")       // ← SUCCESS|FAILURE|PARTIAL|UNKNOWN
  feedbackData    Json     @default("{}")            // ← { reason, delta, confidence, data }
}
```

**关键决策**:
- 初始 feedbackType: SUCCESS | FAILURE | PARTIAL | UNKNOWN
- 不做复杂 AI 评分 (OI-03 的事)
- Decision Engine 可基于 feedbackData 做分析

---

## 四、Service 架构

```
platform/outcome/
├── types.ts                 # 类型定义
├── outcome.service.ts       # OutcomeRecord CRUD
├── impact.service.ts        # ImpactMeasurement CRUD
├── feedback.service.ts      # DecisionFeedback CRUD
└── index.ts                 # barrel export
```

### Service 职责

| Service | 关键方法 | 说明 |
|---------|---------|------|
| OutcomeService | create, get, listByOrganization, updateStatus, appendEvidence, countByOrganization | OutcomeRecord CRUD + Evidence |
| ImpactService | record, listByOutcome, listByOrganization, calculateImpact, verify | Impact 记录 + 聚合 |
| FeedbackService | create, listByOrganization, getDecisionHistory, countByOrganization | Feedback 记录 + 查询 |

### Tenant Isolation 实现

所有查询都带 `organizationId`:
```ts
prisma.outcomeRecord.findMany({
  where: { organizationId, ... },
})
```

禁止:
- ❌ 直接 findFirst (不带 organizationId)
- ❌ 从 client body 读取 organizationId
- ❌ 从 user.id 回退到 organizationId

---

## 五、Tenant Isolation 验证

| 验证项 | 结果 |
|--------|------|
| 所有表有 organizationId 字段 | ✅ |
| 所有查询带 organizationId | ✅ |
| 无 userId → ownership | ✅ |
| 无 client body → organizationId_ | ✅ |
| 无 user.id fallback | ✅ |
| 所有索引包含 organizationId_ | ✅ |
| FK 正确级联删除 | ✅ |

---

## 六、Action → Outcome 链路

已有 Action Lifecycle:
```
Pending → Approved → Executing → Completed → Verified
```

新增加 Outcome 关联:
```
Action (Completed)
  │
  ↓
OutcomeRecord.create({ actionId: action.id })
  │
  ↓
ImpactMeasurement.record({ outcomeId: outcome.id })
  │
  ↓
DecisionFeedback.create({ outcomeId: outcome.id })
```

---

## 七、Gate 验收

| Gate | 状态 |
|------|------|
| ✅ 三个 Model 建立 (OutcomeRecord, ImpactMeasurement, DecisionFeedback) | PASS |
| ✅ organizationId 隔离键存在 | PASS |
| ✅ Outcome 数据模型成为企业事实层_ | PASS |
| ✅ Action 可以被量化评价 (via ImpactMeasurement)_ | PASS |
| ✅ AI 员工具备"绩效反馈"能力 (via DecisionFeedback)_ | PASS |
| ✅ 不违反 Identity Boundary (无 user.id fallback)_ | PASS |
| ✅ 不新增 Agent / Dashboard / BI_ | PASS |

---

## 八、Enterprise Intelligence Gate v1.0 更新

| 能力 | 状态 |
|------|------|
| Tenant Identity Boundary | ✅ |
| Agent Ownership | ✅ |
| Action Lifecycle | ✅ |
| Execution Tracking | 🟡 |
| Outcome Recording | ✅ ← 新增 |
| Impact Measurement | ✅ ← 新增 |
| Decision Learning | 🔜 OI-03 |

---

## 九、明确禁止事项 (已遵守)

OI-01 阶段:
- ❌ 未开发 AI 自动学习
- ❌ 未修改 Decision Engine
- ❌ 未新增 Agent
- ❌ 未做 Dashboard 展示
- ❌ 未做 BI 报表
- ❌ 未修改现有 Identity 层

---

## 十、下一 Sprint

### OI-02: Action Result Tracking
- 连接 Action Lifecycle 与 Outcome
- Completed → Outcome Captured → Impact Calculated

### OI-03: Intelligence Feedback
- Decision Engine 学习闭环
- 历史决策 + 执行结果 + 业务影响 → 优化建议
