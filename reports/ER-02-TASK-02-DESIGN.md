# ER-02-TASK-02 Profile Depth Enhancement 设计

**Date**: 2026-07-17
**Author**: OpenClaw
**Status**: Design → Implementation

---

## 1. 新增 4 个 Profile Section

### 1.1 Contribution Timeline (贡献趋势)

**数据源**: AgentAuditTrail (30d/90d)
**聚合方式**: 按日分组 COUNT
**展示**: 折线图/柱状图 — 每日执行次数趋势

```typescript
// 新增 API 返回字段
contributionTimeline: {
  period: '30d' | '90d'
  data: { date: string; count: number }[]
  total: number
  peak: { date: string; count: number }
}
```

### 1.2 Historical Outcomes (历史成果)

**数据源**: OutcomeRecord + ImpactMeasurement
**聚合方式**: 按时间倒序，关联 Impact
**展示**: 成果卡片列表 — 类型 + 描述 + 业务价值

```typescript
historicalOutcomes: {
  total: number
  items: {
    id: string
    type: string
    description: string
    createdAt: string
    impactValue: string | null
    impactType: string | null
  }[]
}
```

### 1.3 Growth Record (成长记录)

**数据源**: AgentAuditTrail (action = 'agent.updated' / 'capability.added')
**聚合方式**: 按时间倒序
**展示**: 时间线 — Agent 版本升级、能力扩展

```typescript
growthRecord: {
  items: {
    date: string
    event: string
    detail: string
  }[]
}
```

### 1.4 CEO Command Context (CEO 指令上下文)

**数据源**: EnterpriseAgentProfile.managerNote
**聚合方式**: 直接读取
**展示**: CEO 对 AI 员工的备注指令

```typescript
ceoCommandContext: {
  managerNote: string | null
  lastUpdated: string | null
}
```

---

## 2. 新增文件

### 前端组件 (4)

| 文件 | 用途 |
| --- | --- |
| `ContributionTimeline.vue` | 30d/90d 执行趋势图 |
| `HistoricalOutcomes.vue` | 历史成果列表 |
| `GrowthRecord.vue` | Agent 成长时间线 |
| `CEOCommandContext.vue` | CEO 指令上下文 |

### 后端扩展 (1)

| 文件 | 修改 |
| --- | --- |
| `employee-profile.service.ts` | 新增 4 个聚合方法 |

---

## 3. 架构约束

| 约束 | 状态 |
| --- | --- |
| 只读 (Read Model) | ✅ |
| 无写操作 | ✅ |
| 无 Agent 编辑 | ✅ |
| 无 Prompt 修改 | ✅ |
| 无 Runtime 控制 | ✅ |
| 无权限管理 | ✅ |
| 无 Memory 写入口 | ✅ |
| 仅 Aggregation | ✅ |

---

*OpenClaw — ER-02-TASK-02 Design*
