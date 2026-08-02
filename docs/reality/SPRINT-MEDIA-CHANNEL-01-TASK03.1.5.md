# TASK03.1.5 Reality Report — Browser Runtime Upgrade（持久化浏览器 Profile）

**Date:** 2026-08-02 18:15 CST
**Gate:** 掌柜决策（LocoAgent 分析结论）— 不停 03.2，先做 03.1.5 前置增强
**提交:** （见 git log）

---

## 背景

新媒体 Runtime 现状（已解决「AI 员工能不能连接真实账号」）：

```
EnterpriseChannelAccount → EnterpriseChannelService → DouyinBrowserAdapter → BrowserRuntimeService → 真实浏览器
```

LocoAgent 分析揭示下一层问题（「连接账号后如何长期、安全托管」）：

```
临时 Browser Context + cookie 注入  → 不稳定（对社交平台长期运营）
```

**升级目标：**

```
EnterpriseChannelAccount → Dedicated Browser Profile → Persistent Chromium Session → Channel Runtime
```

---

## 交付内容

### 1. Prisma 模型 `ChannelBrowserSession`（账号身份与运行环境分离）

```prisma
model ChannelBrowserSession {
  id                String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  channelAccountId  String   @map("channel_account_id") @db.Text
  browserType       String   @default("chromium") @map("browser_type") @db.Text
  profilePath       String   @map("profile_path") @db.Text
  status            String   @default("IDLE") @db.Text // IDLE / RUNNING / ERROR
  lastStartedAt     DateTime? @map("last_started_at")
  lastHealthCheckAt DateTime? @map("last_health_check_at")
  lastError         String?  @map("last_error") @db.Text
  metadata          Json     @default("{}")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  channelAccount     EnterpriseChannelAccount @relation(fields: [channelAccountId], references: [id], onDelete: Cascade)

  @@unique([channelAccountId, browserType])
  @@index([channelAccountId])
  @@index([status])
  @@map("channel_browser_session")
}
```

- **不污染 EnterpriseChannelAccount**（凭证唯一源仍是 `credentialEncrypted`）
- 迁移：`prisma/migrations/r1_6_channel_browser_session/migration.sql`（手工 SQL，已应用）
- ⚠️ 教训：`prisma migrate diff --from-url` 对长期 drift 的库会生成大量无关 DDL（删索引/改列），**严禁直接执行**；历史迁移均为手工 SQL 风格，保持一致

### 2. BrowserRuntimeService 双模式（主路径 + fallback）

| 方法 | 模式 | 说明 |
|------|------|------|
| `getProfilePath(platform, accountId)` | — | `/data/browser-profiles/<platform>/<accountId>`，账号隔离 + 平台隔离 + 路径清洗 |
| `getOrCreatePersistent(sessionId, profilePath, config)` | **主路径** | `chromium.launchPersistentContext(userDataDir)`，同 profile 复用实例；profile 变化/headless 变化才重启 |
| `launchPersistent(sessionId, profilePath, config)` | 主路径 | 真实 Chrome user-data-dir，登录一次长期有效 |
| `launch / getOrCreate` | fallback | 保留原临时 context + cookie 注入路径 |
| `restoreCookies / saveSession / restoreSession` | fallback | 全部保留，兼容旧登录态/跨机迁移 |
| `close` | 双模式 | persistent 只关 context **不删 profile**（登录态保留）；临时模式关 browser |
| `isPersistent / listInstances` | — | 运行环境观测 |

### 3. ChannelBrowserSessionService（运行环境记录层）

- `getOrCreate`（upsert by channelAccountId + browserType，唯一约束防重复行）
- `markStarted / markHealthCheck / markError / markIdle`
- `findByAccount`（查询账号的浏览器环境）

### 4. DouyinBrowserAdapter 接入

- `connect()`：主路径 = 持久化 profile 启动 → 打开创作者中心；fallback = 有凭证则 restoreCookies 注入
- `fetchMetrics / fetchComments`：同样改为主路径 + fallback（不再强制要求 cookieData 存在）
- `waitForLogin` 接口声明补齐（EnterpriseChannelAdapter 可选方法 + service 侧空值守卫）

### 5. ChannelService 编排

- `connectChannel`：连接前 `getOrCreate` + `markStarted` 记录运行环境；connected 后 `markHealthCheck`
- `waitChannelLogin`：登录成功补健康检查

---

## Reality Test（21 断言全 PASS）

脚本：`scripts/reality-check-browser-profile-0315.ts`

| 组 | 断言 | 结果 |
|----|------|------|
| R1 | profile 路径含 platform+accountId / 账号隔离 / 平台隔离 / 路径清洗 | 4/4 ✅ |
| R2 | 持久化实例创建 / user-data-dir 落盘 / 真实 Chrome 数据 / close 后实例清理 / **close 后 profile 保留** | 5/5 ✅ |
| R3 | **重启后持久化 cookie 仍在（登录态不丢）** / 同 session 复用同一实例 | 2/2 ✅ |
| R4 | ChannelBrowserSession CRUD：创建 / profilePath / IDLE→RUNNING→health→ERROR→IDLE 状态机 / upsert 不重复 | 8/8 ✅ |
| R5 | restoreCookies fallback 仍可用 / cookie 注入成功 | 2/2 ✅ |

### 关键验证发现

1. **持久化登录态真实有效**：用持久化 profile 访问 douyin.com，关闭后重启，抖音真实 cookie（`__ac_nonce`/`_waftokenid`/`__ac_signature`）全部恢复
2. **session cookie 不落盘**（Chromium 行为）：手动 addCookies 不带 `expires` 的 cookie 关闭后丢失；带 expires 的 cookie 正常持久化——真实登录态 cookie 均带过期时间，不受影响
3. **同 profile 并发互斥**：Chromium 自身 user-data-dir 锁保证同账号串行（天然满足「同平台串行」）

### 生产链路验证（aigc.fushtn.com 后端实测）

```
POST /api/enterprise/channels/runtime/:id/connect
→ status: waiting_login（浏览器已用持久化 profile 启动，等待扫码）
```

- `/data/browser-profiles/douyin/08a0f643-.../` 已生成真实 Chrome profile（Default/Local State 等）
- DB `channel_browser_session`：`status=RUNNING`，`last_started_at` 已记录 ✅

---

## 边界确认（掌柜指令逐条）

| 指令 | 状态 |
|------|------|
| 1. BrowserRuntimeService 增加基于 channelAccountId 的持久化 profile | ✅ |
| 2. launchPersistentContext(userDataDir) 替代临时 context + cookie 注入作为**主要路径** | ✅ |
| 3. 新增 ChannelBrowserSession 模型记录运行环境，不污染 EnterpriseChannelAccount | ✅ |
| 4. 保留现有 cookie restore 作为 fallback | ✅ |
| 5. **不开发** OperationLog / Skill / Trajectory | ✅（未动） |
| 6. 输出 Task03.1.5 Reality Report | ✅ 本报告 |

---

## 冻结清单（持续）

- ❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标
- ⏸ 下一步：**Task03.2 Reality Gate**（真实扫码登录测试）— 现在登录成功后登录态将持久化在 `/data/browser-profiles/`，无需每次重新扫码
- ⏸ Task05 再做 OperationLog / ChannelOperationLog 模型

## 风险与后续

- **profile 目录膨胀**：每个账号一个 Chrome profile（约 100-200MB），需监控磁盘；账号删除时 `onDelete: Cascade` 自动清 DB 记录，profile 目录需另加清理任务（Task04 Accounts UI 时处理）
- **headless 切换会重启实例**：persistent 实例在 headless 模式切换时按 profile 重建（登录态保留），页面会丢——设计如此，长驻会话应固定 headless 模式
