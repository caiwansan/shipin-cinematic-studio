# Sprint-09B-3A Commerce Reality Audit

**Date:** 2026-07-30 17:15 CST
**Author:** OpenClaw Audit
**Status:** COMPLETE

## 审计范围

昆仑镜已有的支付、订阅、套餐、Agent Provisioning 体系。

---

## 1. 现有支付能力怎么复用？

### 1.1 支付体系现状

```
PaymentOrder （通用订单表）
 ├── type: 'enterprise_subscription' / 'credit' / 'recharge'
 ├── amount / currency / status
 ├── metadata: JSON（存 planId / planName / cycle 等）
 └── organizationId / userId

PaymentSecret（支付密钥配置，管理员后台维护）
 ├── channel: 'wechat' | 'alipay'
 └── config: JSON（含 appId / mchId / privateKey 等）

PaymentConfig（支付方式展示，管理员配置）
 └── method / name / qrCodeUrl / enabled

RechargeOrder（遗留充值订单表，EnterpriseSubscription.orderId 引用）
```

### 1.2 已有的订阅支付流程（企业侧完整可复用）

```
POST /api/enterprise/subscription/create-order
  → 选择套餐 → 生成 pending PaymentOrder + 待激活 EnterpriseSubscription
  → 返回 orderId + orderNo + amount + available methods

POST /api/enterprise/subscription/create-payment
  → 微信/支付宝二维码生成
  → 更新 PaymentOrder.method

GET  /api/enterprise/subscription/payment-status/:orderId
  → 轮询支付状态

POST /api/enterprise/subscription/activate
  → 确认 paid → 激活 EnterpriseSubscription → 创建 EnterpriseEntitlement
```

**Payment Notify 已经就绪：**
```
POST /api/payment/alipay/notify（支付宝异步通知）
POST /api/payment/wxpay/notify（微信异步通知）
```
自动更新 PaymentOrder.status → 'paid' 或 'completed'

### 1.3 复用方案

个人职业助理应 **复用同样的 PaymentOrder 基础设施**：

| 企业侧 | 个人侧 | 复用方式 |
|--------|--------|---------|
| EnterprisePlan | SubscriptionPlan (career_agent) | SubscriptionPlan 已存在 |
| EnterpriseSubscription | Subscription (governance_subscription) | 复用 governance_subscription 体系 |
| EnterpriseEntitlement | CapabilityGrant | 已有 subscription → capability 关联 |
| PaymentOrder（type=enterprise_subscription） | PaymentOrder（type=career_subscription） | 同一张表，不同 type |
| 企业 create-order 路由 | 个人 create-order 路由 | 新路由，复用核心逻辑 |
| /api/payment/alipay/notify | 同一回调 | 复用，PATCH PaymentOrder → Subscription → Provision |

**不需要：** 新 PaymentOrder 表、新支付配置表、新支付回调。

---

## 2. Subscription 如何表达 career_agent 权益？

### 2.1 已有结构

```
SubscriptionPlan.governance_subscription_plan
 ├── code: 'career_agent' ✅ 已存在
 ├── name: 'Career Agent'
 ├── price: null ← 未配置
 ├── billingCycle: 'monthly'
 └── capabilities: JSON [
       'PROFILE_BUILD', 'RESUME_UPLOAD', 'RESUME_MANAGE',
       'JOB_APPLY', 'JOB_VIEW', 'JOB_SEARCH',
       'AI_RESUME_OPTIMIZE', 'AI_RESUME_REWRITE',
       'AI_CAREER_COACH', 'AI_INTERVIEW_PRACTICE',
       'AI_JOB_RECOMMEND', 'AI_SALARY_ANALYSIS', 'AI_OFFER_ANALYSIS'
     ]

CapabilityGrant.governance_capability_grant
 └── plan_id → SubscriptionPlan.id
 └── capability → 上面列表中的每一项

Subscription.governance_subscription
 ├── tenantId → 用户的 tenant ID
 ├── planId → SubscriptionPlan.id
 ├── status: 'active' | 'expired' | 'cancelled' | 'suspended'
 ├── startDate / endDate
 └── autoRenew
```

### 2.2 Gap：个人用户没有 Tenant

Subscription.tenantId 关联 Tenant 表。个人用户注册后是否自动创建了 Tenant？

**验证：** 需要检查用户注册流程是否创建 Tenant 记录。

**如果无 Tenant：** 第一个选择是 SubscriptionPlan 价格配好 + 新路由直接创建 Subscription。
也可以在系统中对个人用户创建 Tenant（type='personal'）。

### 2.3 权益表达链路

```
用户购买 career_agent 套餐
 ↓
Subscription（governance）
 ├── tenantId = userId （或 personal tenant）
 ├── planId = career_agent 的 id
 └── status: 'active'
 ↓
CapabilityGrant 查询：
  SELECT * FROM governance_capability_grant WHERE planId = ?
  → 返回 career_agent 关联的 capabilities 列表
 ↓
Career Agent Provisioning 触发：
  if capabilities includes 'AGENT_CAREER_ASSISTANT' 或类似标识
    → 激活个人职业助理
```

### 2.4 问题

capabilities 列表中需要有一个表示 "允许创建个人职业助理 Agent" 的能力标识。
当前 `career_agent` 套餐的能力列表全是功能级（RESUME_UPLOAD, AI_CAREER_COACH 等），
**缺少一个标识该订阅包含 Agent 创建权的能力项**。

建议增加一个 capability code：`CAREER_AGENT_PROVISION` 或等效标识。

---

## 3. Agent Provisioning 应该挂在哪里？

### 3.1 已有 provisioning 基础设施

```
CareerAgentService.createAndDeploy()
 ├── 创建 EnterpriseAgentProfile（agentType: 'career_advisor'）
 ├── 创建 EnterpriseAgentInstance
 ├── 创建 HermesProfileBinding
 ├── 关联 memory namespace
 └── 设置 runtimeStatus = 'active'

当前触发时机：
 └── getOrCreateAgentContext() 中
     └── 当用户有 BYOK 且无已有 Agent 时自动创建
```

### 3.2 推荐触发点

```
Payment Success（支付宝/微信 notify 回调）
 ↓
PaymentOrder.status = 'paid'
 ↓
确认 type === 'career_subscription' 且 metadata.planCode === 'career_agent'
 ↓
激活 Subscription（governance）
 ↓
调用 CareerAgentService.createAndDeploy({ userId, userName, goal? })
 ↓
向用户发送站内通知 / 刷新前端状态
```

### 3.3 具体挂载位置

**方案 A（推荐）：支付回调统一处理**

在现有支付回调处理逻辑中增加 career_subscription 分支。

支付宝通知 `/api/payment/alipay/notify` 或微信通知 `/api/payment/wxpay/notify` 
目前会更新 PaymentOrder.status → 'paid'。

增加一个 post-payment hook：

```
src/payment/handlers/career-subscription-handler.ts
```

当 payment.type === 'career_subscription' 时自动触发：

1. 激活 Subscription（governance_subscription + 设置 status='active'）
2. 调用 CareerAgentService.createAndDeploy({ userId })
3. 记录 Audit

**方案 B：前端轮询触发（更简单，推荐最小实现）**

```
POST /api/enterprise/subscription/activate 模式
改为个人侧：

POST /api/career/subscription/activate
```

用户在支付成功后，前端轮询到 PaymentOrder.status === 'paid'，
主动调用 activate API，该 API 做两件事：
1. 激活 Subscription
2. 调用 CareerAgentService.createAndDeploy

**方案 B 更小，建议 Task 02 用方案 A，Task 04 升级到方案 B。**

---

## 4. 总结

### 四个关键发现

| # | 发现 | 状态 | 优先级 |
|---|------|------|--------|
| 1 | SubscriptionPlan.career_agent 已存在，capabilities 已定义 | ✅ 就绪 | — |
| 2 | SubscriptionPlan.career_agent.price = null，需要配置价格 | ⚠️ 未配 | P0 |
| 3 | 缺少 "允许创建 Agent" 的 capability 标识 | ⚠️ 缺失 | P0 |
| 4 | 个人用户的 Tenant 记录可能存在缺口 | 🔍 待验证 | P1 |

### 复用率估计

| 组件 | 复用方式 | 复用率 |
|------|---------|--------|
| PaymentOrder 表 | 直接复用，type='career_subscription' | 100% |
| PaymentSecret 配置 | 直接复用 | 100% |
| 支付回调 | 增加 career_subscription 分支判断 | 90% |
| SubscriptionPlan | 已存在，配价格即可 | 80% |
| Subscription | 直接复用 governance_subscription | 100% |
| CareerAgentService | 已存在 createAndDeploy | 100% |
| 支付前端流程 | 参考 enterprise-billing 复制调整 | 60% |

### 三个问题的答案

**Q1: 现有支付能力怎么复用？**
→ PaymentOrder（type='career_subscription'）+ 已有支付宝/微信回调。不需要新支付表。

**Q2: Subscription 如何表达 career_agent 权益？**
→ SubscriptionPlan（code='career_agent'）+ CapabilityGrant 链路已就绪。配价格 + 加一个 Agent Provisioning 标识即可。

**Q3: Agent Provisioning 应该挂在哪里？**
→ 支付回调中（方案 A）+ 前端 activate API（方案 B）。CareerAgentService.createAndDeploy 已就绪。

---

## 附录：扫描文件清单

| 文件 | 内容 |
|------|------|
| prisma/schema.prisma | PaymentOrder, PaymentConfig, PaymentSecret, SubscriptionPlan, Subscription, EnterpriseSubscription, EnterprisePlan, EnterpriseEntitlement |
| src/routes/enterprise-subscription-billing.ts | 企业订阅完整支付流程（create-order → create-payment → payment-status → activate） |
| src/routes/payment.ts | 支付密钥/配置管理（Admin） |
| src/services/enterprise/enterprise-entitlement.service.ts | Entitlement 创建/同步服务 |
| src/services/enterprise/workflow/career-agent.service.ts | CareerAgentService.createAndDeploy |
| src/services/career/career-conversation-orchestrator.ts | getOrCreateAgentContext（当前触发点） |
| src/seeds/capability-seed.ts | SubscriptionPlan 种子数据 |
| src/constants/capabilities.ts | PLAN_CAPABILITY_MATRIX + PLAN_METADATA 定义 |
