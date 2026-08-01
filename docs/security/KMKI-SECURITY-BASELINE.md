# KMKI 安全基线（KMKI Security Baseline）

> 昆仑镜平台安全设计权威文档。冻结规则，任何 Sprint 不得违反。
> 生效：2026-08-01（SPRINT-PAYMENT-SECURITY-01 确立管理员边界）

---

## 一、KMKI 三大安全基石

```
┌─────────────────────────────────────────────────┐
│  Identity Authority  ·  Commerce Authority  ·  Runtime Authority  │
└─────────────────────────────────────────────────┘
```

| 基石 | 职责 | 权威存储 | 冻结规则 |
|------|------|----------|----------|
| **Identity Authority** | 谁是谁（用户/企业/管理员身份分层） | User / Organization / AdminUser + JWT isAdmin | 用户身份与管理员身份**必须分层**，禁止 User Token 直通 Admin API |
| **Commerce Authority** | 钱的流动（商品/订单/支付/权益） | Commerce 套餐 + PaymentOrder + Entitlement | 支付成功唯一来源 = 验签回调（自动）+ 管理员线下对账（人工）；前端/普通用户无 confirm 路径 |
| **Runtime Authority** | AI 怎么跑（模型/成本/执行记录） | ProviderCredential + OrgModelConfig + AgentExecution + usage_logs | BYOK：平台不托管用户/企业 Key，不替业务 Workspace 调大模型 |

三者交汇：**任何资源变更必须同时通过身份层（谁）与授权层（凭什么），任何 AI 执行必须留下成本与结果记录（干了什么、花了多少、产出什么）。**

---

## 二、身份分层原则（Identity Authority）

> SPRINT-PAYMENT-SECURITY-01 确立。背景：admin 与用户 JWT 曾共用同一 secret，`verifyToken` 只验签不验 isAdmin，导致普通用户 JWT 可穿过 requireAdmin 保护的全部后台端点（20+ 挂载面）——支付 confirm 只是受害面之一。

### 禁止

```
User Token ────────→ Admin API
```

### 必须

```
User Identity ──→ User Permission Layer ──→ 用户 API
Admin Identity ──→ Admin Permission Layer ──→ 后台 API
```

### 实现约束（冻结）

1. `admin-auth.verifyToken` 必须校验 `decoded.isAdmin === true`，否则返回 null（一处修复，全局受益）
2. 后台端点鉴权 = `preHandler: [requireAdmin]`（或等价 requireSuperAdmin）；禁止裸手动 `verifyToken` 逻辑
3. 任何手动 auth 端点必须处理 decoded 为 null → 401（禁止静默放行）
4. admin 签发 JWT 必须带 `isAdmin: true`；用户 JWT 永不携带该字段
5. 新增后台路由默认走 requireAdmin，不默认信任

### 审计结论（2026-08-01）

- 全仓唯一裸鉴权漏洞：payment confirm / member-confirm（无 preHandler + decoded null 不阻断）→ 已修复
- 其余 11 个手动 auth 端点均有 `if (!decoded) return 401` ✅
- 回调验签健康：alipay verifyNotify / wxpay APIv3 解密，伪造全 403
- 非攻击面排除：admin-platform-runtime 路由从未挂载（0 注册点）；provider-keys 废弃；llm-select 只读
- 纵深待办：支付回调 IP 白名单 env（WHITELIST_ALIPAY_IPS / WXPAY_IPS）未配置，验签已兜底

---

## 三、支付闭环（Commerce Authority）

```
商品 → 订单 → 支付 → Webhook 验签 → Entitlement → Agent Provision → Runtime
```

### 支付成功唯一来源（冻结）

```
1. 微信回调（APIv3 解密验签）
2. 支付宝回调（RSA2 验签）
3. 管理员人工确认（线下收款对账，requireAdmin）
```

### 禁止（冻结）

- ❌ 前端 confirm 支付
- ❌ 普通用户 token confirm 支付
- ❌ 绕过验签的任何状态变更

### 订单状态机

```
pending → paid（单向，仅一次转换；幂等：重复 confirm/回调 → 400/忽略）
```

---

## 四、Runtime Authority（BYOK，重申）

> KMKI AI Runtime Principle（2026-08-01 掌柜冻结 · 最高级架构规则）

- 所有 Workspace AI 能力遵循 **BYOK Runtime**：Workspace 负责业务场景/Agent 编排/能力授权/执行记录；用户负责模型供应商与 API 成本；平台禁止成为业务 Workspace 的大模型调用中转方
- 唯一入口：User/Organization Model Config → Unified Runtime Resolver → All Workspace Agents
- 禁止设计：Workspace Model Config / 任何业务线专属模型配置（违反 SSOT）
- 平台层只管理 Provider/Model/Capability/Agent Registry + Runtime + Usage Billing
- 商业模式：订阅/AI 员工/增值/企业服务收入，不是 API 差价

---

## 五、统一价值层（Agent Outcome，补充）

> SPRINT-AGENT-OUTCOME-01 确立。禁止各 Workspace 自建结果表（RecruitmentOutcome / CareerOutcome / HDZOutcome 全禁止）。

```
AgentOutcome（唯一结果表）
   └─ workspace metadata（区分业务线）
```

- 所有 AI 员工产生的业务结果统一写入 `agent_outcome`
- 数据必须来自真实执行结果，禁止估算 / Mock / 手工伪造 ROI
- 成本侧来自 usage_logs（真实调用成本），价值侧来自真实 outcome 计数 + 企业自设价值参数（可选，未配不展示 ROI）
