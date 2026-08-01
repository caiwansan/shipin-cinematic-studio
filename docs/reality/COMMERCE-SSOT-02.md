# SPRINT-COMMERCE-SSOT-02 冻结 Commerce V2：所有商业商品统一 — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜战略指令（Commerce V2 冻结：Product Catalog SSOT，AI 员工与 VIP 不允许双轨）

## T01 商品目录统一（Product Catalog = SSOT）

**审计结论**：
- 目录表 = `SubscriptionPlan`（Product + CapabilityBundle 合一）✅ 已是唯一商品载体
- **代码零分支改造**：删除 PRODUCT_TYPES 硬编码映射表 → 商品自描述（metadata JSON）
  ```
  { productType: 'AI_AGENT'|'VIP', provision: 'agent'|'entitlement_only', months, memberPlanLevel, coins }
  ```
- `resolveProductMeta()` 统一解析，provisionFromPayment 零 `if(productCode===...)` 分支
- 当前目录 10 条：recruitment×4（组织）/ career_agent（AI 员工）/ vip_basic·vip_vips·vip_director·vip_pro（VIP）

## T02 VIP 迁移（核心：消灭商业双轨）

**旧双轨（已冻结）**：
```
/api/member/upgrade-vip → MemberPlan → RechargeOrder → user.memberTier + Membership（无 Subscription/Entitlement）
```
**新统一链**：
```
/api/member/plans（商品权威 merge）→ upgrade-vip → PaymentOrder(vip_*) → 支付 → commerce-provision → Subscription + PersonalEntitlement(VIP) + 兼容层
```

交付：
1. **VIP 商品注册**：vip_basic(¥9.9/30d) / vip_vips(¥1399/365d) / vip_director(¥139/30d) / vip_pro(历史，不再售卖)
2. **upgrade-vip 支付场景** → 统一 PaymentOrder（planType=vip_*），rechargeOrder 禁新订单
3. **coupon 全额抵扣** → 直连 provisionFromPayment（构造 paid 订单，统一激活入口）
4. **create-payment / 轮询端点**：PaymentOrder 优先 + rechargeOrder 存量兼容（代理/历史订单）
5. **判定链 Entitlement 权威**：`resolveEffectiveTierAsync()` = PersonalEntitlement(VIP active 未过期) → membership → memberTier → free；requireMemberTier / auth AI key 检查已接入
6. **存量迁移**：5 个 memberTier≠free 用户 → Subscription + PersonalEntitlement(source=migration，过期诚实标 expired)
7. **/api/member/plans**：价格/周期以 Product Catalog 权威（MemberPlan 仅承载权益参数）

## T03 罗盘商业数据统一

- 收入来源分类：**Product Catalog 权威**（metadata.productType 分类，替代 planType 字符串硬编码）
  - VIP 会员 ¥9.9（活跃权益 1）/ AI 员工 ¥69.3（活跃权益 6）/ 企业订阅 ¥59980 / 商城 ¥0
- 大卡新增：vip.entitlementActive / agentEntitlementActive / expiringSubs30d（30 天内到期订阅 = 续费窗口）
- 漏斗「购买 VIP」改用活跃权益数（真实）

## T04 全仓治理（报告：COMMERCE-SSOT-02-T04-SCAN.md）

| 禁止模式 | 扫描结果 |
|----------|----------|
| /payment/{workspace}/checkout | ✅ 零残留 |
| xxxSubscriptionFromPayment / xxxActivate | ✅ 零残留（commerce-provision 唯一入口） |
| if(productCode==='xxx') 分支 | ✅ 已废除（metadata 自描述） |

存量旁路标记治理（禁新增）：商城积分 recharge / 代理商 AGT / mall 共用流水 / admin vip-orders 存量审批 —— 等掌柜指令统一

## Reality Gate（生产域实测全 PASS）

| 验收项 | 结果 |
|--------|------|
| VIP 商品注册 | ✅ 4 条 vip_* 入目录，/api/member/plans merge 权威价格 |
| upgrade-vip 建单 | ✅ PaymentOrder(vip_basic ¥9.9) 创建，rechargeOrder 零新订单 |
| admin confirm → Provision | ✅ Subscription active(2026-08-31) + PersonalEntitlement(vip_basic, 6 caps, source=payment) + 兼容层(memberTier/membership 同步) |
| Entitlement 权威 | ✅ 清空兼容层后判定仍 = basic |
| 轮询端点 | ✅ PaymentOrder 分支返回 paid/vip_basic |
| 存量迁移 | ✅ 5 用户迁移（诚实 expired） |
| 幂等/未知商品 | ✅ 已订阅 400 / 未知商品 400 |
| career 回归 | ✅ checkout 正常建单 |
| 浏览器 | ✅ 套餐列表权威价格 + 支付弹窗 + 已购状态 |

截图：COMMERCE-SSOT-02-{plans,pay-modal,subscribed}.png

## 冻结（Commerce V2）

1. 商品 = SubscriptionPlan（metadata 自描述），禁止代码硬编码商品分支
2. 所有购买（AI 员工/VIP/未来）→ /api/payment/checkout + provisionFromPayment（唯一激活入口）
3. 权益 = PersonalEntitlement / EnterpriseEntitlement 权威，membership/memberTier 仅兼容层
4. 禁止 rechargeOrder 新订单（存量旁路只处理不新增）

## 遗留（冻结清单）

⏸ 代理商套餐（agent-plan）/ 商城积分 / mall 未入 Product Catalog（等掌柜指令）
⏸ admin vip-orders 存量审批界面与新 PaymentOrder 审批合并
⏸ VIP 会员权益能力码与具体功能 gate 的完整映射（本期落 Entitlement，功能 gate 接入待续）
