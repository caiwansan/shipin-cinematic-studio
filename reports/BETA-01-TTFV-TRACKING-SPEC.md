# TTFV Event Tracking Specification v1.0

## 设计原则

- **复用已有事件系统**：不新建 Event Model，在 `AgentAuditTrail` 追加事件类型
- **不新增数据模型**：仅扩展 `eventType` 枚举 + JSON payload
- **TTFV 起点锚定**：Payment Success 时间戳
- **TTFV 终点锚定**：First Outcome 落库时间戳

---

## Event Namespace

```
enterprise.lifecycle.*
enterprise.employee.*
```

---

## Event Schema（复用 AgentAuditTrail）

```prisma
// 已有模型，无需修改
model AgentAuditTrail {
  id          String   @id @default(uuid())
  tenantId    String
  agentId     String?
  eventType   String   // 扩展枚举
  payload     Json     // 存储差异化数据
  createdAt   DateTime @default(now())
}
```

---

## Event 清单

### 1. enterprise.lifecycle.signup

```json
{
  "eventType": "enterprise.lifecycle.signup",
  "payload": {
    "organizationId": "uuid",
    "userId": "uuid",
    "source": "beta"
  }
}
```

**触发点**：Organization 创建成功时

---

### 2. enterprise.lifecycle.pricing_viewed

```json
{
  "eventType": "enterprise.lifecycle.pricing_viewed",
  "payload": {
    "userId": "uuid",
    "organizationId": "uuid",
    "planViewed": "pro",
    "billingCycle": "monthly"
  }
}
```

**触发点**：`GET /api/enterprise/subscription/plans` 被调用时（或前端 pricing 页面加载）

---

### 3. enterprise.lifecycle.payment_created

```json
{
  "eventType": "enterprise.lifecycle.payment_created",
  "payload": {
    "organizationId": "uuid",
    "planId": "uuid",
    "planName": "专业版",
    "cycle": "yearly",
    "amount": 29999,
    "orderId": "uuid"
  }
}
```

**触发点**：`POST /api/enterprise/subscription/create-order` 成功时

---

### 4. enterprise.lifecycle.payment_success（TTFV 起点）

```json
{
  "eventType": "enterprise.lifecycle.payment_success",
  "payload": {
    "organizationId": "uuid",
    "subscriptionId": "uuid",
    "orderId": "uuid",
    "paidAt": "2026-07-17T10:01:00Z",
    "amount": 29999,
    "planName": "专业版",
    "cycle": "yearly"
  }
}
```

**触发点**：支付回调验证通过后（`activateEnterpriseSubscription` 内）

---

### 5. enterprise.lifecycle.subscription_active

```json
{
  "eventType": "enterprise.lifecycle.subscription_active",
  "payload": {
    "organizationId": "uuid",
    "plan": "pro",
    "employeeLimit": 10,
    "channelLimit": 10
  }
}
```

**触发点**：Subscription status 变更 → `active` 时

---

### 6. enterprise.employee.created

```json
{
  "eventType": "enterprise.employee.created",
  "payload": {
    "organizationId": "uuid",
    "employeeId": "uuid",
    "role": "sales_growth_officer",
    "name": "销售增长官",
    "hasSoul": true,
    "hasHermesBinding": true
  }
}
```

**触发点**：EnterpriseAgentInstance 创建成功时

---

### 7. enterprise.employee.first_task_started

```json
{
  "eventType": "enterprise.employee.first_task_started",
  "payload": {
    "employeeId": "uuid",
    "organizationId": "uuid",
    "taskId": "uuid",
    "taskType": "customer_analysis",
    "startedAt": "2026-07-17T10:04:00Z"
  }
}
```

**触发点**：每个企业 AI 员工的第一次任务执行时（需要判断 isFirstTask=true）

---

### 8. enterprise.employee.first_outcome_created（TTFV 终点）

```json
{
  "eventType": "enterprise.employee.first_outcome_created",
  "payload": {
    "employeeId": "uuid",
    "organizationId": "uuid",
    "outcomeId": "uuid",
    "outcomeType": "customer_opportunity_report",
    "createdAt": "2026-07-17T10:06:00Z"
  }
}
```

**触发点**：每个企业 AI 员工的第一次 Outcome 落库时

---

## TTFV 计算逻辑

```typescript
function calculateTTFV(organizationId: string): number | null {
  const events = await prisma.agentAuditTrail.findMany({
    where: {
      tenantId: organizationId,
      eventType: {
        in: ['enterprise.lifecycle.payment_success', 'enterprise.employee.first_outcome_created']
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  const paymentSuccess = events.find(e => e.eventType === 'enterprise.lifecycle.payment_success')
  const firstOutcome = events.find(e => e.eventType === 'enterprise.employee.first_outcome_created')

  if (!paymentSuccess || !firstOutcome) return null  // TTFV 未完成

  return (firstOutcome.createdAt.getTime() - paymentSuccess.createdAt.getTime()) / 60000  // 返回分钟
}
```

---

## Dashboard 展示格式

```
Beta Customer Activation 看板
┌─────────┬──────────┬──────────┬──────────┬──────────┬────────┐
│ 企业    │ 支付完成 │ 员工创建 │ 首次任务 │ 首次价值 │ TTFV   │
├─────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│ XX科技  │ 10:01    │ 10:03    │ 10:04    │ 10:06    │ 5分钟 ✅│
│ YY电商  │ 09:30    │ 09:35    │ 09:40    │ 09:43    │ 13分钟 │
│ ZZ教育  │ 11:00    │ 11:02    │ —        │ —        │ 进行中  │
└─────────┴──────────┴──────────┴──────────┴──────────┴────────┘
```

---

## 部署实现

### Step 1: 扩展 EnterpriseEventCollector

在现有 `enterprise-event-collector.service.ts` 中新增事件记录方法：

```typescript
// 无需新增模型，仅增添方法
async recordEvent(organizationId: string, eventType: string, payload: any) {
  return prisma.agentAuditTrail.create({
    data: {
      tenantId: organizationId,
      eventType,
      payload,
    }
  })
}
```

### Step 2: 插入事件埋点

在以下位置插入事件记录：
- `enterprise.ts`（signup）
- `enterprise-subscription.ts`（payment_created, payment_success）
- `enterprise-agent-profiles.ts`（employee.created）

### Step 3: Dashboard API

```
GET /api/admin/enterprise/revenue/ttfv-overview
```

聚合所有 enterprise.lifecycle 事件，输出 TTFV 表格。

---

## 注意事项

1. **事件幂等**：payment_success 只记录第一次，重复回调不重复记录
2. **首任务判断**：first_task_started 仅触发一次/企业/员工
3. **首 Outcome 判断**：first_outcome_created 仅触发一次/企业/员工
4. **性能**：AgentAuditTrail 已有 tenantId 索引，查询高效
