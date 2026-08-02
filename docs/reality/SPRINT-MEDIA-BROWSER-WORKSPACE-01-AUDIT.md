# SPRINT-MEDIA-BROWSER-WORKSPACE-01 — Task 00 架构审计

**Date:** 2026-08-02 20:40 CST
**Gate:** 掌柜战略指令（昆仑镜不是做「抖音自动化工具」，而是建设「AI 员工数字办公环境」）
**状态:** 审计完成，零代码改动

---

## 0. 战略对齐

> **渠道账号 = 身份｜Browser Workspace = AI 员工工作电脑｜Channel Runtime = 浏览器执行能力｜AI Employee = 使用这台电脑完成任务**

当前实现本质上是「单平台（抖音）登录修复 + 数据读取」的直连结构。本 Sprint 将其升级为 **Browser Workspace 基础设施层**——账号身份与运行环境彻底分离，AI 员工通过 Workspace 访问平台，操作可审计、多企业隔离、登录态持久化。

---

## 1. 当前架构总览

```
EnterpriseChannelAccount (账号身份: 凭证/状态/归属)
        |
        | channelAccountId
        v
ChannelBrowserSession (运行环境记录: profilePath/status)   ← 已有雏形
        |
        | profilePath
        v
BrowserRuntimeService (Playwright 执行层, launchPersistentContext)
        |
        | sessionId (douyin:<accountId>)
        v
DouyinBrowserAdapter (平台逻辑: 登录/探针/指标)
        |
        | ChannelIdentityProbe
        v
抖音创作者中心
```

## 2. 关键组件审计结论

### 2.1 BrowserRuntimeService（src/services/media/browser-runtime.service.ts, 502 行）
| 项目 | 现状 | 审计结论 |
|------|------|----------|
| **Profile 存储** | `PROFILE_ROOT = /data/browser-profiles`（env BROWSER_PROFILE_ROOT 可覆盖）；结构 `<root>/<platform>/<accountId>` | ✅ 已独立、已按账号隔离；❌ 无 organizationId 层级（多企业同平台账号会混在 platform 下）；❌ 目录信息未入 SSOT（仅运行时内存 Map + ChannelBrowserSession 冗余一份） |
| **浏览器启动** | 主路径 `launchPersistentContext(profilePath)`；临时 `launch()` 仅 fallback（media-platform.ts 旧链路仍用） | ✅ 主路径正确；❌ 生命周期无 DB 状态机（RUNNING/ERROR 仅内存） |
| **生命周期管理** | `launch/close/getOrCreate/getOrCreatePersistent/withPage/healthCheck/closeAll` | ⚠️ closeAll 无调用点（服务重启时浏览器进程孤儿）；❌ 无 startWorkspace/stopWorkspace/restartWorkspace 概念 |
| **登录态持久化** | 真实 Chrome profile（launchPersistentContext user-data-dir）+ cookie fallback | ✅ 重启后 profile 保留；❌ 无健康检查自动恢复机制 |
| **实例 Map** | `Map<sessionId, BrowserInstance>` 内存态 | ❌ 服务器重启丢失（浏览器进程可能残留） |
| **多账号并发** | Chromium 自身 profile 锁保证同 profile 串行 | ⚠️ 无显式并发 Gate（多账号同时 connect 会各自独立浏览器，资源无上限） |
| **反自动化** | 固定 timezone/locale/UA + webdriver 抹除 | ⚠️ 边界风险：仅抹除自动化特征，**不**修改指纹欺骗（符合掌柜第一原则）；launch() 临时模式仍带这些 flag |

### 2.2 ChannelBrowserSession（Prisma model + service, 136 行）
| 项目 | 现状 | 审计结论 |
|------|------|----------|
| 字段 | channelAccountId + browserType + profilePath + status(IDLE/RUNNING/ERROR) + lastStartedAt/lastHealthCheckAt/lastError | ✅ 已有「运行环境」雏形；❌ 无 organizationId（隔离缺失）；❌ 无 workspaceType/浏览器版本/销毁状态 |
| 唯一键 | `@@unique([channelAccountId, browserType])` | ⚠️ 一账号一浏览器环境，但无多 workspace 概念 |
| 生命周期 | markStarted/markHealthCheck/markError/markIdle | ✅ 基本齐全；❌ 无 destroyWorkspace |

### 2.3 DouyinBrowserAdapter（src/enterprise/channel/adapters/douyin-browser.adapter.ts, 692 行）
| 项目 | 现状 | 审计结论 |
|------|------|----------|
| 职责边界 | 只做浏览器执行，无 DB/权限/AI 逻辑 | ✅ 符合掌柜批准约束 |
| Credential | getCredential/persistCredential 注入回调 → AES 落库 credentialEncrypted | ✅ 唯一凭证源正确 |
| 登录流程 | connect → launchPersistentContext → navigate(creator) → identity probe → waiting_login/connected | ✅ 已有多信号探针；❌ 无 BrowserAuthSession 状态机（INIT/OPEN_BROWSER/WAIT_USER_LOGIN/PLATFORM_VERIFY/AUTH_SUCCESS） |
| 探针 | DouyinIdentityProbe：页面特征(A) + Cookie(B) + hydration 身份(C) | ✅ 三信号（不靠单一 URL）；❌ 无 PLATFORM_VERIFY 状态显式建模（verificationRequired 仅 getLoginStatus 透出，未入状态机） |
| 指标读取 | fetchMetrics: 数据概览页文本解析（粉丝/获赞/作品） | ✅ 真实数据不 mock；❌ 本 Sprint 冻结（G4 之后再说） |
| 自动发布/回复 | publish/schedule/reply 全部诚实 failed（禁止事项） | ✅ 符合掌柜冻结清单 |

### 2.4 EnterpriseChannelAccount（Prisma, 7533 行起）
- 身份字段齐全：channelType/channelName/externalAccountId/credentialEncrypted/connectionStatus/organizationId/ownerId/metadata
- ✅ `@@unique([tenantId, channelType])`（每租户每渠道一个账号）
- ✅ metadata 已存 avatar/permissionLevel/boundAt/deviceTrusted/lastVerifiedAt（Channel Identity Trust Completion）
- ❌ 无 browserWorkspaceId 概念（Task 05 由 AgentChannelBinding 加）

### 2.5 AgentChannelBinding（Prisma, 7075 行起）
- agentInstanceId + channelAccountId + permissions + status + publishCount/scheduleCount
- ✅ `@@unique([agentInstanceId, channelAccountId])`
- ❌ **无 browserWorkspaceId**（Task 05 核心缺口：Alice 拥有「宏图抖音工作空间」需要 workspace 维度绑定）

### 2.6 EnterpriseAgentInstance / Hermes
- EnterpriseAgentInstance: 每 AI 员工一个实例（tenantId/organizationId/employeeId/runtime/openclaw/namespace）
- HermesProfileBinding: 员工 → Hermes 子代理身份（soulMdContent/toolAllowList/memoryNamespace）
- ❌ **AI 员工无渠道执行入口**：agent-runtime 中没有任何调用 channelService.resolveAdapter() 的路径（grep 确认 0 命中）；渠道操作目前只通过 HTTP 路由（enterprise-channel-runtime.ts）由人/前端触发，未接入 AI 员工任务执行链

### 2.7 路由层（src/routes/enterprise-channel-runtime.ts, 296 行）
| 路由 | 用途 | 审计 |
|------|------|------|
| POST /runtime/:id/connect | 打开浏览器会话 | ✅ 真实执行 |
| GET /runtime/:id/metrics | 读取真实指标（?agentInstanceId= 触发权限校验） | ✅ L1 权限已接 |
| GET /runtime/browser/:sessionId/status | 登录轮询（qr/screenshot/verificationRequired） | ✅ 前端连接流程在用 |
| POST /runtime/:id/confirm-binding | 人工确认绑定（SaaS 授权事件） | ✅ 已实现 |
| GET /runtime/:id/runtime-health | 浏览器/Profile/会话健康 | ✅ 已实现（前端卡片待接） |
| GET /runtime/:id/identity-probe | 探针透出 | ✅ |
| POST /runtime/:id/refresh-credential | 凭证续期 | ✅ |

## 3. 掌柜审计问题逐项回答

### Q1: 当前 profile 存储位置？
`/data/browser-profiles/<platform>/<accountId>`（env 可覆盖）。持久化真实 Chrome user-data-dir。**缺陷：无 organizationId 层级**，多企业同平台账号目录仅靠 accountId 区分（accountId 是 UUID，隔离实际成立，但目录结构未表达企业归属，备份/迁移/清理无法按企业操作）。

### Q2: 浏览器生命周期管理？
内存 Map + ChannelBrowserSession 表。**缺陷**：(a) closeAll 无调用点，服务重启浏览器进程可能孤儿；(b) 状态机不完整（无 DESTROYED）；(c) 无「启动时按需拉起、空闲自动回收」策略。

### Q3: 多企业隔离情况？
账号数据层隔离成立（tenantId + organizationId 在 EnterpriseChannelAccount）。浏览器层：profile 目录按 accountId 隔离（UUID 不碰撞）。**缺陷**：BrowserWorkspace 无 organizationId 显式建模，目录结构未按企业分层。

### Q4: 多账号并发风险？
Chromium profile 锁保证同账号串行。多账号并发 = 多浏览器进程，**无资源上限 Gate、无并发数统计**。风险：内存/CPU 失控（每浏览器 ~300MB）。

### Q5: AI 员工调用入口？
**不存在**。渠道能力目前仅 HTTP 路由（人工/前端触发）。AI 员工（EnterpriseAgentInstance + Hermes）无任何渠道执行调用链。这是本 Sprint 最大缺口——Browser Workspace 建成后必须提供 `agent → workspace → skill → runtime` 执行入口。

## 4. 与掌柜蓝图差距矩阵

| 掌柜 Task | 现状 | 差距 |
|-----------|------|------|
| Task 01 BrowserWorkspace SSOT | 无此模型（有 ChannelBrowserSession 雏形） | 新增模型：organizationId + channelAccountId(unique) + workspaceType + profilePath + status(CREATED/READY/RUNNING/ERROR/DESTROYED) + browserVersion + lastStartedAt/lastHealthCheckAt/lastError |
| Task 02 BrowserWorkspaceRuntimeService | BrowserRuntimeService 已用 launchPersistentContext | 重命名/封装：createWorkspace/startWorkspace/stopWorkspace/restartWorkspace/healthCheck/destroyWorkspace；目录加 organizationId 层级 |
| Task 03 BrowserAuthSession 状态机 | 有 loginStage（waiting_scan/scan_confirming/verifying/awaiting_confirmation/connected）+ verificationRequired | 升级为持久化状态机：INIT→OPEN_BROWSER→WAIT_USER_LOGIN→PLATFORM_VERIFY→AUTH_SUCCESS/FAILED/EXPIRED；PLATFORM_VERIFY 已部分实现（安全验证卡片已上线） |
| Task 04 ChannelLoginProbe | DouyinIdentityProbe 已实现（三信号） | 已有 80%；抽象 LoginProbe 接口 + 平台注册表已存在（identityProbeRegistry） |
| Task 05 AgentChannelBinding + browserWorkspaceId | binding 无 workspace 字段 | 加列 browserWorkspaceId + 关系 |
| Task 06 Platform Skill 系统 | 无 channel-skills/ 目录 | 新建 skills/douyin|xiaohongshu|wechat SKILL.md |
| Task 07 ChannelOperationLog | 无 | 新模型 + 唯一约束(workspaceId+action+target) |
| Task 08 BrowserTrajectory | 无 | 新模型（AI 操作轨迹实时可见） |
| Task 09 Reality Gate G1-G6 | 部分可测（G2 抖音登录可测） | G3（重启保留登录态）可测；G4/G5/G6 需 Task 05-08 完成后 |

## 5. 执行顺序建议（掌柜冻结：小步快跑，每 Task 部署+Reality Test）

```
Task 01 (SSOT 模型) → 部署 → Reality: prisma migrate + workspace CRUD
  → Task 02 (Runtime 服务) → 部署 → Reality: create/start/stop/health
  → Task 03 (AuthSession 状态机) → 部署 → Reality: 登录全流程状态迁移
  → Task 04 (探针抽象) → 部署 → Reality: probe 三信号
  → Task 05 (AI 绑定) → 部署 → Reality: Alice→workspace→account 链
  → Task 06 (Skills) → 部署 → Reality: skill 加载
  → Task 07 (OperationLog) → 部署 → Reality: 唯一约束防重复
  → Task 08 (Trajectory) → 部署 → Reality: 轨迹实时
  → Task 09 (G1-G6 全 Gate)
```

## 6. 冻结清单（本 Sprint 内禁止）
❌ fetchMetrics 接入 AI 建议 ❌ AI 运营建议 ❌ 多渠道复制 ❌ 自动发布/回复 ❌ 修改浏览器指纹欺骗平台 ❌ 自动破解验证码 ❌ 模拟真人规避风控
✅ 允许：用户授权后长期浏览器工作空间 / 每企业每账号独立环境 / 登录态持久化 / 授权范围内 AI 工作 / 可审计操作轨迹

## 7. 不破坏原则
- 现有 Channel Runtime（BrowserRuntimeService/DouyinBrowserAdapter/ChannelBrowserSession）**全部保留**，只做增量升级
- BrowserWorkspace 作为新抽象层叠加，ChannelBrowserSession 保留兼容（或迁移）
- 不删除任何已部署路由

---

**审计范围文件：**
- src/services/media/browser-runtime.service.ts（502 行）
- src/services/enterprise/channel-browser-session.service.ts（136 行）
- src/enterprise/channel/adapters/douyin-browser.adapter.ts（692 行）
- src/enterprise/channel/adapters/douyin-identity.probe.ts（116 行）
- src/enterprise/channel/channel.adapter.ts（193 行）
- src/services/enterprise/channel.service.ts（799 行）
- src/routes/enterprise-channel-runtime.ts（296 行）
- prisma/schema.prisma（EnterpriseChannelAccount/ChannelBrowserSession/AgentChannelBinding/EnterpriseAgentInstance/HermesProfileBinding/ChannelVerificationSession）
