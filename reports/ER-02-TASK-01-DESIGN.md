# ER-02-TASK-01 Profile API 设计

**Date**: 2026-07-17
**Author**: OpenClaw
**Status**: Design Review

---

## 1. Current Employee Data Structure Confirmation

### 1.1 Source Model: EnterpriseAgentProfile

| 字段 | 类型 | API 返回 | Profile 用途 |
| --- | --- | --- | --- |
| id | UUID | ✅ | 主键 |
| name | String(100) | ✅ | "销售增长官" |
| avatarUrl | String? | ✅ | 头像 (fallback: emoji) |
| description | String? | ✅ | 简介 |
| role | String(100) | ✅ | "增长总监" |
| agentType | String(50) | ✅ | "growth_director" |
| goal | String? | ✅ | "负责企业收入增长" |
| capabilities | String(JSON) | ✅ | ["销售分析","客户预测","自动报价"] |
| knowledgeScope | String(JSON) | ✅ | ["企业CRM","产品资料","销售历史"] |
| tools | String(JSON) | ✅ | ["CRM读写","客户分析","方案生成"] |
| permissions | String(JSON) | ✅ | ["数据导出","客户触达","报告生成"] |
| kpiMetrics | String(JSON) | ✅ | {"opportunities_found":18,"content_created":5} |
| dailyTarget | Int? | ✅ | 10 |
| workingHours | String? | ✅ | "09:00-18:00" |
| managerNote | String? | ✅ | "重点跟进制造业客户" |
| status | String(20) | ✅ | "active" |
| runtimeStatus | String | ✅ | "active" |
| runtimeAgentId | String? | ✅ | runtime identifier |
| lastExecutionAt | DateTime? | ✅ | 最近活跃时间 |
| version | Int | ✅ | 版本号 |
| createdAt | DateTime | ✅ | 入职时间 |

### 1.2 Aggregated Data (Computed at Query Time)

| 来源 | 聚合方式 | Profile 展示 |
| --- | --- | --- |
| AgentAuditTrail (7d) | COUNT + SUM(cost) | "近7天执行 45 次" |
| AgentAuditTrail (30d) | COUNT + AVG(success) | Trust Score 计算 |
| AgentGoal (7d) | target vs actual | 目标完成率 |
| OutcomeRecord (agentId) | COUNT + 最新 | 历史成果数 |
| ImpactMeasurement | SUM(metricValue) where REVENUE | "创造 ¥50,000" |
| AgentAuditTrail (approvalStatus) | COUNT where rejected | "人工纠正 3 次" |

### 1.3 Trust Score Formula

```
trustScore = executionSuccessRate * 0.4
           + outcomeCompletionRate * 0.3
           + humanApprovalRate * 0.2
           - errorRate * 0.1

where:
  executionSuccessRate = successCount / totalCount (AgentAuditTrail, 30d)
  outcomeCompletionRate = completedGoals / totalGoals (AgentGoal, 30d)
  humanApprovalRate = autoExecuted / totalCount (AgentAuditTrail, 30d)
  errorRate = errorCount / totalCount (AgentAuditTrail, 30d)
```

展示:
```
可信度 96%
连续工作: 32天
成功执行: 582次
人工纠正: 3次
```

---

## 2. Profile API Design

### 2.1 Route

```
GET /api/enterprise/agent-profiles/:agentId/profile
```

**前置条件**: JWT 认证 +organizationId 校验

### 2.2 Implementation

```typescript
// backend/src/services/enterprise/employee-profile.service.ts

interface EmployeeProfileDTO {
  // Identity
  id: string
  name: string
  avatarUrl: string | null
  bio: string          // derived from description
  role: string
  agentType: string
  goal: string | null
  personality: string | null

  // Status
  status: string
  runtimeStatus: string
  lastActiveAt: string | null
  workingHours: string | null

  // Capabilities
  capabilities: string[]
  knowledgeScope: string[]
  tools: string[]
  permissions: string[]

  // Trust Score
  trustScore: number           // 0-100
  consecutiveWorkDays: number  // 连续工作天数
  totalExecutions: number      // 30d
  humanCorrections: number     // 30d (approvalStatus = rejected)

  // Today
  todayTarget: number
  todayCompleted: number
  todayTasks: TodayTaskItem[]

  // Contribution (30d)
  contributionSummary: {
    totalOutcomes: number
    totalRevenue: string | null
    topOutcome: string | null
  }

  // CEO Instruction
  managerNote: string | null
}
```

### 2.3 New Backend Files

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `backend/src/services/enterprise/employee-profile.service.ts` | Service | Profile 数据聚合 |
| `backend/src/routes/employee-profile.ts` | Route | Profile API |

### 2.4 API 路由注册

```typescript
// backend/src/index.ts
await app.register(
  (await import('./routes/employee-profile.js')).employeeProfileRoutes,
  { prefix: '/api/enterprise/agent-profiles' }
)
```

**完整路径**: `GET /api/enterprise/agent-profiles/:agentId/profile`

### 2.5 数据查询计划

```typescript
// 1. Agent 基本信息 (1 query)
const agent = await prisma.enterpriseAgentProfile.findFirst({
  where: { id: agentId, organizationId }
})

// 2. Audit Trail 30d 聚合 (1 query)
const audit30d = await prisma.agentAuditTrail.aggregate({
  where: { agentId, createdAt: { gte: start30d } },
  _count: { id: true },
  _sum: { cost: true }
})

// 3. Goal 30d 完成率 (1 query)
const goals30d = await prisma.agentGoal.findMany({
  where: { agentId, goalDate: { gte: start30dStr } }
})

// 4. Outcome 30d 汇总 (1 query)
const outcomes = await prisma.outcomeRecord.findMany({
  where: { agentId, createdAt: { gte: start30d } }
})

// 5. Impact 30d 收入 (1 query)
const impacts = await prisma.impactMeasurement.findMany({
  where: { outcomeId: { in: outcomeIds } }
})

// 6. 连续工作天数 (1 query)
const consecutiveDays = await calculateConsecutiveDays(agentId)
```

**总查询数**: 6 (可并行优化至 2 batch)

---

## 3. Page Route Design

### 3.1 路由方案

**新增路由**: `/enterprise/agent/:id`

**实现方式**: Nuxt 动态路由

```
pages/enterprise/agent/
  └── [id].vue    → EmployeeProfilePage.vue
```

### 3.2 页面结构

```
enterprise/agent/[id].vue          (Page)
  └── EmployeeProfilePage.vue      (Container)
        ├── EmployeeIdentity.vue   (头像 + 名称 + 状态 + Trust Score)
        ├── EmployeeRole.vue       (职责 + 目标)
        ├── EmployeeCapability.vue (技能标签)
        ├── EmployeeKnowledge.vue  (知识库标签)
        └── EmployeeTools.vue      (工具权限标签)
```

### 3.3 前端新增组件

| 文件 | 用途 |
| --- | --- |
| `pages/enterprise/agent/[id].vue` | Page 入口 |
| `components/enterprise/employee-profile/EmployeeProfilePage.vue` | 页面容器 |
| `components/enterprise/employee-profile/EmployeeIdentity.vue` | 身份区 |
| `components/enterprise/employee-profile/EmployeeRole.vue` | 职责区 |
| `components/enterprise/employee-profile/EmployeeCapability.vue` | 技能区 |
| `components/enterprise/employee-profile/EmployeeKnowledge.vue` | 知识库区 |
| `components/enterprise/employee-profile/EmployeeTools.vue` | 工具权限区 |

### 3.4 点击流集成

```
Dashboard → EmployeeCard → click → navigateTo(`/enterprise/agent/${agentId}`)
EmployeesModule → AgentCard → click → navigateTo(`/enterprise/agent/${agentId}`)
AgentDetailPanel → "查看完整资料" → navigateTo(`/enterprise/agent/${agentId}`)
```

### 3.5 Layout

Profile 页面使用 `enterprise` layout (与 Dashboard 一致)，保持 Workspace 体验。

---

## 4. Identity Audit

| 检查项 | 状态 |
| --- | --- |
| JWT 认证 | ✅ authenticate hook |
| organizationId 来自 JWT | ✅ getOrganizationIdForUser() |
| 禁止 URL tenantId | ✅ 路由参数仅 agentId |
| 禁止 body.organizationId | ✅ GET 请求无 body |
| 禁止 user.id fallback | ✅ 全链路 organizationId |
| Agent 查询带组织隔离 | ✅ findFirst({ id, organizationId }) |

---

## 5. Data Source Summary

| 来源 | 用途 | 是否新增 |
| --- | --- | --- |
| EnterpriseAgentProfile | 身份/技能/知识/工具 | ❌ 复用 |
| AgentAuditTrail | Trust Score/执行统计 | ❌ 复用 |
| AgentGoal | 目标完成率 | ❌ 复用 |
| OutcomeRecord | 历史成果 | ❌ 复用 |
| ImpactMeasurement | 业务价值 | ❌ 复用 |
| **新增 Schema** | — | ❌ 无 |
| **新增 Agent** | — | ❌ 无 |
| **新增 Route** | GET /agent-profiles/:id/profile | ✅ View Layer |

---

*OpenClaw — Enterprise Engineering*
*ER-02-TASK-01 Design: Ready for Development*
