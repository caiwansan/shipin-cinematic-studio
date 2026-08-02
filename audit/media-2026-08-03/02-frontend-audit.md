# 前端审计发现

> 审计对象：`/root/shipin-cinematic-studio/frontend/` 新媒体工作台（pages/workspace/media 9 文件、pages/media-department 6 文件、pages/workspace/enterprise 渠道中心相关、components/media 全部、API 层封装、pages/workspace/index.vue）
> 方法：全部文件逐行阅读 + 与后端路由清单（`/root/shipin-cinematic-studio/backend/src/routes/*`、`src/index.ts`）逐条比对验证
> 审计时间：2026-08-03

---

## 1. 高危 [H]（3）

`[H-01]` **pages/media-department/employees.vue:342-345（配合 template:9）** — 「停止全部AI操作」紧急停止按钮是纯前端假控件：`toggleEmergencyStop()` 仅翻转本地 `emergencyActive` 布尔值并 `console.log`，**不调用任何 API**。而后端存在真实端点 `POST /api/enterprise/media-department/emergency-stop` / `emergency-resume`（backend/src/routes/enterprise-agent-runtime.ts:625-642 已核实），前端完全未使用。用户点击红色「停止全部AI操作」按钮以为 AI 已被紧急停止，实际系统毫无变化 —— 虚假的安全控制/虚假安全状态。
- 影响：安全控制失效，用户对「已停止」产生错误信任，AI 员工仍在运行；合规风险。
- 建议：删除按钮或接入真实 `emergency-stop` 端点，并轮询 `emergency-status` 渲染真实状态。

`[H-02]` **pages/media-department/employees.vue:176（表单收集）+ 353-368（createEmployee 请求体）** — 创建 AI 员工向导 Step 4 向用户索要第三方 LLM **API Key**（`type="password"`，文案承诺「昆仑镜不存储明文 Key」），但 `createEmployee()` 的请求体 `{ name, role, positionType, goal, knowledge, memory }` **根本不包含 apiKey** —— 用户输入的敏感凭据被静默丢弃（若未来接入发送，则明文 API Key 直接入库）。前端页面收集云端 API Key 本身就是高危凭据面。
- 影响：用户凭据被无意义收集（信任破坏）；若代码演进为发送，将造成明文密钥存储与泄露。
- 建议：移除该表单步骤，或明确不收集；如确需 BYOK，走后端加密存储 + 掩码回显，且必须真实发送。

`[H-03]` **pages/media-department/settings/channels.vue:154, 209-259（全页）** — 渠道账号管理页三重问题叠加：
1. `const isLoggedIn = ref(true)`（:154）硬编码已登录，绕过认证状态；
2. 所有请求头 `Authorization: Bearer ${getToken() || 'demo-token'}`（:209/230/243/258）—— 无 token 时发送**假凭据** `demo-token`；
3. 所有请求硬编码绝对地址 `https://aigc.fushtn.com/api/enterprise/channel-accounts*`；且该接口为后端 legacy **模拟授权**链路（backend/src/routes/channels.ts:232-279 注释自认「模拟授权」：生成 `fakeToken` 写入 DB `credentials`、`status: 'active'`、`simulated: true`）。
- 影响：页面把「模拟授权」的假连接当真实「已连接」展示；用假 token 打生产域；可诱导用户绑定 AI 员工到从未真实授权的渠道。
- 建议：整页下线或改接到真实 `channels/runtime/*` 链路；删除 demo-token fallback；isLoggedIn 用真实 token 判断。

---

## 2. 中危 [M]（13）

`[M-01]` **composables/enterprise/useMediaApi.ts:129-136, 145-163** — 9 个死 API 调用（后端路由清单逐一核对不存在，必 404）：
`/auth/login`(:129)、`/auth/me`(:131)、`/media-department/employees/:id`(:135)、`/media-department/employees/:id/value-summary`(:136)、`/ceo/value-summary`(:145)、`/knowledge/brand-voice`(:149)、`/knowledge/product-catalog`(:152)、`/knowledge/audience-profiles`(:155)、`/tasks`(:159)。
- 影响：`KunlunMediaApi.login/getMe/createTask/saveBrandVoice/...` 一旦被调用即失败；`runTask`（employees.vue）依赖 `createTask` → 任务执行功能实际不可用。
- 建议：删除或按真实端点重写（auth 用 `/api/auth/login`；任务用 `/api/enterprise/agent-identity/tasks`）。

`[M-02]` **composables/enterprise/useMediaApi.ts:163** — `createTask` 硬编码 `tenantId: 'tenant-955d2b1a'`。伪造租户 ID 会写入错误租户数据 / 泄漏到不该出现的上下文。

`[M-03]` **pages/workspace/media/index.vue:30 + 157-176** — (a) 问候条硬编码「· 5 名 AI 员工」(:30)，与真实 agent 数无关；(b) `dashboardData` ref 声明后**全文件无任何赋值点**，`hasData` 恒为 false → 三块经营指标、本周经营表现永远显示「待接入」，注释声称「数据接入后自动点亮」但从未接线；`healthScore/healthTrend`(:173-174) 为死代码。
- 影响：状态不真实（写死员工数）；核心数据区永久空态，且无任何加载逻辑可修复。

`[M-04]` **pages/workspace/media/accounts.vue:95, 185** — 已连接账号卡片硬编码「🤖 AI 员工：Alice 运营总监」（:95 绑定卡片、:185 确认绑定文案）。真实后端绑定的 AI 员工是谁完全无关 —— 用写死身份冒充真实授权关系。

`[M-05]` **pages/media-department/employees.vue:253, 55-84, 322-335** — `hasOrganization = ref(true)` 硬编码（:253，绕过「请先创建企业」流程）；`fetchEmployees` 映射只写 `status` 字段，但模板消费 `emp.runtimeStatus` 与 `emp.emergencyStop`（:55-84）→ 所有员工卡永远显示 `Draft`、「激活」按钮永远出现、「执行任务」按钮永不出现，状态标签错乱（后端返回的是 `runtimeStatus`）。

`[M-06]` **pages/media-department/analytics.vue:2** — `<template>` 块内第 2 行混入 `import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'`（应是误粘贴到 template），该文本会作为页面顶部可见乱码渲染（或导致编译异常），且该文件声明 `import` 实际未在 script 中使用。
- 建议：删除该行；顺带此页 `isLoggedIn` 仅在 onMounted 判断 token，逻辑可用但未用 KunlunMediaApi。

`[M-07]` **stores/auth.ts:61-95** — token 明文持久化到 `localStorage['auth_token']` **且**写入非 HttpOnly/非 Secure 的 `auth_token` cookie（`path=/; max-age=86400; samesite=lax`，无 Secure 无 HttpOnly）；`auth_user` cookie 存放完整用户 JSON。文件注释声称「内存层防御 XSS 窃取」，但实现同时落 localStorage + cookie —— 注释与实现矛盾，XSS 可直接读 localStorage 或 cookie。
- 建议：cookie 增加 `HttpOnly; Secure`（由后端下发），前端只保留内存态；或明确接受 localStorage 风险并做内容安全策略。

`[M-08]` **middleware/auth.ts:12-23** — `/admin/*` 路由守卫仅检查 `localStorage.getItem('auth_token')` 是否存在，**无角色/权限校验**：任意持有普通用户 token 的登录用户都能进入前端 admin 路由（后端是否有鉴权不在此次前端审计范围，但前端入口已泄露）。media 工作台 `/workspace/*` 守卫同理仅验 token 存在。

`[M-09]` **pages/media-department/settings.vue:163, 185-186** — (a) `getAuthHeaders()` 无 token 时回退 `{ Authorization: 'Bearer demo-token' }`（:163）→ 假凭据请求 `/api/enterprise/subscription/available-plans`；(b) `saveOrgInfo` 成功后把 `d.data.tenantId` 直接写入 `localStorage['organizationId']`（:186），tenantId 与 organizationId 混用 → `useMediaApi.orgQuery()` 会用错误 ID 拼 `?organizationId=` 查询参数，导致查错组织或 404。

`[M-10]` **pages/media-department/** 系列静默失败 — settings/channels.vue:225-316 全部增删改查失败仅 `console.warn`，无任何用户提示（连接/断开/绑定/解绑失败用户无感知，还可能在页面无刷新时显示过期状态）；settings.vue:214 `loadPlans` 失败静默；media-department/index.vue:218 失败仅 warn。账号/员工/套餐关键操作全部无错误态。

`[M-11]` **pages/workspace/enterprise/ai-employees.vue:242-244, 343-345（同 enterprise/index.vue:775-778）** — 用 `name.includes('carol') || name.includes('c')` 从 agent 列表找 Carol：任何名字含字母 "c" 的员工都会被命中 → 可能对错误的 agent 执行 toggle/激活。

`[M-12]` **pages/workspace/enterprise/talent.vue:124 + 471-481** — `v-html="formatCarolResult(carolResults[c.id])"` 渲染 AI 生成内容：`formatCarolResult` 只做 markdown 正则替换（`###`→`<h4>` 等），**未先对原始内容做 HTML 转义/消毒**。AI 输出来自候选人简历等用户可控输入的提示词链，若 AI 输出含 `<img onerror=...>`/`<script>` 即形成存储型 XSS（需 prompt injection 触发，故定中危，可升级高危）。
- 建议：先 `escapeHtml` 再执行 markdown 替换，或使用 DOMPurify。

`[M-13]` **pages/workspace/media/team.vue:249-256, 280** — `EMPLOYEE_CHANNELS` 硬编码 Alice/Bob/Carol/David/Eve → 渠道映射；真实 agents 名字不同时 `employeeChannels(name)` 回退 `MATRIX_COLUMNS.slice(0,2)`，渠道状态矩阵（:24-46 表格）与真实绑定错位。矩阵「已连接」状态本身来自真实 account-status API（:258-266），但员工×渠道归属是写死的。

---

## 3. 低危 [L]（10）

`[L-01]` **plugins/token-bridge.client.ts:14-24** — 将 `getToken/setToken/clearAuth` 挂载到 `window.__token_cache`：任何页面脚本（含 XSS）可全局读写 token，扩大了攻击面。建议移除 setToken 暴露或加白名单。

`[L-02]` **utils/auth-fetch.ts:12-13** — 读取 legacy key `accessToken`/`token`，与「唯一 auth_token」硬化策略冲突（utils/auth/token.ts 注释明确禁止这两 key）。旧 key 若残留脏数据会被误用。

`[L-03]` **pages/workspace/media/accounts.vue:294-325** — 「登录诊断」调试面板（URL/Frames/QR 探测四通道/页面文本）留在生产页面，默认收起但可一键展开，泄露登录会话探测细节（浏览器内部 URL、框架结构）。属开发残留。

`[L-04]` **pages/workspace/media/accounts.vue:432-433** — `statusMsg.value = '启动失败: ' + e.message` / toast 直接透传后端原始异常消息，可能包含内部路径/服务名等实现细节。

`[L-05]` **composables/useEnterpriseAgents.ts:29-45** — `fetchAgentList` 对每个员工逐个 `fetchJSON('/employees/:id/health')`（N+1 串行健康检查），员工多时页面明显变慢；且无超时控制。

`[L-06]` **layouts/enterprise-workspace.vue:88-112** — 三个身份请求硬编码绝对地址 `https://aigc.fushtn.com/api/...`（auth/me、subscription/current、enterprise/home）。后端 CORS 只允许 `https://aigc.fushtn.com`（backend/src/plugins/cors.ts），非该域部署环境全部失败；且混域场景下用户 token 会随请求发往固定域名。

`[L-07]` **pages/workspace/media/intelligence.vue:120-131** — `radar.supported` 恒为 `false` 且无任何加载逻辑（`radar.hot/competitor/...` 永远空数组），「数据源待接入」是永假状态，没有 API 接线；customers.vue（tiers customers 恒 []）、messages.vue（sessions 恒 []）同为纯静态空态页 —— 诚实但完全未接线，与页面文案「接入后点亮」不符。

`[L-08]` **pages/workspace/media/accounts.vue:601-617** — `finishConnect()` 在 `wait-for-login` 超时后**无条件回退调用 `refresh-credential` 并提示「连接成功！」**：未确认真实登录态就标记成功，可能造成「已连接」但实际未授权。

`[L-09]` **pages/media-department/employees.vue:410-412** — `runTask` 成功后 `taskStats.value = { cost: 0, durationMs: 0 }` 写死假统计（页面展示 Token/Cost/Duration 均为伪造零值）。

`[L-10]` **pages/workspace/media/index.vue:253-255（及 MediaWorkspaceShell:115-118）** — token 为空字符串时仍发送 `Authorization: Bearer `（空 Bearer 头），属于脏请求。

---

## 4. 信息 [I]（架构观察 / 假数据位置 / 死代码 / 正确项）

`[I-01]` **useMediaApi.ts:9-10** — 注释自认「/api/v1 从未在后端注册，历史假端点」，API_BASE 已统一到 `/api/enterprise`（方向正确），但 M-01 的 9 个死端点残留未清理。

`[I-02]` **accounts.vue 登录流程（正面结论）** — 扫码登录/短信登录/确认绑定/拒绝绑定/安全验证/轮询状态机（:369-560）与后端 `enterprise-channel-runtime.ts` 的 `ensure-account/connect/browser/:sessionId/{status,tab,phone,send-code,code}/wait-for-login/confirm-binding/refresh-credential` 全部真实匹配；二维码 3s 轮询、防重入、jsQR 裂图自修复（:544-596）实现完整；douyin/kuaishou/xiaohongshu/channels_wechat 四个可连接平台在后端均有真实注册适配器（backend/src/index.ts:486-497 + browser-channels.ts:19），非假连接。

`[I-03]` **端点匹配验证（正面）** — `/api/enterprise/media/overview`（index.ts:374 注册）、`/media-department/employees` GET/POST、`/onboarding/status`、`/subscription/current`、`/subscription/available-plans`、`/channel-center/{overview,candidates,import}`、`/channels/runtime/*`、`/agent-profiles/*`、`/workspaces/owner-view`、`/api/member/profile`、`/api/user/profile` 均存在且与前端调用一致；media/overview 返回结构（instanceId/employeeId/name/role/avatar/lifecycleState）与 team.vue 消费字段匹配。

`[I-04]` **legacy 模拟授权证据** — backend/src/routes/channels.ts:16-17 注释：「/api/enterprise/channel-accounts/:id/connect 是模拟授权（fakeToken + simulated:true）→ 保留 deprecated」。与 H-03 前端页面使用行为形成对照。

`[I-05]` **诚实空态页（正面）** — media/content.vue、media/shop.vue、media/analytics.vue、media/customers.vue、media/messages.vue 均为静态产品展示 + 明确「待接入/即将开放」空态，零 mock 数据、零 API 调用（符合页面声明的纪律）；shop.vue:139 声明「昆仑镜不会保存你的平台账号密码」。

`[I-06]` **team.vue roster 逻辑（正面）** — 有真实 agents 时隐藏标准编制卡（:47 `agents.length ? ... : '标准编制 5 名'`），解锁弹窗为营销引导，不冒充运行状态；渠道矩阵状态来自真实 API。

`[I-07]` **后端真实紧急停止端点存在但前端未用** — 与 H-01 呼应：`POST /media-department/emergency-stop|resume`、`GET /emergency-status` 已在 enterprise-agent-runtime.ts 实现，属「有枪不用、用玩具」的典型案例。

`[I-08]` **enterprise/index.vue（招聘指挥中心）** — 数据全部来自真实 API（`/api/enterprise/home`、`agent-profiles`、`subscription/current`、`reports/summary`、`model-config`、`/api/ai/recommendations?workspace=job` 均存在）；visitor 模式用 PREVIEW_AGENTS + 锁定样式明确标注「预览」（:436-449, 731-747），不冒充真实数据（正面）。

`[I-09]` **auth 中间件覆盖（正面）** — `/workspace/*`（含全部 media 页）均走 `definePageMeta({ middleware: 'auth' })` + 全局 middleware，未登录跳 `/?showLogin=1&redirect=...`，链路正确。

`[I-10]` **MediaAgentRoster 组件（正面）** — 锁定卡标注「模板待注册（Sprint-MEDIA-02）」+「不产生假员工数据」，属诚实占位；全组件无网络请求，props 驱动。

`[I-11]` **v-html 全量核查（正面）** — 审计范围内 v-html 共 10 处：MediaWorkspaceShell（:32,42,43,44,61）、media/index.vue（:115,120,125,130）全部为**静态 SVG 字符串**（`S(path)` 模板字面量，无用户输入），安全；唯一动态数据 v-html 即 M-12 talent.vue。

`[I-12]` **employees.vue runTask 依赖死端点** — 通过 `KunlunMediaApi.createTask`（M-01 中 `/tasks` 不存在）执行任务，UI 上「执行任务」按钮因 M-05 字段错位也基本不可达 —— 整条任务执行链路当前为死路。

---

## 审计覆盖清单（实际读取文件）

**pages/workspace/media/（9/9 全读）**
- pages/workspace/media/accounts.vue（1667 行全读，含全部 script 逻辑；样式段略读）
- pages/workspace/media/index.vue
- pages/workspace/media/content.vue
- pages/workspace/media/customers.vue
- pages/workspace/media/analytics.vue
- pages/workspace/media/intelligence.vue
- pages/workspace/media/messages.vue
- pages/workspace/media/shop.vue
- pages/workspace/media/team.vue（script + template 全读，样式段略读）

**pages/media-department/（6/6 全读）**
- pages/media-department/index.vue
- pages/media-department/workspace.vue
- pages/media-department/settings.vue
- pages/media-department/settings/channels.vue
- pages/media-department/analytics.vue
- pages/media-department/employees.vue

**pages/workspace/enterprise/（渠道中心相关）**
- pages/workspace/enterprise/channels.vue（全读 —— 招聘渠道中心，即该目录的「渠道中心」页）
- pages/workspace/enterprise/index.vue（template 头部 + 全部 script 数据逻辑区 420-900 行精读，样式略读）
- pages/workspace/enterprise/ai-employees.vue（script 逻辑区 200-400 精读）
- pages/workspace/enterprise/talent.vue（v-html/XSS 相关行核对）

**components/media/（9/9）**
- components/media/MediaWorkspaceShell.vue（全读）
- components/media/MediaAgentRoster.vue（全读）
- components/media/MediaCapabilitySplit.vue / MediaEmptyState.vue / MediaHealthRing.vue / MediaKpiCard.vue / MediaPageHeader.vue / MediaPanel.vue / MediaPlannedPage.vue（安全模式 grep 核查 + MediaPageHeader 精读）

**API 层 / 插件 / 中间件**
- composables/enterprise/useMediaApi.ts（全读）
- composables/useAIDepartment.ts、useEnterpriseAgents.ts、useEnterpriseDashboard.ts、useEnterpriseContext.ts
- composables/useFetchWithFallback.ts（grep 核查）
- utils/auth-fetch.ts、utils/token-cache.ts、utils/auth/token.ts（全读）
- plugins/token-bridge.client.ts、auth-init.client.ts、store-safety.client.ts、router-error.ts（grep）
- middleware/auth.ts（全读）
- stores/auth.ts（token 处理段精读）、stores/enterprise-command-center.store.ts（grep）
- layouts/enterprise-workspace.vue（身份加载段 70-130 精读）
- pages/workspace/index.vue（全读）

**后端交叉验证（非前端文件，仅用于核对路由/行为）**
- backend/src/routes/enterprise-channel-runtime.ts（全部端点清单）
- backend/src/routes/enterprise-agent-runtime.ts（media-department/employees、emergency-stop、activate/pause/resume、provision）
- backend/src/routes/channels.ts（legacy channel-accounts 模拟授权）
- backend/src/routes/enterprise-channel-center.routes.ts（overview/import/candidates）
- backend/src/routes/enterprise-readonly.routes.ts（media/overview）
- backend/src/routes/agent-identity.ts、enterprise-agent-profiles.ts、enterprise-subscription-billing.ts、enterprise.ts、auth.ts、member.ts、browser-workspace.routes.ts、ai-recommendations.routes.ts
- backend/src/index.ts（全部 /api/enterprise 路由清单 + 适配器注册）
- backend/src/services/enterprise/channel.service.ts（resolveAdapter/权限矩阵）
- backend/src/enterprise/channel/adapters/browser-channels.ts、browser-channel.meta.ts、mock.adapter.ts
- backend/src/plugins/cors.ts
