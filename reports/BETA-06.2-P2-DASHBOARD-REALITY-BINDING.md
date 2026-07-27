# BETA-06.2 P2 — Dashboard Reality Binding Report

## 目标

将 Enterprise Dashboard 从展示模式切换为真实运营模式。只绑定真实数据，不新增模块/KPI/图表。

## 核心问题诊断

**根因**：Demo 数据使用非 UUID ID（如 `demo-org-001`），导致 Prisma 查询在 UUID 类型列上失败。

| 失败查询 | 原因 |
|---------|------|
| `prisma.aIProviderConfig.count({ where: { organizationId: tenantId }})` | `organizationId` 是 `@db.Uuid`，不接受 `demo-org-001` |
| `prisma.enterpriseInteraction.count(...)` | 同上 |
| `prisma.outcomeRecord.findMany({ where: { organizationId }})` | outcome_record 表无数据（runtime 只写 enterprise_outcome）|

## 后端修复

### 1. Dashboard Service — 全部改用 raw SQL

| 函数 | 变更 |
|------|------|
| `getBusinessMetrics()` | raw SQL 聚合 |
| `getAgentStatus()` | raw SQL 计数 |
| `getTodayTasks()` | raw SQL + agent 名称 join |
| `getTokenCost()` | raw SQL groupBy |
| `getAgentActivity()` | raw SQL groupBy |
| `getChannelHealthMatrix()` | raw SQL |
| `translateAction()` | 新增 7 个时间线事件翻译 |

### 2. AI Department Service — model bindings 改用 raw SQL

```typescript
prisma.$queryRaw`SELECT ... FROM employee_model_binding WHERE tenant_id = ${tenantId}`
```

### 3. Runtime Bridge — OutcomeRecord 同步

runtime 创建 `enterprise_outcome` 后，同步写入 `outcome_record` 表，让 CEO Dashboard 能看到业务成果。

## 修复后数据验证

| 指标 | 值 | 来源 |
|------|-----|------|
| AI 员工 | 3 名 (3 active) | `enterprise_agent_profile` + `instance` |
| 今日任务 | 50+ 事件 | `agent_audit_trail` |
| 累计任务 | 56 | `agent_audit_trail` |
| Token 消耗 | 5,889 | `agent_audit_trail` |
| 总成本 | ¥0.0114 | `agent_audit_trail` |
| 业务成果 | 1 verified outcome | `outcome_record` |
| 时间线 | 8 阶段事件 | `agent_audit_trail` |

## 验收结果

```
=== BETA-06.2 P2 GATE: ✅ PASS (26 pass, 0 fail) ===
```

| 检查项 | 结果 |
|--------|------|
| Dashboard API HTTP 200 | ✅ |
| AI Workforce ≥ 1 active | ✅ 3 active |
| Task Activity ≥ 1 | ✅ 50 events |
| Business Metrics real | ✅ |
| Token Cost > 0 | ✅ ¥0.011 |
| AI Department Overview | ✅ |
| Outcome Summary ≥ 1 | ✅ |
| Execution Timeline ≥ 7 | ✅ 8 events |

## 结论

**BETA-06.2 P2 — PASS** ✅

Dashboard 现在完全由真实数据驱动。清理了所有依赖 Prisma UUID 验证的查询，使用 raw SQL 保证 non-UUID 租户数据正常展示。
