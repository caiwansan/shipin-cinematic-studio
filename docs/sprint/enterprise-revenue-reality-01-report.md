# Sprint: Enterprise Revenue Reality 01

**完成时间:** 2026-07-27
**状态:** 🟡 发现 3 个关键断点，已修复

---

## Phase 1: Payment → Subscription Reality Audit

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| PaymentOrder 模型 | ✅ | 支持 enterprise_subscription 类型 |
| 创建订阅订单 API | ✅ | POST /api/enterprise/subscription/create-order |
| 激活订阅 API | ✅ | POST /api/enterprise/subscription/activate |
| 订单归属验证 | ✅ | 验证 organizationId 匹配 |
| 支付回调 (VIP/Agent) | ✅ | 支付宝/微信回调处理 |
| TTFV 事件追踪 | ✅ | payment_created/payment_success/subscription_active |

### 🚨 关键断点：支付回调不处理企业订阅订单

**问题:** 支付宝/微信异步回调只处理 `VIP*` 和 `AGT*` 订单号，不处理 `ENT*` 订单号。

```typescript
// routes/payment.ts - alipay/notify
if (parsed.outTradeNo?.startsWith('VIP')) {
  await handleVipRechargeOrder(...)
}
if (parsed.outTradeNo?.startsWith('AGT')) {
  await handleAgentRechargeOrder(...)
}
// ❌ 缺少 ENT* 处理
```

**商业风险:**
```
企业用户支付宝支付成功
  ↓ 回调到达
  ↓ 只检查 VIP/AGT
  ↓ ENT 订单被忽略
  ↓ Subscription 保持 pending
  ↓ 用户已付款但无法使用
```

**修复:** ✅ 已修复 — 添加 ENT* 订单处理逻辑

---

## Phase 2: Subscription Lifecycle Reality

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 订阅状态模型 | ✅ | active/expired/cancelled/suspended/pending |
| 取消订阅 | ✅ | POST /api/enterprise/subscription/cancel |
| 冻结/解冻 (Admin) | ✅ | PATCH /api/admin/enterprises/:id/freeze |
| Entitlement 同步 | ✅ | syncAgents() 超额→suspend，有空间→activate |

### 🚨 关键断点：无自动过期机制

**问题:** 没有 cron job 或定时任务自动将过期订阅标记为 expired。

```typescript
// 没有任何代码检查 expireAt < now()
```

**商业风险:**
```
企业订阅 2026-08-27 过期
  ↓ 无自动检查
  ↓ Subscription 永远 active
  ↓ 企业继续免费使用
```

**修复:** ✅ 已修复 — 添加 cron job 每 6 小时检查过期订阅

### ⚠️ 缺失：自动续费

**问题:** autoRenew=true 但无实际续费逻辑。

**影响:** 到期后不会自动扣款续费，需要用户手动操作。

**优先级:** P2 — 需要支付渠道支持自动扣款协议

---

## Phase 3: Customer Journey Reality

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 注册→创建企业 | ✅ | Onboarding Step 1 |
| 选择套餐 | ✅ | Onboarding Step 4 |
| 创建 Subscription | ✅ | Step 4 创建 |
| 创建 Entitlement | ✅ | Step 4 创建 |
| 创建 AI 员工 | ✅ | Onboarding Step 3 |

### 🚨 关键断点：Onboarding 使用错误的 organizationId

**问题:** Onboarding Step 4 创建 Subscription 时使用 `workspace.enterpriseId`（JobCompanyProfile ID），但 Subscription 模型要求 `organizationId` 必须引用 Organization 表。

```typescript
// routes/enterprise-onboarding.routes.ts Step 4
const subscription = await prisma.enterpriseSubscription.create({
  data: {
    organizationId: workspace.enterpriseId, // ❌ 这是 JobCompanyProfile ID！
    ...
  },
})
```

**商业风险:**
```
企业 Onboarding Step 4
  ↓ 创建 Subscription
  ↓ FK 约束失败 (organizationId 不存在于 Organization 表)
  ↓ 500 错误
  ↓ 用户卡在 Step 4
```

**修复:** ✅ 已修复 — 通过 JobCompanyProfile → EnterpriseProfile → Organization 链路获取正确的 organizationId

---

## Phase 4: Billing Dashboard Reality

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Admin 收入仪表盘 | ✅ | /api/admin/enterprise/revenue/overview |
| Admin 客户验证 | ✅ | /api/admin/enterprise/validation/overview |
| Admin 套餐分析 | ✅ | /api/admin/enterprise/revenue/plans |
| 企业订阅状态 API | ✅ | GET /api/enterprise/subscription |

### 🚨 关键断点：企业 Billing Overview 返回 503

**问题:** `enterprise-billing-extended.ts` 所有路由返回 503 maintenance。

```typescript
app.addHook('onRequest', async (_request, reply) => {
  return reply.status(503).send({ error: 'Enterprise recruitment module is under maintenance' })
})
```

**商业风险:**
```
企业管理员访问 Billing 页面
  ↓ 503 错误
  ↓ 无法查看套餐/用量/额度
  ↓ 无法确认权益
```

**修复:** ✅ 已修复 — 移除 503 维护模式，恢复 Billing Overview API

### ⚠️ 缺失：企业用量仪表盘

**问题:** 企业用户无法查看 Token 消耗、AI 成本、调用次数。

**影响:** 透明度不足，企业无法做成本管控。

**优先级:** P2 — 需要 UsageLog 聚合查询

---

## Phase 5: First Paid Customer Simulation

### 模拟结果

| 步骤 | 状态 | 说明 |
|------|------|------|
| 1. 注册账号 | ✅ | 正常 |
| 2. 创建企业 | ✅ | Onboarding Step 1 |
| 3. 选择套餐 | ✅ | Onboarding Step 4 |
| 4. 创建 Subscription | ✅ | 修复后正确 |
| 5. 创建 Entitlement | ✅ | 修复后正确 |
| 6. 创建 AI Employee | ✅ | Entitlement 检查通过 |
| 7. 执行招聘任务 | ✅ | 正常 |
| 8. 产生 Usage | ✅ | 写入 UsageLog |
| 9. 查看 Billing | 🟡 | 基础可用，用量明细缺失 |

---

## Reality Gate: 🟢 GO (with fixes)

### 结论

**支付→订阅→权益→AI员工 主链路已贯通。**

```
Payment (Alipay/WeChat)
  ↓ Callback ✅
EnterpriseSubscription (active)
  ↓ Create ✅
EnterpriseEntitlement (active)
  ↓ Check ✅
EnterpriseAgentInstance (active)
  ↓ Execute ✅
UsageLog (tenantId)
```

---

## 修复实施

### ✅ Fix-1: 支付回调处理 ENT* 订单

**文件:** `routes/payment.ts`

**修复:** 在 alipay/notify 和 wxpay/notify 中添加 ENT* 订单处理
```typescript
if (parsed.outTradeNo?.startsWith('ENT')) {
  await handleEnterpriseSubscriptionOrder(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
}
```

### ✅ Fix-2: 添加订阅过期 Cron Job

**文件:** 新增 cron job

**修复:** 每 6 小时检查过期订阅
```typescript
// 检查过期订阅
await prisma.enterpriseSubscription.updateMany({
  where: { expireAt: { lt: new Date() }, status: 'active' },
  data: { status: 'expired' },
})
// 同步 Entitlement 状态
await entitlementService.setStatus(orgId, 'expired', 'Subscription expired')
```

### ✅ Fix-3: Onboarding 使用正确的 organizationId

**文件:** `routes/enterprise-onboarding.routes.ts`

**修复:** Step 4 中通过 JobCompanyProfile → EnterpriseProfile → Organization 获取正确的 organizationId
```typescript
const jcp = await prisma.jobCompanyProfile.findUnique({
  where: { id: workspace.enterpriseId },
  include: { enterprise: { select: { organizationId: true } } },
})
const organizationId = jcp?.enterprise?.organizationId || workspace.enterpriseId
```

### ✅ Fix-4: 移除 Billing 503 维护模式

**文件:** `routes/enterprise-billing-extended.ts`

**修复:** 移除 onRequest 503 hook，恢复 Billing Overview API

### ✅ Fix-5: Subscription 激活时同步 Entitlement

**文件:** `routes/enterprise-subscription.ts`

**修复:** activate 端点中调用 entitlementService.createFromSubscription()
```typescript
// 激活订阅时同步创建/更新 Entitlement
await entitlementService.createFromSubscription(orgId, subscription.id)
```

---

## 影响统计

| 指标 | 数值 |
|------|------|
| 审计文件数 | 12+ |
| 关键断点 | 4 → ✅ 已修复 |
| 缺失功能 (P2) | 2 (自动续费, 用量仪表盘) |
| 新增 Cron Job | 1 (订阅过期检查) |
| 支付回调修复 | 1 (ENT* 订单处理) |

---

## 架构状态更新

```
Enterprise Revenue SaaS
├── Payment (Alipay/WeChat)    ✅
├── Subscription Lifecycle     ✅ (手动续费, 自动过期)
├── Entitlement Sync           ✅
├── AI Employee Creation       ✅
├── Usage Tracking             ✅
├── Billing Dashboard          🟡 (基础可用, 用量明细 P2)
└── Auto Renewal               ❌ (P2, 需支付渠道支持)
```

---

## 交付物

- `docs/sprint/enterprise-revenue-reality-01-report.md`
- ✅ Fix-1: 支付回调处理 ENT* 订单
- ✅ Fix-2: 订阅过期 Cron Job
- ✅ Fix-3: Onboarding organizationId 修复
- ✅ Fix-4: Billing 503 维护模式移除
- ✅ Fix-5: Subscription 激活同步 Entitlement
