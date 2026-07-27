# Revenue Dashboard API Design v1.0

## 原则

- **不新增任何数据模型**：全量复用 EnterpriseSubscription, EnterprisePlan
- **不新增 Runtime / Agent / Memory / 权限系统**
- **只做数据聚合层**：对已有数据做 SUM/COUNT/GROUP BY
- **数据来源**：`snapshot_price`, `snapshot_cycle`, `snapshot_max_employees`, `status`, `created_at`, `expire_at`

---

## API 设计

### 1. 收入总览

**Endpoint**: `GET /api/admin/enterprise/revenue/overview`

**Query Params**:
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| timeframe | string | all | all / 30d / 90d |

**Response**:
```json
{
  "success": true,
  "data": {
    "mrr": 299.00,
    "arr": 3588.00,
    "activeSubscriptions": 10,
    "newThisMonth": 3,
    "churnThisMonth": 1,
    "churnRate": 0.10,
    "conversionRate": 0.30,
    "averageTTFV": 4.8
  }
}
```

**计算逻辑**:
```sql
-- MRR
SELECT SUM(
  CASE
    WHEN snapshot_cycle = 'monthly' THEN snapshot_price
    WHEN snapshot_cycle = 'yearly' THEN snapshot_price / 12
    ELSE 0
  END
) / 100.0 AS mrr
FROM enterprise_subscription
WHERE status = 'active'

-- ARR = MRR * 12

-- Active Subscriptions
SELECT COUNT(*) FROM enterprise_subscription WHERE status = 'active'

-- New This Month
SELECT COUNT(*) FROM enterprise_subscription
WHERE created_at >= date_trunc('month', NOW())

-- Churn This Month
SELECT COUNT(*) FROM enterprise_subscription
WHERE status = 'cancelled'
  AND updated_at >= date_trunc('month', NOW())

-- Churn Rate = Churn / (Active + Churn)

-- Conversion Rate = Active Subscriptions / Total Organizations
```

---

### 2. 套餐分布

**Endpoint**: `GET /api/admin/enterprise/revenue/plans`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "planId": "uuid",
      "planName": "专业版",
      "monthly": { "count": 3, "mrr": 897.00 },
      "yearly": { "count": 2, "arr": 5976.00 },
      "totalMrr": 1893.00,
      "subscriberCount": 5
    }
  ]
}
```

---

### 3. Beta 转化漏斗

**Endpoint**: `GET /api/admin/enterprise/revenue/beta-conversion`

**Response**:
```json
{
  "success": true,
  "data": {
    "funnel": [
      { "stage": "signup", "count": 4 },
      { "stage": "pricing_viewed", "count": 4 },
      { "stage": "payment_created", "count": 3 },
      { "stage": "payment_success", "count": 2 },
      { "stage": "subscription_active", "count": 2 },
      { "stage": "employee_created", "count": 1 },
      { "stage": "first_outcome", "count": 1 }
    ],
    "conversionRates": [
      { "from": "signup", "to": "payment_success", "rate": 0.50 },
      { "from": "payment_success", "to": "employee_created", "rate": 0.50 },
      { "from": "employee_created", "to": "first_outcome", "rate": 1.00 }
    ]
  }
}
```

**数据来源**: `AgentAuditTrail`（eventType IN enterprise.lifecycle.* + enterprise.employee.*）

---

### 4. TTFV 概览

**Endpoint**: `GET /api/admin/enterprise/revenue/ttfv-overview`

**Response**:
```json
{
  "success": true,
  "data": {
    "averageTTFV": 4.8,
    "medianTTFV": 4.5,
    "p90TTFV": 8.2,
    "companies": [
      {
        "organizationId": "uuid",
        "name": "XX科技",
        "planName": "专业版",
        "cycle": "monthly",
        "paymentSuccessAt": "2026-07-17T10:01:00Z",
        "firstOutcomeAt": "2026-07-17T10:06:00Z",
        "ttfvMinutes": 5.0,
        "status": "completed"
      },
      {
        "organizationId": "uuid",
        "name": "YY电商",
        "planName": "基础版",
        "cycle": "monthly",
        "paymentSuccessAt": "2026-07-17T09:30:00Z",
        "firstOutcomeAt": null,
        "ttfvMinutes": null,
        "status": "pending_first_outcome"
      }
    ]
  }
}
```

---

### 5. 流失风险预警

**Endpoint**: `GET /api/admin/enterprise/revenue/churn-risk`

**Response**:
```json
{
  "success": true,
  "data": {
    "highRisk": [
      {
        "organizationId": "uuid",
        "name": "AA传媒",
        "planName": "专业版",
        "expireAt": "2026-08-10T00:00:00Z",
        "daysRemaining": 24,
        "riskReason": "7天内无任务执行",
        "lastTaskAt": "2026-07-10T14:00:00Z",
        "taskCount7d": 0
      }
    ],
    "mediumRisk": [],
    "lowRisk": []
  }
}
```

---

## 实现方案

### 文件结构

```
backend/src/routes/enterprise-revenue.ts  ← 新增路由文件
backend/src/services/enterprise/
  └── revenue.service.ts                  ← 新增聚合服务
```

### Revenue Service 伪代码

```typescript
class RevenueService {
  async getOverview(): Promise<RevenueOverview> {
    const subs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' }
    })

    const mrr = subs.reduce((sum, sub) => {
      return sum + (sub.snapshotCycle === 'monthly'
        ? sub.snapshotPrice
        : sub.snapshotPrice / 12)
    }, 0) / 100  // 分转元

    return {
      mrr,
      arr: mrr * 12,
      activeSubscriptions: subs.length,
      // ... 其他指标
    }
  }

  async getPlanDistribution(): Promise<PlanDistribution[]> {
    // GROUP BY snapshot_name, snapshot_cycle
    // 计算每个套餐的订阅数和 MRR
  }

  async getBetaConversion(): Promise<FunnelData> {
    // 查询 AgentAuditTrail
    // 统计每个事件类型的数量
    // 计算转化率
  }

  async getTTFVOverview(): Promise<TTFVOverview> {
    // 获取所有 payment_success 事件
    // 匹配对应的 first_outcome_created 事件
    // 计算时间差
  }

  async getChurnRisk(): Promise<ChurnRiskData> {
    // 查询即将过期的订阅
    // 关联任务执行频率
    // 标记风险等级
  }
}
```

---

## 数据库查询优化

所有查询基于以下索引：

```sql
-- 已存在
CREATE INDEX idx_subscription_status ON enterprise_subscription(status)
CREATE IF NOT EXISTS idx_subscription_organization ON enterprise_subscription(organization_id)
CREATE INDEX idx_audit_trail_tenant_event ON agent_audit_trail(tenant_id, event_type)
```

无需新增索引。

---

## 前端集成

在现有 admin 页面或新建 `/admin/enterprise/revenue.vue` 中展示：

```
Enterprise Revenue Dashboard
┌──────────────────────────────────────────────────┐
│ MRR ¥299   ARR ¥3,588   活跃: 10   新增: 3      │
├──────────────────────────────────────────────────┤
│ 套餐分布                                         │
│ ████████████████████ 专业版 (5) MRR ¥1,893       │
│ ████████ 基础版 (2) MRR ¥0                      │
├──────────────────────────────────────────────────┤
│ Beta 转化漏斗                                    │
│ 注册(4) → 定价(4) → 支付(3) → 成功(2) → 激活(2)│
├──────────────────────────────────────────────────┤
│ TTFV 平均: 4.8分钟  ✅                          │
└──────────────────────────────────────────────────┘
```

---

## 验收标准

| API | 响应时间 | 数据准确性 |
|-----|---------|-----------|
| overview | < 500ms | MRR 误差 < 1% |
| plans | < 300ms | 100% 准确 |
| beta-conversion | < 500ms | 100% 准确 |
| ttfv-overview | < 800ms | 100% 准确 |
| churn-risk | < 300ms | 100% 准确 |

---

## 禁止事项

❌ 新增任何 Runtime Agent
❌ 新增任何 Memory 系统
❌ 新增任何权限/治理模块
❌ 修改 Hermes Runtime 代码
❌ 修改 ER-01~ER-05 任何已完成模块

只做数据聚合 + 前端展示。
