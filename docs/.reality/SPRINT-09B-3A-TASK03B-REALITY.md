# Sprint-09B-3A Task 03-B Payment → Subscription Reality Fix

**Date:** 2026-07-30 17:36 CST
**Status:** ✅ PASS (4/4)

## 改动

### 文件

**`src/routes/payment.ts`** — 约 50 行新增

| 改动点 | 内容 |
|--------|------|
| +`handleCareerSubscriptionFromPayment()` | 支付回调业务逻辑：创建 Tenant → Subscription |
| 支付宝 notify 中 | 更新 PaymentOrder 后检查 `planType === 'career_agent'` → 调用 handler |
| 微信 notify 中 | 新增通用 PaymentOrder 状态更新 + career_agent 检查 |
| 管理员确认到账 | `planType === 'career_agent'` → 调用 handler |

### 0 新 Schema / 0 新表 / 0 新支付系统

---

## 完整的支付→激活链路

```
用户支付 ¥9.9 → Alipay/Wxpay 回调

   ↓

routes/payment.ts notify handler

   ↓  planType === 'career_agent'

handleCareerSubscriptionFromPayment()

   1. ensurePersonalTenant(userId)      ← 创建个人 Tenant
   2. Subscription.create(active)       ← 30天有效期
   3. // CapabilityGrant 自动生效（plan级别）

   ↓

用户打开镜心工作台 → checkProvisionEntitlement() → ✅ allowed

   ↓

createAndDeploy() → Agent Profile → Instance → Binding → Hermes Runtime
```

## Reality Gate — 4/4 PASS

| Gate | 结果 | 验证 |
|------|------|------|
| G1 支付回调产生 Subscription | ✅ | 人工创建 PaymentOrder → handler 执行 → Subscription(status=active) 写入 |
| G2 权益门控通过 | ✅ | `checkProvisionEntitlement()` → `{ allowed: true }` |
| G3 职业助理创建 | ✅ | `createAndDeploy()` → Agent Profile + Instance + Binding + Hermes Runtime |
| G4 幂等 | ✅ | 重复调用 handler → existingSub.status === 'active' → 跳过 |

## 覆盖场景

| 场景 | 状态 |
|------|------|
| 新用户首次购买 → Tenant 不存在 → 自动创建 | ✅ |
| 已有 Tenant → Subscription 直接创建 | ✅ |
| 订阅已激活 → 重复支付回调 → 跳过 | ✅ |
| 订阅过期 → 重复支付 → 续期 | ✅ |
| 管理员手动确认到账（非回调场景） | ✅ |
| 支付宝回调 | ✅ |
| 微信回调（同步补齐了之前缺失的通用 PaymentOrder 更新） | ✅ |
