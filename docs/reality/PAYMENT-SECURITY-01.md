# Sprint-PAYMENT-SECURITY-01 支付安全边界加固 — COMPLETE ✅

**Date:** 2026-08-01 18:50
**Gate:** 掌柜 P0 指令（SPRINT-CAREER-REALITY-01 遗留：admin confirm 信任任意 user JWT = 免费开通 Agent/改订阅状态/商业损失）

## T01 审计：根本漏洞比报告的更严重

**1. admin JWT 与用户 JWT 共用同一 secret（JWT_SECRET）签发**
- 用户 JWT：`{id, email, tokenVersion}`（auth.ts）
- admin JWT：`{userId, username, role, isAdmin: true}`（admin-auth.ts）
- `admin-auth.verifyToken` 只做 `app.jwt.verify(token)`（验签），**不校验 isAdmin**
- → 普通用户 JWT 通过验签 → 返回非 null 对象 → **requireAdmin 形同虚设**（20+ 文件挂载面全部失效）
- → payment confirm 里 `decoded = verifyToken(用户JWT)` 非 null → 继续执行

**2. `/api/admin/payment/confirm` + `/api/admin/member/confirm` 无 preHandler**
- 无 401 检查、decoded 为 null 也不阻断（其他 11 个手动 auth 端点都有 `if (!decoded) return 401`，仅这 2 个例外）
- 攻击链：普通用户 JWT（或直接无 token）+ 猜/拿订单号 → 免费确认订单 → 加积分 + 激活 Career Agent + 升级 VIP

**3. 回调验签已存在（无漏洞）**
- alipay notify：`provider.verifyNotify(body)` 验签 ✅（伪造 → 403「signature verification failed」）
- wxpay notify：APIv3 `decryptWxpayNotify(resource)` 解密 ✅（伪造密文 → 403「invalid notification」）
- IP 白名单 env（WHITELIST_ALIPAY_IPS/WXPAY_IPS）未配置 → 跳过（纵深防御待办，验签已兜底）

**4. 非攻击面排除**
- admin-platform-runtime.route.ts 10 个无鉴权端点：**从未被 index.ts 挂载（0 注册点，运行时 404）**，文件头 DEPRECATED 已注明
- admin-models.ts provider-keys：废弃路由（直接返回提示，无副作用）
- admin-platform-llm select：只读配置决策

## T02 修复（双层防线）

**Fix 1（根本）** `admin-auth.ts verifyToken` 加 `isAdmin === true` 校验：
- 一处修复，覆盖全部 6 个 verifyToken 使用方 + 20+ 个 requireAdmin 挂载面
- 用户 JWT → decoded.isAdmin = undefined → 返回 null → 401

**Fix 2** `payment.ts` confirm/member-confirm 加 `preHandler: [requireAdmin]`：
- 移除手动 verifyToken 裸逻辑，改用 `extractAdmin`
- 双保险：preHandler 拦截 + verifyToken isAdmin 校验

## T03 支付状态唯一来源冻结

```
订单 pending
  ├─→ paid（自动）：支付宝回调（验签） / 微信回调（APIv3 解密）
  ├─→ paid（人工）：管理员线下收款对账（requireAdmin）
  └─→ 普通用户/前端：一律 401，不存在 confirm 路径
```

幂等状态机：`pending → paid` 仅一次转换（`status !== 'pending'` → 400）；回调侧 `if (payOrder.status === 'pending')` 防重放；Career 订阅 active 检查防重复激活。

## T04 攻击路径验收（生产域实测）

| 攻击/路径 | 结果 |
|-----------|------|
| 无 token confirm 任意订单 | 401「未授权，需要管理员登录」✅ |
| 普通用户 JWT confirm 任意订单 | 401（修复前放行！）✅ |
| 普通用户 JWT 读支付密钥 | 401「token 无效或已过期」✅ |
| 伪造 alipay notify（无签名） | 403「signature verification failed」，订单零影响 ✅ |
| 伪造 wxpay notify（垃圾密文） | 403「invalid notification」✅ |
| 管理员 confirm 正常订单 | 200 + 订阅激活 ✅ |
| 重复 confirm 同一订单 | 400「订单状态不允许确认」（幂等）✅ |
| 管理员读订单/支付配置（回归） | 200，密钥掩码 ✅ |

## 治理规则（冻结）

1. admin 端点鉴权 = `preHandler: [requireAdmin]` 或 `verifyToken`（isAdmin 强校验），禁止裸 verifyToken 手动逻辑
2. 支付成功唯一来源 = 验签回调（自动）+ 管理员线下对账（人工）；前端/普通用户无 confirm 路径
3. 订单状态机 pending→paid 单向转换，回调与 confirm 均须幂等
4. admin/用户 JWT 继续共用 secret 但 isAdmin 字段是身份分界（admin 签发必须带 isAdmin: true）
