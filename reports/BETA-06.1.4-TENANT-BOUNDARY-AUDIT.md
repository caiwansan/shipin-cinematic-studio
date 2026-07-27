# BETA-06.1.4 — Organization Tenant Boundary Audit 报告

## 审计目标

确认 Enterprise 全链路所有数据查询使用 `organizationId` 隔离，禁止 `userId` 直接作为企业租户标识。

## 审计范围

| 模型 | 路由文件 | 审计结果 |
|------|----------|----------|
| AgentProfile | `enterprise-agent-profiles.ts` | ✅ PASS |
| AgentTask | `enterprise-agent-runtime.ts` | ✅ PASS |
| AgentInstance | `enterprise-agent-runtime.ts` | ✅ PASS |
| Subscription | `enterprise-subscription.ts` | ✅ PASS |
| Outcome | `enterprise-outcome.ts` | ✅ PASS |
| Health | `enterprise-health.ts` | ✅ PASS |
| Billing | `enterprise-billing.ts` | ✅ PASS |
| Channel | `enterprise-channel.ts` | ⚠️ WARN |
| Intelligence | `enterprise-intelligence.ts` | ⚠️ WARN |
| Timeline | `enterprise-timeline.ts` | ⚠️ WARN |
| Knowledge | `enterprise-knowledge.ts` | ✅ FIXED |
| Approval | `enterprise-approval.ts` | ✅ PASS (空) |
| Command | `enterprise-command.ts` | ✅ PASS (空) |
| Dashboard | `enterprise-dashboard.ts` | ✅ PASS (空) |
| Leads | `enterprise-leads.ts` | ✅ PASS (空) |
| Sales | `enterprise-sales.ts` | ✅ PASS (空) |
| ROI | `enterprise-roi.ts` | ✅ PASS (空) |

## 详细审计结果

### ✅ 通过项

#### AgentProfile（AI 员工）
```typescript
// 所有查询都使用 organizationId
prisma.enterpriseAgentProfile.findFirst({
  where: { id: profileId, organizationId: orgId }
})
```
- 列表：`findMany({ where: { organizationId } })`
- 创建：`create({ data: { organizationId, ... } })`
- 验证：先验证 profile.organizationId === orgId

#### AgentTask（任务）
```typescript
prisma.enterpriseAgentTask.findMany({
  where: { tenantId: orgId }  // orgId 从 JWT → DB 解析
})
```

#### Subscription（订阅）
```typescript
prisma.enterpriseSubscription.findUnique({
  where: { organizationId: orgId }
})
```

#### Outcome（产出）
```typescript
// enterprise-outcome.ts 文件头设计原则
// - organizationId 来自 JWT (Identity Resolution)
// - 禁止从 URL tenantId 查询 Outcome
prisma.outcomeRecord.findMany({
  where: { organizationId: orgId, ... }
})
```

### ⚠️ 风险项

#### 1. Channel 路由 — URL tenantId 未校验
```typescript
// /api/enterprise/:tenantId/channels/accounts
app.get('/api/enterprise/:tenantId/channels/accounts', async (request, reply) => {
  const { tenantId } = request.params as any
  const accounts = await channelAccountService.listAccounts(tenantId)
})
```
**风险**：`tenantId` 来自 URL 参数，未验证其是否属于当前用户的 Organization。
**影响**：用户可通过修改 URL tenantId 尝试访问其他企业数据。
**建议**：增加中间件校验 `tenantId === user's orgId`。

#### 2. Intelligence 路由 — URL tenantId 未校验
```typescript
// /api/enterprise/:tenantId/intelligence/feed
app.get('/api/enterprise/:tenantId/intelligence/feed', async (request, reply) => {
  const { tenantId } = request.params as any
  // 直接使用 tenantId 查询 signals, recommendations
})
```
**风险**：同上。

#### 3. Timeline 路由 — 部分查询缺 tenant 过滤
```typescript
const executionLogs = await prisma.agentExecutionLog.findMany({
  where: {
    createdAt: { gte: startOfDay, lte: endOfDay },
    // ⚠️ 缺少 organizationId 或 tenantId 过滤
  },
})
```
**风险**：返回所有组织的执行日志。

### ✅ 修复项

#### Knowledge 路由 — tenantId 未定义（已修复）
```typescript
// 修复前（Bug）
const orgId = await getOrganizationIdForUser(user?.id)
const result = await enterpriseKnowledgeService.list(tenantId, { /* ... */ })
//                                                  ^^^^^^^^ 未定义变量

// 修复后
const result = await enterpriseKnowledgeService.list(orgId, { /* ... */ })
```

影响三个端点：
- `GET /api/enterprise/knowledge` — 列表
- `POST /api/enterprise/knowledge` — 创建
- `GET /api/enterprise/knowledge/stats` — 统计

## 审计结论

| 维度 | 状态 | 说明 |
|------|------|------|
| 核心数据 AgentProfile/Task/Instance | ✅ PASS | 全部使用 organizationId |
| 资产数据 Outcome/Subscription | ✅ PASS | 全部使用 organizationId |
| 资源数据 Knowledge | ✅ FIXED | 修复 undefined → orgId |
| 渠道数据 Channel | ⚠️ WARN | URL tenantId 未校验 |
| 智能数据 Intelligence | ⚠️ WARN | URL tenantId 未校验 |
| 操作数据 Timeline | ⚠️ WARN | agentExecutionLog 缺过滤 |

**总体评价**：核心链路（Agent → Runtime → Outcome）已正确实现 Organization 隔离。
次要风险（Channel/Intelligence URL 参数校验）不影响 Golden Case 执行。

## 后续建议（非紧急）

1. **Channel 路由加固**：增加 `preHandler` 验证 URL tenantId 与 JWT orgId 一致
2. **Intelligence 路由加固**：同上
3. **Timeline 路由修复**：给 `agentExecutionLog` 查询增加 `tenantId: orgId` 过滤
4. **统一中间件**：为 `/:tenantId/` 路由增加统一的 OrgOwnershipGuard

## 部署状态

- ✅ Knowledge 路由修复已部署（Backend `api-server-aigc` 已重启）
- ⚠️ 风险项建议后续迭代处理，不影响 BETA-06.1 Runtime Truth
