# SPRINT-MEDIA-VIRTUAL-COMPUTER-REALITY-01 虚拟电脑账号生命周期闭环 — COMPLETE ✅

**Date:** 2026-08-03 09:10
**Gate:** 掌柜战略（新媒体工作台暴露的不是「登录问题」，而是虚拟电脑空间与新媒体账号生命周期没有闭环：电脑显示已登录/渠道账号显示等待登录/旧 cookie 残留/扫码进错账号/AI 员工读错身份。**「一台数字电脑 = 一个真实可验证的新媒体账号环境；没有登录成功，就不存在这个账号；退出登录，就必须彻底清空环境」**。优先级高于二维码速度优化——产品架构问题 > 体验问题）

## 核心：四层状态必须一致（VirtualComputer → BrowserProfile → ChannelLoginSession → ChannelAccount）
电脑实例在线 ≠ 平台账号在线，两者拆开。唯一事实源 = ChannelAccount.connectionStatus → BrowserProfileLoginState 映射。

## Task01 BrowserProfileLoginState 状态模型
- schema 新增 `browser_workspace.login_reality_state`（TEXT 默认 UNKNOWN）+ `last_login_state_at` + 索引；存量回填（CONNECTED → WORKSPACE_READY）
- `mapToLoginRealityState()` 纯函数（constants/channel-connection-status.ts）：
  `CONNECTED→WORKSPACE_READY / IDENTITY_VERIFIED→IDENTITY_READY / AUTHENTICATED→SESSION_AUTHENTICATED / WAITING_LOGIN+VERIFYING→WAITING_LOGIN / EXPIRED+NEEDS_REAUTH→EMPTY / LOGGED_OUT→LOGGED_OUT / BLOCKED+SECURITY_CHECK+ERROR→UNKNOWN`
- `ChannelConnectionStatus` 新增 **LOGGED_OUT**（用户主动退出，账号实体保留历史）
- 同步点：`updateChannelIdentity` 内嵌 syncLoginState（登录推进/合并/退出时随账号状态同步 workspace）

## Task02 退出登录链路 POST /api/enterprise/channels/runtime/:id/logout（MANAGE 权限）
① **HealthGuard.pauseForLogout**（非失败路径，直接暂停 active bindings + 记录 pauseReason=user_logout，AI 员工不得中途读取）
② **browserRuntime.clearPlatformAuth**（CDP `Storage.clearDataForOrigin('all')` 按平台 origin ×N + `Network.clearBrowserCookies/Cache` + 全部 open pages localStorage/sessionStorage/indexedDB 兜底）——必须清：Cookies/LocalStorage/SessionStorage/IndexedDB/CacheStorage/ServiceWorker/浏览器缓存
③ stopWorkspace + **删除 profile 目录**（含 Downloads 临时文件；profile 路径 = /data/browser-profiles/<platform>/<accountId> 全链路唯一）
④ DB：credentialEncrypted 销毁 + connectionStatus=LOGGED_OUT + connectedAt=null + metadata{loggedOutAt/loggedOutBy/loggedOutReason/credentialDestroyed}，**identitySnapshot 保留**（账号历史资产不删）+ workspace DESTROYED + loginRealityState=LOGGED_OUT（恢复服务跳过 DESTROYED 不拉起）
⑤ **双重审计**：governance_audit_log（action=channel_logout，details=清理明细）+ channel_ownership_migration（reason=user_logout）
- 权限：owner 或 share MANAGE（ChannelAccessService.assertAccess），跨 org 403

## Task03 电脑展示真实化
- owner-view：workerStatus 新增 **logged_out**（优先于 offline 判定）；identityStatus 将 LOGGED_OUT 计入 loginInvalid → stale（身份保留但登录无效）
- accounts.vue：空壳账号身份块显示「⚪ 未绑定账号 · 没有登录成功，就不存在这个账号」；卡片加 **[退出登录]**（working/expired/authenticated 等有登录态时）+ **[重新登录]**（logged_out/expired/offline）；LOGGED_OUT 状态「⚫ 已退出登录 · 认证环境已清空」
- team.vue 数字电脑矩阵：按 connectionStatus 真实映射（🟢已连接账号名 / 🟡等待授权 / 🟡需要重新登录 / ⚫已退出登录 / ⚪未配置）——不再把「浏览器在线」当「账号已登录」

## Task04 重新登录闭环
- LOGGED_OUT 账号 ensure-account **复用不新建**（owner 未变）；profile 目录已删 → connect 时 getOrCreatePersistent 重建全新空环境 → 扫码 → 验证 → 重绑（复用现有登录链路）
- 重新登录按钮直接复用 openDouyinConnect 全流程

## 验收 19/19 PASS（scripts/reality-check-virtual-computer-reality-01.mjs）
T01a-f 映射纯函数 6 项 / T02a-i logout 全链路 9 项（含非 owner 403、credential 销毁、identitySnapshot 保留、workspace DESTROYED+LOGGED_OUT、双重审计）/ T04a ensure 复用 / T03a-b 展示真实化
- 回归：FIX-02 9/9、FIX-01 9/9（metrics 403 断言已对齐）

## 关键经验
- **auditLog 的 tenantId 是 Tenant 表 FK**：account.tenantId（9af5f6bd）= 合法 Tenant id，可直接写；governanceAuditService.log 用 actorId/targetId 字段与 schema 不符，**一直静默失败**（被 catch 吞）——审计统一走 prisma.auditLog 直写 + migration 表双通道
- profile 全链路唯一（/data/browser-profiles/<platform>/<accountId>）= logout 删除 + 重登重建的基石
- prisma migrate dev 被历史迁移 20260531_add_event_ledger_fields 卡死（shadow DB 缺列）→ 团队模式 = 手写 SQL + `prisma db execute --schema`（不进 _prisma_migrations 记录）
- 前端部署：nuxt build → pm2 restart nuxt-frontend（监听 3000，nginx 反代 aigc.fushtn.com）

## 待掌柜
- 真机验证：抖音/视频号 扫码登录 → [退出登录] → 确认浏览器环境清空 + 账号显示「已退出」→ [重新登录] → 重新扫码闭环
- 掌柜 QQ 登录的账号（0ba5bf98）在渠道中心对南波万账号点「退出登录」→ 应 403（非 owner，需授权）——顺便验证权限模型

提交 `2977929b`
