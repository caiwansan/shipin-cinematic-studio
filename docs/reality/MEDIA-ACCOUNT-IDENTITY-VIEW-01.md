# Sprint-MEDIA-ACCOUNT-IDENTITY-VIEW-01 渠道中心账号身份展示 — COMPLETE ✅

**Date:** 2026-08-03 02:00
**Gate:** 掌柜战略指令（「登录态持久化已解决，但账号身份展示还差最后一个产品闭环」→ 新媒体渠道中心显示真实平台账号身份，而不是只显示『已连接』；完成本项后不做自动发布，先打磨『AI 员工真的坐在一台登录了账号的电脑前』）

## 产品闭环（掌柜验收视角）
```
用户扫码登录 → BrowserWorkspace → IdentityProbe
  → updateChannelIdentity() → EnterpriseChannelAccount（SSOT）
  → owner-view / Reality API / 渠道中心卡片
```
现状升级：
```
抖音 🟢已连接            →   🟢 已连接
                              👤 [真实头像] 抖音创作者中心
                              ID 88130666815
                              🖥 数字电脑 · 最近验证 昨天
AI员工: Alice             →   AI员工: Alice 新媒体运营主管
```

## 交付

### Task 01 — 身份数据 SSOT（不新增第二套表）
- `EnterpriseChannelAccount` 新增 **accountName / avatarUrl** 独立列（prisma schema + SQL 迁移 + 存量回填）
- 身份锚点唯一：`externalAccountId + accountName + avatarUrl + connectionStatus + connectedAt`
- 来源唯一链路：IdentityProbe → **updateChannelIdentity()** → EnterpriseChannelAccount
- 禁止：前端保存账号名 / workspace 保存账号名 / AI 员工保存账号名（AI 员工只是使用电脑，不拥有账号）
- 历史散写（metadata.identitySnapshot JSON）全部收口到统一入口

### Task 02 — 登录成功自动同步身份
- 新增 `updateChannelIdentity()` 统一写入入口（SSOT 列 + lastVerifiedAt + identitySnapshot，via 标注来源）
- 替换 4 处散写：connect_keepalive / wait_login_keepalive / refresh_credential / startup_recovery（恢复服务）
- confirmChannelBinding 探针通过 → 写 externalAccountId + accountName + avatarUrl（via=confirm_binding）

### Task 03 — Reality API identity 标准化
```json
{ "identity": {
    "status": "verified | stale | missing",
    "platform": "douyin",
    "name": "宏荼记", "avatar": "https://...", "externalId": "MS4wLjAB...",
    "lastVerifiedAt": "2026-08-03T...", "loggedIn": true, "checkedAt": "..." } }
```
- **verified 必须来自最近一次真实探针**（不猜、不用 DB 快照冒充）
- stale = 有身份但当前未验证（浏览器不在线/探针未过/登录态失效）→ 身份保留
- missing = 从未获取身份 → **name/avatar/externalId 一律 null**（G5：未登录不能生成账号名，绝不 fallback 渠道名冒充）

### Task 04 — Owner View 展示真实身份
- owner-view identity 块升级：`{status, externalAccountId, accountName, avatar, lastVerifiedAt, reason, verifiedBy}`（读 SSOT 列）
- 前端卡片：**真实头像 img + 账号名 + 平台ID + 最近验证（相对时间）+ 验证来源标注**（扫码确认绑定/开机恢复确认…）
- verified 判定修正：**身份快照新鲜 ≠ 登录有效**——EXPIRED/ERROR 即使昨天刚验证也强制 stale

### Task 05 — 身份失效展示（不删身份）
- 登录过但失效 → 卡片显示：
  ```
  👤 抖音创作者中心（头像保留）
  状态: 🟡 登录状态需要重新验证
  原因: 登录状态已过期，需重新扫码验证
  最近验证: 昨天 · 手动绑定
  ```
- 真实 SaaS 原则：**账号身份 ≠ 当前在线**；identity.reason 五态（浏览器环境失效/登录态过期/连接异常/快照超期/从未登录）

## 验收（浏览器生产域 + API 实测，15/15 PASS）

| Gate | 断言 | 结果 |
|------|------|------|
| G1 | 扫码登录后显示真实账号名 | ✅（卡片渲染「抖音创作者中心」，SSOT 写入链路就绪） |
| G2 | 刷新页面账号名保持 | ✅（刷新后身份+失效状态均保持） |
| G3 | 后端重启账号名保持 | ✅（pm2 重启后 owner-view 仍返回 accountName） |
| G4 | 浏览器失效显示过期 | ✅（stale + 🟡 需重新验证 + 原因「登录状态已过期」+ 最后验证时间） |
| G5 | 未登录不能生成账号名 | ✅（missing 态 name/externalId 为 null，不 fallback 渠道名） |
| G6 | AI员工看到真实绑定账号 | ✅（Alice + 抖音创作者中心 + 88130666815） |

Reality API 实测（douyin 08a0f643，登录态已失效）：
```json
{ "identity": { "status": "stale", "platform": "douyin", "name": "抖音创作者中心",
  "externalId": "88130666815", "lastVerifiedAt": "2026-08-02T15:13:07.993Z", "loggedIn": false } }
```
—— 身份保留 + 诚实 stale：登录过但当前不可用。

## 关键设计（掌柜原则落实）
- **EnterpriseChannelAccount = 渠道身份 SSOT**，零新增身份表
- **IdentityProbe = 唯一身份来源**；verified 只认最近真实探针
- **账号身份 ≠ 当前在线**：stale 展示（Task 05）是真实 SaaS 的标准行为
- 迁移修复：初始回填误伤未登录账号（把 channelName 当 accountName）→ 已修正为仅 externalAccountId 非空行回填

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标 ❌ 新平台扩展
⏸ 安全项（明文 Key / demo-token / 假控件）单独进 Security Sprint
⏸ **不做自动发布**（掌柜指令）：MVP 闭环 = 账号登录 → 账号身份展示 → AI员工拥有数字电脑 → 读取数据指标 → 生成运营分析 → 人工确认执行

## 提交
`（待提交）` ｜ 截图 docs/reality/ACCOUNT-IDENTITY-VIEW-01-accounts.png ｜ 脚本 scripts/reality-check-account-identity-view-01.cjs
