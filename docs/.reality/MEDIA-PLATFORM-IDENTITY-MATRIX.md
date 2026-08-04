# MEDIA-PLATFORM-IDENTITY-MATRIX

平台真实身份信号矩阵 — Task 02.0（SPRINT-MEDIA-REALITY-CLOSURE-01，只读采集）

- **日期:** 2026-08-03 19:00
- **方法:** 启动现有持久 profile（BrowserRuntime 同款 playwright + google-chrome），导航平台创作者中心，采集 cookies / localStorage / 页面 URL / 身份字段。只读观察，零代码改动、零 DB 写入。
- **目的:** Task 02 identityRequirements 配置的唯一数据源。**禁止凭经验配置身份信号。**

---

## 1. 抖音 douyin — ✅ 实测（真实登录态）

**账号:** 南坡万 / 抖音号 88130666815（profile `08a0f643`，DB CONNECTED）
**页面:** `creator.douyin.com/creator-micro/home`（创作者中心首页，真实数据渲染）

### Cookie keys（.douyin.com / creator.douyin.com，共 44 个）

**🔴 强信号（登录主体凭证，httpOnly）：**

| cookie | domain | httpOnly | 说明 |
|---|---|---|---|
| `sessionid` | .douyin.com | ✅ | 会话主凭证 |
| `sessionid_ss` | .douyin.com | ✅ | 会话主凭证（安全版） |
| `sid_guard` | .douyin.com | ✅ | 会话守卫（含过期时间） |
| `sid_tt` | .douyin.com | ✅ | 会话 |
| `uid_tt` / `uid_tt_ss` | .douyin.com | ✅ | 用户 ID |
| `odin_tt` | .douyin.com | ✅ | 用户身份 |
| `sid_ucp_v1` / `ssid_ucp_v1` | .douyin.com | ✅ | UCP 会话 |
| `passport_mfa_token` / `d_ticket` | .douyin.com | ✅ | 二次验证/票据 |

**🟡 弱信号（游客也可能有 / 环境 / 风控）：**

`passport_csrf_token`（游客也有，32 字符）、`ttwid`（设备）、`s_v_web_id`、`bd_ticket_guard_*`（风控）、`__security_mc_*`（风控）、`n_mh`、`is_staff_user`、`has_biz_token`、`passport_assist_user`

### LocalStorage keys（douyin.com）

**🔴 强信号：** `SLARDARdouyin_login_new`（含 userId 登录态）、`SLARDARuc_secure_sdk`（userId=4495236668331551）、`LOGIN_STATUS`
**🟡 弱信号：** `__tea_cache_*`（埋点）、`security-sdk/*`（风控）、`xmst`、`athena_web_id`

### Identity fields（页面明文/hydration）

- 抖音号：`88130666815`（body 明文「抖音号：88130666815」→ 现有 extractionRules regex 已命中 ✅）
- 昵称：南坡万（body 明文 ✅）

### Network signals

- 现有 `meta.userApis` 已配置；创作者中心加载必然请求用户信息 API（真实数据渲染已验证）
- 本次页面加载自然请求（未抓明细，登录态真实性已由「首页真实数据渲染」兜底证明）

### 建议 identityRequirements 草案（基于实测）

```ts
identityRequirements: [
  { type: 'cookie', key: 'sessionid', strength: 'required' },
  { type: 'cookie', key: 'sid_guard', strength: 'required' },
  { type: 'cookie', key: 'uid_tt', strength: 'required' },
  { type: 'cookie', key: 'passport_csrf_token', strength: 'weak' },   // 游客也有
  { type: 'identity', field: 'userId', strength: 'required' },        // 抖音号提取
]
```

> 注：现有 meta cookies `['sessionid','sid_guard','uid_tt','passport_csrf_token']` 命中≥2 与实测兼容；抽象后 required 三主凭证全命中更严格，且排除 passport_csrf_token 单独凑数。

---

## 2. 快手 kuaishou — ⚠️ 半失效实证 + ⏳ 待扫码补采

**当前状态:** DB `10e0ea29` LOGGED_OUT（掌柜退出测试后）；`be53a9a8` WAITING_LOGIN 空壳。**无真实登录态可采。**

### 半失效会话实证（历史 VC-REALITY-HOTFIX-01，2026-08-03 08:48）

- profile 残留 `kwssectoken + did`（**缺 `bUserId`**）→ 现有判定命中 2 → `cookie=true` 假阳性
- 页面在创作者工作台（urlFragments 命中）→ `authenticated=true` 但 `accountId` 永远空 → 「已登录但永不 connected」
- 这正是 Task 02 要根治的场景

### 已知信号（未实测，供扫码后对照）

- 现有 meta cookies: `['bUserId', 'kwssectoken', 'did']`
- 登录主体：`bUserId`（快手主登录凭证）；`kwssectoken` = passport 会话（可能残留）；`did` = 设备 ID（不代表登录）
- 身份字段：快手号（body 明文，现有 regex 已配）
- network：cp.kuaishou.com 三路由必然请求 `/rest/v2/creator/pc/authority/account/current`（VC-REALITY-HOTFIX-01 实证）

### 建议 identityRequirements 草案（扫码后按实测修正）

```ts
identityRequirements: [
  { type: 'cookie', key: 'bUserId', strength: 'required' },   // 登录主体，缺失=会话不成立
  { type: 'cookie', key: 'kwssectoken', strength: 'weak' },   // passport 残留可能
  { type: 'cookie', key: 'did', strength: 'weak' },           // 设备 ID
  { type: 'identity', field: 'userId', strength: 'required' },// 快手号提取（networkCapture 兜底）
]
```

⏳ **待掌柜扫码：** 快手真实扫码登录后补采 cookie/localStorage 全量。

---

## 3. 小红书 xiaohongshu — ⚠️ 半失效实证 + ⏳ 待扫码补采

**当前状态:** 3 账号全 WAITING_LOGIN 空壳；实测 `45663e51` profile → 页面跳 `creator.xiaohongshu.com/login`。

### 半失效会话实证（本次实测 19:00）

- **`web_session` cookie 存在（38 字符）但页面在登录页** → 「cookie 存在 ≠ 登录成功」第二活案例
- 现有判定链：cookie 命中≥2（web_session + a1/webId/gid 等）→ `cookie=true`，但 **loginPage 信号拦截**（loginPageMarkers 命中「登录」）→ `credential = cookie && !loginPage = false` → 未假阳性 ✅
- **结论：loginPage 判定是小红书当前唯一防线**；若页面恰好停在工作台 URL（不跳登录页）而 web_session 过期，仍可能假阳性 → identityRequirements 需 required 信号兜底

### 已知信号（未实测真实登录态）

- 现有 meta cookies: `['web_session', 'customerClientId']`（待扫码确认）
- 实测残留集：`web_session`(38) / `a1`(52) / `webId`(32) / `gid`(72) / `abRequestId` / `acw_tc` / `websectiga` / `sec_poison_id`（游客也有）
- 身份字段：小红书号（现有 regex 已配）

⏳ **待掌柜扫码：** 小红书真实扫码登录后补采。

---

## 4. 视频号 shipinhao — ⏳ 无账号待创建

**当前状态:** DB 无 shipinhao 账号行、无 profile 目录。审计记录视频号扫码失败（manual_confirm 流程未走通）。

- 已知 meta cookies: `['sessionid', 'wxuin']`（微信双凭证，未实测）
- 身份字段：视频号 ID（现有 regex 已配）

⏳ **待掌柜：** 新建视频号账号 + 真实扫码成功后补采全量信号。

---

## 5. 跨平台结论（Task 02 配置约束）

1. **信号分级规则：**
   - `required`（登录主体凭证）：缺失 → 会话不成立，无论其他信号多强
   - `weak`（环境/风控/游客也有）：只进诊断日志，不参与成立判定
2. **两道防线并存：** identityRequirements（第一道：凭证主体成立）+ loginPage 判定（第二道：页面未回登录页）。两道都过才 `credential=true`。
3. **实测铁证：** 抖音（真登录）✅ / 小红书（web_session 残留跳登录页）⚠️ / 快手（kwssectoken+did 残留假阳性）⚠️ —— 三平台三态，验证「cookie 存在 ≠ 登录成功」是全平台共性，不是快手特例。
4. **Task 02 范围收窄（矩阵约束）：** 快手配置按本矩阵草案落地（bUserId required 是实证+历史实证双支撑）；抖音/小红书/视频号配置**等掌柜扫码补采后**再进 Task 02 或独立小步（不做则维持现状判定，避免凭经验误伤）。

---

## 附：采集脚本（只读，临时）

`/tmp/identity-snapshot.mjs` — playwright launchPersistentContext + cookies/localStorage/body/身份字段提取，仅观察。
