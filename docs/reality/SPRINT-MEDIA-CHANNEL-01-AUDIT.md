# SPRINT-MEDIA-CHANNEL-01 — Task 01: Media Channel Architecture Audit

**Date:** 2026-08-02
**Gate:** 掌柜战略指令（新媒体工作台升级为「AI 新媒体运营部门」；先审计不写代码，避免多套 Credential / Runtime 架构）

---

## 一、审计结论（TL;DR）

> **后端架构已超前于 UI：掌柜要的 Media Channel SSOT / AI 员工绑定 / 权限模型 / 真实执行链路，90% 已建好且经历过企业招聘阶段的真实验证。缺的不是「造架构」，而是「前端接线 + 双轨收敛 + 授权方式决策」。**
>
> ⚠️ 掌柜担心的「多套 Credential / Runtime 架构」**确实存在**（双轨），但可收敛，无需重建。

---

## 二、已有资产盘点（超预期）

### 1. Media Channel SSOT —— 已存在，且以 Organization 为身份主体 ✅

掌柜设计的 `MediaWorkspace → MediaChannelAccount → OAuth Credential → AI Employee Binding` 已落地为（`backend/prisma/schema.prisma`）：

| 掌柜设计 | 实际模型 | 状态 |
|---------|---------|------|
| MediaWorkspace | **Organization**（企业身份 SSOT，记忆定案） | ✅ |
| MediaChannelAccount | **EnterpriseChannelAccount** | ✅ 字段与设计 99% 对齐 |
| OAuth Credential | **credentialEncrypted**（media 域已 AES 加密） | ⚠️ enterprise 域 ChannelService 仍是明文 TODO |
| AI Employee Binding | **AgentChannelBinding** | ✅ 含权限模型 |

**EnterpriseChannelAccount 关键字段**（7533 行）：
`tenantId / governanceTenantId / organizationId / channelType / channelName / externalAccountId(unique) / credentialEncrypted / connectionStatus(PENDING) / connectedAt / lastSyncAt / lastError / ownerId / ownerType / manageRole(CHANNEL_OWNER) / metadata`

**EnterpriseChannelProvider**（7095 行）：渠道注册表（wechat_work/douyin/kuaishou/weibo...），capabilities 含 `publish/analyze/schedule/reply/createTask`。

### 2. AI 员工层 —— 已存在且真实验证过 ✅

- **EnterpriseAgentProfile**（档案：name/agentType/capabilities/avatarUrl）
- **EnterpriseAgentInstance**（实例：runtime=openclaw / namespace / lifecycleState(ACTIVE|PAUSED|EMERGENCY_STOP|RECOVERING) / totalTasks / lastActiveAt）
- **HermesProfileBinding**（一个 AI 员工 = 一个 Hermes 子代理身份 —— 记忆：AI 猎聘顾问六要素全 PASS 真实验证）
- API：`GET /api/enterprise/media-department/agents`（实例列表）/ `agents/summary`（统计）—— 已按 orgId 严格隔离

### 3. AI 员工 ↔ 渠道绑定 + 权限模型 —— 已存在 ✅

**AgentChannelBinding**（7075 行）：`agentInstanceId + channelAccountId + permissions Json + status(active|paused) + publishCount + scheduleCount`，`@@unique([agentInstanceId, channelAccountId])`

权限模型已含掌柜要求的全部：`{read, reply, createTask, execute, delete, publish, analyze, schedule}`

### 4. 真实执行层 —— 两条链路并存（这是双轨风险点）

**链路 A：media 域 · playwright 浏览器自动化（真实可用）**
- 路由：`/api/enterprise/media-department/media/*`（backend/src/routes/media-platform.ts）
  - `GET/POST /media/accounts`、`POST /media/accounts/connect`（真实启动 headless 浏览器 → creator.douyin.com → 轮询登录状态）、`POST /media/accounts/refresh-cookies`、`GET /media/accounts/health`
  - `POST /media/browser/launch|navigate|save-session|restore-session|close`、`GET /media/browser/cookies`
  - `POST /media/hotspots`、`POST /media/contents` + `/media/contents/review`、**`POST /media/publish`** + `GET /media/publish-records`
- 服务：`MediaPlatformService`（createAccount / encryptCredential(AES) / decryptCredential / refreshCookies / checkAccountHealth）
- 适配器：`PlatformAdapter` 接口（login/createPost/uploadMedia/publish/fetchMetrics/fetchComments）
- **playwright chromium 已装**：`~/.cache/ms-playwright/chromium-1234 + chromium_headless_shell + ffmpeg` ✅

**链路 B：enterprise 域 · 渠道适配器接口（仅 mock）**
- `EnterpriseChannelAdapter` 接口（publish/schedule/fetchInteractions/fetchHealth）
- `ChannelService`（connectAccount/publish/fetchInteractions/getGrowthFunnel）+ **MockChannelAdapter**（假数据）

**遗留 C：旧页面双轨**
- `frontend/pages/media-department/*`（旧版新媒体运营中心，调 `/api/enterprise/media-department/employees`）—— 与新 `workspace/media/*` 并存，前端也有两套

### 5. 凭证基础设施（不要混淆）

- **ProviderCredential** = 大模型 BYOK 凭证（deepseek 等模型 key，AES 加密 + 健康检查）—— 与渠道账号凭证**无关**
- **CredentialVault / ResourceCredential** = GEO/平台资源凭证（另一条业务线）
- 渠道账号凭证 = `EnterpriseChannelAccount.credentialEncrypted`（media 域已加密，enterprise 域 ChannelService 明文 TODO 加密）

---

## 三、核心问题

### 问题 1：前端零接线（最痛）
`workspace/media/*` 8 页全部静态展示（accounts.vue 等 **零 fetch 调用**），后端完整链路完全没接 UI。掌柜看到的「未连接」= 前端没调 API，不是后端没有。

### 问题 2：双轨 Credential/适配器架构（掌柜担忧坐实）
- media 域：真实浏览器自动化（PlatformAdapter + playwright）
- enterprise 域：EnterpriseChannelAdapter 接口 + mock
- 两套凭证处理：media 域已加密 / enterprise 域明文
- 前端两套页面：workspace/media（新壳）+ media-department（旧页）

### 问题 3：OAuth 决策未定（Task 03 关键决策点）
- **官方 OAuth API**（open.douyin.com）：需企业主体开发者资质 + 行业资质 + 应用审核；视频发布/数据 API 权限门槛极高，个人与多数小团队拿不到
- **浏览器自动化**（已有真实链路）：绕开资质，headless chromium 已装，AI 迷你浏览器扫码登录可行；脆弱点 = 平台页面结构变化 / 验证码 / 风控

### 问题 4：AI员工 → 渠道 → 真实数据闭环未接
AgentChannelBinding 存在但无前端管理 UI；fetchMetrics（读真实数据）接口存在但未接；AI 数据分析员工未消费真实数据生成运营建议；首页 dashboardData 双态渲染就绪但无数据源。

---

## 四、建议路线（供掌柜决策）

### 决策点 A：授权方式
**推荐：浏览器自动化为主（第一闭环最快），官方 OAuth 为后续增强。**
理由：① 真实链路已存在且 chromium 已装；② 抖音开放平台视频发布 API 资质门槛现实不可达；③ 浏览器扫码登录对老板是「扫码即连」，体验最好。

### 决策点 B：SSOT 收敛（消灭双轨）
**以 enterprise 域模型为 SSOT**（EnterpriseChannelAccount + AgentChannelBinding 已是掌柜要的架构），media 域浏览器链路作为**执行适配器**下沉：实现 `DouyinAdapter implements EnterpriseChannelAdapter`（内部用 playwright + 加密凭证），Mock 只留开发用。旧 `pages/media-department/*` 标记 deprecated 或删除。

### 决策点 C：第一闭环（修正版 Task 03）
不做「官方 OAuth 授权页」，做**「扫码连接」**：
```
前端 accounts.vue「连接抖音」→ POST /media/accounts/connect（起 headless 浏览器进 creator.douyin.com）
→ 前端嵌 AI 迷你浏览器（MiniAIBrowser 已存在）扫码/登录
→ 保存加密凭证（save-session + encryptCredential）
→ accounts 页显示「已连接」（真实账号名/头像）
→ AI 员工（Alice）读取 fetchMetrics 真实数据
→ 首页 dashboardData 点亮（内容影响/客户增长/销售转化真实数字）
→ AI 数据分析员工生成运营建议（真实数据驱动的第一条链）
```

### 不建议现在做的
❌ 官方 OAuth 全套（等资质）❌ 多平台并行（先抖音）❌ 自动发布矩阵 ❌ 自动涨粉分析

---

## 五、执行顺序建议

| 阶段 | 内容 | 依赖 |
|------|------|------|
| T03 | 前端 accounts.vue 接线 + 扫码连接抖音 + 凭证落库 | 决策 A/B |
| T04 | DouyinAdapter（浏览器执行层下沉 enterprise 接口）+ 双轨收敛 | T03 |
| T05 | AI员工读取真实数据（fetchMetrics）+ 首页数据点亮 | T04 |
| T06 | 运营建议生成（数据分析员工）+ Reality Gate | T05 |
| T07 | 复制到小红书/视频号/B站（同构复制） | T06 验证通过 |

## 六、Reality Gate（T04 定义）
- 真实账号扫码登录 → 凭证加密落库 → 重新读取仍有效
- fetchMetrics 返回真实粉丝/播放/互动数（与抖音创作者后台一致）
- AI 员工按 AgentChannelBinding 权限读取，无越权
- 首页数字来自真实数据（非 mock）
- 抖音断连/凭证过期 → accounts 页状态正确降级

---
**审计完成，等待掌柜决策：授权方式（A 浏览器自动化 / B 官方 OAuth）与 SSOT 收敛批准后进入 Task 02 架构冻结。**
