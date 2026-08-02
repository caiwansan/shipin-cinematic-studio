# 扫码授权登录全链条审计报告（SPRINT-MEDIA-CHANNEL-01 / BROWSER-WORKSPACE-01）

**Date:** 2026-08-02 21:50 CST
**审计方式:** 代码逐行审查 + 生产环境真实 API 调用（aigc.fushtn.com，demo token）+ DB 数据核验
**审计人:** 杨玉环（掌柜指令：全链条审计，不自以为是，不擅自修复）

---

## 全链条地图（9 环节）

```
[1]ensure-account → [2]connect(启动Chromium) → [3]status轮询(QR/探针)
      → [4]掌柜扫码 → [5]探针检测登录态 → [6]confirm-binding(人工确认)
      → [7]refresh-credential(凭证落库) → [8]fetchMetrics(读数据) → [9]owner-view展示
```

---

## 逐环节审计结论

### ✅ 环节 1 — ensure-account（真实）
- 查不到抖音账号则 `connectAccount` 创建（AES-256-GCM 加密空凭证）
- **实测 200**，返回账号 `08a0f643`（测试企业 org 11111111 下的抖音账号，7-16 创建）

### ✅ 环节 2 — connect（真实，浏览器真启动）
- `DouyinBrowserAdapter.connect` → `browserRuntime.getOrCreatePersistent`（`headless:false` + Xvfb :99 + 持久化 Chrome profile `/data/browser-profiles/douyin/<accountId>`）
- 反自动化指纹（webdriver/languages/chrome 对象）已抹除
- **实测 200**：`status: waiting_login`，浏览器真实打开 `creator.douyin.com` 登录页
- 环境验证：api-server 带 `DISPLAY=:99`，pm2 `xvfb` 进程在线（14h）

### ✅ 环节 3 — status 轮询（真实，QR 真拿到）
- `getLoginStatus`：整页截图 + 放大二维码提取（PIL 放大 1024 + 白边）+ 多信号探针
- **实测 200**：`qrCodeBase64` 118KB 真实二维码、`loginStage: waiting_scan`、页面文本确认是抖音登录页（扫码登录/验证码登录/密码登录）

### ✅ 环节 4 — 扫码检测（真实，多信号探针）
- `DouyinIdentityProbe`：A 页面特征（创作者工作台菜单≥2）+ B Cookie（sessionid/sid_guard/uid_tt ≥2）+ C 身份接口（_ROUTER_DATA/__NEXT_DATA 提取 user_name/sec_uid/avatar）
- 任一强信号命中即 authenticated；**不会把登录页误判为已登录**（有登录页特征排除）

### ⚠️ 环节 5 — 授权确认（半真，存在测试造假数据）
- `confirm-binding` 前置探针复核 + 回写 DB + 凭证落库 + 权限 L1 —— 代码逻辑正确
- **实测（未登录）400 诚实拒绝**：「未检测到有效登录态，请重新扫码登录」✅
- **但 DB 存在造假**：`ChannelVerificationSession 89b24140` 状态 `AUTH_SUCCESS`，`verifiedIdentity = {accountName:"测试账号", externalAccountId:"test_sec_uid"}` —— 这是测试数据冒充真实授权成功

### ❌ 环节 6 — refresh-credential（**造假点 #1，最严重**）
- `adapter.refreshCredential`：`browserRuntime.getCookies(sid)` 只要 cookies.length > 0 就 `persistCredential` + `return {ok:true}`
- **游客 cookie 也算 cookie**（ttwid 等）→ 未登录也能 ok:true
- `channel.service.refreshChannelCredential` 在 `result.ok` 时**无条件把 `connectionStatus` 更新为 `connected` + `connectedAt=now`**
- **实测实锤**：账号 08a0f643 从 PENDING → **connected**（connectedAt 写入），但 `externalAccountId=null`（无真实身份）
- 前端 `finishConnect` 的 fallback 路径：wait-for-login 超时 → refresh-credential → **假连接成功**
- 我已恢复该账号为 PENDING（测试污染已清理）

### ⚠️ 环节 7 — wait-for-login（半真）
- 180s 轮询探针，登录成功才 connected；未确认账号返回 awaiting_confirmation —— 逻辑正确
- 未实测（需要真人扫码），代码审查通过

### ⚠️ 环节 8 — fetchMetrics（真实但展示层有假）
- **实测（未登录）400 诚实报错**：「未能从抖音数据概览解析核心指标（可能未登录…）」✅ 不 mock
- 权限 Gate：`requirePermissionLevel('read:metrics')` = L1，+ agentInstanceId 时 `authorizeAgentAction` 校验 binding
- **但 `fetchMetrics` 成功路径会 `browserRuntime.close(sid)`** —— 读完数据关闭浏览器（持久化 profile 保留登录态，下次 connect 复用，可接受但需注意）

### ❌ 环节 9 — owner-view 展示（**造假点 #2 和 #3**）

**造假点 #2 — 伪造操作日志：**
- `channel_operation_log` 存在 `action: publish, target: video_123, result: success` + `action: reply, target: comment_456, result: success`，**agent_id=null，organization_id=null，tenant_id=default**
- 但 `adapter.publish` 明确返回 `failed`（自动发布 Task 阶段禁用）——**这些 success 日志是伪造的**
- owner-view 的 `lastOperation` 读取这些日志 → 展示「最近动作」

**造假点 #3 — workspace RUNNING ≠ 账号已登录：**
- workspace `b27a2e1e` status=RUNNING（lastStartedAt 12:44），但绑定的账号 08a0f643 是 PENDING + externalAccountId=null
- owner-view `online: ['RUNNING','READY'].includes(ws.status)` → **未登录也显示「🟢 工作中」**
- 上一轮我截图看到的「Alice 🟢 工作中 · 正在读取粉丝/获赞指标」是 workspace RUNNING + 伪造日志的共同产物，**账号实际从未登录过**

### ⚠️ 数据一致性（孤儿数据）
- Binding `ca8c739a`（paused）指向 `channelAccountId: 2262011f-...` —— **该账号不存在**（孤儿引用）
- Binding `d31d142e`（active）→ Alice 新媒体运营主管（media 域）→ 账号 08a0f643（PENDING，未登录）—— **active binding 挂在未连接账号上**
- `ChannelBrowserSession 776370ce` status=RUNNING，lastHealthCheckAt=null

---

## 真实验证证据（本轮实测）

| 调用 | 结果 | 判定 |
|------|------|------|
| POST ensure-account | 200, id=08a0f643 | ✅ |
| POST connect | 200, waiting_login + sessionId | ✅ 浏览器真启动 |
| GET browser/status | 200, QR 118KB + waiting_scan | ✅ 二维码真 |
| GET metrics | 400 诚实报错（未登录） | ✅ 不 mock |
| POST confirm-binding | 400 诚实拒绝（未登录） | ✅ |
| POST refresh-credential | **200 ok:true（未登录！）** | ❌ **假成功** |
| GET runtime-health | browser:online / session:degraded / account:none | ✅ 诚实 |
| GET account-status | connected:false（externalAccountId=null） | ✅ 诚实 |

---

## 结论：全链条真相

**浏览器自动化层是真实的**（Chromium + Xvfb + 持久化 profile + 多信号探针 + 二维码提取 + 诚实失败），**掌柜扫码 → 登录 → 确认这条主线代码逻辑是正确的**。

**但存在 3 个造假点 + 2 处数据污染，必须掌柜批准后修复：**

1. **refresh-credential 假连接**（最严重）：游客 cookie → ok:true → connectionStatus=connected。修复方向：`refreshCredential` 必须校验登录态（探针 authenticated 才允许写凭证+置 connected），或加 `externalAccountId` 非空才 connected
2. **伪造操作日志**：channel_operation_log 的 publish/reply success 记录（agent_id=null）应清除；owner-view 的 lastOperation 应只读真实轨迹或置空
3. **owner-view 在线判定**：`online` 不能只看 workspace.status=RUNNING，应叠加 `account.connectionStatus === 'connected' && externalAccountId` 双条件
4. **孤儿 binding**：ca8c739a 指向不存在的账号 2262011f（paused 无害但应清理或修复）
5. **AUTH_SUCCESS 测试数据**：89b24140 verifiedIdentity=测试账号/test_sec_uid（冒充真实授权）应标记或清除

**按掌柜纪律：本轮只审计不修复**，以上 5 项修复方向待掌柜批准。
