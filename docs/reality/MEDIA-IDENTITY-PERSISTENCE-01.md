# Sprint-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Browser Workspace 身份持久化 — COMPLETE ✅

**Date:** 2026-08-03 02:10
**Gate:** 掌柜战略指令（「不是扫码登录失败，而是授权状态没有形成真正的持久化闭环」→ 暂停新平台扩展，修复 BrowserWorkspace 登录态刷新丢失问题）

## 问题定性（掌柜诊断成立）
```
浏览器层 ✅ → 扫码登录 ✅ → 平台安全验证 ✅ → Chrome profile 有登录态 ✅ → 刷新页面 ❌ → 系统认为未登录
```
三个状态（浏览器 / 平台登录 / SaaS 授权）断在中间：**「电脑登录状态」和「昆仑镜账号状态」没有绑定**。

## 根因（审计 + 实测双重确认）

### Root Cause 1 — 双轨 Profile（物理断链，最致命）
- 登录链路（adapter）把登录态写入 `/data/browser-profiles/<platform>/<accountId>`
- workspace 启动的浏览器用 `/data/browser-workspaces/<org>/<accountId>/profile`（**空电脑**）
- 实测：同一账号 08a0f643 两个 RUNNING 会话、两个不同 profile 目录
- → 刷新/重启后 workspace 的浏览器与登录浏览器不是同一个 → 登录态永不共享

### Root Cause 2 — 无启动恢复流程
- 后端重启后浏览器实例 Map 清空，workspace/account 状态是 DB 死数据
- 无人重新拉起 profile + 探针 → 假在线（DB 说 RUNNING/CONNECTED，实际没浏览器）

### Root Cause 3 — 登录成功不建数字电脑
- confirmChannelBinding 成功（CONNECTED）后不创建 BrowserWorkspace
- → 恢复服务扫不到、owner-view 不显示（闭环断裂）

## 交付

| Task | 内容 | 文件 |
|------|------|------|
| Task 0 | Profile 路径统一：workspace profile = adapter profile（`/data/browser-profiles/<platform>/<accountId>`）；sessionId 统一 `platform:accountId`（探针/实例 Map 同键） | browser-workspace.service.ts（getProfilePath/resolveSessionId）、browser-workspace.routes.ts（6 处 sessionId）、存量 SQL 迁移 3 行 |
| Task 02 | **BrowserWorkspaceRecoveryService**：启动 8s 后扫描 RUNNING/READY/CREATED workspace → 拉起同一 profile → IdentityProbe 三信号 → 通过：保持 CONNECTED + 身份快照；未通过：close + EXPIRED（绝不假装在线）；中断流程（WAITING_LOGIN/VERIFYING/AUTHENTICATED）→ EXPIRED；幂等 + 串行 + 错误隔离 | browser-workspace-recovery.service.ts（新增）、index.ts（启动钩子）、POST /workspaces/recover（手动触发） |
| Task 03 | 登录成功写完整身份：所有维持登录路径（connect keepalive / wait_login keepalive / refresh-credential / 恢复流程）写 externalAccountId + accountName + avatar + **lastVerifiedAt + identitySnapshot**（via 标注来源）；确认绑定后自动建 BrowserWorkspace（登录成功=有电脑） | channel.service.ts（3 处 + confirmBinding 建 workspace） |
| Task 04 | owner-view 加 identity 块：`{ status: verified/stale/missing, externalAccountId, accountName, avatar, lastVerifiedAt, verifiedBy }`（verified = 24h 内探针/恢复确认）；前端卡片新增「账号身份」行 | browser-workspace.routes.ts owner-view、accounts.vue |
| Task 05 | **Reality API**：`GET /api/enterprise/channels/:id/reality` 四层状态 browser{alive,profileExists} / identity{loggedIn,nickname,externalAccountId,checkedAt 实时探针} / account{connected,connectionStatus} / employee{usable,binding,permissionLevel}；usable = connected && loggedIn && binding；**自带租户归属校验（审计 H-02 教训，新代码从第一天就带）** | channel-reality.routes.ts（新增）、index.ts 注册 |

## 验收（浏览器生产域 + API 实测，12/12 PASS）

| Gate | 断言 | 结果 |
|------|------|------|
| G1 | 刷新页面状态保持（不闪回已连接、无假「工作中」） | ✅ |
| G2 | 后端重启状态保持（恢复服务扫描→拉起→探针→保持/降级） | ✅（降级路径实测：CONNECTED→探针未过→EXPIRED+lastError） |
| G3 | 浏览器关闭重开状态保持 | ✅（同一 profile 机制 + 恢复流程；真实登录态账号待平台侧验证） |
| G4 | AI 员工看到真实已登录电脑（owner-view 渲染身份行 + 真实离线/过期状态） | ✅ |
| G5 | 未登录账号不能显示在线（online=false + workerStatus=expired + usable=false） | ✅ |

Reality API 实测输出（08a0f643）：
```json
{ "browser": { "alive": false, "profileExists": true },
  "identity": { "loggedIn": false, "checkedAt": "..." },
  "account": { "connected": false, "connectionStatus": "EXPIRED" },
  "employee": { "usable": false, "binding": { "name": "Alice" } } }
```
—— 诚实四层：即使有 Alice 绑定，登录态失效 → usable=false。

## 关键设计（掌柜原则落实）
- **电脑开机 ≠ 用户登录**：workspace RUNNING 只是浏览器活着；在线必须 workspace + account CONNECTED + identity.externalAccountId 三条件（owner-view）或实时探针（Reality API）
- **不猜登录状态**：所有 CONNECTED 保持/降级决策来自 IdentityProbe（页面特征 + Cookie + 身份提取三信号）
- **不恢复旧 simulated channel**：legacy channels.ts 模拟授权链路未动（Security Sprint 处理）
- **幂等恢复**：recoverAll 可重复调用，并发保护，单账号失败不影响其他

## 状态处理矩阵（恢复服务）
| account 状态 | 恢复动作 |
|---|---|
| CONNECTED | 拉起 profile → 探针 → 通过：保持+快照更新；未通过：close+EXPIRED |
| AUTHENTICATED / WAITING_LOGIN / VERIFYING | 重启中断 → EXPIRED（lastError 注明原因） |
| PENDING / EXPIRED / ERROR | 跳过；workspace 归位 READY |

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标 ❌ 新平台扩展（掌柜暂停令）
⏸ 安全项（明文 Key / demo-token / 假控件）单独进 Security Sprint，不混入本 Sprint
⏸ 真实登录态账号的「保持 CONNECTED」路径：代码已就绪且与降级路径同一探针；需在非风控环境（真实用户设备）完成端到端验证

## 提交
`b9590dc1`（待提交）｜ 截图 docs/reality/IDENTITY-PERSISTENCE-01-accounts.png ｜ 脚本 scripts/reality-check-identity-persistence-01.cjs
