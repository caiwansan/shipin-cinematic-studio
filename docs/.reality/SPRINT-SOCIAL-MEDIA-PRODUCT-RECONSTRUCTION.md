# SPRINT-SOCIAL-MEDIA-PRODUCT-RECONSTRUCTION — 新媒体运营产品重构设计

**Date:** 2026-08-02 01:40
**Gate:** 掌柜战略指令（新媒体不是「工作台 + AI 生成 + 人工发布」的 AIGC 工具，而是「用户授权账号 → AI 员工接管 → Hermes 执行 → 持续运营 → 数据反馈 → 商业转化」的 AI Employee 产品）
**性质:** Reality Audit + 重构设计文档。**本 Sprint 不修改任何代码**，等掌柜确认后拆 Sprint。

---

## 1. 当前实现审计（/media-department 现状）

### 1.1 事实基线（代码级取证，非猜测）

| 层 | 现状 | 证据 |
|----|------|------|
| 前端 | 6 页：index / workspace / settings / analytics / employees / settings/channels（共 3800 行） | `frontend/pages/media-department/*` |
| 导航 | workspaces.ts 标记 `status: 'preview'`、`completion: 45%`、`note: '内部媒体部门管理，半完成'` | `frontend/config/workspaces.ts:116-123` |
| 后端 | `/api/enterprise/media-department/*` 真实端点：state / employees CRUD / agents / agents/summary / emergency-stop/resume/status | `backend/src/routes/enterprise-agent-runtime.ts` `enterprise-agents.ts` `media-department-state.ts` |
| 新媒体死代码 | `media-platform.routes.ts`（527 行，/media/* 全端点）**从未注册**；`media-platform.service.ts` 引用不存在的 Prisma 模型；`platform-adapter.ts` 仅接口无任何平台实现；`browser-runtime.service.ts` Playwright 方案 | grep import=0；生产实测 `GET /api/media/accounts` → **404**；`prisma.mediaPlatformAccount` 等 4 模型 client 全 undefined；schema 无 media_* 模型；`media_credential_vault` 无 migration 建表 |
| 员工创建 | POST /media-department/employees 只写 `EnterpriseAgentProfile` 一行（runtimeStatus 默认 `draft`），**不部署 Hermes runtime** | `enterprise-agent-runtime.ts:551-620` |
| 页面占位 | analytics.vue **零数据加载**（仅登录检查 + empty-state）；index.vue 注释「今日运营状态（占位，Phase 2 实现）」、`connectedPlatforms=[]` 硬编码空 | analytics.vue:60-90、index.vue:102 |

### 1.2 已有（可复用资产，真实且健康）

- **企业 AI 员工运行时（招聘线成果）**：`EnterpriseAgentProfile`（runtimeStatus/runtimeAgentId/runtimeType）、`AgentSchedule`（daily/weekly/cron + taskTemplate + nextRunAt）、`AgentGoal`（scan/analyze/content/outreach）、`HermesProfileBinding`、`AgentTemplate`、`CapabilityContract/Grant`、`AgentModelBinding`、`usage_logs`、`AgentOutcome`、provision 端点（`/api/enterprise/agent-runtime/provision`，agent_template 优先 + activate 接线）、agent-brain 执行器
- **模型路由（BYOK）**：`OrgModelConfig` + `ProviderCredential` → `model-resolver`（KMKI AI Runtime Principle 已冻结）
- **渠道资产（招聘线）**：`EnterpriseChannelProvider`（含 wechat_work/douyin/kuaishou/weibo 等 8 渠道，统一 🟡 接入准备中）、`EnterpriseChannelAccount` + bindings——**结构可借鉴，语义不可直接复用**
- **价值层**：`AgentOutcome` 统一表 + outcome-registry（禁 Workspace 自建结果表）；`UsageLog` 真实成本归因
- **记忆层（可借鉴）**：`AgentMemory` 带 `embeddingVector` 字段（重复检测可复用此模式）
- **商业层**：Commerce Authority（Product→Order→Subscription→Entitlement→Provision）已闭环（招聘/求职两线验证）

### 1.3 缺失（对照掌柜十部分）

| # | 掌柜要求 | 现状 |
|---|---------|------|
| 1 | Social Workspace（/workspace/media） | ❌ 只有后台部门页 /media-department |
| 2 | AI 员工（总监/策划/生产/客服/数据 5 岗 + capability） | ⚠️ 有 agentType 字符串枚举（director/hotspot_analyst/content_creator/content_reviewer/sales/support/data_analyst）但：无岗位模板、无 media capability 注册、创建不部署 → **员工永远不运行** |
| 3 | SocialAccount（授权/Token/同步/发布/消息权限） | ❌ 无模型；`mediaPlatformAccount` 不存在；无授权闭环 |
| 4 | 数据同步层（内容/互动/私信 → AI Memory） | ❌ 无 Sync Worker、无 SocialMessage、无互动数据模型（ConversationMessage 属招聘线） |
| 5 | 每日运营闭环（Scheduled Agent Task） | ❌ 无任何媒体定时任务（AgentSchedule 表存在但媒体零占用） |
| 6 | 平台规则智能（Compliance Agent/敏感词/限制） | ❌ 无 |
| 7 | 内容重复检测（embedding） | ❌ 无媒体内容记忆 |
| 8 | 私域运营（企业微信/客户/标签/真人接管） | ❌ 无（CustomerChatMessage 是旧通用客服，非私域客户） |
| 9 | 客户价值（CustomerProfile：intentScore/valueLevel/转化概率） | ❌ 无 |
| 10 | 运营日报（AI 生成 DailyOperationReport） | ❌ 无；analytics.vue 空壳 |

### 1.4 错误（必须纠正的设计）

1. **产品定位错误**：页面是「企业 AI 员工管理壳」+「招聘渠道 API 复用」（channels.vue 调 `/api/enterprise/channel-accounts`——招聘渠道 ≠ 新媒体发布渠道，语义错位）
2. **死代码误导**：media-platform.ts 声称 Phase 3.1 交付但从未挂载、模型不存在、表不存在——若有人误注册会 500 全炸（PrismaClientUnknownModelError）
3. **假运营风险**：创建员工不部署 runtime → 用户以为 AI 在干活实际没干（与招聘线 G4 教训同源）
4. **analytics 空壳 + 首页占位**：半成品标记 preview 却可访问，违背诚实原则

### 1.5 风险

- **Playwright 浏览器自动化方案（cookie 登录 → 页面操控发布）**：平台方（抖音/小红书/微信）明令禁止自动化，封号合规风险高；选择器脆弱维护成本爆炸；且与「真实 API 商务接入」路线冲突 → **整体废弃，不修不补**
- 账号凭证如沿用旧 base64「加密」方案（`Buffer.from().toString('base64')`）→ 明文等效，严重违规（对比 BYOK ProviderCredential 加密标准）
- 无 SocialAccount → 无法授权闭环 → 无法真实发布 → 只能造假 → 触犯冻结红线（❌ 假渠道/假发布）

---

## 2. 新产品架构设计

> 定位：**新媒体 = AI Employee 产品线**。用户授权账号（企业资产），AI 员工（Hermes runtime）接管账号持续运营，平台负责编排/合规/记忆/价值分析，**不托管企业 Key（BYOK），不伪造发布（真实平台 API）**。

### 2.1 Frontend IA

```
/workspace/media（新入口，替代 /media-department）
├── 总览 dashboard      —— 今日运营状态 / AI 员工运行状态 / 待办 / 日报入口
├── 账号中心 accounts   —— 平台授权（扫码/回调）、Token 健康度、同步状态、解绑
├── 内容中心 content    —— 热点榜 → 内容日历 → 草稿 → 合规检查 → 发布队列 → 已发布
├── 消息中心 messages   —— 私信/评论聚合、AI 回复、潜客识别、真人接管
├── 客户中心 customers  —— CustomerProfile 列表、价值分层、标签、转化
├── 数据中心 analytics  —— 表现分析 / 客户价值 / 增长日报（真实数据，无空壳）
└── AI 团队 team        —— 5 岗 AI 员工卡片（部署状态 / 今日任务 / 执行记录 / 成本）
```

### 2.2 Backend Service

```
media-workspace（新模块，遵守 SSOT：不建 Workspace 级模型配置）
├── account.service      —— SocialAccount 授权闭环（OAuth/扫码 + ProviderCredential 加密）
├── sync.worker          —— 平台数据拉取（内容/互动/私信）→ SocialDataLayer → AgentMemory
├── publish.service      —— 草稿→合规→去重→真实 API 发布（ChannelProvider 商务接入）
├── compliance.service   —— 平台规则库 / 敏感词 / 违规案例 / 时段规则
├── dedup.service        —— 内容 embedding 记忆（复用 AgentMemory 模式）
├── message.service      —— 私信/评论聚合、意图识别、真人接管路由
├── customer.service     —— CustomerProfile 价值分层（intentScore/valueLevel）
├── report.service       —— DailyOperationReport 生成（AI + 真实数据）
└── outcome hooks        —— 全部埋点走 agent_outcome（禁自建结果表）
```

### 2.3 Database Schema（新增，全部归 Organization）

```prisma
model SocialAccount {            // 新媒体账号（企业资产）
  id, organizationId, platform   // wechat_mp/video_account/douyin/xiaohongshu/bilibili/weibo/zhihu
  accountName, accountId, avatar
  credentialId      → ProviderCredential（加密，非 base64）
  status            // pending_auth / active / token_expired / revoked
  publishEnabled, messageEnabled  // 发布权限 / 消息权限（掌柜四权限）
  lastSyncAt, lastPublishAt
}

model SocialPost {               // 发布记录
  id, organizationId, accountId, agentId?
  title, body, mediaUrls[], platform
  status            // draft / compliance_passed / queued / published / failed / rejected
  complianceResult  Json（敏感词命中/规则检查）
  dedupResult       Json（embedding 相似度）
  platformPostId, platformUrl, publishedAt
  metricsSnapshotId?
}

model SocialMessage {            // 私信/评论（掌柜字段）
  id, organizationId, accountId, postId?
  direction        // inbound / outbound
  sender, content, messageTime
  intent           // 咨询/投诉/合作/采购线索/闲聊
  customerValue    Float?   // 客户价值分
  status           // new / ai_replied / human_handoff / closed
  handledBy        // agentId | userId
}

model SocialMetricsSnapshot {    // 互动数据（点赞/收藏/评论/转发/阅读）
  id, organizationId, accountId, postId?
  date, followers, reads, likes, comments, shares, collects, forwards
}

model CustomerProfile {          // 客户价值（掌柜字段）
  id, organizationId, platform, platformUserId
  identity, industry
  intentScore Int, valueLevel   // 普通/潜客/高价值/VIP/合作伙伴
  conversionProbability Float
  lastInteractionAt, tags[]
  linkedAgentId?               // 负责的 AI 员工
}

model DailyOperationReport {
  id, organizationId, reportDate, generatedBy
  publishedCount, interactions, newCustomers, messagesHandled
  aiTasksCompleted, anomalies, tomorrowPlan   // 掌柜七要素
  costAttribution Json
}

model ComplianceRule {           // 平台规则库
  id, platform, ruleType   // sensitive_word/content_limit/time_rule/case
  keyword, description, severity, enabled
}
```

### 2.4 Hermes Agent Design（5 岗，全部走 AgentTemplate + provision）

| 岗位 | agentType | capabilities | 说明 |
|------|-----------|--------------|------|
| 新媒体运营总监 | media_director | strategy_planning / daily_operation / task_dispatch / report_generation | 每日晨会拆解任务到各岗 |
| 内容策划 | media_planner | trend_analysis / competitor_monitor / topic_generation / content_calendar | 热点抓取 + 日历 |
| 内容生产 | media_producer | article_generate / video_script / image_generate / platform_adaptation | 多平台适配 |
| 客服 | media_cs | message_receive / conversation_reply / lead_identification / human_handoff | 私信/评论 + 潜客 |
| 数据分析 | media_analyst | performance_analysis / customer_value_score / growth_report | 日报 + 价值分 |

> 注：旧枚举（hotspot_analyst/content_creator/content_reviewer）作废迁移；5 岗模板注册进 `AgentTemplate`（agent_template 优先，provision 复用），员工创建即部署 Hermes（runtimeStatus=draft 历史数据一并激活或标记废弃）。

### 2.5 Capability Catalog（能力注册到 CapabilityContract/Grant）

```
media.* 命名空间（与 recruitment.*/career.* 平级）
media.planning.strategy / media.planning.calendar
media.produce.article / media.produce.script / media.produce.image / media.produce.adapt
media.customer.reply / media.customer.lead / media.customer.handoff
media.analytics.performance / media.analytics.value / media.analytics.report
media.compliance.check / media.dedup.check（平台侧能力，非生成模型能力）
```

### 2.6 Runtime Flow（每日闭环，AgentSchedule 复用）

```
02:00 Scheduler 触发 media_director 日任务（cron，AgentSchedule）
  ├─ 热点抓取（真实数据源）→ media_planner 生成内容日历
  ├─ 合规检查（ComplianceRule）→ 重复检测（embedding）→ 草稿
  ├─ 人工审批（可选开关）→ 真实 API 发布（ChannelProvider 商务接入）
  ├─ Sync Worker 拉取昨日数据 → SocialMetricsSnapshot → AgentMemory
  ├─ 私信/评论 → media_cs 回复 / 潜客识别 → CustomerProfile
  └─ media_analyst 生成 DailyOperationReport → 全部埋 agent_outcome + usage_logs
```

### 2.7 Commerce Model

- 沿用 **Commerce Authority**（零新增套餐系统）：新媒体权益挂在订阅 Entitlement（`max_social_accounts` / `max_publish_per_day` / `ai_employee_slots` / `platforms[]`）
- 新增套餐档位由掌柜定（候选：新媒体基础版/专业版/旗舰版），**先有真实能力再卖权益**（延续「配置不完整→运行中」教训）
- 平台 API 商务接入（抖音/小红书/微信开放平台）为独立成本项，记 `usage_logs` 真实成本归因

---

## 3. 开发路线（小步快跑，每 Phase 独立 Gate）

```
Phase 0  Reality Audit（本 Sprint，已完成）——掌柜确认设计
   ↓
Phase 1  Account Connection MVP
         SocialAccount + ProviderCredential 加密 + 单平台（微信公众平台）真实 API 授权/发布/数据同步
         Gate: 真实发布一条内容 + 真实拉回数据（不造假）
   ↓
Phase 2  AI Employee Runtime
         5 岗 AgentTemplate 注册 + provision 部署 + media.* capability + 员工创建即运行
         Gate: 员工真实执行任务（usage_logs + outcome 落库）
   ↓
Phase 3  Content Operation Loop
         热点/日历/合规/去重/发布队列 + AgentSchedule 每日闭环 + 多平台接入
         Gate: 连续 7 天无人值守闭环
   ↓
Phase 4  Customer Operation
         SocialMessage + CustomerProfile + 价值分层 + 真人接管 + 私域（企业微信）
         Gate: 潜客识别→转化追踪真实链路
   ↓
Phase 5  Commercialization
         DailyOperationReport + 新媒体套餐上架 + ROI 罗盘（真实成本/真实价值）
         Gate: 付费转化闭环（同职业助理验收标准）
```

**前置依赖（Phase 1 阻塞项）**：新媒体平台开放平台商务资质/API 权限申请（微信公众平台接口权限、抖音开放平台、小红书专业号 API）——需掌柜确认商务路径；在此之前 Phase 1 保持「授权闭环 + 单平台真实 API」最小化，**禁止 mock 发布/假数据同步**。

---

## 附：冻结红线（本产品线适用）

❌ Playwright 浏览器自动化操控平台（废弃旧方案）
❌ 假发布/假数据同步/假渠道状态
❌ 平台托管企业 Key（BYOK 冻结）
❌ 账号凭证 base64 明文（必须 ProviderCredential 加密标准）
❌ 自建结果表（统一 agent_outcome）
❌ Workspace 级模型配置（KMKI Runtime Principle）
⏸ /media-department 旧页面：保留可访问但导航标记「重构中」，Phase 1 完成后迁移 /workspace/media

**审计证据索引**：`frontend/pages/media-department/*`、`frontend/config/workspaces.ts:116`、`backend/src/routes/media-platform.ts`（未注册）、`backend/src/services/media/*`（4 模型 undefined）、`backend/src/routes/enterprise-agent-runtime.ts:551`（员工只建 profile）、`analytics.vue:60-90`（空壳）、生产实测 `/api/media/accounts` → 404
