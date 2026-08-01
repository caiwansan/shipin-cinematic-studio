# SPRINT-COMMERCE-SSOT-02 T04 — 商业代码全仓治理扫描报告

**Date:** 2026-08-01
**Gate:** 掌柜指令（冻结 Commerce V2：禁止业务线支付代码）

## 禁止模式扫描结果

| 禁止模式 | 扫描规则 | 结果 |
|----------|----------|------|
| 业务线专属 checkout | `/payment/{workspace}/checkout` | ✅ 零残留（仅 `career/checkout` 兼容壳，已标注 DEPRECATED） |
| 业务线专属激活函数 | `xxxSubscriptionFromPayment` / `xxxActivate()` | ✅ 零残留（唯一入口 `commerce-provision.provisionFromPayment`） |
| 业务线商品分支 | `if(productCode==='xxx')` 代码硬编码 | ✅ 已废除（PRODUCT_TYPES 表删除 → 商品自描述 metadata） |

## 统一链现状（冻结）

```
用户 → POST /api/payment/checkout（productCode 驱动）
     → PaymentOrder（统一表）
     → 支付回调（验签 / admin confirm）
     → commerce-provision.provisionFromPayment（唯一激活入口）
     → Subscription（统一表）→ PersonalEntitlement / EnterpriseEntitlement
     → Agent Provision / 权益生效
```

- 商品目录 = SubscriptionPlan（Product + CapabilityBundle 合一，metadata 自描述 productType/provision/months）
- VIP 判定 = PersonalEntitlement(productType=VIP) 权威 → membership/memberTier 仅兼容层
- 轮询 = /api/payment/alipay/status/:orderId（PaymentOrder 优先，rechargeOrder 存量兼容）

## 存量旁路（非本期商品，标记治理，禁新增）

| 位置 | 模式 | 归属 | 状态 |
|------|------|------|------|
| member.ts `/api/member/recharge` | RECHARGE_PLANS 硬编码 + rechargeOrder | 商城积分（type=mall） | ⏸ 商城统一时迁移 |
| agent-plan.ts `/api/agent-plan/purchase` | AGT 专属订单 + rechargeOrder | 代理商套餐（独立商业线） | ⏸ 等掌柜指令 |
| mall-public.ts 商城下单 | rechargeOrder 共用支付流水 | 商城 | ⏸ 商城统一时迁移 |
| member.ts `/api/admin/vip-orders/*` | rechargeOrder 审批 | 存量 VIP 订单审批 | ⏸ 新订单已走 PaymentOrder，存量兼容 |

**规则**：以上旁路只处理存量，禁止新订单写入（新 VIP 订单已全走 PaymentOrder）。

## 遗留（未纳入本期，冻结清单）

❌ 代理商套餐（agent-plan）未入 Product Catalog —— 等掌柜指令
❌ 商城积分/道具未入 Product Catalog —— 等掌柜指令
