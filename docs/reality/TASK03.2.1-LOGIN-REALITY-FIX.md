# TASK03.2.1 Login Reality Fix — Reality Report

**Date:** 2026-08-02 19:40 CST
**Gate:** 掌柜战略修正（二维码/扫码成功 ≠ 登录完成；「用户授权成功」与「系统确认授权成功」的状态闭环是 SaaS 产品必须补的）

## 解决的问题

之前链路停在：
```
用户扫码 → 抖音确认扫码 → 浏览器停留
```

缺的是「系统明确知道这个抖音账号到底登录成功没有」，以及登录成功后账号数据回写。

## 交付 1 — 登录成功探针（detectLoginState 三信号）

| 信号 | 实现 | 说明 |
|------|------|------|
| A 页面特征 | 工作台菜单标记（内容管理/发布作品/创作灵感/作品管理/数据概览/创作者服务/我的主页 ≥2）+ 排除登录页营销文案 | 明确登录页特征优先级最高 |
| B Cookie 信号 | `sessionid` / `sid_guard` / `uid_tt` 关键登录 cookie ≥2 | 抖音登录态核心 cookie |
| C 身份接口 | 页面 hydration 数据（`window._ROUTER_DATA` / `__NEXT_DATA__`）深度遍历提取 `user_name` + `sec_uid` | 登录成功才有 |

判定：`loggedIn = signals.page || signals.cookie || signals.identity`（任一命中即登录成功）

## 交付 2 — 登录成功自动回写账号（G1 身份绑定 / G2 Credential）

- `connect` / `waitForLogin` 返回真实 `accountName` + `externalAccountId`（不再硬编码「抖音创作者中心」）
- `channel.service.waitChannelLogin` 登录成功自动更新：
  ```sql
  connectionStatus = 'connected'
  connectedAt = now()
  externalAccountId = <真实 sec_uid>
  channelName = <真实昵称>
  ```
- 新接口 `POST /api/enterprise/channels/runtime/:id/wait-for-login`：轮询探针 → 登录成功 → **自动回写账号 + 自动保存 cookie 凭证**（AES 加密落库，无需用户手动 refresh-credential）

## 交付 3 — 前端状态机（产品体验）

弹窗显示登录阶段指示条（不再只有二维码/「登录中」死等）：

```
等待扫码 → ①扫码确认 → ②验证登录 → ③账号已连接
```

- `loginStage` 由后端 status 接口驱动：`waiting_scan / scan_confirming / verifying / connected`
- 扫码确认特征：页面出现「需在手机上进行确认 / 扫码成功 / 确认登录」过渡层
- 登录成功 → 自动调 wait-for-login → 弹窗显示「账号已连接：<真实昵称> ✓」

## Reality Test（未登录态，防误报）

| Case | 输入 | 结果 |
|------|------|------|
| A | 未登录态 status | loggedIn=false, loginStage=waiting_scan, 二维码 160KB ✅ |
| B | 未登录态 wait-for-login | 持续轮询等待，不误报 connected ✅ |
| C | 弹窗 E2E | 17 卡片 → 点抖音 → 12.5s 显示二维码 + 双 tab（扫码/短信）✅ |
| D | 填手机号 → 获取验证码 | SET 成功 + 页面真实倒计时「50s后重新发送」✅ |
| E | 填验证码提交 | 请求到达 passport/web/check_qrconnect 真实返回 ✅ |

## Gates

| Gate | 要求 | 状态 |
|------|------|------|
| G1 身份绑定 | 登录成功 → externalAccountId/channelName 回写 | ✅ 代码闭环（真实扫码待掌柜验收） |
| G2 Credential | 登录成功 → cookie 加密落库 | ✅ 自动保存（wait-for-login 内联） |
| G3 Runtime | 浏览器存活 + 反风控 | ✅ PASS（上轮已验） |
| G4 Metrics | fetchMetrics | ❌ 未开始（下一 Task） |
| G5 Permission | AgentChannelBinding | ❌ 未开始 |
| G6 Recovery | 登录态失效恢复 | ⚠️ 部分（connect 已处理 expired 降级） |

## 遗留（需掌柜真实扫码验收）

- [ ] 真实扫码 → 探针返回 connected + 真实昵称/sec_uid
- [ ] 账号卡片变「已连接」+ channelName 显示真实账号名
- [ ] 二次打开弹窗直接恢复登录态（cookie 注入）

**提交:** `59105c2c`
