# SPRINT-MEDIA-WORKSPACE-AUTH-REALITY-AUDIT

新媒体运营工作台全链路 Reality Audit — 只审计，零改动

- **日期:** 2026-08-03
- **范围:** /media-department 新媒体运营工作台（抖音/快手/视频号/小红书 账号接入体系）
- **原则:** 只发现问题，不修复、不提交代码、不修改数据库、不增加补丁
- **审计方式:** 源码逐层追踪（前端→路由→Service→Adapter→Probe→DB）+ 真机实测（connect/status 计时）

---

## 0. 执行摘要

新媒体账号接入体系**方向正确**（真实浏览器 + 持久 profile + 多信号探针 + 人工确认绑定），但**距离产品级稳定还有四类硬伤**：

1. **性能硬伤**：connect 同步等待 18.5s（小红书）/ 30.5s（快手），用户点击「去连接」到看到二维码的体感是「死等」。瓶颈 = 串行浏览器操作链（Chrome 启动 + 3 次整页导航 + 固定 waitMs 4s + 点击序列 5s + QR ready 轮询 ≤8s + 探针 2×2s），无一异步化。
2. **误判残留**：快手 profile 存在「半失效会话」——残留 kwssectoken+did（缺 bUserId）→ cookie≥2 → 首探针 `authenticated=true` 误判，但 identity=false 不满足硬条件 → connect 白白多走一轮，且清理保护（keyHit≥2）阻止清掉脏 cookie → 脏会话可能干扰新扫码（与掌柜实测「扫码成功永不 connected」同源）。
3. **凭证双轨**：新媒体链路 AES-256-GCM 加密落库 ✓；**WeCom 旧链路 createWithOwnership 明文落库**（`{_v:1,_encrypted:false}`），且 token.service 对 credentialEncrypted **完全不解密直读明文**——字段名叫 encrypted，内容不加密。两条写入/解析路径并存，互不兼容。
4. **历史残留**：4 个假数据 stub adapter（微博/视频号旧版/B站/QQ）**仍注册在生产 channelService**；_deprecated-channels-mock-auth.ts（引用已删除表，tsc 报错）+ 旧前端页面 channels.vue（调已删除 API，必 500）仍是死代码；全后端 tsc 1957 个错误（渠道相关集中在废弃文件）。

SSOT 结论：**存在**（EnterpriseChannelAccount 为唯一身份/凭证/状态真相源，BrowserWorkspace 为运行环境真相源，AgentChannelBinding 为授权真相源），但被上述历史残留稀释可信度。

---

## 1. 当前真实架构图（读代码所得，非设计文档）

```
┌─ Frontend (Nuxt) ─────────────────────────────────────────────┐
│ pages/workspace/media/accounts.vue   ← 渠道中心唯一 Connect 入口 │
│   ensure-account → connect(同步等 18-30s) → status 轮询 3s      │
│   loginStage: waiting_scan/scan_confirming/verifying/          │
│               awaiting_confirmation/connected                  │
└──────────────────────────┬─────────────────────────────────────┘
                           │ REST
┌─ Backend Routes ─────────▼─────────────────────────────────────┐
│ enterprise-channel-runtime.ts (POST /connect, GET /status,     │
│   POST /wait-for-login, /confirm-binding, /refresh-credential, │
│   /logout, /ensure-account, /account-status)                   │
│   → statusLocks Map 串行化轮询                                  │
└───────────────┬──────────────────────────┬─────────────────────┘
                │ channel.service.ts        │ (WeCom 旧链路)
                │ connectChannel →          │ enterprise-channel.ts
                │ waitChannelLogin →        │ POST /:tenantId/channels/accounts
                │ confirmChannelBinding →   │   → createWithOwnership（明文！）
                │ refreshChannelCredential  │ POST .../connect
                │ updateChannelIdentity     │   → wecomAdapterService.initialize
                ▼                           ▼
┌─ Adapters ─────────────────────────┐  ┌─ token.service.ts ────┐
│ DouyinBrowserAdapter（独立实现）    │  │ WeComClient           │
│ BrowserChannelAdapterBase（通用）  │  │ tokenCache            │
│   ├ kuaishou / xiaohongshu /      │  │ 直读 credentialEncrypted
│   │ channels_wechat 实例          │  │ （不解密，期望明文）    │
│   └ fetchMetrics（meta 配置驱动）  │  └────────────────────────┘
└───────────────┬────────────────────┘
                │ browserRuntime（Playwright 持久 profile /data/browser-profiles/<platform>/<accountId>）
                ▼
┌─ Probes ──────────────────────────┐
│ BrowserChannelProbe（配置驱动）     │
│   page/cookie/identity 三信号      │
│   judgeIdentityV2 纯函数           │
│   network 常驻监听（快手 __NS_sig3）│
│ DouyinIdentityProbe               │
│ LoginStateMachine（统一状态机）     │
└───────────────┬────────────────────┘
                ▼
┌─ DB (Prisma) ─────────────────────┐
│ EnterpriseChannelAccount（SSOT）   │
│   credentialEncrypted AES-GCM     │
│   connectionStatus 12 态          │
│ BrowserWorkspace（channelAccountId 唯一）
│ ChannelBrowserSession / ChannelVerificationSession
│ ChannelAccountShare / ChannelHealthState / ChannelMetricSnapshot
│ AgentChannelBinding（AI 员工授权）  │
└────────────────────────────────────┘
```

---

## 2. 账号登录真实调用链（四个平台逐段追踪）

### 2.1 通用链路（所有平台）

```
accounts.vue 点「去连接」
  → POST /channels/runtime/:platform/ensure-account
      → findFirst(org+owner) → 无则 ghost 认领 → 无则 connectAccount(WAITING_LOGIN 空壳)
  → POST /channels/runtime/:id/connect（同步等待 18-30s）
      → channelService.connectChannel
          → resolveAdapter(channelType)  ← 按平台找 adapter
          → channelBrowserSessionService.getOrCreate（profilePath）
          → browserAuthSessionService.begin + OPEN_BROWSER
          → adapter.connect(accountId)
              → browserRuntime.getOrCreatePersistent(sid, profilePath, {headless:false})
                  ← Chrome 启动（headed，需 Xvfb :99）
              → identityProbeRegistry.get(platform).probe(sid)   ← 探针#1（~2s）
              → [未满足硬条件] clearLoginCache(sid)
                  → withPage 导航平台根域 + localStorage.clear + clearCookies
              → browserRuntime.navigate(sid, meta.loginUrl)      ← 整页导航
              → ensureLoginSurface(sid)
                  → waitMs(4000) 固定等待
                  → clickSteps 依次点击（每个 1500+1000ms，快手=「立即登录」「扫码登录」）
                  → waitForQrReady(page, 8000) 轮询 detect（800ms 间隔）
              → probe 探针#2（~2s）
              → return waiting_login / connected / awaiting_confirmation
  → startPolling() 每 3s GET /status（串行锁）
      → adapter.getLoginStatus(sid)
          → browserRuntime.getStatus（截图到磁盘→读文件→base64，~50ms）
          → withPage+loginDetector.detect（A img→B canvas→C iframe→D 截图 jsQR，有 QR 缓存 15s）
          → identityProbeRegistry.probe（探针缓存 5s；未命中 ~2s）
          → LoginStateMachine.derive → state + loginStage
  → 用户扫码 → 平台回调（浏览器内完成，无后端 callback URL）
  → 探针检测到登录 → 前端 awaiting_confirmation 确认卡片
  → 用户点「确认绑定」→ POST /confirm-binding
      → 探针复核（失败退避重试 2s/4s/6s）
      → updateChannelIdentity（身份锚定 IDENTITY_VERIFIED）
      → adapter.refreshCredential（cookie → AES 落库）
      → CONNECTED + 建 BrowserWorkspace + AUTH_SUCCESS 状态机
  → 前端 fetchReality 复核 → 绿色「已连接」
```

### 2.2 平台差异点

| 环节 | 抖音 | 快手 | 小红书 | 视频号 |
|---|---|---|---|---|
| adapter | DouyinBrowserAdapter（独立） | GenericBrowserChannelAdapter | 同左 | 同左 |
| probe | DouyinIdentityProbe | BrowserChannelProbe | 同左 | 同左 |
| loginUrl | creator.douyin.com | cp.kuaishou.com | www.xiaohongshu.com/explore | channels.weixin.qq.com/login.html |
| postScanBehavior | redirect | stay_page | stay_page | manual_confirm |
| 身份策略 | page+cookie | page+cookie+**networkCapture**（__NS_sig3） | page+cookie | page+cookie |
| loginEntry | 无 | mustMatch cp/passport + clickSteps[立即登录,扫码登录] | mustMatch xiaohongshu.com + clickSteps[登录] | 无 |
| 扫码后导航 | 无需（自动跳工作台） | auto-navigate workspaceUrl（节流 20s）+ reload 一次 | 同快手 | 无 |
| 二维码通道 | 截图 jsQR 等 | 同上 | **qrImgSelector=img.qrcode-img（A0 精确命中）** | 同上 |
| 实测 connect | 未测 | **30.5s** | **18.5s** | 未测（同基类，预计 20s+） |

### 2.3 扫码后「平台回调」真相（重要）

**不存在后端 callback URL / state / token exchange。** 三个平台全部是「浏览器内完成 OAuth，探针轮询页面状态感知登录」，链路为：

```
扫码 → 平台在浏览器内建 session（cookie）→ 探针 cookie≥2 + 页面特征/身份 → authenticated
```

这正是掌柜战略（不学 cookie 注入机器人、坚持 BrowserWorkspace）的正确落地，但代价是**登录成功判定完全依赖探针的页面/网络信号**，任何信号缺失（无明文 ID、无自然请求、SPA 拉回 /profile）都会造成「扫码成功但永不 connected」（快手 2026-08-03 实锤，已修复为常驻网络监听，待掌柜重扫验证）。

---

## 3. SSOT 审计

### 结论：存在（单一真相源成立），但有历史稀释

| 真相源问题 | 回答 |
|---|---|
| 谁是账号身份？ | **EnterpriseChannelAccount**（accountName/avatarUrl/externalAccountId SSOT 列，updateChannelIdentity 统一写入） |
| 谁存平台授权凭证？ | **EnterpriseChannelAccount.credentialEncrypted**（新媒体链路 AES-256-GCM；WeCom 旧链路明文） |
| 谁存 token？ | WeCom：tokenCache（内存 TTL）+ credentialEncrypted 内 corpSecret；新媒体：无 token，全 cookie |
| 谁存登录状态？ | EnterpriseChannelAccount.connectionStatus（12 态）+ LoginStateMachine（会话内）+ BrowserWorkspace.loginRealityState（电脑态） |
| 谁负责刷新状态？ | channelService.refreshChannelCredential / adapter.refreshCredential + FastIdentityValidator（12h TTL 快照） |
| 运行环境真相源 | BrowserWorkspace（channelAccountId 唯一）+ ChannelBrowserSession |
| AI 员工授权真相源 | AgentChannelBinding |

### 冲突来源（稀释因素）

1. **ChannelAccount 表已删但 _deprecated-channels-mock-auth.ts 仍引用**（死代码 + tsc 报错）
2. **channel-account.service.ts（旧）与 channel.service.ts（新）并存**：前者 `_encrypted:false` 明文写入，后者 AES 加密写入——同一列两种格式
3. **token.service 不解密直读**：若新媒体账号被误当 WeCom 用，`creds.corpId` 为 undefined → token fetch 失败；若 WeCom 走加密写入，同样失败——两条路径互不兼容
4. 身份快照三处冗余：metadata（lastVerifiedAt/permissionLevel/boundAt）+ SSOT 列（accountName/avatarUrl）+ ChannelVerificationSession.verifiedIdentity

---

## 4. 平台 Adapter 架构审计

### 结论：**配置化基本成立（评分 7.5/10）**

- ✅ BrowserChannelAdapterBase + BrowserChannelProbe + CHANNEL_META 三件套：平台差异 100% 配置（loginUrl/workspaceUrl/cookies/urlFragments/markers/extractionRules/networkApis/loginEntry/qrImgSelector/metricsExtraction/identityStrategy/navigation/postScanBehavior）
- ✅ probe 内无 if(platform)，judgeIdentityV2 纯函数
- ✅ 新增平台 = meta 加配置 + BROWSER_CHANNEL_PLATFORMS 加名 + 前端点亮，adapter 零改动（设计上成立）
- ⚠️ **抖音是例外**：DouyinBrowserAdapter（764 行）+ DouyinIdentityProbe（171 行）是独立实现，与通用基类逻辑重复（connect/waitForLogin/getLoginStatus/fetchMetrics 各写一遍）——「一个平台一个模板」的掌柜蓝图被抖音自己违反
- ⚠️ **假数据 adapter 仍在生产注册表**：index.ts 注册 VideoAccountAdapter/WeiboAdapter/BilibiliAdapter/QQAdapter（stub 假指标假发布）——虽然 platform 名与真实浏览器渠道不冲突（video_account/weibo/bilibili/qq），但 violates「禁止 mock in production」（WeCom 已移除 mock，这 4 个没移除）
- ⚠️ fetchMetrics 通用实现把「未解析到指标」throw 为错误（adapter 抛错→路由 400）——语义上「unavailable」应是可区分的业务状态（ChannelMetricSnapshot 已支持 status=unavailable，但 adapter 层没有复用）

---

## 5. 二维码生成性能审计（实测数据）

### 5.1 实测总览（2026-08-03，tenant_org_test@audit.local，生产 api-server）

| 环节 | 实测耗时 | 备注 |
|---|---|---|
| 登录 | 147ms | |
| registry | 6ms | |
| ensure-account | 23ms | 无浏览器操作 |
| **connect（小红书）** | **18,497ms** | 用户等待二维码的主因 |
| **connect（快手）** | **30,473ms** | 含点击序列+QR ready 等待 |
| status#1（无缓存） | 1,831–2,332ms | 探针固定 wait 为主 |
| status#2/#3（有缓存） | 63–70ms | QR 缓存 15s + probe 缓存 5s |

### 5.2 connect 耗时分解（快手 30.5s，按代码路径推断 + 日志佐证）

| 阶段 | 估算耗时 | 日志证据 |
|---|---|---|
| Chrome 启动（headed 持久实例） | 4–8s | navigate pages count: 2 |
| 探针#1（waitForTimeout 1500+rand800 + cookie + 日志 URL 读取） | ~2s | probe url=cp.kuaishou.com/profile |
| clearLoginCache 现场检查 | ~1s | 登录态保护判定 |
| navigate(loginUrl) 整页加载 | 3–6s | navigate .../profile success |
| ensureLoginSurface waitMs | 4,000ms 固定 | waitMs=4000 |
| clickSteps[立即登录,扫码登录] | ~5s | 每个 1500+1000ms |
| waitForQrReady 轮询 | ≤8s（实际 QR 8s 内出现则提前） | QR_READY |
| 探针#2 | ~2s | probe url=passport... |
| **合计** | **~30s** | 实测 30,473ms 吻合 |

### 5.3 最大瓶颈排序

1. **connect 全同步串行**：前端在 connect 返回前不展示任何二维码/进度（用户看到「正在启动登录浏览器...」死等 18–30s）——体感最差，也是掌柜「二维码出现慢」的直接答案
2. **固定等待堆积**：waitMs=4000 + clickSteps 每步 2500ms + QR ready 轮询 800ms×N，全是 sleep，没有事件驱动
3. **探针固定 sleep**：`waitForTimeout(1500 + Math.random()*800)` 每次探针白等 1.5–2.3s（status 轮询 2.3s 的主因；probe 缓存兜底后才降到 70ms）
4. **整页导航多次**：clearLoginCache 根域导航 + navigate loginUrl + 302 重定向 = 3 次整页加载
5. 截图写盘+读盘 base64（~50ms，次要）

### 5.4 前端轮询节奏

- 前端 3s 轮询 /status；后端串行锁 + 探针缓存 5s → 实际约 2/3 轮询命中探针缓存，1/3 真跑 2.3s——**扫码成功后最迟 ~5s 状态可见**（可接受，但 connect 首屏是灾难）

---

## 6. 扫码登录失败节点分析

### 6.1 快手（2026-08-03 掌柜真机实锤 + 本次实测佐证）

| 检查点 | 结论 |
|---|---|
| 二维码生成 | ✅（本次实测 qrSource=img jsQR 通过；passport 扫码 tab 需 clickSteps 触发，已修） |
| 扫码后回调 | 无后端回调（浏览器内 OAuth）——感知靠探针 |
| cookie 建立 | ⚠️ **半失效会话误判**：残留 kwssectoken+did（缺 bUserId）→ cookie≥2 → 探针#1 authenticated=true，但会话实际无效 |
| 身份提取 | ❌ **历史主断点**：body 无快手号明文 + 无 hydration + 页面稳定无自然请求 → userId 空 → waitForLogin 硬条件永不满足 → 「已登录但永不 connected」（VC-REALITY-HOTFIX-01 已修：per-session 常驻网络监听 + 导航后 reload 触发身份 API，**待掌柜重扫验证**） |
| token 保存 | cookie 走 refreshCredential AES 落库 ✅ |
| 账号绑定 | externalAccountId 空则不写库（LOGIN-REALITY-FIX-01）✅ 诚实 |

**遗留风险**：半失效 cookie 不被清理（clearLoginCache keyHit≥2 保护）→ 新扫码带着脏会话，passport 可能与残留会话打架 → 扫码确认结果异常。

### 6.2 视频号（历史修复记录 + 代码路径）

| 检查点 | 结论 |
|---|---|
| 二维码生成 | ✅ login.html 扫码 |
| 扫码后回调 | **manual_confirm**：需手机微信确认，确认后 1–5s 页面才跳工作台 → 探针竞态（confirmBinding 已加 2s/4s/6s 退避重试） |
| cookie 建立 | 已修：真实 cookie = sessionid+wxuin（旧配置 wxsid/rand_info 张冠李戴 → 永不认证） |
| 身份提取 | 已修：视频号ID 正则 sphpfkmVO5uy6NF 格式 + textContent fallback |
| 重启恢复 | WECHAT-CHANNELS-FIX-01：重启后导航 workspaceUrl（非 loginUrl）保护现场 |

### 6.3 小红书

| 检查点 | 结论 |
|---|---|
| 二维码生成 | ✅ 主站弹窗 img.qrcode-img（A0 精确选择器），creator/login 只有短信面（历史坑已绕开） |
| cookie 建立 | web_session + customerClientId ✅ |
| 身份提取 | hydration 多 key 候选 + URL 正则（creator/user/profile/:id） |
| 扫码后导航 | auto-navigate creator.xiaohongshu.com/new/home（session 成立后） |

**共性结论**：失败节点集中在「探针信号完整性」而非「二维码生成/扫码」。平台不提供回调，一切依赖页面信号——这是架构性风险（平台改版即失效），不是一次性 bug。

---

## 7. Credential 安全架构审计

| 维度 | 新媒体（浏览器渠道） | WeCom 旧链路 |
|---|---|---|
| 加密存储 | ✅ AES-256-GCM（crypto.service.ts encryptKey，格式 iv:tag:ciphertext，密钥 CRYPTO_ENCRYPTION_KEY 已配置） | ❌ **明文**：createWithOwnership 写 `{_v:1,_encrypted:false,...}`；token.service loadCredential 直接 `creds.corpSecret` 读 |
| 生命周期 | refreshCredential 登录成功即续期回写 ✅；logout 销毁 credentialEncrypted ✅ | TokenService TTL 缓存 + 提前 5min 刷新 ✅ |
| 自动刷新 | cookie 无自动刷新（过期靠探针 EXPIRED 降级 + 重新扫码）⚠️ | gettoken 过期 errcode 42001/40014 自动刷新 ✅ |
| 过期检测 | FastIdentityValidator（关键 cookie≥2 + 快照 12h TTL）⚠️ 只验存在性，不验有效性 | tokenCache TTL ✅ |
| 多账号隔离 | 每账号独立 profile + 独立凭证行（同 key 不同 iv）✅ | per-tenant cache key ✅ |
| 密钥管理 | CRYPTO_ENCRYPTION_KEY 在 .env（hex）⚠️ 单密钥全局，无 KMS/轮换；crypto.service 若未配置会**打印密钥到日志**（当前已配置，未触发） | 同左 |

**Critical 发现**：
1. **credentialEncrypted 字段名撒谎**：WeCom 路径下内容是明文（corpSecret/encodingAESKey 可直接 SELECT 出）
2. 两条凭证路径互不兼容：同一列两种格式，解析逻辑（decryptKey vs 直读）取决于调用方
3. credential 解密结果在服务端内存明文传递（getCredential 返回对象）——可接受（进程内），但无 munmap 零化（crypto.service 注释声称有，实际 encryptKey 无 munmap 代码）

---

## 8. 前后端契约审计

### 8.1 状态机

- 后端标准枚举：`INIT→OPEN_BROWSER→WAIT_LOGIN→USER_ACTION_REQUIRED→SCAN_CONFIRMED→VERIFYING→SESSION_AUTHENTICATED→IDENTITY_RESOLVED→WORKSPACE_READY→LOGIN_PARTIAL→AUTHENTICATED→CONNECTED→READY`（LoginStateMachine）
- 前端消费：`loginStage`（旧 5 值：waiting_scan/scan_confirming/verifying/awaiting_confirmation/connected）+ `state`（新枚举，前端优先但实际轮询逻辑仍按 loginStage 分支）
- **契约风险**：前端 `loginStage` 无法表达 SESSION_AUTHENTICATED/IDENTITY_RESOLVED/WORKSPACE_READY/LOGIN_PARTIAL 的差异（全映射为 awaiting_confirmation）——「身份已确认但凭证未落库」与「仅 session 有身份缺失」在前端显示同一张确认卡片；state 字段已返回但前端主分支未消费
- 后端 connectionStatus（DB 12 态）与 LoginStateMachine（会话 13 态）两套并存，靠 `sm.toLegacy()` + status 路由的同步（browserAuthSessionService）缝合

### 8.2 字段一致性

- accounts.vue 读：status.loginStage / loggedIn / accountName / externalAccountId / avatar / verificationRequired / verificationType / verificationTriggered / screenshotBase64 / qrCodeBase64 / qrSource / debug —— 与 getLoginStatus 返回完全对齐 ✅
- account-status 返回：connected/connectionStatus/accountName/avatar/permissionLevel/boundAt/deviceTrusted/lastVerifiedAt —— team.vue 按 connectionStatus 映射 ✅
- **断链**：pages/media-department/settings/channels.vue 调 `/api/enterprise/channel-accounts`（旧路由，表已删→500）且 POST `.../connect`（旧模拟授权）——死页面仍可直达

### 8.3 平台特殊状态污染

- 无（状态机统一）；但前端 qrFallback 修复逻辑（jsQR 客户端裁剪）与后端截图通道 D 重复实现，两处二维码修复并存

---

## 9. 异常处理审计

| 维度 | 现状 |
|---|---|
| trace id | fastify 默认 reqId（日志有 req-xx）✅；但**前端拿不到**（响应头/body 无 reqId）→ 用户报障无法关联日志 ❌ |
| 全局错误处理 | 无 setErrorHandler → 默认 500（fastify 会回显 message，部分含内部路径细节）；各路由 catch 后 `{code:1, message:e.message}` 直接透传 |
| 超时 | 无全局请求超时；wait-for-login 180s / waitForLogin 300s 内部超时 ✅；前端轮询失败静默 ❌（用户看到的是无限 waiting_scan，无错误提示） |
| 可诊断性 | KSQR-TIMING + LOGIN-TIMELINE + probe 信号明细日志 ✅（本次审计全靠它还原链路）；Login Debug Panel（前端 debug 字段）✅ |
| 失败用户可见性 | connect 失败 → toast「启动失败: ...」✅；轮询期失败 → 静默 ❌；AUTHENTICATED 身份缺失 → 黄色提示 ✅ |
| 前端无限 loading | connect 期间 connecting=true 无超时上限（后端 connect 最坏 30s+，若挂死用户只能关弹窗）⚠️ |

---

## 10. 历史开发遗留问题扫描

| 类别 | 文件/位置 | 风险 |
|---|---|---|
| 假数据 adapter（生产注册） | index.ts:483-486 注册 VideoAccountAdapter/WeiboAdapter/BilibiliAdapter/QQAdapter | fetchMetrics/publish 返回假数据；platform=weibo 与 meta 冲突面 |
| 废弃路由文件 | _deprecated-channels-mock-auth.ts（引用已删 ChannelAccount/ChannelBinding 表，tsc 报错 10+） | 死代码 + 若被 import 即 500 |
| 重复 service | channel-account.service.ts（旧，明文） vs channel.service.ts（新，AES） | 同一列两种写入格式 |
| 重复 adapter 实现 | DouyinBrowserAdapter vs BrowserChannelAdapterBase | 抖音未并入通用模板 |
| 死前端页面 | pages/media-department/settings/channels.vue（调已删 API） | 直达即 500；旧 media-department/* 体系未清理 |
| 旧 connect 路由 | enterprise-channel.ts:304 POST /:tenantId/channels/accounts/:id/connect（wecomAdapterService.initialize） | 与 runtime connect 并存；JSON.parse(credentialEncrypted) 对新格式解析异常 |
| 双二维码修复 | 前端 jsQR 客户端裁剪 + 后端截图 D 通道 | 功能重复 |
| 双状态机 | LoginStateMachine（会话） + BrowserAuthSessionService（复用 ChannelVerificationSession）+ DB connectionStatus | 三处状态需同步（status 路由已缝合，但语义冗余） |
| tsc 全量 | 1957 错误（渠道相关集中在 deprecated 文件；另有大量旧模块 truth/video-blueprint 等） | 生产 tsx 直跑不受影响，但类型防线失效 |
| 平台 meta 僵尸 | wechat_mp/weibo/toutiao/baijiahao 配置齐全但无 adapter（connectable=false，registry 已正确熄灭）✅ | 仅配置死数据，无害 |
| 明文 Key 类 | crypto.service 未配置时打印密钥到日志（当前已配置未触发） | 潜在 |
| ChannelOperationLog @@unique([workspaceId,action,target]) | 防重复操作 | 副作用：同目标重复操作被唯一约束挡掉，需确认语义 |

---

## 11. 平台能力矩阵（实际代码实证）

| 平台 | 二维码 | 扫码感知 | token/凭证 | 绑定 | 状态同步 | 实测状态 |
|---|---|---|---|---|---|---|
| 抖音 | ✅（截图 jsQR） | ✅ 探针（redirect 自动跳工作台） | ✅ AES cookie | ✅ confirm-binding | ✅ | 快照验证 fresh 保持 CONNECTED（FastIdentityValidator） |
| 快手 | ✅（passport clickSteps 触发，jsQR） | ⚠️ 半失效会话误判 + identity 提取曾断（已修待验） | ✅ AES cookie | ✅ | ✅ LOGIN_PARTIAL 诚实 | connect 30.5s；首探针 authenticated=true 假阳性 |
| 视频号 | ✅ login.html | ⚠️ manual_confirm 手机确认竞态（退避重试已修） | ✅ AES cookie（sessionid+wxuin） | ✅ | ✅ | 未真机复测（数据中心 IP 微信扫码需掌柜） |
| 小红书 | ✅ A0 img.qrcode-img 精确命中 | ✅ 探针 + auto-navigate 工作台 | ✅ AES cookie（web_session） | ✅ | ✅ | connect 18.5s；status 首次 2.3s |

---

## 12. 问题分级汇总

### 🔴 Critical（阻断产品级稳定）

1. **C1 — connect 同步死等 18–30s**：前端在 connect 返回前无二维码/无进度；瓶颈 = 串行浏览器操作链 + 固定 sleep 堆积（waitMs 4s + clickSteps 5s + QR ready ≤8s + 探针 2×2s + 3 次整页导航）。掌柜要的「2–5s 出码」需要 connect 异步化（先返回 sessionId，后台推进，status 轮询驱动前端）。
2. **C2 — WeCom 凭证明文落库**：createWithOwnership 写 `_encrypted:false` 明文；token.service 不解密直读。字段名 credentialEncrypted 与事实不符，corpSecret/encodingAESKey 可 SELECT 直出。
3. **C3 — 快手半失效会话假阳性**：残留 kwssectoken+did（缺 bUserId）→ cookie≥2 → `authenticated=true` 误判 + 清理保护阻止清脏 cookie → 干扰新扫码；掌柜 2026-08-03「扫码成功永不 connected」的同类根因（虽已修 identity 捕获，脏 cookie 问题仍在）。
4. **C4 — 假数据 adapter 在生产注册表**：index.ts 注册 4 个 stub（假指标/假发布）。任何代码路径 resolveAdapter('weibo'/'video_account'...) 都会拿到假数据实现，违背「真实或不存在」。

### 🟠 High

5. **H1 — 探针固定 sleep 2s**：status 轮询 2.3s 主因；应改为「页面就绪信号/事件驱动」或缩短至 300–500ms。
6. **H2 — 前端无 reqId 透传 + 无全局错误处理/超时**：报障不可关联日志；默认 500 回显内部细节。
7. **H3 — 死代码/死页面**：_deprecated-channels-mock-auth.ts（tsc 报错）、media-department/settings/channels.vue（API 已删必 500）、channel-account.service.ts 与 channel.service.ts 双轨。
8. **H4 — 抖音未并入通用模板**：两套 adapter/probe 逻辑重复，后续平台维护双份。
9. **H5 — token.service 与 AES 结构不兼容**：若 WeCom 账号被误写加密格式，token 链路静默失败（creds.corpId=undefined）。

### 🟡 产品级缺陷

10. **P1** — connect 失败无前端超时兜底（connecting=true 永久转圈风险）。
11. **P2** — 前端 loginStage 5 值无法表达后端 13 态（LOGIN_PARTIAL/IDENTITY_RESOLVED 等全部塌缩为 awaiting_confirmation 一张卡片）。
12. **P3** — fetchMetrics「未解析到指标」= 抛错 400，未复用 ChannelMetricSnapshot status=unavailable 语义（掌柜要的「如实报 unavailable 绝不 0」在 adapter 层没闭环）。
13. **P4** — FastIdentityValidator 12h TTL 快照只验 cookie 存在性不验有效性（fast 恢复 CONNECTED 与实际登录态可能不一致——已知权衡，已在 owner-view 用 reality API 兜底）。
14. **P5** — 轮询期失败静默（前端 catch 吞掉），用户看到无限 waiting_scan 无提示。

### ⚪ 架构债务

15. **A1** — 三处状态机并存（LoginStateMachine / BrowserAuthSessionService / DB connectionStatus）需持续缝合。
16. **A2** — 双二维码修复实现（前端 jsQR + 后端截图通道）重复。
17. **A3** — 全后端 tsc 1957 错误（类型防线失效，含渠道 deprecated 文件）。
18. **A4** — 单全局加密密钥无轮换/KMS；crypto.service 未配置即打印密钥（潜在）。
19. **A5** — meta 中 wechat_mp/weibo/toutiao/baijiahao 配置僵尸（无 adapter，仅 connectable=false 兜住）。

---

## 13. 后续修复建议（仅建议，本次不动）

**优先级 P0（掌柜拍板后执行）**
1. **connect 异步化**：POST /connect 先返回 sessionId（浏览器后台启动），前端立即进入轮询态并展示「浏览器启动中」；出码、QR ready 全部由 status 轮询驱动 → 目标 2–5s 内首帧可见。
2. **清理 WeCom 明文凭证**：createWithOwnership 改走 encryptKey；token.service loadCredential 增加 cipher 结构识别（解密读取）+ 兼容旧明文；存量明文行迁移加密。
3. **快手脏 cookie 治理**：cookie 信号改为「关键 cookie 全命中」（bUserId+kwssectoken 等强 cookie 白名单）而非 ≥2 弱命中；clearLoginCache 保护判定同步收紧；或对「有 cookie 但身份缺失」的会话显式 NEEDS_REAUTH 而非 authenticated。
4. **移除生产 stub adapter**：index.ts 删除 4 个假 adapter 注册（保留文件标注 deprecated 亦可，但不得注册）。

**P1**
5. 探针 wait 缩短/事件化；waitMs/clickSteps/QR ready 等待改为条件轮询（短间隔 500ms 探测）而非固定 sleep。
6. 全局 setErrorHandler（统一错误格式 + reqId 透传响应头）+ 路由级超时；前端 connect 加 45s 超时兜底。
7. 删除 _deprecated-channels-mock-auth.ts + 旧 media-department 死页面 + channel-account.service.ts 明文写入路径。
8. 抖音并入 BrowserChannelAdapterBase（消除双实现）。

**P2**
9. 前端消费 `state` 新枚举，扩展确认卡片细分（身份已确认 vs 凭证未落库 vs session 已建身份缺失）。
10. fetchMetrics 返回 unavailable 结构化结果（对齐 ChannelMetricSnapshot）。
11. 轮询失败向前端暴露（error 字段展示 + 重试提示）。

---

## 14. 审计方法与证据

- 源码：backend/src/routes/enterprise-channel-runtime.ts（471 行）、enterprise-channel.ts、services/enterprise/channel.service.ts（1369 行）、enterprise/channel/adapters/browser-channel.adapter.ts（944 行）、browser-channel.meta.ts（478 行）、browser-channel.probe.ts（493 行）、login-detector.ts（356 行）、login-state-machine.ts（223 行）、identity-probe.ts、platform-registry.ts、services/media/browser-runtime.service.ts、token.service.ts、channel-account.service.ts、extended.adapter.ts、mock.adapter.ts、_deprecated-channels-mock-auth.ts、crypto.service.ts、crypto-helper.ts、prisma/schema.prisma
- 前端：pages/workspace/media/accounts.vue、pages/workspace/media/team.vue、pages/media-department/settings/channels.vue、components/enterprise/workspace/modules/ChannelsModule.vue、pages/workspace/enterprise/channels.vue
- 实测：audit-qr-perf（小红书 connect 18,497ms；快手 30,473ms；status 首次 1.8–2.3s / 缓存 63–70ms）+ pm2 日志时间线（KSQR-TIMING / LOGIN-TIMELINE / probe 信号明细）
- 编译：backend tsc --noEmit 1957 错误（渠道相关集中在 deprecated 文件）

*本报告由 SPRINT-MEDIA-WORKSPACE-AUTH-REALITY-AUDIT 任务产出，全程只读审计，未修改任何代码/数据。*
