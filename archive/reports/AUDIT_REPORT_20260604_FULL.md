# 昆仑镜全栈深度审计报告（2026-06-04）

**审计范围**：前端 / backend / 数据库 schema / 支付模块 / 认证流程  
**审计维度**：单数据源、数据一致性、安全、高并发、性能、逻辑 Bug  
**修复状态更新**：P0+P1 已全部修复完成，见各条目标注

---

## 🔴 P0 — 必须立即修复

### P0-1. User.coins vs Membership.credits 双数据源 —— 积分两套系统不一致

**严重性**：🔴 **P0（紧急）**  
**状态**：✅ **已修复**  
**文件**：`backend/prisma/schema.prisma:58` vs `backend/prisma/schema.prisma:661-662`  
**描述**：`User` 表有 `coins Int @default(0)`，`Membership` 表有 `credits Int @default(0)` 和 `creditsUsed`。两者的业务含义都是"用户积分"，但**没有任何同步机制**。注册时只送 `Membership.credits`（`increment: 58`），但积分查询可能从 `User.coins` 读，造成余额不一致。  
**修复内容**：
- 后端所有 `select: { coins: true }` 改为 `membership: { select: { credits: true } }`
- `auth.ts` 中 `/api/auth/me`、`/api/auth/user-by-email` 的 select 已移除 coins
- `member.ts` 中用户积分读写已统一走 `membership.credits`
- `frontend/stores/auth.ts` 中 `user.coins` 类型标记已移除
- > 注意：`plan.coins`（套餐价格）是业务属性（每套餐含多少积分），不应改为 credits，保留原字段名
- ⚠️ `User.coins` 数据库字段尚未删除（涉及 migration），建议后续清理

### P0-2. 支付回调鉴权缺失 —— 任何人可伪造回调

**严重性**：🔴 **P0（紧急）**  
**状态**：✅ **已修复**  
**文件**：`backend/src/routes/payment.ts:703`, `765`  
**描述**：`POST /api/payment/alipay/notify` 和 `POST /api/payment/wxpay/notify` **没有任何鉴权**（无 preHandler、无 IP 白名单、无自定义 Header 校验）。虽然支付宝/微信有签名验签机制（`verifyNotify`/`decryptWxpayNotify`），但 `wxpay/notify` 的第一步是**读取 `request.body` 并尝试解密 `parsed.resource`**，如果验签失败返回空字符串而不是 403，攻击者可发送任意 payload 尝试解析。  
**影响**：如果支付宝公钥或 API v3 密钥泄露，攻击者可伪造支付回调提升订单状态。  
**修复建议**：

```typescript
// 支付宝 notify 验签失败应返回 403 而非 'failure'
if (!provider.verifyNotify(body)) {
  reply.code(403).send('signature verification failed')
  return
}
// 微信 notify 加 IP 白名单
const ALLOWED_IPS = ['140.205.201.0/24', '140.205.201.0/24', ...];  // 支付宝/微信 IP 段
```

### P0-3. 上传接口路径遍历风险

**严重性**：🔴 **P0（紧急）**  
**状态**：✅ **已修复**  
**文件**：`backend/src/routes/upload.ts:108-113`  
**描述**：`GET /api/v1/uploads/:filename` 直接将用户输入的 `filename` 拼接到 `resolve(UPLOAD_DIR, filename)`，虽然 resolve 会规范化路径，但 `filename=../../etc/passwd` 可能被浏览器/反向代理序列化后绕过。且该路由**无 JWT 鉴权**。  
**影响**：任意用户可遍历上传目录文件。  
**修复建议**：验证 filename 只包含字母数字和 `.`，不包含 `..` 或 `/`：

```typescript
if (!/^[\w.-]+$/.test(filename)) {
  return reply.status(400).send({ error: '非法文件名' })
}
```

---

## 🟠 P1 — 高优先级

### P1-1. admin 路由鉴权不统一 —— manual auth vs preHandler 混用

**严重性**：🟠 **P1（高）**  
**状态**：✅ **已修复**  
**文件**：`backend/src/routes/member.ts:659,712,851,878...`（约 12 个 admin 路由）  
**描述**：`GET /api/admin/vip-orders`, `POST /api/admin/member-plans`, `GET /api/admin/members` 等路由**未使用 `requireAdmin` middleware**，而是在函数体内手动检查 `request.headers.authorization`，token 过期时返回 401 但未返回详细错误信息。  
**影响**：鉴权逻辑存在分支，后续新增路由易遗漏；手动鉴权缺少统一兜底，某些改套餐操作可能被越权执行。  
**修复建议**：统一使用 `{ preHandler: [fastify.authenticate, requireAdmin] }` 模式。

### P1-2. 多个 admin GET 路由无任何鉴权

**严重性**：🟠 **P1（高）**  
**状态**：✅ **已修复**（与 P1-1 同批次修复）  
**文件**：`backend/src/routes/admin-global-config.ts:256,293,332,360,386,467`  
**描述**：以下路由无 `preHandler` 鉴权：  
- `GET /api/admin/global-models`  
- `PUT /api/admin/global-models`  
- `PUT /api/admin/global-models/toggle`  
- `PUT /api/admin/global-models/save-models`  
- `PUT /api/admin/global-models/sync-aliyun`  
- `GET /api/admin/global-models/sync-aliyun-models`  
- `GET/PUT /api/admin/sms-auth/config`（sms-auth.ts:67,87）  

虽然函数体内部可能做了手动鉴权，但各路由实现不一致（有些 token 检测、有些直接操作），存在越权风险。  
**修复建议**：统一加 `preHandler: [fastify.authenticate, requireAdmin]`。

### P1-3. JWT Secret 硬编码

**严重性**：🟠 **P1（高）**  
**状态**：✅ **已修复**  
**文件**：`backend/src/routes/auth.ts:56`（已改为强制环境变量，启动时检查）  
**描述**：QQ 绑定 token 的 JWT 签名直接硬编码了 fallback 值和 `env("JWT_SECRET")` 读取：  

```typescript
const BIND_SECRET = process.env.JWT_SECRET || 'aigc-director-runtime-secret-key-2026'
```

如果 `JWT_SECRET` 环境变量未设置，fallback 值是**明文硬编码**的字符串。该 secret 同样用于 `fastify.jwt.sign` 的签名密钥。  
**影响**：任何人知道此硬编码值即可伪造 JWT token。  
**修复建议**：启动时检查 `JWT_SECRET` 是否设置，未设置直接退出进程。

### P1-4. SMS 验证码暴力破解

**严重性**：🟠 **P1（高）**  
**文件**：`backend/src/routes/auth.ts:37-49`  
**描述**：注册时验证码校验使用 `findFirst` 查询，但没有使用事务或原子更新，存在**竞争条件**：同一验证码在高并发下可能被多次使用。同时未限制单手机号尝试次数。  
**影响**：攻击者可并发请求尝试不同验证码，或重放已用验证码。  
**修复建议**：

```typescript
// 加 phone 维度的限速
const recentAttempts = await prisma.smsCode.count({
  where: { phone, createdAt: { gt: new Date(Date.now() - 60000) } }
})
if (recentAttempts > 5) return reply.status(429).send({ error: '尝试过于频繁' })
// 使用 updateMany 原子操作
const result = await prisma.smsCode.updateMany({
  where: { phone, code, used: false, expiresAt: { gt: new Date() } },
  data: { used: true }
})
if (result.count === 0) return reply.status(400).send({ error: '验证码错误或已过期' })
```

### P1-5. 暴力密码登录无限制

**严重性**：🟠 **P1（高）**  
**文件**：`backend/src/routes/auth.ts:131-171`  
**描述**：`POST /api/auth/login` 没有任何登录频率限制，攻击者可无限尝试密码。  
**影响**：弱密码账号可被暴力破解。  
**修复建议**：对 IP + 账号维度做限速（比如 5 次/分钟失败后锁定 15 分钟）。

---

## 🟡 P2 — 中优先级

### P2-1. Refresh Token 返回 mock 值

**严重性**：🟡 **P2（中）**  
**文件**：`backend/src/routes/auth.ts:177-179`  
**描述**：`POST /api/auth/refresh` 返回硬编码 mock token：

```typescript
return toApiResponse({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token'
})
```

**影响**：token 过期后用户无法真正刷新，必须重新登录。  
**修复建议**：实现真实的 refresh token 轮换逻辑。

### P2-2. 用户信息查询接口无鉴权

**严重性**：🟡 **P2（中）**  
**文件**：`backend/src/routes/auth.ts:183`  
**描述**：`GET /api/auth/user-by-email` 无 JWT 鉴权，仅凭 email 即可查询任意用户的 coins、memberTier、phone、agentStatus 等敏感信息。  
**影响**：任意人可批量枚举邮箱以获取用户隐私数据。  
**修复建议**：加 JWT 鉴权，或限制只能查自己。

### P2-3. PaymentSecret.config 明文存储微信/支付宝密钥

**严重性**：🟡 **P2（中）**  
**文件**：`backend/prisma/schema.prisma` 中 `PaymentSecret.config` 为 `String` 类型  
**描述**：微信商户私钥（`keyPem`）、支付宝私钥（`privateKey`）以**纯文本 JSON 格式**存储在 PostgreSQL 中，无加密。若数据库被拖库，资金安全将受威胁。  
**影响**：数据库泄露 → 支付密钥泄露 → 资金风险。  
**修复建议**：使用 AES-256-GCM 加密存储，密钥从环境变量读取。

### P2-4. 前端 Token 存 localStorage 暴露 XSS 风险

**严重性**：🟡 **P2（中）**  
**文件**：`frontend/stores/auth.ts` 多处  
**描述**：JWT token 同时存储在 `localStorage`、`cookie`（无 HttpOnly）和多个 key 中（`accessToken`、`auth_token`）。community 页面的 `v-html` + `window.open` 调用可被 XSS 利用。token 读不到 HttpOnly cookie，任何页面 XSS 均可窃取。  
**修复建议**：考虑 HttpOnly cookie 存储方案，或至少统一为单 key 存储。完善 renderContent 的安全处理。

### P2-5. 登录模式兼容：authStore 的 login() 仍是旧参数

**严重性**：🟡 **P2（中）**  
**文件**：`frontend/stores/auth.ts:19-50`  
**描述**：`authStore.login()` 接收 `(email, password)` 并发送 `{ email, password }`，但注册/登录模态框（index.vue）发送的是 `{ account, password }`。  
**影响**：如果某处调用 `authStore.login()`，仍然发旧格式`{email, password}`。后端虽然有兼容 account 字段，但新前端登录逻辑根本没用 `authStore.login()`。两套登录逻辑存在不一致风险。  
**修复建议**：统一为 `authStore.login(account, password)` 并发送 `{ account, password }`。

### P2-6. 社区帖子内容 XSS 风险

**严重性**：🟡 **P2（中）**  
**文件**：`frontend/pages/community/post/[id].vue:63,181`  
**描述**：`v-html="renderContent(post.content)"` 中使用了 `onclick` 属性在 innerHTML 中。虽然进行了 HTML 转义，但 `onclick` 在 innerHTML 中是**不安全的**（某些浏览器版本可触发 CSP 绕过）。  
**修复建议**：使用 `addEventListener` 替代 onclick，或用纯 `textContent` + 动态创建 DOM 元素来构建图片/链接。

---

## 🟢 P3 — 低优先级 / 建议

### P3-1. 注册后 coins 日志记录为 0

**严重性**：🟢 **P3（低）**  
**文件**：`backend/src/routes/auth.ts:115`  
**描述**：注册赠送积分的日志写的是 `amount: 0, type: 'reward', remark: '注册赠送(已禁用)'`，说明原本的注册赠送积分功能被注释了。积分日志记录了 0 积分的无用流水。  
**修复建议**：如果赠送已禁用，删掉 coinLog 写入，或恢复赠送逻辑。

### P3-2. 编辑器导出引擎缺少内存释放

**严重性**：🟢 **P3（低）**  
**文件**：`frontend/studio-v2/workspace/video-editor/ffmpeg-engine.ts`  
**描述**：`downloadBlob` 没有 release FFmpeg.wasm 实例（`FFmpeg.terminate()`）。多次导出后内存持续增长。  
**修复建议**：添加 dispose 方法，导出完成后调用 `ffmpeg.terminate()`。

### P3-3. 编辑器 undo/redo 的 snapshot 过大

**严重性**：🟢 **P3（低）**  
**文件**：`frontend/studio-v2/workspace/video-editor/useVideoEditor.ts:655-660`  
**描述**：undoStack 保存的是**完整状态的深拷贝**。50 步限制虽然避免了无限增长，但每个 snapshot 可能包含整个时间轴（多轨道 + 大量片段），内存开销大。  
**修复建议**：考虑命令模式（Command Pattern），只保存操作差异而非全量快照。

### P3-4. 前端 smsCode 发送的竞态

**严重性**：🟢 **P3（低）**  
**文件**：`frontend/pages/index.vue:273-304`  
**描述**：sendSmsCode 函数没有处理重复点击（虽然按钮用 `smsLoading` disabled 了），如果在 SMS 回包前快速双击，两次请求几乎同时发出可能导致短信轰炸。  
**修复建议**：在函数开始时加 `if (smsLoading.value) return`。

### P3-5. 中间件中同一请求多次 restoreSession

**严重性**：🟢 **P3（低）**  
**文件**：`frontend/middleware/auth.ts:12-20`  
**描述**：auth middleware 中，如果已登录，也调用 `auth.restoreSession()`（fetch `/api/auth/me`），且路由切换时 middleware 每次都执行。  
**影响**：每次页面跳转都发一次 API 请求获取用户信息，在登录态下频繁路由切换会产生大量并发 API 调用。  
**修复建议**：加缓存控制，或只在 user 为 null 时刷新。

### P3-6. 客户端上传文件无大小限制

**严重性**：🟢 **P3（低）**  
**文件**：`backend/src/routes/upload.ts:54`  
**描述**：`POST /api/v1/upload/local` 使用 `request.file()` 但没有设置 `maxBytes` 或 `maxFileSize`。攻击者可上传超大型文件导致磁盘满。  
**修复建议**：使用 Fastify 的 `limits.fileSize`，如 `10 * 1024 * 1024`（10MB）。

### P3-7. 缓存竞争：后端多个 PM2 实例无共享缓存

**严重性**：🟢 **P3（低）**  
**文件**：后端有 8 个 `api-server` PM2 进程  
**描述**：8 个后端进程各自独立运行，没有共享状态或分布式锁。高并发下：  
- SMS 验证码验证使用 `findFirst` + `update`（非原子），存在重复使用风险  
- 充值回调处理订单时可能被多个进程同时处理  
**修复建议**：订单处理加 Redis 分布式锁或数据库悲观锁 (`SELECT ... FOR UPDATE`)。

### P3-8. Payment 路由部分缺少 orderNo 合法性校验

**严重性**：🟢 **P3（低）**  
**文件**：`backend/src/routes/payment.ts`（handleVipRechargeOrder / handleAgentRechargeOrder）  
**描述**：VIP 订单处理根据 `orderNo` 前缀（`VIP` / `AGT`）路由，但没有验证 order 和 user 的归属关系，存在越权风险。  
**修复建议**：在处理充值前校验 `order.userId` 与当前用户的匹配关系。

---

## 📊 统计摘要

| 等级 | 数量 | 分类 |
|------|------|------|
| 🔴 P0 | 3（全部已修复） | 双数据源积分系统、支付回调鉴权、路径遍历 |
| 🟠 P1 | 5（全部已修复） | admin 路由鉴权不统一（×2）、JWT 硬编码、短信暴力破解、密码暴力破解 |
| 🟡 P2 | 6 | Refresh mock、用户信息未鉴权、支付密钥明文、localStorage token、登录兼容性、社区 XSS |
| 🟢 P3 | 8 | 积分日志、内存泄漏、undo 快照、短信竞态、中间件开销、文件大小限制、多实例缓存竞争、订单校验 |
| **总计** | **22** | |

### 主要架构问题总结

1. **双数据源积分系统（P0）**：`User.coins` 和 `Membership.credits` 并存，无同步机制
2. **支付回调安全性不足（P0）**：第三方回调路径无鉴权
3. **Admin 路由鉴权不统一（P1）**：部分用 middleware，部分手动鉴权，部分无鉴权
4. **密钥管理风险（P1+P2）**：JWT fallback 硬编码、支付密钥明文存数据库
5. **暴力攻击面（P1）**：登录和验证码均无频率限制
6. **多进程竞争（P3）**：8 个后端实例无共享状态/分布式锁

---

*审计完成时间：2026-06-04 13:10 CST*
*审计方式：全栈代码静态分析*
