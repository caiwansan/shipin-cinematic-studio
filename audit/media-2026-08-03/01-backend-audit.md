# 后端审计发现

> 审计范围：/root/shipin-cinematic-studio/backend/src 下新媒体渠道后端（路由层 / 浏览器运行时 / 企业渠道 / 关联服务 / channel-skills）
> 审计方式：逐文件通读 + 注册链核对（index.ts）+ 数据流核对
> 严重度定义：[H] 可直接被利用的安全漏洞或系统性缺陷；[M] 有条件利用/中等影响；[L] 轻微；[I] 信息/架构/死代码

---

## 1. 高危 [H]（10）

**[H-01] 跨租户账号读取/创建（tenantId 校验缺失）**
- 文件: `routes/enterprise-channel-runtime.ts:80-90`（account-status）、`:114-133`（ensure-account）
- 描述: 两个路由均 `prisma.enterpriseChannelAccount.findFirst({ where: { channelType: platform } })`，**没有任何 tenantId/organizationId 过滤**。`ensure-account` 创建账号时 tenantId 取 `user?.tenantId || user?.id || 'default'`（`:112`），无企业身份用户会落到共享租户 `'default'`。
- 影响: 任意登录用户可读取**全平台任意租户**第一个抖音/小红书等渠道账号的连接状态；自动创建账号时可能复用/覆盖共享租户资源，跨租户数据污染。
- 建议: 所有查询必须带 `tenantId: user.tenantId` 且禁止 `'default'` 兜底；`findFirst` 改为 `findFirst({ where: { channelType, tenantId } })`。

**[H-02] 渠道 Runtime 全链路 IDOR：账号级越权（含凭证覆写 = 渠道账号接管）**
- 文件: `services/enterprise/channel.service.ts:207(connectChannel)、293(waitChannelLogin)、350(confirmChannelBinding)、467(fetchMetrics)、484(refreshChannelCredential)、528(getChannelHealth)、547(getRuntimeHealth)、96/103(getPermissionLevel/setPermissionLevel)、686(getAccountById)`；路由 `routes/enterprise-channel-runtime.ts:25-335` 直接透传 `:id`。
- 描述: 所有方法都只 `findUnique({ where: { id } })`，**从不校验 account 的 tenantId/organizationId/ownerId**。攻击链示例：
  1. 攻击者 A 调 `POST /api/enterprise/channels/runtime/<受害者账号id>/connect` → 打开受害者账号的持久化浏览器 → 用 A 自己的抖音扫码登录；
  2. `POST .../confirm-binding` → 探针把 A 的 identity 写入受害者账号记录；
  3. `POST .../refresh-credential` → A 的 cookie 被 AES 加密写入受害者账号 `credentialEncrypted` → **受害者渠道账号被 A 完全接管**；
  4. `POST .../permission` 可将任意账号提升到 L3（发布权限）。
- 影响: 渠道账号接管、伪造绑定、权限提升、任意账号指标/健康信息读取。属于最严重越权。
- 建议: service 层统一增加 `assertAccountBelongsTo(accountId, tenantId/orgId)`；所有路由从 JWT 取 tenantId 并与资源归属比对（或由全局 Tenant Guard 注入后强制使用）。

**[H-03] 渠道 Capability 鉴权中间件形同虚设（默认放行）**
- 文件: `services/enterprise/channel/channel-permission.service.ts:80-102(check)、109-119(getGovCapabilities 恒返回 [])`；`routes/enterprise-channel.ts:32-57(中间件)`
- 描述: `getGovCapabilities()` 是 TODO stub 恒返回 `[]`，导致 `check()` 中 `if (govCapabilities.length > 0)` 永不成立 → capability 校验永远跳过；中间件调用 `check()` 时又**从不传 `channelAccountId`** → `checkOrgScope` 也被跳过 → 只要用户是 URL 中 tenantId 的 govUser，`check` 恒 `allowed:true`。
- 影响: 所谓「Capability-based permission check（所有 Channel API）」完全失效，任意租户成员可 connect/disconnect/sync/verify 全部渠道操作。
- 建议: 接入真实 Role/Capability 关联表；中间件对每个资源路由传 `channelAccountId` 做归属校验；未知路由默认拒绝（见 M-12 默认放行问题）。

**[H-04] 企业微信渠道账号详情/操作接口 IDOR + 明文凭证泄露**
- 文件: `routes/enterprise-channel.ts:178-183(GET accounts/:id)、185-215(connect/disconnect)、272-282(interactions/stats、verify)、355-363(sync-logs)、370-378(dlq)、640-666(identities assign/delete)、sentiment/trace`；`services/enterprise/channel/channel-account.service.ts:133-146(getAccount 无 select 过滤)`
- 描述: 所有 `:id` 资源操作仅按 id 查询/更新，**不校验资源是否属于 URL 中的 tenantId**；且 `getAccount` 用 `findUnique` 不带 select，返回**完整记录（含 credentialEncrypted，而该字段当前为明文 JSON，见 H-05）**，`data` 原样返回前端。
- 影响: 跨租户读取任意渠道账号（含企微 corpId/secret/token 明文）、跨租户断开/验证/改状态/删客户身份。
- 建议: 所有 get/update/delete 增加 tenantId 条件（findFirst({id, tenantId})）；响应层剥离 credentialEncrypted/credentials 字段（只服务端内部使用）。

**[H-05] 企微渠道凭证明文落库（字段名 credentialEncrypted 实为明文）**
- 文件: `services/enterprise/channel/channel-account.service.ts:33-36(createWithOwnership)、85-88(createAccount)`
- 描述: `credentialEncrypted = JSON.stringify({ _v: 1, _encrypted: false, ...input.credentials })`——客户端提交的 corpId/secret/token 等**明文 JSON 直接存入**名为 encrypted 的字段，注释还写着 `TODO: 接入真实 AES-256 加密`。与 channel.service.ts 的 AES-256-GCM 加密流程（connectAccount/updateCredential）形成两套不一致的凭证体系。
- 影响: DB 泄露即企微 API 完全控制（发消息/读客户）；违反「禁止明文存储凭证」冻结规则；且 `_encrypted:false` 使前端/审计可识别。
- 建议: 统一走 crypto.service encryptKey（同 channel.service 的 `{cipher, payload}` 格式）；迁移存量明文数据。

**[H-06] 企业微信回调 POST 未验签（msg_signature 只查存在不校验）**
- 文件: `enterprise/channel/wecom-callback.controller.ts:68-108`
- 描述: 回调 POST 仅检查 `msg_signature/timestamp/nonce` 三个 query 参数**是否存在**，随后直接 `decryptWeComMessage(credentials.encodingAESKey, body.Encrypt, corpId)`，**从不调用 `verifyEventSignature`/`verifyWeComSignature` 校验签名**（wecom-crypto.ts 已有该函数却未用）。且账号选取为 `findFirst({ where: { channelType:'wechat_work', connectionStatus:'CONNECTED' } })`（`:74-80`）全局取第一条，无租户维度。
- 影响: 任何掌握 encodingAESKey 的人可伪造任意事件 → 触发 `callbackEventService.processEvent` → 写入 interaction、解析客户身份、并经 `interaction-signal.service.ts` 关键词命中**自动创建 P1 动作**（见 M-08）；多租户部署时回调归属歧义。
- 建议: POST 必须用 `verifyEventSignature(token, msg_signature, timestamp, nonce, Encrypt)` 校验；账号查询带租户标识（URL/域名/路径参数 + 白名单校验）。

**[H-07] 企微 Token 管理接口完全无鉴权（未注册任何 auth hook）**
- 文件: `enterprise/channel/wecom-callback.controller.ts:112-168`；注册点 `index.ts:357`（`app.register(..., { prefix: '/api/enterprise/wecom' })`，无 auth 选项）
- 描述: `GET /api/enterprise/wecom/token/stats`、`POST /api/enterprise/wecom/token/invalidate/:channelAccountId`、`GET /api/enterprise/wecom/token/health/:channelAccountId` 三个接口**无任何 JWT/权限校验**（全局仅限流+helmet）。
- 影响: 任何人可：① 失效任意渠道账号的企微 access_token（业务 DoS，invalidate 还会把账号置 ERROR）；② 触发服务端向企微发起真实 API 调用（token 拉取，消耗凭证额度）；③ 读取 cache 统计（泄露 corpId 列表）与账号 connectionStatus/lastError。
- 建议: 增加 `app.authenticate` + 租户归属校验；invalidate/health 限制为管理员。

**[H-08] Browser Workspace 全接口 IDOR + 跨租户账号误用**
- 文件: `routes/browser-workspace.routes.ts:87/101/132/147/164/182/198(findById(id) 无 org 校验)、59-65(create 时 findFirst({channelType:'douyin'}) 无租户过滤)、205-255(owner-view 对无 organizationId 用户展示全部租户 workspace)`
- 描述: 所有 `workspaces/:id/*`（详情/start/stop/restart/health/operation-logs/trajectory/DELETE）只按 id 查 workspace，**不校验 organizationId**。DELETE `?deleteProfile=true` 会 `fs.rmSync(profilePath, {recursive:true})` 删除浏览器 profile 目录（`services/media/browser-runtime.service.ts:127-136`）。创建接口在未传 channelAccountId 时取**全租户第一条抖音账号**并为其建 workspace。
- 影响: 跨租户启动/停止/销毁他人 AI 员工工作电脑（含物理删除其登录态 profile）、读取操作日志与轨迹；未绑定企业用户（orgId='default'）可看到全部租户 workspace 列表。
- 建议: 所有操作前 `workspace.organizationId === ctx.organizationId` 校验；无 org 用户禁止 owner-view 全局视图；create 的兜底查询必须带 tenantId。

**[H-09] 生产链路注册了返回假数据的 Mock 适配器（视频号/微博/B站/QQ）**
- 文件: `enterprise/channel/extended.adapter.ts:30/39/48/50(VideoAccount)、64-82(Weibo)、96-114(Bilibili)、128-146(QQ)`；注册点 `index.ts:480-483`
- 描述: 四个适配器 `fetchMetrics` 返回硬编码假数据（如 8500 粉丝），`publish()` 直接 `status:'success'` + 伪造 URL，`reply()` 恒返回 true。它们被注册进 `channelService.registerAdapter`，与真实 Runtime 共用 `resolveAdapter`。而项目多处声明「读取真实核心指标，禁止 mock」「自动发布 Task 阶段禁用」。
- 影响: 通过 runtime metrics 接口给平台为 video_account/weibo/bilibili/qq 的账号返回**假数据**；`channelService.publish`（channel.service.ts:762）对这类平台会**假发布成功**；违背「诚实状态」产品原则，AI 运营基于假数据决策。
- 建议: 删除或禁用这四个 stub 注册（Task 阶段一律返回未实现/failed），只在显式开发环境注册。

**[H-10] CRYPTO_ENCRYPTION_KEY 未配置时自动生成并打印到日志（密钥泄露 + 重启即丢数据）**
- 文件: `services/crypto.service.ts:15-22`
- 描述: 未设置 `CRYPTO_ENCRYPTION_KEY` 时自动生成随机密钥，并通过 `console.error('[Crypto] 请设置环境变量: CRYPTO_ENCRYPTION_KEY=' + key)` **把明文密钥打到日志**；且该密钥仅存内存，进程重启后旧密文（含渠道 cookie 凭证）**全部无法解密**。
- 影响: 日志可读者获得密钥 → 解密全部 credentialEncrypted 凭证；未配置环境下重启 = 所有渠道登录态永久丢失（服务降级）。
- 建议: 启动时强制要求环境变量，缺失直接 fail-fast（不自动生成）；日志严禁输出密钥；密钥托管到 KMS/Secret Manager。

---

## 2. 中危 [M]（15）

**[M-01] 登录接口响应体泄漏到 API 响应**
- 文件: `enterprise/channel/adapters/douyin-browser.adapter.ts:524-536`
- 描述: `fillCodeAndLogin` 监听页面 `response`，把 `/sms|verify|login|passport|check|code|phone|captcha/` 请求的**响应体前 250 字符**拼进返回值 `resp:[...]`，经 `POST .../code` 路由原样返回前端。
- 影响: 抖音内部接口响应（可能含 token/session 片段）泄漏给客户端，且被日志/前端调试面板留存；响应体还可能被带到下游日志。
- 建议: 仅记录状态码与 URL，不记录响应体；debug 输出增加脱敏与开关。

**[M-02] 短信验证码发送无频率限制（短信轰炸）**
- 文件: `routes/enterprise-channel-runtime.ts:212-224(send-code)`；`enterprise/channel/adapters/douyin-browser.adapter.ts:388-430(clickSendCode)`
- 描述: `POST /api/enterprise/channels/runtime/browser/:sessionId/send-code` 可被任意登录用户重复调用（前端轮询间隔不限），adapter 连续 6 秒轮询重试；无每账号/每手机号/每 IP 限流。
- 影响: 对目标手机号短信轰炸（平台短信通道消耗 + 骚扰）；sessionId 可猜（`douyin:<accountId>`）→ 可针对任意账号触发。
- 建议: 按 session/账号/手机号加滑动窗口限流（如 60s 一次），并校验 session 归属。

**[M-03] fetchMetrics/fetchComments 关闭共享持久化浏览器实例（打断登录/竞态）**
- 文件: `enterprise/channel/adapters/browser-channel.adapter.ts:658`、`douyin-browser.adapter.ts:630、679`
- 描述: `fetchMetrics`/`fetchComments` 结尾 `browserRuntime.close(sid)`；但前面是 `getOrCreatePersistent`（**已存在实例则复用**）。若用户正在扫码登录（connect 已拉起实例），任何指标读取会**直接关掉登录中的浏览器**，登录流程中断；并发 metrics 与登录轮询互相杀实例。
- 影响: 登录体验断裂、状态机回退、重复开浏览器；高并发下实例反复销毁重建。
- 建议: 读取指标改为复用实例不关闭（或按需使用独立 sessionId）；关闭动作交给显式生命周期（workspace stop）。

**[M-04] 浏览器实例与状态机 Map 永不清理（资源/内存泄漏）**
- 文件: `services/media/browser-runtime.service.ts:47(instances Map)、568-573(closeAll 无人调用)`；`enterprise/channel/adapters/browser-channel.adapter.ts:29-37(stateMachines Map 无清理)`
- 描述: `closeAll()` 全项目无调用方；无空闲超时回收（如 30min 无操作自动 close）；无进程退出钩子。adapter 的 `stateMachines` 按 sessionId 累积永不删除。
- 影响: 长期运行后 Chromium 进程堆积（每实例数百 MB）、内存泄漏、到达系统 fd/进程上限后所有浏览器操作失败。
- 建议: 增加空闲 TTL 回收 + `process.on('exit')`/SIGTERM 钩子调用 closeAll；状态机 Map 在会话关闭时删除条目。

**[M-05] Token 缓存按 corpId 键控而非租户隔离 + corpSecret 出现在 URL**
- 文件: `enterprise/channel/token.service.ts:92/126/169(cacheKey = credential.corpId)、186-188(fetchToken 把 corpsecret 拼进 query)`
- 描述: 注释声称「租户隔离：每个 channelAccountId 对应独立 Token Cache」，实际缓存键是 **corpId**。同一企业微信 corp 下不同 agentId/secret 的多个渠道账号会共用/互相覆盖 access_token；`getToken` 的 refresh 回调闭包绑定了首次加载的 credential，缓存续期可能用错凭证。同时 `?corpid=...&corpsecret=...` 明文出现在出站 URL（代理/网关/日志可见）。
- 影响: 跨账号 token 错用（消息发到错误 agent）、凭证在 URL 中泄露。
- 建议: 缓存键改为 `channelAccountId`（或 corpId+agentId）；corpsecret 改为 POST body/header 传递。

**[M-06] WeComAdapterService 单例可变状态（跨账号串号）+ initialize 读取格式不匹配**
- 文件: `services/enterprise/channel/wecom-adapter.service.ts:20-23(isInitialized/channelAccountId 实例字段)、60-76(initialize 直接 `account.credentialEncrypted as any` 取 corpId 不做解析)、142-160(sendMessage/syncCustomers stub)`
- 描述: 该 service 是导出单例，`initialize(accountId)` 写入实例字段——两个账号交替操作会互相覆盖（`this.isInitialized`/`this.channelAccountId` 全局漂移）；`initialize` 把 Json 字段当对象直接用（企微凭证经 H-05 明文 JSON **字符串**存储时 `creds.corpId` 为 undefined → 恒 false）。`connect` 路由（routes/enterprise-channel.ts:185-203）`JSON.parse(account.credentialEncrypted)` 对对象/字符串两种格式都可能抛 500，且解析结果 `credentials` 从未使用（死变量）。
- 影响: 企微连接流程实际不可用/不稳定；多账号并发时状态串扰。
- 建议: 去掉单例可变状态（改为按调用传参/每次 new）；统一凭证格式解析函数；删除死变量并修复 connect 路由错误处理。

**[M-07] 回调去重存在竞态 + eventId 弱哈希碰撞**
- 文件: `enterprise/channel/callback-event.service.ts:283-307(checkDuplicate findFirst 后无冲突处理)、407-435(generateEventId 简易 hash)`
- 描述: `processWithRetry` 先 `checkDuplicate`（findFirst）再 `processedEvent.create`，两步非原子——并发相同事件双双通过检查，一个 insert 抛 P2002 被外层 catch → 重试 → **死信**（误报失败）；`generateEventId` 为 32 位简易 hash，不同事件可能同 ID → 合法事件被去重丢弃。
- 影响: 高并发回调下事件误入 DLQ、真实事件丢失。
- 建议: 依赖数据库唯一约束 + create 时 catch P2002 直接判定 duplicate；eventId 使用 msgid 或强哈希（sha256 截断）。

**[M-08] 互动信号自动创建 P1 动作（无人工确认）+ 去重键过粗**
- 文件: `enterprise/channel/interaction-signal.service.ts:57-99(analyzeAndTrigger)、155-162(autoCreateAction: true)`
- 描述: 内容命中「采购/报价/签约」等关键词 ≥2 即自动 `actionLifecycleService.createActionsFromDecision` 创建 P1 动作（owner 直接置 tenantId）。且 dedup 仅按 `(tenantId, signalType, status='active')` 查第一条——同类型任意活跃信号存在即跳过创建、仅追加 evidence，可能把不同客户的事件合并到同一信号。
- 影响: 伪造/误命中内容 → 自动生成高优先级动作并派发任务；信号归并错乱影响决策。
- 建议: 自动建动作改为「生成建议 + 人工确认」；去重键增加客户维度（externalId/interactionId）。

**[M-09] 未知路由默认放行 CHANNEL_READ（默认允许而非默认拒绝）**
- 文件: `routes/enterprise-channel.ts:130(return ChannelCapability.CHANNEL_READ // 默认)`
- 描述: `getRequiredCapability` 对未匹配的任何新路由默认返回 CHANNEL_READ（读权限），且该检查本身已失效（H-03）。新增端点忘记登记 = 自动获得读取权限。
- 影响: 新增接口默认暴露读能力，安全边界脆弱。
- 建议: 未知路由默认返回 null（拒绝）并显式登记；修复 H-03 后此默认才真正生效。

**[M-10] channels.ts 绑定列表接口 IDOR（跨租户读绑定）**
- 文件: `routes/channels.ts:106-119`
- 描述: `GET /api/enterprise/channel-accounts/:id/bindings` 直接 `channelBinding.findMany({ where: { channelAccountId: id } })`，**未先校验该 channelAccount 属于当前 orgId**（同文件其他接口都先查归属）。
- 影响: 任意登录用户可枚举读取任意渠道账号的 AI 员工绑定关系（含 agentInstanceId、权限、状态）。
- 建议: 先 `findFirst({ id, organizationId: orgId })` 校验归属。

**[M-11] 微信回调 GET URL 验证取全局第一条 CONNECTED 企微账号 + 存储格式不匹配导致验签失败**
- 文件: `enterprise/channel/wecom-callback.controller.ts:33-42、74-80`
- 描述: GET 回调（URL 验证）同样全局 `findFirst` 取第一条 CONNECTED 企微账号；且 `credentials.token` 依赖 H-05 的明文对象格式——若账号凭证是 channel.service 的 `{cipher,payload}` 加密格式或字符串格式，`token/encodingAESKey/corpId` 为 undefined → 验签恒失败 → 回调配置无法完成。
- 影响: 多租户下回调落到错误账号；URL 验证功能与两种凭证存储格式不兼容。
- 建议: 回调账号通过显式配置（URL 前缀/域名）解析；凭证读取统一解密函数。

**[M-12] 登录状态轮询单次开销大 + 会话数无上限（资源耗尽风险）**
- 文件: `enterprise/channel/adapters/douyin-browser.adapter.ts:230-380(getLoginStatus)`、`browser-channel.adapter.ts:230-300`；`routes/enterprise-channel-runtime.ts:139-167(statusLocks)`
- 描述: 每次轮询执行：整页截图 + 二维码 DOM 扫描 + jsQR 解码 + 身份探针（2-3s 页面等待）+ debug 页面求值 + 可选 python 放大；前端 2.5s 轮询。路由层仅做同 session 串行化，**无全局并发上限**；`/media/accounts/connect`（若启用）每请求拉起一个浏览器也无配额。
- 影响: 多账号并发轮询可耗尽 CPU/内存/Chromium 实例，拖垮服务。
- 建议: 轮询节流（探针结果缓存 2s）、全局信号量限制并发浏览器数、空闲会话自动回收（M-04）。

**[M-13] 状态流转先置位后执行（失败不回滚）**
- 文件: `routes/browser-workspace.routes.ts:101-118(start)`
- 描述: start 路由先 `transition(id,...,'RUNNING')` 再 `browserRuntime.startWorkspace`；若浏览器拉起失败 catch 返回 400，但 DB 状态已 RUNNING，`lastError` 未写。
- 影响: 老板视图显示「工作中」而浏览器实际没起来（真实性问题，违背该项目自身的 Reality Gate 原则）。
- 建议: 先执行浏览器操作成功后再置 RUNNING，失败置 ERROR 并写 lastError。

**[M-14] 绑定接口接受未校验的 browserWorkspaceId（跨租户引用）**
- 文件: `services/enterprise/agent-channel-binding.service.ts:88-108(createBinding)`
- 描述: DTO 若带 `browserWorkspaceId` 直接落库，**不校验该 workspace 是否属于 dto.tenantId/orgId**；agent 与 channel 有校验，workspace 没有。
- 影响: 绑定可指向他人租户的工作电脑，后续 owner-view/轨迹/操作日志按此绑定串数据。
- 建议: `browserWorkspaceService.findById` 后校验 organizationId === channel.organizationId。

**[M-15] 回调/同步/统计服务资源级方法普遍无租户校验（IDOR 服务层）**
- 文件: `services/enterprise/channel/interaction-sync.service.ts:96-106(verifyInteraction)、119-131(updateTrustLevel)、178-200(getInteractionStats)`；`enterprise/channel/customer-identity.service.ts:194-210(assignInternalCustomer)、235-241(deleteIdentity)`；`enterprise/channel/interaction-feed.service.ts:236-244(storeSentiment)`
- 描述: 这些方法只按 interactionId/identityId 更新或查询，路由层（enterprise-channel.ts）也未先做归属校验（H-04 同源），任何登录用户可跨租户 verify 交互、分配客户、删除客户身份、标注情绪。
- 影响: 跨租户数据篡改/删除。
- 建议: 服务层方法增加 tenantId 参数并在 where 中限定；路由层统一资源归属中间件。

---

## 3. 低危 [L]（10）

**[L-01] humanType 逐字输入实现错误（重复字符截断 + O(n²)）**
- 文件: `services/media/browser-agent.adapter.ts:296-302`
- 描述: `for (const char of text) { locator.fill(text.substring(0, text.indexOf(char)+1)) }` —— `indexOf` 取**首次出现**位置，结尾重复字符（如「哈哈」「AA」）会导致最终值被截断；且每次 fill 全文前缀，复杂度 O(n²)。
- 影响: 标题/正文尾部重复字符丢失（小红书发布内容被截断）；性能浪费。
- 建议: 直接一次 `fill(text)` 或按索引遍历 `text[i]` 逐步 append。

**[L-02] executeAction 的 evaluate/upload 原语未暴露路由（潜在高危后门）**
- 文件: `services/media/browser-agent.adapter.ts:166-173(evaluate: page.evaluate(action.expression!))、178-189(upload: setInputFiles(action.filePath!))`
- 描述: 该服务支持任意 JS 求值与任意本地文件上传到页面，目前无路由调用 executeTask/executeAction（仅 publishXiaohongshuNote 被引用）。一旦未来接入 AI 任务编排且未收敛输入，即成为 RCE/任意文件读取通道。
- 影响: 潜在；需在接入时对 expression/filePath 做白名单与权限校验。
- 建议: 在接口层禁止 evaluate/upload 动作类型或要求 L3+ 人工审批。

**[L-03] 登录状态响应透出本地路径与页面文本样本**
- 文件: `enterprise/channel/adapters/browser-channel.adapter.ts:296-300(debug.pageTextSample)、douyin-browser.adapter.ts:319-321(debug.bodyText)`；`services/media/browser-runtime.service.ts:346(screenshotPath 绝对路径)`
- 描述: getLoginStatus 返回 `debug.pageTextSample`（页面文本 180 字）与截图本地绝对路径；抖音 debug 含 `bodyText.slice(0,800)`。
- 影响: 泄露服务器文件布局与登录页 DOM 文本（轻微信息泄露/便于调试攻击面分析）。
- 建议: 返回 base64 截图代替路径；debug 输出仅限内网/管理端。

**[L-04] 会话 cookie 明文落盘（/tmp/browser-sessions/*.json）**
- 文件: `services/media/browser-runtime.service.ts:482-499(saveSession/restoreSession)`
- 描述: saveSession 把完整 cookie JSON 明文写 `/tmp/browser-sessions/<sessionId>.json`（仅 0600 默认 umask 保护）；restoreSession 从该文件读取注入。当前仅未注册的 media-platform.ts 调用（潜在）。
- 影响: 本地/tmp 可读时泄露平台登录态；sessionId 可控时存在路径穿越（L-05）。
- 建议: 统一走加密凭证库；删除 saveSession/restoreSession 或加目录内路径白名单。

**[L-05] sessionId 路径穿越（文件写/读原语，潜在）**
- 文件: `services/media/browser-runtime.service.ts:482/492(path.join(SESSION_DIR, `${sessionId}.json`))、346/379/395(截图路径)`
- 描述: sessionId 未做净化直接拼路径，`launch('../../x')` + `saveSession` 可写出 SESSION_DIR（任意 JSON 文件写）；`restoreSession('../../x')` 可读任意 JSON 文件。当前入口只有未注册路由（潜在），但 `douyin:<accountId>` 形式的 sessionId 来自 URL 参数（enterprise-channel-runtime.ts 各 browser 路由），一旦将来任一路由调用 save/restore 即可利用。
- 影响: 潜在任意文件写/读（受 JSON 内容约束）。
- 建议: sessionId 白名单校验（`/^[a-z0-9_:-]+$/i`）。

**[L-06] 错误信息直接回显内部细节**
- 文件: `routes/enterprise-channel-runtime.ts:32-33/44-45/60-61/76-77/...`（多处 `message: e.message`）；`enterprise/channel/adapters/douyin-browser.adapter.ts:352(extractMetrics 错误含页面片段)`
- 描述: 所有 runtime 路由把 `e.message` 原样返回（浏览器错误、DB 错误、解密错误等），抖音指标解析失败错误含 `bodyText.slice(0,120)`。
- 影响: 内部实现/依赖/页面结构细节暴露，辅助攻击者。
- 建议: 统一错误码 + 脱敏 message；详细堆栈只进日志。

**[L-07] SKILL.md 与实现冲突：禁止改指纹 vs 代码主动伪装指纹**
- 文件: `channel-skills/douyin/SKILL.md:44-47(绝对禁止「修改浏览器指纹欺骗平台」)` vs `services/media/browser-runtime.service.ts:158-197(addInitScript 抹 webdriver/plugins/chrome、写死 hardwareConcurrency/deviceMemory/timezone)`
- 描述: 技能文档明确禁止指纹伪造与规避风控，运行时却主动隐藏自动化特征（`navigator.webdriver=undefined`、`window.chrome={runtime:{}}`、`Intl` 时区覆写、并发数写死 8）。
- 影响: 政策与实现背离，若用于规避平台风控存在合规/封号风险，也削弱审计可信度。
- 建议: 明确取舍：要么删除反检测注入，要么修订 SKILL 红线并增加风控触发告警。

**[L-08] 抖音二维码放大用 execSync 同步执行 python3**
- 文件: `enterprise/channel/adapters/douyin-browser.adapter.ts:277-307`
- 描述: 每轮轮询可能 `execSync('python3 -c "..."')`（阻塞事件循环；路径为 os.tmpdir()+时间戳，暂不可注入）；依赖服务器装有 python3+PIL，缺装时静默回退。
- 影响: 阻塞主线程（每轮最多约 1s）、环境依赖脆弱。
- 建议: 改用 sharp（已在 login-detector 使用）纯 Node 放大，删除 execSync。

**[L-09] waitForLogin 恢复导航可能打断扫码（异常恢复逻辑）**
- 文件: `enterprise/channel/adapters/douyin-browser.adapter.ts:111-135(waitForLogin catch 中 navigate 重开登录页)`
- 描述: 探针抛异常即重新 navigate 登录页——若异常仅因页面瞬态（SPA 跳转），会刷新掉已成功的扫码页，把用户踢回登录；且每 5s 一次重试，最长 5 分钟。
- 影响: 偶发登录中断、体验回退。
- 建议: 增加失败计数阈值（如连续 3 次异常才恢复导航）。

**[L-10] 图片 URL 提取 fetch 目标来自页面内容（潜在 SSRF 链）**
- 文件: `enterprise/channel/adapters/login-detector.ts:233-254(imgToBase64 对 https 图执行 fetch)`
- 描述: 二维码提取对 `https?://` 图片在页面上下文内 fetch。若浏览器被导航到攻击者页面（依赖未注册的 `/media/browser/navigate` 任意 URL 能力，见 I-01），攻击者可放 `<img src="http://内网地址">` 触发内网探测（SSRF 链）。
- 影响: 与任意导航能力组合后成为 SSRF；当前导航入口受限，风险受限。
- 建议: fetch 目标仅允许平台域名白名单；任意导航接口启用前必须做 URL 策略校验（项目已有 `utils/ssrf-protection.ts` 未使用）。

---

## 4. 信息 [I]（架构观察 / 死代码 / 设计说明）

**[I-01] routes/media-platform.ts 整个文件未注册（死代码，但含高危模式）**
- 位置: `routes/media-platform.ts`（全文件，index.ts 及各路由聚合处均无 import）
- 内容: ① `:54` 硬编码后门 `Authorization: Bearer demo-token / Bearer test` → 注入 demo 租户身份（auth 绕过）；② `/media/browser/navigate` 任意 URL 导航（SSRF）、`/media/browser/cookies` 直接返回会话 cookie、sessionId 无归属校验；③ `POST /media/accounts:124`、`POST /media/hotspots:220`、`POST /media/contents:258`、`POST /media/publish:314`、`POST /media/accounts/refresh-cookies:377` 引用**未定义变量 `orgId`**（handler 内从未声明）→ 恒 400/404，功能不可用；④ 登录确认流程把 cookie base64 当「加密」存入 vault。
- 结论: 该文件一旦被注册即同时引爆 auth 绕过 + SSRF + cookie 泄露 + 数据损坏。建议要么删除，要么按安全基线重写后再注册。

**[I-02] mediaPlatformService 的「加密」实为 base64（凭据落库明文等效）**
- 位置: `services/media/media-platform.service.ts:168-172(encryptCredential = Buffer.from(data).toString('base64'))、186-204(refreshCookies 原样存 encryptedPayload)`
- 说明: `media_credential_vault.encrypted_payload` 存 base64 的浏览器 cookie JSON；客户端可提交任意 payload 覆盖（无服务端校验/加密）。仅被 I-01 死代码调用，但作为「凭证加密存储」样板存在，风险高。

**[I-03] 两套渠道凭证存储格式并存**
- 说明: `channel.service.ts`（AES-256-GCM `{cipher,payload}`，抖音/浏览器渠道）与 `channel-account.service.ts`（明文 JSON `{_v:1,_encrypted:false}`，企微渠道）并存；`token.service.loadCredential`、`wecom-adapter.service.initialize`、`wecom-callback.controller` 均假定「对象含 corpId」格式，对加密格式/字符串格式会静默失败。凭证读取应统一收敛到单一解密入口。

**[I-04] 微信回调存在两个重复端点且行为不一致**
- 位置: `routes/enterprise-channel.ts:341-347(POST /api/channels/wechat-work/callback/:accountId，但被插件级 authenticate 保护（:20）→ 企微服务器无法调用，实际不可用)` vs `enterprise/channel/wecom-callback.controller.ts:68(/api/enterprise/wecom/callback，无鉴权可用)`
- 说明: 前者标注「public endpoint, no auth」却挂在有 authenticate hook 的插件下（401），属死端点/文档与实现不符；后者才是生效回调。建议删除前者并统一签名校验。

**[I-05] 未注册/未被调用的死代码清单**
- `services/media/browser-agent.adapter.ts` 的 `executeTask/executeAction/loginXiaohongshu`（仅 publishXiaohongshuNote 被引用）
- `enterprise/channel/mock.adapter.ts` MockChannelAdapter（全项目无注册）
- `enterprise/channel/channel-provider.service.ts` 的 `register/seedProviders`（无路由调用？待确认注册点）
- `routes/media-platform.ts` 全部（见 I-01）
- `services/enterprise/channel/wecom-adapter.service.ts` 的 `sendMessage/syncCustomers/handleCallback`（TODO stub）
- `enterprise/channel/wecom-adapter.ts` 的 `connect/send/receive`（send 需 config 恒 NOT_CONNECTED，实际不可达）
- `channel-account.service.ts` 的 `testConnection`（恒失败 stub）

**[I-06] 平台配置与适配器注册不一致**
- 位置: `enterprise/channel/adapters/browser-channel.meta.ts` 定义 8 平台，`browser-channels.ts:19` 仅注册 `['kuaishou','xiaohongshu','channels_wechat']`；`CONNECTABLE_PLATFORMS` 含 `wechat_mp` 但无适配器 → 前端可点、后端 connect 报「未注册渠道适配器」；weibo/toutiao/baijiahao 有 meta 无适配器（且有 H-09 假适配器同名冲突：weibo 平台会命中 extended.adapter 的假 WeiboAdapter）。
- 建议: 平台列表与注册表单一事实源对齐，未接入平台前端置灰。

**[I-07] 扫码登录 → 确认绑定 → 凭证回写 数据流（整体评价）**
- 链路: `connectChannel`（开持久化浏览器+探针）→ 前端轮询 `getLoginStatus`（screenshot/qrCode/probe 多信号）→ 用户扫码 → `wait-for-login`（adapter.waitForLogin 轮询探针）→ `confirm-binding`（探针复核+回写 identity+refreshCredential 落库）→ `refresh-credential`（Reality Gate 探针复核后 AES 落库）。
- 优点: 探针多信号（页面特征/Cookie/身份提取）判定登录态、拒绝「仅 cookie 残留」假登录、凭证加密落库、绑定需人工确认，设计上是对的。
- 缺陷: 整条链路**缺少租户归属校验**（H-02），且「确认绑定」路由无 CSRF/二次校验（同一账号 id 谁都能点）；`wait-for-login` 路由在 connected 后自动 `refreshChannelCredential`（enterprise-channel-runtime.ts:192-199），把「确认」前置为自动流程的一部分，削弱人工确认意义。

**[I-08] token/service 状态机与健康报告设计良好但落地不完整**
- 说明: `login-state-machine.ts` 的 TRANSITIONS 白名单 + 非法迁移告警、`browser-auth-session.service.ts` 的授权状态机、`channel.service.getRuntimeHealth` 三态健康、`getLoginStatus` 的 loginStage 统一映射——结构清晰；但状态机实例生命周期未管理（M-04）、auth-session `latest()` 无租户校验（IDOR，随 H-02 修复一并处理）。

**[I-09] 「确认绑定」无操作审计写入（除 ChannelVerificationSession 外）**
- 说明: confirmChannelBinding 写 metadata.boundAt 与 verification session，但未写 `channelOperationLog`/`governanceAuditService`；与项目「每个操作记录审计日志」原则不完全一致（channels.ts 旧链路有 channelAuthorizationLog）。

**[I-10] 权限模型双轨（L1-L3 与 AgentChannelBinding permissions）职责边界不清晰**
- 说明: `channel.service` 的 PERMISSION_MATRIX（账号级 L1/L2/L3）与 `agentChannelBindingService.authorize`（绑定级 read/reply/execute）两套并存：`fetchMetrics` 先走 binding 校验（有 agentInstanceId 时）再走 L1 Gate；`publishWithPermission` 同理。语义重叠且 L3 可被 H-02 越权设置，建议收敛为单一授权入口。

**[I-11] 环境安全配置建议（未在代码中体现）**
- 说明: 浏览器以 `--no-sandbox` 运行（browser-runtime.service.ts:71-75、131-135），进程为 root 时风险高；`BROWSER_CDP_PORT` 开启时（诊断用）等价暴露远程调试端口（可接管浏览器/读 cookie），需确保仅内网且认证保护；建议容器内降权 + 关闭 CDP 或加 token。

---

## 审计覆盖清单（实际通读文件）

**路由层（6）**
- routes/enterprise-channel-runtime.ts（335 行）
- routes/enterprise-channel.ts（771 行）
- routes/enterprise-channel-center.routes.ts（341 行）
- routes/channels.ts（347 行）
- routes/browser-workspace.routes.ts（342 行）
- routes/media-platform.ts（546 行）

**浏览器运行时（4）**
- services/media/browser-runtime.service.ts（587 行）
- services/media/media-platform.service.ts（262 行）
- services/media/browser-agent.adapter.ts（369 行）
- services/media/platform-adapter.ts（123 行）

**企业渠道 enterprise/channel/（18）**
- callback-event.service.ts（654）、channel-adapter.interface.ts（119）、channel.adapter.ts（193）、customer-identity.service.ts（429）、extended.adapter.ts（150）、identity-probe.ts（70）、interaction-feed.service.ts（382）、interaction-signal.service.ts（240）、login-state-machine.ts（128）、mock.adapter.ts（131）、token-cache.ts（168）、token.service.ts（358）、wecom-adapter.ts（308）、wecom-callback.controller.ts（218）、wecom-client.ts（177）、wecom-crypto.ts（148）

**enterprise/channel/adapters/（7）**
- browser-channel.adapter.ts（665）、douyin-browser.adapter.ts（764）、login-detector.ts（356）、browser-channel.meta.ts（362）、browser-channel.probe.ts（196）、douyin-identity.probe.ts（153）、browser-channels.ts（49）

**services/enterprise/channel/（5）**
- channel-account.service.ts（215）、channel-customer-mapping.service.ts（114）、channel-permission.service.ts（156）、interaction-sync.service.ts（233）、wecom-adapter.service.ts（133）

**关联服务（8）**
- services/enterprise/browser-auth-session.service.ts（115）、browser-trajectory.service.ts（88）、browser-workspace.service.ts（199）、channel-browser-session.service.ts（136）、channel-operation-log.service.ts（108）、channel-provider.service.ts（117）、channel.service.ts（899）、agent-channel-binding.service.ts（226）

**channel-skills/（3）**
- channel-skills/douyin/SKILL.md、channel-skills/xiaohongshu/SKILL.md、channel-skills/wechat/SKILL.md

**辅助核对（非全量通读，用于注册链/格式确认）**
- index.ts（路由注册点 244/357/367/477-499 段）、plugins/auth.ts（authenticate 定义）、services/crypto.service.ts（加密密钥管理）、constants/channel-connection-status.ts（状态判定）、prisma/schema.prisma（credentialEncrypted Json 类型，行 7549）
