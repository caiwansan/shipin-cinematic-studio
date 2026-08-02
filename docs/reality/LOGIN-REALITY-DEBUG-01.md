# SPRINT-MEDIA-LOGIN-REALITY-DEBUG-01 — 扫码成功刷新丢失 诊断报告

**Date:** 2026-08-03 02:10 CST
**Gate:** 掌柜战略纠偏（暂停 Metrics Sprint；账号登录→状态保存→刷新恢复底层闭环未证明前，禁止一切上层功能）
**原则:** 只诊断，零代码改动

---

## 结论（一句话）

**「扫码成功 → 页面显示已连接 → 刷新 → 未登录」已实锤复现，根因不是浏览器/Profile，而是登录成功的"显示成功"来自浏览器探针实时状态，持久化依赖 DB 写回，两者之间有三处断裂。**

---

## 一、现场四层快照（2026-08-03 02:05）

### 抖音 08a0f643-fb0d-48d5-af18-ad87bd9a34fb（曾完整登录过）

| 层 | 状态 | 判定 |
|---|---|---|
| ChannelAccount | `EXPIRED` + `accountName=抖音创作者中心` + `externalAccountId=88130666815` | 身份保留 ✅ 登录态失效（真实）|
| BrowserWorkspace | `READY` profile=`/data/browser-profiles/douyin/08a0f643...` | **唯一 ✅（无分裂）** |
| ChannelBrowserSession | `RUNNING` 同一 profile | **唯一 ✅** |
| 身份快照 | metadata.identitySnapshot 有（lastVerifiedAt=08-02 23:13）| ✅ |
| 前端显示 | 未登录 | **正确**（登录态确实失效）|

### 快手 10e0ea29-3a20-4aae-9efc-8557b86daa0c（扫码流程中断——铁证）

| 层 | 状态 | 判定 |
|---|---|---|
| ChannelAccount | **`AUTHENTICATED` + `external_account_id=NULL` + `account_name=kuaishou`（默认名）** | **❌ 卡死中间态：探针检测到登录但身份从未写入** |
| BrowserWorkspace | `CREATED`（从未 READY）| ❌ 未完成 |
| ChannelBrowserSession | — | — |
| 身份快照 | boundAt=08-02 18:03 但无 identitySnapshot | ❌ |
| 前端显示 | 未登录 | **用户视角：刚扫码成功却未登录 ❌** |

---

## 二、掌柜四怀疑判定

| # | 怀疑 | 判定 | 证据 |
|---|---|---|---|
| 1 | 前端刷新没读 Reality | **成立但方向反了** | 前端刷新读 `account-status`（DB 内存态），不读 /reality、不触发探针。读 DB 是正确架构（DB=SSOT），**真问题是登录成功时 DB 没被写对** |
| 2 | DB 没保存身份 | **✅ 成立** | 快手铁证：confirm-binding 返回 200 但 `external_account_id=NULL`，身份从未落库 |
| 3 | BrowserWorkspace 分裂 | **❌ 不成立** | profile 全链路唯一：`/data/browser-profiles/<platform>/<accountId>`，workspace/session 同路径（此前 Sprint 已修复）|
| 4 | 前端旧字段 | **部分成立** | 前端字段没错；后端 `isChannelConnected()` 只认 `CONNECTED`，`AUTHENTICATED` 中间态永不通过 → 刷新即丢 |

---

## 三、唯一断点链（三处断裂）

### 断点 A（后端·核心）— `waitChannelLogin` 已绑定判定过严
```ts
alreadyBound = isChannelConnected(account.connectionStatus) && !!account.externalAccountId
//              ^^^^^^^^^^^^^^^^^^^^^^^^^ 只认 CONNECTED
```
- 失效重扫（EXPIRED/PENDING）→ 判定"未绑定" → 走首次登录分支 → **探针明明检测到真实登录（adapter 已返回 connected+身份），service 层吞掉结果，不写 DB**，返回 `awaiting_confirmation`
- 效果：扫码成功，DB 零写入，刷新必丢

### 断点 B（前端·核心）— `finishConnect` 假成功
```ts
const res = await api(`.../${accountId}/wait-for-login`)
const d = res.data || {}
statusMsg.value = d.accountName ? `账号已连接：${d.accountName} ✓` : ...
```
- wait-for-login 返回 `{status:'awaiting_confirmation', accountName:...}` 时，前端**只看 `d.accountName` 是否存在** → 显示「账号已连接」→ 关弹窗
- 确认绑定卡片只在 status 轮询路径显示；**finishConnect 路径永不触发 confirm-binding**
- 效果：用户看到成功，DB 未写 → 刷新丢

### 断点 C（状态机缝隙）— `AUTHENTICATED` 不被认可 + 无自动推进
- confirm-binding 写 `AUTHENTICATED` → 再 `refreshCredential` → CONNECTED（代码完整）
- 但 `refreshCredential` 内部探针复核若拒绝（数据中心 IP 风控 / 探针偶发失败）→ **永久卡 AUTHENTICATED**（快手现状：连身份都没写，说明探针从未通过）
- `isChannelConnected(AUTHENTICATED) = false` → 刷新后 account-status 返回 connected=false
- 附带：`ensure-account` 新建账号写假 ID（`platform+timestamp`），confirm-binding 前刷新必 false

---

## 四、产品级 Reality Gate 结论

- 此前各 Sprint 验收都在**接口层**验证（API 返回 connected / 探针返回 authenticated）✅
- 真实用户路径验收（扫码 → 关页面 → 刷新 → 仍看到账号）**从未通过** ❌
- 「登录成功」应定义为：**浏览器真实登录 + DB 持久化 CONNECTED**，两者缺一不可；当前实现"显示成功"只依赖前者

---

## 五、修复方向（待掌柜批准，本 Sprint 不改代码）

| 断点 | 修复方向 |
|---|---|
| A | `alreadyBound` 放宽：`!!account.externalAccountId`（身份已锚定=已绑定过），EXPIRED 重扫直接 keepalive 写 CONNECTED |
| B | `finishConnect` 处理 `awaiting_confirmation` → 显示确认卡片或自动 confirm-binding（探针已给身份）；假成功文案禁止 |
| C | confirm-binding 失败必须显式报错不假成功；AUTHENTICATED 超时自动推进/降级；`isChannelConnected` 评估是否纳入 AUTHENTICATED+externalAccountId |

---

## 附：诊断命令（可复现）

```sql
SELECT id, channel_type, connection_status, account_name, external_account_id, connected_at, last_error
FROM enterprise_channel_account WHERE id='<accountId>';
SELECT id, channel_account_id, profile_path, status FROM browser_workspace WHERE channel_account_id='<accountId>';
SELECT id, channel_account_id, profile_path, status FROM channel_browser_session WHERE channel_account_id='<accountId>';
SELECT metadata FROM enterprise_channel_account WHERE id='<accountId>';
```
前端 hydrate：`frontend/pages/workspace/media/accounts.vue` onMounted（仅 account-status + owner-view，无 /reality）
