# SPRINT-MEDIA-REALITY-CLOSURE-PLAN

基于 `SPRINT-MEDIA-WORKSPACE-AUTH-REALITY-AUDIT.md` 的执行设计 —— **只设计，不开发**

- **日期:** 2026-08-03
- **性质:** 实施方案设计文档（不含任何代码改动；代码改动须经掌柜逐 Task 批准后另起开发 Sprint）
- **上游:** docs/.reality/SPRINT-MEDIA-WORKSPACE-AUTH-REALITY-AUDIT.md（4 Critical / 5 High / 5 产品缺陷 / 5 架构债务）

---

## 0. 战略背景与目标

审计结论：架构方向正确（EnterpriseChannelAccount SSOT ✅ / BrowserWorkspace ✅ / BrowserChannelAdapterBase+Probe+Meta 配置化 ✅），距 SaaS 产品级体验存在一个 **Reality Gap**，由三个边界未收口造成：

1. **登录流程状态机未真正异步化**（connect 承担 9 项职责，18–30s 同步死等）
2. **状态真实性**（快手半失效会话假阳性 → 扫码成功≠连接成功 → 信任毁灭）
3. **历史遗留污染**（生产 stub adapter、双凭证轨、死代码）

**目标:** 小步快跑，按 Reality Closure 路线增量收口，不推倒重来，每个 Task 独立上线验证。

**执行顺序（掌柜 2026-08-03 18:35 批准版）：**

| 序 | 掌柜优先级 | Task | 核心价值 |
|---|---|---|---|
| 1 | P0-1 前置 | **Task 02.0** 平台身份信号矩阵（只读） | 数据驱动 → 禁止凭经验配置身份信号 |
| 2 | P0-1 | **Task 02** 快手登录真实性修复 | 信任毁灭 → 扫码成功必然正确连接 |
| 3 | P0-2 | **Task 01-A** Connect 异步化 | 慢但可用 → 首帧 2s + 全程可见进度 |
| 4 | P0-3 | **Task 03** Production Reality Cleanup | 产品诚信 → 能力关闭而非数据删除 |
| 5 | P0-4 | **Task 04** Credential Security Closure | 安全事故风险 → 凭证全量加密 |

**掌柜 8 点调整已并入本文档：**
1. T02 第一（信任先于速度）✅ 2. requiredCookies → **identityRequirements 信号数组抽象**（§3.3A）✅ 3. T02 前增加 **Task 02.0 只读身份信号矩阵**（§3.8）✅ 4. T01 拆 **T01-A 异步化**（本期）+ **T01-B 性能优化**（单独 Sprint，§2.7）✅ 5. T03 **能力关闭不删 DB 数据**（§4.2）✅ 6. T04 **CredentialService 唯一解密边界分层**（§5.3A）✅ 7. ChannelLoginRealityState 本期不建（§6）✅ 8. 每 Task 独立提交/部署/验收，禁止跨 Task 修改（§1）✅

---

## 1. 执行原则（所有 Task 共同遵守）

1. **增量收敛**：只基于现有 SSOT（EnterpriseChannelAccount）/ BrowserWorkspace / BrowserChannelAdapterBase / LoginStateMachine 做增量，不重新设计新媒体系统
2. **小步快跑**：每个 Task 独立开发 → 独立上线 → 独立验证（Reality Gate 脚本 + 掌柜真机验收），通过才进下一个
3. **Reality Gate 纪律**：真实或不存在，绝不 mock/假装；禁止新增模拟数据、禁止假成功文案
4. **改前留证**：每个 Task 开工前先写当前行为快照（脚本 + 截图 + DB 状态），验收对照
5. **禁止扩大范围**：Task 内只允许触碰本 Task 声明范围的文件/端点；跨范围需求记入 backlog 不进本期

---

## 2. Task 01 — 登录体验 Reality Closure

### 2.1 目标与范围

**目标:** 用户点击「去连接」→ 首帧反馈 ≤2s；二维码出现 ≤15s（当前 30.5s）；connect 全程前端可见进度（启动浏览器 → 加载平台 → 二维码生成 → 等待扫码）。

**范围（掌柜钦定）：**
- ✅ 只改：connect lifecycle / session lifecycle / frontend status display
- ❌ 禁止：改 adapter（BrowserChannelAdapterBase/DouyinBrowserAdapter 内部）
- ❌ 禁止：改探针（browser-channel.probe.ts / identity-probe.ts）

### 2.2 现状问题链（审计实测）

```
POST /connect（同步 18–30s）
 ├ 创建/复用 BrowserWorkspace 相关 session
 ├ 启动 Chrome（4–8s）
 ├ 探针#1（~2s）
 ├ clearLoginCache + 导航（3–6s）
 ├ waitMs 4s + clickSteps 5s
 ├ waitForQrReady ≤8s
 ├ 探针#2（~2s）
 └ 返回 waiting_login / connected / awaiting_confirmation
     ↓ 之后前端才开始 3s 轮询 /status → 用户此刻才看到二维码
```

问题本质：**connect 把「登录流程状态机」压在一个同步 HTTP 请求里**。用户感知 = 白屏死等 18–30s。

### 2.3 目标模型（异步化设计）

```
POST /connect
  只做：创建/复用 LoginSession，立即返回
  返回：{ sessionId, status: "STARTING", qrSource: null, ... }
  后台（fire-and-forget）：connectChannel 编排继续执行 adapter.connect

GET /status/:sessionId（前端 3s 轮询，已有）
  connect 未完成 → 返回 ConnectProgress 快照（阶段驱动）
  connect 已完成 → 返回原 getLoginStatus 结果（二维码/登录态）

前端阶段展示：
  STARTING_BROWSER → LOADING_PLATFORM → WAITING_QR → QR_READY → SCAN_DETECTED → CONNECTED
```

### 2.4 详细设计

**A. 后端 connect 拆两段（channel.service.ts + enterprise-channel-runtime.ts）**

- `POST /connect` 不再 await `adapter.connect()` 全流程，改为：
  1. 创建/复用 ChannelBrowserSession（现有 getOrCreate，~10ms）
  2. 初始化 ConnectProgress 记录：`{ stage: 'STARTING_BROWSER', startedAt }`
  3. 立即返回 `{ sessionId, status: 'STARTING' }`
  4. 后台任务执行现有 connectChannel 编排（复用现有代码路径，不加新逻辑）
  5. connectChannel 完成 → ConnectProgress 置 `{ stage: 'DONE', result }`（或失败 `{ stage: 'FAILED', message }`）

- ConnectProgress 存放：进程内存 Map（`sessionId → progress`，TTL 30min + 完成即清）。不落库（会话级瞬态；重启丢失由前端重新 connect 兜底）。⚠️ 若多实例部署需换 Redis，本期单实例内存即可。

- **禁止改 adapter 的约束下，中间阶段如何打点？** 在 connectChannel 编排层（channel.service.ts，非 adapter）打点：
  - `STARTING_BROWSER`：connect 请求进入即置
  - `LOADING_PLATFORM`：adapter.connect 调用前（浏览器实例已就绪）
  - `QR_READY`：adapter.connect 返回 waiting_login 时（二维码已可提取）
  - `CONNECTED / AWAITING_CONFIRMATION / FAILED`：connect 返回终态
  - 说明：LOADING_PLATFORM 与 QR_READY 之间的「二维码真实出现时刻」无法在不改 adapter 的情况下精确捕捉；前端在 QR_READY 前展示「正在加载平台…」文案（诚实，不伪造二维码）。若要精确到「出码瞬间」→ 见 2.7 可选 B 段（需掌柜批准动 adapter 内等待策略）。

**B. GET /status 扩展（enterprise-channel-runtime.ts）**

- 进入原 getLoginStatus 前，先查 ConnectProgress：
  - 存在且未 DONE → 返回 `{ code:0, data: { connectStage, status:'starting', loginStage:'starting_browser'|'loading_platform', qrSource:null } }`
  - DONE 且成功 → 清除 progress，走原 getLoginStatus（返回二维码/登录态）
  - FAILED → 返回 `{ code:0, data: { connectStage:'failed', message } }`（前端展示错误 + 重试按钮）
- statusLocks 串行化保留；connect 后台任务与 status 轮询的并发：connect 未完成时 status 不触碰浏览器（只读 progress），无并发冲突；connect 完成后才走浏览器路径 —— 天然互斥 ✅

**C. 前端 accounts.vue（status display）**

- connect 调用后立即进入轮询（不等 connect 返回体感；或 connect 返回 STARTING 即 startPolling）
- 状态展示扩展：`starting_browser`（启动浏览器中…）/ `loading_platform`（正在加载平台…）/ `qr_ready`（二维码已生成，请扫码）
- connect 后台失败 → 展示错误 + 「重试」按钮（当前无此兜底）
- connect 前端超时兜底：45s 内未到 QR_READY 且无进度推进 → 提示「启动超时，请重试」（当前 connecting=true 无限转圈风险）
- `state` 新枚举字段接入（为长期唯一状态机铺路，见 §7）

### 2.5 影响面

| 维度 | 影响 |
|---|---|
| API | `POST /connect` 返回从「同步终态」变为 `{sessionId, status:'STARTING'}`（**行为变更**：原调用方逻辑按 status 分支，需前端同步改）；`GET /status` 响应新增 connectStage 字段（向后兼容，原字段保留） |
| 前端 | accounts.vue connect 流程 + 轮询分支 + 阶段文案 + 错误兜底 + 超时兜底 |
| 数据库 | **零 schema 变更**；ChannelBrowserSession 表行为不变 |
| 后端 | channel.service.ts connectChannel 编排拆分（纯编排层改造）；enterprise-channel-runtime.ts connect/status 路由 |
| adapter/探针 | **零改动**（掌柜红线） |

### 2.6 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 后台 connect 与前端轮询并发触碰浏览器 | 中 | connect 未完成时 status 只读 progress 不触浏览器；connect 完成后才切浏览器路径，天然互斥 |
| 后台任务异常未捕获 → 前端永远 STARTING | 中 | ConnectProgress FAILED 兜底 + 前端 45s 超时提示 |
| 用户重复点击 connect → 多后台任务 | 低 | 现有 session 复用 + 前端 connecting 防重入保留 |
| 进程重启丢 ConnectProgress | 低 | 前端收 STARTING 后 3s 轮询探活，重启后 status 无 progress 且浏览器未启动 → 前端提示重新连接 |
| connect 返回语义变更破坏旧调用方 | 中 | 全仓搜索 `/connect` 调用点（accounts.vue 唯一入口 + wait-for-login 兜底），统一改；对外无第三方 |

### 2.7 T01-B 二维码性能优化（掌柜钦定：单独 Sprint，不混入 T01-A）

T01-A 只解决「体感」（异步化属架构）；实际出码 30s 的优化（性能）**另立 Sprint，禁止混入**。

T01-B 候选范围（待掌柜批准后另立）：
- waitMs 4000 → 条件轮询（页面出现「扫码」tab 即提前，≤1s）
- clickSteps 1500+1000ms → 500ms 步进 + DOM 状态探测
- 探针 waitForTimeout(1500+rand800) → 300–500ms + 页面就绪事件
- Chrome 持久实例热启动（复用已运行 profile，二次 connect 免冷启动）

**预计收益:** 30.5s → 5–8s（含 Chrome 冷启动物理下限 4–8s）；热启动二次连接 2–4s。

**原因（掌柜）：** 异步化与性能风险不同，混在一起无法独立验证/回滚。

### 2.8 回滚方案

- 后端：git revert 本次 connect 拆分 commit（connect 路由保留旧同步路径 1 个版本，通过环境变量 `CONNECT_ASYNC=0|1` 开关，默认新路径；异常时切回同步路径零代码变更）
- 前端：旧 accounts.vue 逻辑由 git revert 恢复；阶段文案与分支向后兼容（未知 connectStage 走原分支）
- 数据：无 schema/数据变更，无需数据回滚

### 2.9 验收标准（Reality Gate）

1. `POST /connect` 响应 ≤2s（实测 curl 计时），返回 `status:'STARTING'` + sessionId
2. 前端首帧进度 ≤2s 可见（截图存证）
3. 二维码出现 ≤15s（四平台各测 2 次；热启动二次连接 ≤8s）
4. 全程阶段推进可见（截图序列：starting_browser → loading_platform → qr_ready）
5. connect 后台失败 → 前端错误提示 + 重试可用
6. 扫码→确认→连接全链路回归（复用 G6 验收 step1）
7. 回归：四平台 connect 成功路径 5/5；adapter/probe 文件 git diff 为空（红线验证）

---

## 3. Task 02.0 — 平台身份信号矩阵（只读，先于 Task 02）

### 3.0.1 目标

采集四平台（抖音/快手/小红书/视频号）**真实登录后**的：cookie keys / localStorage keys / identity fields / network signals，产出 `docs/.reality/MEDIA-PLATFORM-IDENTITY-MATRIX.md`。

**铁律：禁止凭经验配置身份信号。** Task 02 的 identityRequirements 配置只允许引用矩阵里实测命中的信号。

### 3.0.2 方法（只读）

1. 盘点：`/data/browser-profiles/<platform>/*` 现有持久 profile + DB 凭证/快照新鲜度（哪些平台有真实登录态）
2. 对**有真实登录态**的平台：启动浏览器（现有 BrowserRuntime，不写库不清理），采集：
   - `browserRuntime.getCookies(sessionId)` → cookie 全集 keys
   - CDP 读 localStorage（各平台域）→ keys
   - 页面 URL + 身份提取字段（现有 identity-probe 逻辑，复用不改造）
   - network 身份 API 请求清单（现网 meta.userApis 命中记录，复用网络捕获）
3. 对**登录态失效**的平台：如实标注「需掌柜扫码恢复」→ 矩阵标记 PENDING，等掌柜扫码后补采
4. 输出矩阵：每平台一节 `{ cookie keys + 强弱标注 / localStorage keys / identity fields / network signals / 建议 requiredSignals }`

### 3.0.3 交付物

`docs/.reality/MEDIA-PLATFORM-IDENTITY-MATRIX.md`（只读采集，零代码改动）

---

## 3. Task 02 — 快手登录真实性修复

### 3.1 目标与范围

**目标:** 扫码成功必然正确连接；半失效会话（残留 cookie 假阳性）不再被当登录态。

**范围（掌柜钦定）：** BrowserChannelProbe / identity validator / cookie policy / session cleanup。**不动 adapter.connect 流程、不动前端主流程。**

### 3.2 根因（审计实证）

快手 `identityRules.cookies = ['bUserId','kwssectoken','did']`，`cookie 信号 = 命中 ≥2`。
实测残留 `kwssectoken + did`（缺 `bUserId`，真实主登录凭证）→ 命中 2 → `cookie=true` → 首探针 `authenticated=true` 假阳性。
连锁污染：
1. waitForLogin 硬条件 `authenticated && accountId && identityResolved && workspaceReady` 中 authenticated 虚真，但 accountId 空 → 永远等（「已登录但永不 connected」）
2. clearLoginCache 保护 `keyHit ≥ 2` 同样虚真 → 脏 cookie 不清理 → 新扫码带着半失效会话，passport 与残留会话打架

**语义问题:** `bUserId`（登录主体）与 `kwssectoken`（passport 会话）/ `did`（设备 ID）权重相同，弱信号可单独凑出「登录」——违反「cookie 存在 ≠ 登录成功」。

### 3.3 设计：identityRequirements 信号数组（替代 cookie ≥ 2）

**A. Meta 层（browser-channel.meta.ts，纯配置变更；掌柜钦定抽象）**

不要简单替换为 requiredCookies 列表——各平台未来信号形态必然不同。抽象为**信号数组**（Probe 判断「身份是否成立」而非「有没有 cookie」）：

```ts
identityRequirements: [
  { type: 'cookie', key: 'bUserId', strength: 'required' },      // 强信号：登录主体，必须命中
  { type: 'cookie', key: 'kwssectoken', strength: 'weak' },       // 弱信号：passport 会话（可能残留）
  { type: 'cookie', key: 'did', strength: 'weak' },               // 弱信号：设备 ID（不代表登录）
  { type: 'identity', field: 'userId', strength: 'required' },    // 身份提取字段（需 identity 提取命中）
  { type: 'page', field: 'urlFragments', strength: 'weak' }       // 页面特征（参考）
]
```

判定规则：
- `signals.cookie = 所有 strength:'required' 的 cookie 信号命中`（且要求 required 信号数量 ≥1）
- `signals.identity` 增强：若配置了 `{type:'identity', field:'userId', strength:'required'}` 且提取命中 → identity 信号成立
- **身份成立 = required 信号（cookie/identity 任一类型）满足配置组合**；弱信号只进诊断日志，不参与成立判定
- 策略开关 `cookiePolicy: 'required_all' | 'legacy_any_2'`，默认 required_all；legacy 模式保留一版供灰度/回滚
- 探针信号明细日志输出逐信号命中表（`req=[bUserId cookie] hit=0/1 weak=[kwssectoken,did] hit=2/2 → cookie=false`）

⚠️ 各平台信号配置**只允许引用 Task 02.0 矩阵实测结果**（禁止凭经验填写）。矩阵未出 → 该平台保持现状判定，Task 02 只改快手。

**B. Probe 层（browser-channel.probe.ts）**

judgeIdentityV2 不变（credential = cookie && !loginPage；authenticated = credential && (identity||page)），只改 cookie/identity 信号来源为 identityRequirements 求值。信号明细日志增强（逐信号命中），诊断可读。

**C. Session cleanup 层（browser-channel.adapter.ts clearLoginCache 保护）**

保护条件从 `urlFragments 命中 || keyHit >= 2` 改为 `urlFragments 命中 || requiredCookies 全命中`：
- 有效会话（bUserId 在）→ 保护，不清理 ✅（不破坏正常恢复）
- 半失效会话（仅 kwssectoken+did）→ 不保护 → **清理脏 cookie** → 全新干净环境扫码 ✅（根治干扰）

**D. 半失效会话显式标注（可选增强，推荐）**

connect 首探针检测到「optional 命中 ≥2 但 required 缺失」→ ConnectProgress/状态标注 `NEEDS_REAUTH`（半失效会话，需重新扫码），前端显示黄色提示「检测到残留登录痕迹，已清理，请重新扫码」——诚实告知，不假装已登录。

### 3.4 影响面

| 维度 | 影响 |
|---|---|
| API | 无新端点；探针信号明细日志格式扩展（诊断字段） |
| 前端 | 可选：NEEDS_REAUTH 提示文案（accounts.vue 一处分支）；主流程不变 |
| 数据库 | 零 schema 变更（connectionStatus 已有 NEEDS_REAUTH 枚举） |
| 后端 | browser-channel.meta.ts（配置）、browser-channel.probe.ts（cookie 信号）、browser-channel.adapter.ts（clearLoginCache 保护条件） |
| 风险面 | ⚠️ 抖音/小红书/视频号的 requiredCookies 需要按各自真实会话键确认后配置——改错会导致真登录也被判未登录（**验收时必须四平台全量回归**） |

### 3.5 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| requiredCookies 配置错误 → 真登录判未登录 | 高（唯一高风险点） | 上线前用各平台真实登录态实测探针日志；保留 legacy_any_2 开关灰度；每平台独立验证通过才切 |
| 抖音等平台主凭证键不明 | 中 | 实现第一步先做「会话键实证」（读各平台登录后 cookie 全集，标注主凭证），再定配置 |
| 清理脏 cookie 误伤正常会话 | 低 | 保护条件仅收窄不放宽：urlFragments 命中（页面已在工作台）依旧保护 |

### 3.6 回滚方案

- `cookiePolicy: 'legacy_any_2'` 环境变量/配置开关，一键回旧判定（代码保留两个判定分支，默认 required_all）
- meta requiredCookies 回滚 = git revert 配置 commit
- 数据无变更，无数据回滚

### 3.7 验收标准（Reality Gate）

1. **半失效会话场景**（构造 kwssectoken+did 无 bUserId）：connect 首探针 `authenticated=false` + `NEEDS_REAUTH` 标注 + 脏 cookie 被清理（实测探针日志 + cookie 快照对比）
2. **有效会话场景**（bUserId 在）：保护逻辑生效，不清理，fast 恢复 CONNECTED 不受影响
3. **四平台真登录回归**：抖音/快手/小红书/视频号各 1 次真实扫码 → 连接成功（探针日志 authenticated=true 且 required 全命中）
4. **四平台未登录回归**：全新 profile 首扫前探针 authenticated=false
5. 掌柜真机：快手扫码 → 一次成功 connected（复测 VC-REALITY-HOTFIX-01 场景）

---

## 4. Task 03 — Production Reality Cleanup

### 4.1 目标与范围

**目标:** 生产环境不再存在任何假数据实现；死代码/死页面清除；tsc 类型防线恢复可用（至少渠道相关）。

**范围（掌柜钦定）：** 删 4 个 stub adapter 注册、删 `_deprecated-channels-mock-auth.ts`、关旧页面 `media-department/settings/channels.vue`。

### 4.2 删除清单与影响面

| # | 对象 | 位置 | 影响 |
|---|---|---|---|
| 1 | VideoAccountAdapter / WeiboAdapter / BilibiliAdapter / QQAdapter 生产注册 | backend/src/enterprise/channel/index.ts:483-486（channelService.register） | registry connectable 自动熄灭（假平台不再可连）；resolveAdapter 不再命中假实现 |
| 2 | `_deprecated-channels-mock-auth.ts` | backend/src/enterprise/channel/ | 死代码（引用已删 ChannelAccount/ChannelBinding 表，tsc 报错）；删除后渠道相关 tsc 错误清零 |
| 3 | 旧页面 `media-department/settings/channels.vue` | frontend/pages/ | 调已删 `/api/enterprise/channel-accounts`（必 500）+ 旧模拟授权 connect |
| 4 | 旧明文写入路径收敛（与 Task 04 协同） | channel-account.service.ts | Task 04 处理，本 Task 只冻结其调用面 |

**掌柜钦定：能力关闭，不删数据。** 历史数据（ChannelAccount / ChannelMetricSnapshot / OperationLog 等）**禁止删除**，只做生产注册移除：

```ts
// 原：resolveAdapter('weibo') → 返回 stub（假数据可用）
// 改：resolveAdapter('weibo') → throw UnsupportedChannelError（能力关闭，数据保留）
```

SaaS 正确做法：数据保留，能力关闭。

**前置检查（开工前必做）：**
- 全仓搜索 `resolveAdapter('weibo'|'bilibili'|'qq'|'video_account')` 及 DB 中是否存在这些 channelType 的存量账号（若有，需掌柜确认处置：隐藏/标注废弃/迁移）
- 搜索前端所有指向 media-department/settings/channels.vue 的入口（菜单/路由），同步移除或重定向到新渠道中心（/workspace/media/accounts）
- registry（platform-registry.ts）connectable 判定依赖 adapter 注册表 → 删除注册后自动熄灭 ✅（已有机制，无需额外改）

### 4.3 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 存量 DB 账号引用被删 channelType | 中 | 开工前 SELECT 盘点；有存量则只摘注册表（不删数据），owner-view 显示「已停用平台」 |
| 前端入口残留 → 404/空白 | 中 | 全仓搜索菜单/路由引用，一并清理或重定向 |
| 删除文件影响 tsc 编译链 | 低 | 删除后 tsc --noEmit 验证渠道相关错误清零；确认无 import 残留 |

### 4.4 回滚方案

- git revert 删除 commit（文件恢复）；注册表删除不影响 DB 数据
- 前端路由恢复 + 菜单恢复

### 4.5 验收标准

1. `GET /api/enterprise/channels/registry` 不再返回 weibo/bilibili/qq/video_account（或 connectable=false 且明确「已停用」）
2. `_deprecated-channels-mock-auth.ts` 删除，渠道相关 tsc 错误 = 0
3. media-department/settings/channels.vue 无任何入口可达（页面 404 或重定向到新渠道中心）
4. 全仓 grep 无 `channel-accounts` 旧 API 调用残留
5. 新渠道中心（/workspace/media/accounts）四平台功能回归不受影响

---

## 5. Task 04 — Credential Security Closure

### 5.1 目标与范围

**目标:** 凭证存储全量 AES-256-GCM 加密；任何 service 不再直接 `JSON.parse(credentialEncrypted)` 读明文；WeCom 与新媒体链路统一凭证契约。

**范围（掌柜钦定）：** WeCom 统一 credentialEncrypted AES-GCM + decrypt boundary；禁止任何 service JSON.parse(credentialEncrypted)。

### 5.2 现状（审计实证）

- 新媒体链路 ✅：`{ cipher:'aes-256-gcm', payload: encryptKey(JSON.stringify(cred)) }`，channel.service `getCredential()` 统一解密
- WeCom 旧链路 ❌：createWithOwnership 写 `{ _v:1, _encrypted:false, ...input.credentials }` 明文 JSON 字符串
- token.service `loadCredential()` 直读 `creds.corpId / creds.secret||corpSecret / creds.encodingAESKey`（不识别 cipher 结构）→ 与新媒体格式互不兼容
- 同一列两种格式 → `JSON.parse` 的调用方对新格式解析出 undefined

### 5.3 设计：统一凭证契约 v2

**目标契约（credentialEncrypted 存储格式）：**

```json
{ "cipher": "aes-256-gcm", "payload": "iv:tag:ciphertext" }
```

**A. 解密边界（decrypt boundary）— CredentialService 唯一入口（掌柜钦定分层）**

```
Database
  │  credentialEncrypted（唯一密文形态 {cipher:'aes-256-gcm',payload}）
  ▼
CredentialService（唯一解密边界：识别新密文/旧明文/非法，统一出口）
  │  Plain Credential Object
  ▼
Adapter / token.service / 各业务（只消费明文对象，禁止触碰存储格式）
```

- **CredentialService.getCredential(accountId) = 唯一凭证读取入口**（升级现有 channel.service.getCredential 或独立 service）：
  - 识别 `{cipher:'aes-256-gcm', payload}` → decryptKey 解密
  - 识别旧明文 `{_v:1,_encrypted:false,...}` 或纯 JSON → 兼容读取（返回明文结构）+ 告警日志「旧格式凭证读取，需迁移」
  - 识别非法 → 明确错误（不再静默 undefined）
- token.service.loadCredential 改为调用 CredentialService，删除直读逻辑
- 全仓审计所有 `credentialEncrypted` 读取点（grep JSON.parse / .credentialEncrypted），全部收敛到 CredentialService
- **代码审查硬规则**（写入 AGENTS.md/TOOLS.md + CI grep check）：任何业务 `JSON.parse(credentialEncrypted)` 一律不通过

**B. 写入统一**

- createWithOwnership 改为 `encryptKey(JSON.stringify({_v:2,...}))` + `{cipher:'aes-256-gcm',payload}` 结构（与 updateCredential 一致）
- wecom-adapter.service 等其他写入点同步

**C. 存量明文迁移（一次性脚本，上线前执行）**

- 盘点：SELECT id, channel_type, credential_encrypted 中 `_encrypted:false` 或非 cipher 结构的行
- 迁移脚本：逐行 decrypt→encrypt 回写（密钥同 CRYPTO_ENCRYPTION_KEY）
- 迁移前全量备份该表；迁移后抽查解密可读（corpId/secret 还原一致）
- 迁移失败行保留明文 + 告警（不中断）

**D. 红线固化**

- 新增 ESLint 规则或代码评审清单：禁止直接 `JSON.parse(account.credentialEncrypted)`（grep 可查的硬规则，写入 AGENTS.md/TOOLS.md 或 CI check）

### 5.4 影响面

| 维度 | 影响 |
|---|---|
| API | 无对外契约变化（token 链路内部改造）；getCredential 行为增强 |
| 前端 | 零影响（凭证从不出后端） |
| 数据库 | **数据迁移**：存量 WeCom 明文行 → 加密（一次性；风险最高环节） |
| 后端 | channel.service.ts getCredential、token.service.ts loadCredential、channel-account.service.ts createWithOwnership、wecom-adapter.service 写入点 |
| 运维 | 迁移脚本 + 备份 + 回滚脚本 |

### 5.5 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 存量明文迁移失败 → corpSecret 丢失（WeCom 无法取 token） | 高 | 迁移前全表备份；逐行迁移 + 解密回读校验；失败行保留明文并告警；回滚脚本（备份还原） |
| token.service 改造引入回归（WeCom 消息收发依赖 token） | 中 | 迁移后用真实 WeCom 账号取 token + 发消息回归；保留旧 loadCredential 一个版本（环境变量开关） |
| getCredential 兼容层误读新格式 | 低 | 单元测试覆盖三种格式（新密文/旧明文/非法） |

### 5.6 回滚方案

- 代码：git revert + `CRED_LEGACY_READ=1` 开关恢复旧直读
- 数据：备份还原（迁移脚本逆操作：解密回明文 + 置 _encrypted:false）

### 5.7 验收标准

1. DB 全表扫描：credentialEncrypted 无 `_encrypted:false` 明文行（存量已迁移）
2. 任意行可经 getCredential 解密还原（抽查脚本比对 corpId/corpSecret）
3. token.service 走统一解密入口（grep 无直读 creds.corpSecret）
4. WeCom 真实账号：取 token + 发消息回归通过
5. 新媒体四平台登录链路不受影响（credential 加密格式未变，仅统一入口）
6. 全仓 grep `JSON.parse(.*credentialEncrypted)` = 0（或全部在 getCredential 内）

---

## 6. 长期方向（本期不做，本期为它铺路）

### ChannelLoginRealityState 唯一状态机（掌柜蓝图）

审计确认当前四状态源并存：`EnterpriseChannelAccount.connectionStatus`（DB）/ `BrowserWorkspace.loginRealityState` / `LoginStateMachine`（会话）/ `BrowserAuthSessionService`（ChannelVerificationSession）。

**本期铺路动作（不新增状态机）：**
1. Task 01 前端接入 `state` 新枚举（后端已返回，前端未消费）——为唯一状态机建立前端消费面
2. Task 02 的 NEEDS_REAUTH 标注复用现有枚举，不新建
3. 记录设计草案（不进代码）：下一阶段将四个状态源收敛为 `ChannelLoginRealityState`（INIT → STARTING_BROWSER → WAITING_QR → QR_READY → SCAN_DETECTED → IDENTITY_VERIFYING → CONNECTED → EXPIRED → FAILED），DB 存最终态、Runtime 只执行、Frontend 只消费——**另立 Sprint，掌柜拍板后启动**

---

## 7. 验收总纲

每个 Task 独立上线验证，全部通过后整体回归 G6 黄金验收（docs/reality/G6-REALITY-ACCEPTANCE.md）：

| Task | 独立验证 | 掌柜真机验收点 |
|---|---|---|
| Task 02.0 | 四平台矩阵产出（每平台 cookie/localStorage/network/identity 实测） | 失效平台扫码补采 |
| Task 02 | 半失效会话构造测试 + 快手真实登录回归（信号矩阵驱动配置） | 快手扫码一次成功 connected |
| Task 01-A | connect ≤2s 首帧 + 阶段推进截图 + 全程可见进度 | 四平台各扫码一次，进度可见 |
| Task 03 | resolveAdapter 抛 UnsupportedChannelError + registry 熄灭 + tsc 渠道清零 | 新渠道中心四平台功能回归 |
| Task 04 | 明文行迁移 100% + CredentialService 唯一边界 + WeCom 回归 | WeCom 取 token/发消息可用 |
| 整体 | G6 step1-6 全绿 | 登录→电脑确认→重启恢复→AI 读取→Owner View |

---

*本计划为执行设计文档，不含代码改动。每个 Task 开工前需掌柜逐项批准，并另起开发 Sprint（含 Reality Gate 脚本 + 截图存证）。*
