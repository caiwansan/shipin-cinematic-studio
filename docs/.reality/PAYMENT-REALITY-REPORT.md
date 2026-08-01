# PAYMENT-REALITY-REPORT

**Date:** 2026-07-30 18:10 CST
**Scope:** 支付宝+微信支付生产能力审计
**Type:** 审计（不开发）

---

## 1. 基础设施 Reality

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 域名 aigc.fushtn.com 解析 | ✅ | 124.223.208.24 |
| SSL 证书 | ✅ | /www/server/panel/vhost/ssl/aigc.fushtn.com/ |
| Nginx → 4002 代理 | ✅ | `location /api/` → `proxy_pass 127.0.0.1:4002` |
| 外网可访问 | ✅ | 通过 HTTPS 可达 |
| Nginx 有代理超时 300s | ✅ | 长回调没问题 |

**结论：基础设施就绪。**

---

## 2. 支付宝生产配置

| 字段 | 状态 | 值摘要 |
|------|------|--------|
| `appId` | ✅ | `20210061...` (16位) |
| `privateKey` | ⚠️ 格式 | 1624 字符，无 PEM 头，纯 Base64 |
| `publicKey` (alipayPublicKey) | ⚠️ 格式 | 392 字符，无 PEM 头，纯 Base64 |
| 签名算法 | ✅ | RSA-SHA256 |
| `gateway` | ✅ | `https://openapi.alipay.com/gateway.do` |
| `notifyUrl` | ✅ | `https://aigc.fushtn.com/api/payment/alipay/notify` |
| `returnUrl` | ✅ | `https://aigc.fushtn.com/user/center` |
| enabled | ✅ | `true` |

**关键发现：**
- `verifyNotify()` 在代码中自动处理纯 Base64 密钥 → PEM 格式转换
- privateKey 和 publicKey 无 PEM 头不阻塞验证（代码已处理）
- **但 AlipayProvider 的 `buildRequest` 中的签名方法未审计完整 — 需要确认签名一致性**

---

## 3. 微信支付生产配置

| 字段 | 状态 | 值摘要 |
|------|------|--------|
| `appId` | ✅ | `wx49061f...` |
| `mchId` | ✅ | `1723193665` |
| `apiV3Key` | ✅ | 31 字符 |
| `keyPem` (商户私钥) | ✅ | 1704 字符，包含 `-----BEGIN PRIVATE KEY-----` |
| `serialNo` | ✅ | `6FF42552...` |
| `apiKey` (v2) | ✅ | 存在 |
| notify 路由 | ✅ | `POST /api/payment/wxpay/notify` |

**关键发现：**
- 微信使用 API v3，配置完整
- `keyPem` 格式正确（含 PEM 头）
- `serialNo` 需要与商户证书匹配（配置存在）

---

## 4. 订单与交易 Reality ❌

### 最严重发现：0 笔支付成功

| 指标 | 值 |
|------|-----|
| PaymentOrder 总数 | **23** |
| 其中 `pending` | **23** |
| 其中 `paid` | **0** |
| 其中 `expired` | **0** |
| Career 订单 (planType=career_agent) | **2**（都是今日测试订单） |
| 真实用户购买 Career | **0** |

**结论：上线至今没有一个真实用户完成支付。**

### 根本原因分析

```
用户 → 创建订单 (pending) → ❌ 没有支付
```

这里不是程序问题，是业务流程的现实：

**阶段 1：收款码模式**（旧）
- 用户看到收款码 → 扫码付款 → 告诉管理员 → 管理员手动确认到账
- 用户流失率高：多了一步"告诉管理员"

**阶段 2：密钥自动回调模式**（当前）
- 支付宝/微信已配置密钥
- `/api/payment/alipay/notify` 和 `/api/payment/wxpay/notify` 路由存在
- 但：订单创建时 **没有调用 createOrder()** — checkout 只创建了 PaymentOrder 记录，没有调支付宝 SDK 生成支付链接/二维码
- 所以用户根本没进入支付宝支付流程

---

## 5. Career 支付链路断点

```
用户进入镜心工作台 → 403 → showPurchaseCard → 立即开通
  ↓
前端 fetch POST /api/payment/career/checkout ✅ (09C-1 刚完成)
  ↓
后端创建 PaymentOrder(status=pending, planType=career_agent) ✅
  ↓
返回 { orderNo, amount, status }
  ↓
❌ 前端没有引导用户去支付
   (没有对接支付宝/微信的支付链接/二维码)
```

**当前 checkout 端点是纯订单创建，不是真正的收银台。**

---

## 6. 支付回调就绪性

| 回调 | 状态 | 说明 |
|------|------|------|
| Alipay notify | ✅ | 路由 `/api/payment/alipay/notify` 存在 |
| Alipay 验签 | ✅ | `verifyNotify()` 含签名验证 + IP 白名单 |
| WeChat notify | ✅ | 路由 `/api/payment/wxpay/notify` 存在 |
| WeChat 解密 | ✅ | `decryptWxpayNotify()` 含 resource 解密 |
| 订单状态更新 | ✅ | `pending → paid` 逻辑存在 |
| Career 订阅激活 | ✅ | `handleCareerSubscriptionFromPayment()` 已接入 |

**回调链路代码级就绪，但缺少前端支付入口。**

---

## 7. 风险矩阵

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| R1 | **checkout 不触发真实支付** | 🔴 HIGH | 只创建订单，不调用 Alipay/Wxpay SDK 生成支付链接。用户无法完成支付 |
| R2 | **支付宝公钥格式风险** | 🟡 MEDIUM | publicKey 392 字符无 PEM 头，代码有转换逻辑但未在生产验证过 |
| R3 | **微信 API v3 证书序列号不匹配** | 🟡 MEDIUM | serialNo 需要与微信商户平台上传的证书一致，配置有但未验证 |
| R4 | **回调 IP 白名单** | 🟢 LOW | ALIPAY_WHITELIST_IPS 和 WXPAY_WHITELIST_IPS 环境变量未配置，白名单为空。生产环境建议配置 |
| R5 | **回调幂等性** | 🟢 LOW | 重复回调已做 status 检查，但 planType=career_agent 的幂等性需要确认 |

---

## 8. 现状结论

**支付能力存在闭环已配置但未走过：**

```
配置层 ✅ (密钥/域名/SSL/Nginx)
订单层 ✅ (PaymentOrder CRUD)
回调层 ✅ (notify 路由/验签/订阅激活)
─────
交易层 ❌ (用户从未完成支付)
前端层 ❌ (没有支付跳转/二维码展示)
```

**当前系统配置了支付宝和微信密钥，但 Career checkout 只产出待支付订单，未对接真实支付网关。**

---

## 9. 下一步选项

### 方案 A：收银台落地（推荐）

改动最小：在 checkout 中返回支付链接/二维码

```
POST /api/payment/career/checkout
  → 创建 PaymentOrder
  → 调 AlipayProvider.createOrder() 获取 payUrl
  → 返回 { orderNo, payUrl, qrCode }
  ↓
前端展示二维码/跳转支付宝
```

此方案改动点：
- `payment.ts` checkout 路由增加 ~20 行：根据 method 调对应 provider 生成支付链接
- 前端购买卡片：展示二维码或跳转链接

### 方案 B：管理员确认 + 状态展示（成本低，但需要人工）

保持人工确认流程，但需要：
- 用户端能看到订单状态（当前没有）
- 购买后显示"支付确认中"+ 订单编号

---

**报告完毕。** 建议掌柜决策走 A 或 B，或者先讨论方案再开工。
