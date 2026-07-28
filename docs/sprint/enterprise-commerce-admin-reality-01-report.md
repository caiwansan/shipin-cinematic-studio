# Sprint: Enterprise Commerce Admin Reality 01

**完成时间:** 2026-07-27
**状态:** 🟢 PASS

---

## 目标

建立企业套餐运营后台，把企业招聘从"能收费"推进到"运营人员可以在后台管理套餐、定价、销售和权益"。

---

## Phase 1: Enterprise Plan Admin Management ✅

### 新增 API（集成在求职招聘管理下）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/recruitment/plans` | 套餐列表（含订阅数统计） |
| POST | `/api/admin/recruitment/plans` | 创建套餐 |
| PUT | `/api/admin/recruitment/plans/:id` | 更新套餐 |
| DELETE | `/api/admin/recruitment/plans/:id` | 删除套餐 |
| PATCH | `/api/admin/recruitment/plans/:id/toggle` | 启用/停用 |

### 管理员可配置字段

```
name          — 套餐标识（唯一）
displayName   — 显示名称
description   — 套餐说明
price         — 月付价格（分）
yearlyPrice   — 年付价格（分）
originalPrice — 原价（分）
currency      — CNY | USD
billingCycle  — monthly | yearly
maxEmployees  — AI员工上限
maxChannels   — 渠道上限
maxMembers    — 企业成员上限
storageLimit  — 存储上限（GB）
requireOwnLLMKey — 是否必须自带模型Key
allowedProviders  — 允许的模型供应商
quotaPolicy   — unlimited | fixed | pay_as_you_go
features      — 功能特性列表（JSON）
enabled       — 是否启用
sortOrder     — 排序权重
```

---

## Phase 2: EnterprisePlan 数据真实化 ✅

### Schema 变更

```prisma
model EnterprisePlan {
  // 新增字段
  yearlyPrice    Int    @default(0) @map("yearly_price")  // 年付价格（分）

  // 已有字段（无需变更）
  price          Int    @default(0)                       // 月付价格（分）
  maxEmployees   Int    @default(2)
  maxChannels    Int    @default(1)
  maxMembers     Int    @default(5)
  features       Json   @default("[]")
  enabled        Boolean @default(true)
  // ...
}

model EnterpriseSubscription {
  // 新增字段
  snapshotPrice  Int?    @map("snapshot_price")  // 快照价格（分）
  snapshotCycle  String? @map("snapshot_cycle")  // monthly | yearly

  // 已有字段
  snapshotName        String?
  snapshotMaxEmployees Int?
  snapshotMaxChannels  Int?
  snapshotMaxMembers   Int?
  snapshotFeatures     Json?
  // ...
}
```

### 数据库迁移

```sql
ALTER TABLE enterprise_plan ADD COLUMN IF NOT EXISTS yearly_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE enterprise_subscription ADD COLUMN IF NOT EXISTS snapshot_price INTEGER;
ALTER TABLE enterprise_subscription ADD COLUMN IF NOT EXISTS snapshot_cycle VARCHAR(20);
```

---

## Phase 3: 接入昆仑镜统一支付系统 ✅

### 原则：禁止新建支付，复用现有链路

```
企业用户选择套餐
  ↓
POST /api/enterprise/subscription/create-order
  ↓
创建 PaymentOrder (type=enterprise_subscription)
  ↓
创建/更新 EnterpriseSubscription (status=pending)
  ↓
跳转昆仑镜支付页面（支付宝/微信）
  ↓
支付成功 → 异步回调
  ↓
handleEnterpriseSubscriptionOrder()
  ↓
PaymentOrder.status = paid
  ↓
EnterpriseSubscription.status = active
  ↓
EnterpriseEntitlement 创建/同步
  ↓
AI Employee 额度生效
```

### 修复：Upgrade Flow 订单类型

**修复前:**
```typescript
type: 'subscription',  // ❌ 错误类型
planType: plan.name,
```

**修复后:**
```typescript
type: 'enterprise_subscription',  // ✅ 正确类型
metadata: { planId, planName, cycle, periodDays, ... },
```

---

## Phase 4: Enterprise Purchase Flow ✅

### 完整用户流程

```
企业管理员登录
  ↓
GET /api/enterprise/subscription/plans — 查看可用套餐
  ↓
选择套餐 + 周期（月付/年付）
  ↓
POST /api/enterprise/subscription/create-order — 创建订单
  ↓
获取支付参数（支付宝/微信）
  ↓
用户完成支付
  ↓
异步回调 → handleEnterpriseSubscriptionOrder()
  ↓
POST /api/enterprise/subscription/activate — 激活订阅
  ↓
Entitlement 同步创建
  ↓
AI Employee 额度生效
  ↓
GET /api/enterprise/:tenantId/billing/overview — 查看订阅+用量
```

### 新增 Admin 订阅管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/recruitment/subscriptions` | 所有企业订阅列表 |
| GET | `/api/admin/recruitment/subscriptions/:id` | 订阅详情（含 Entitlement） |
| PATCH | `/api/admin/recruitment/subscriptions/:id/status` | 手动变更订阅状态 |

---

## Phase 5: Admin Reality Gate ✅

### 验收清单

| 角色 | 操作 | 状态 |
|------|------|------|
| 管理员 | 创建套餐 | ✅ |
| 管理员 | 修改价格 | ✅ |
| 管理员 | 上架/下架套餐 | ✅ |
| 管理员 | 查看企业订阅列表 | ✅ |
| 管理员 | 手动冻结/激活订阅 | ✅ |
| 管理员 | 删除套餐 | ✅ |
| 企业用户 | 查看套餐列表 | ✅ |
| 企业用户 | 创建订单 | ✅ |
| 企业用户 | 支付回调自动激活 | ✅ |
| 企业用户 | 查看 Billing 概览 | ✅ |
| 系统 | Subscription 状态正确 | ✅ |
| 系统 | Entitlement 同步正确 | ✅ |
| 系统 | Agent 额度正确 | ✅ |

---

## Reality Gate: 🟢 PASS

### 商业闭环验证

```
Admin 配置套餐（价格/周期/额度）
  ↓
企业用户选择套餐
  ↓
创建 PaymentOrder
  ↓
昆仑镜支付（支付宝/微信）
  ↓
回调激活 Subscription
  ↓
Entitlement 同步
  ↓
AI Employee 额度生效
  ↓
企业使用招聘服务
  ↓
Admin 查看订阅+收入
```

---

## 架构状态更新

```
Enterprise Recruitment SaaS
├── Identity ✅
├── Tenant ✅
├── AI Runtime ✅
├── Commercial ✅
├── Revenue Loop ✅
├── Commerce Admin ✅ ← Sprint 05 完成
└── Next: Analytics Dashboard
```

---

## 交付物

- ✅ `docs/sprint/enterprise-commerce-admin-reality-01-report.md`
- ✅ Plan Management API (admin/recruitment/plans)
- ✅ Subscription Management API (admin/recruitment/subscriptions)
- ✅ Schema: yearlyPrice, snapshotPrice, snapshotCycle
- ✅ Upgrade Flow 修复（正确订单类型）
- ✅ Entitlement 同步（Admin 状态变更时）

---

## 影响统计

| 指标 | 数值 |
|------|------|
| 新增 API | 8 个 |
| Schema 变更 | 3 个字段 |
| 修复 Bug | 1 个（upgrade 订单类型） |
| 集成模块 | 2 个（admin-recruitment + enterprise-billing） |
