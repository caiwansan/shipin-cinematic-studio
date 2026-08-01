# SPRINT-COMMERCE-UNIFICATION-CAREER-01 职业助理开通迁回统一商业系统 — COMPLETE ✅

**Date:** 2026-08-01 19:30
**Gate:** 掌柜架构纠偏（Career Agent 不是独立商品，是昆仑镜 Commerce Authority 下的 Entitlement 激活；不允许 Career 专属支付链）

## 掌柜纠偏核心

❌ 错误方向：用户 → Career 专属支付 → CareerSubscription → Career Agent 激活
✅ 正确架构：用户 → 昆仑镜 Commerce Authority → Product → Order → Payment → Subscription → Entitlement → Agent Provision

## T01 支付链路审计（事实修正）

**结论：Career 从未建独立商业表**（无 career_order / career_payment / career_subscription 表）：
- 支付：统一 `PaymentOrder`（planType=career_agent）+ 统一支付宝/微信 provider + 统一回调验签/幂等 ✅（此前已合规）
- 订阅：统一 `Subscription`（个人线 tenantId=userId）+ `SubscriptionPlan(code: career_agent)` ✅（此前已合规）

**真正的架构偏差（本次修复）**：
| # | 偏差 | 修复 |
|---|------|------|
| 1 | **Entitlement 缺失**：订阅成功不落权益记录，校验只查 Subscription | 新增 `PersonalEntitlement`（个人权益授予，对称企业线 EnterpriseEntitlement），支付成功自动授予能力目录 |
| 2 | **Provision 专属函数**：payment.ts `handleCareerSubscriptionFromPayment`（1279 行专属激活） | 删除，统一走 `commerce-provision.service.ts`（provisionFromPayment 唯一入口） |
| 3 | **checkout 专属端点**：`/api/payment/career/checkout` | 泛化为 `POST /api/payment/checkout`（productCode 驱动），career 端点降级为兼容壳 |
| 4 | **前端语义**：「立即开通」+ 硬编码权益 | 「立即开通 AI 职业助理」+ 权益来自统一 Product 目录 |

## T02 职业助理商品化

- **Product + CapabilityBundle 合一**：`SubscriptionPlan(code: career_agent)` 已有 14 项能力目录（CAREER_AGENT_PROVISION / PROFILE_BUILD / RESUME_UPLOAD / JOB_APPLY / AI_RESUME_OPTIMIZE / AI_CAREER_COACH / AI_INTERVIEW_PRACTICE / AI_JOB_RECOMMEND / AI_SALARY_ANALYSIS / AI_OFFER_ANALYSIS 等）
- **新增 `personal_entitlement` 表**（Commerce Authority 通用层，非 Career 专属）：userId + subscriptionId + planCode + productType(AI_AGENT|VIP) + capabilityCodes + status + source(payment|migration) + orderNo
- **新增 `GET /api/payment/products/:productCode`**：商品 + 权益目录数据源（前端展示 + 未来会员页复用）

## T03 统一 Provision

```
PaymentSuccess（验签回调 / 管理员确认）
  → commerce-provision.provisionFromPayment(payOrder)   ← 唯一入口
    → ① Subscription 落库/续期（统一表）
    → ② PersonalEntitlement 授予（能力目录，幂等 upsert）
    → ③ AgentProvisionService 部署（CareerAgentService.createAndDeploy）
```

- payment.ts 三处支付成功点（admin confirm / alipay notify / wxpay notify）全部改走统一入口
- 权益校验升级：checkProvisionEntitlement = Subscription active **+ PersonalEntitlement active** 双确认（Entitlement 权威）
- 存量迁移：5 条 active career_agent 订阅 → 补 PersonalEntitlement（source=migration，1 条非 UUID 测试租户跳过）

## T04 前端语义

- 按钮：「立即开通」→「立即开通 AI 职业助理」
- 弹窗标题：「开通镜心职业助理」→「🪞 立即开通 AI 职业助理」
- 权益列表：硬编码 → `GET /api/payment/products/career_agent` 能力目录渲染（能力码 → 中文权益名映射，去重取前 6）
- checkout 调用：`/api/payment/career/checkout` → `/api/payment/checkout`（productCode 语义）

## Reality Gate（生产域实测全 PASS）

| 验收项 | 结果 |
|--------|------|
| 统一 checkout（productCode=career_agent） | ✅ PaymentOrder 落库 + 真实支付宝支付链接 |
| 幂等防护（已订阅用户重复购买） | ✅ 400「您已拥有活跃的订阅」 |
| admin confirm 到账 → 统一 Provision | ✅ Subscription active(2026-08-31) + PersonalEntitlement(14 caps, 来源订单) + AgentProfile active + AgentInstance active |
| 权益校验（新用户购买后 status） | ✅ hasAgent=true / hasActiveSubscription=true / subscriptionStatus=active |
| 未知商品拒绝 | ✅ 400「商品 vip_unknown 未配置」 |
| 存量迁移 | ✅ demo 用户 entitlement active（14 caps, source=migration） |
| 前端未购买用户 | ✅ 按钮「立即开通 AI 职业助理」+ 弹窗权益来自后端目录（职业画像/简历管理/岗位投递…） |
| 前端已订阅用户 | ✅ 「已订阅」徽章 + 无购买按钮 |

截图：COMMERCE-UNIFICATION-CAREER-01-{modal,subscribed}.png

## 治理规则（冻结）

1. 所有 AI 员工 / VIP 购买必须走 `POST /api/payment/checkout`（productCode 驱动）+ `provisionFromPayment`（唯一激活入口）
2. 权益授予必须落 `PersonalEntitlement`（个人）/ `EnterpriseEntitlement`（企业），禁止只查订阅
3. 禁止业务线自建商业表 / 专属 checkout / 专属激活函数（career/checkout 兼容壳仅过渡，前端已迁移）
4. 商品目录 = SubscriptionPlan（Product + CapabilityBundle），前端权益展示必须来自目录 API，禁止硬编码

## 遗留

⏸ VIP 会员套餐（vip_basic/vip_advanced）商品化——本期只迁移 career_agent，PRODUCT_TYPES 已预留 entitlement_only 分发
⏸ 微信/支付宝真实回调端到端（沙箱已验证，生产回调逻辑与 admin confirm 同一入口）
