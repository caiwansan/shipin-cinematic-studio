# SPRINT-MEDIA-WORKSPACE-RECONSTRUCTION-01 — 完整审计与设计方案

> **Date**: 2026-08-08
> **Auditor**: OpenClaw (AI Architect)
> **Scope**: 前端 9 页面 + 后端媒体服务 + 数据库 + Runtime 全链路
> **方法**: 代码逐行审查 + 模型映射 + API 端点追踪 + 架构设计
> **文件数**: 9 合 1

---

## 目录

- [Part 1: Reality Audit — 现状审计](#part-1-reality-audit--现状审计)
- [Part 2: Product Blueprint — 产品蓝图](#part-2-product-blueprint--产品蓝图)
- [Part 3: AI Employee Spec — AI 员工产品模型](#part-3-ai-employee-spec--ai-员工产品模型)
- [Part 4: Capability Map — 能力地图](#part-4-capability-map--能力地图)
- [Part 5: Adapter Spec — 外部平台 Adapter 架构](#part-5-adapter-spec--外部平台-adapter-架构)
- [Part 6: Permission Model — AI Agent 权限系统](#part-6-permission-model--ai-agent-权限系统)
- [Part 7: Data Ownership Map — 数据所有权映射](#part-7-data-ownership-map--数据所有权映射)
- [Part 8: UX Blueprint — UX 蓝图](#part-8-ux-blueprint--ux-蓝图)
- [Part 9: Design Gate — 设计放行审查](#part-9-design-gate--设计放行审查)

---

# Part 1: Reality Audit — 现状审计

## 审计摘要

| 维度 | 评级 | 一句话 |
|------|------|--------|
| AI Employee 产品化 | ⚠️ PARTIAL | AgentTemplate/Profile/Instance ✅ 但 Hermes 子代理绑定仅限招聘/求职，**媒体域未连接 Hermes** |
| CRUD vs AI 产品 | ❌ FAIL | 9 个前端页面中 **7 个是静态空壳**（`supported:false`），2 个(accounts/team)有真实数据但非 AI 驱动 |
| 外部平台接入 | ⚠️ PARTIAL | 抖音/快手/小红书/视频号 ✅（Browser自动化），微博/B站/淘宝/京东/美团 ❌ |
| 宪法合规性 | ⚠️ PARTIAL | Platform/Workspace 分层 ✅，但 **Capability Map 缺失**、**数据所有权映射缺失** |
| 权限系统 | ❌ FAIL | 无 AI Agent 权限模型，无用户审批/自动/紧急停止机制 |
| 客户图谱 | ❌ FAIL | 无 CustomerIdentity 表、无图谱数据结构 |

---

## 1. 当前是不是 AI Employee 产品？

### 1.1 Agent 三层模型 — ✅ 存在

| 模型 | 表名 | 状态 | 说明 |
|------|------|------|------|
| AgentTemplate | `agent_template` | ✅ 有数据 | 岗位模板（recruiter/interview/director/content...） |
| EnterpriseAgentProfile | `enterprise_agent_profile` | ✅ 有数据 | 企业员工（businessType 字段做域隔离） |
| EnterpriseAgentInstance | `enterprise_agent_instance` | ✅ 有数据 | 运行实例（绑定 employeeId，含 runtimeStatus） |

### 1.2 Hermes Runtime 连接 ⚠️ 部分

| 组件 | 状态 | 问题 |
|------|------|------|
| HermesProfileBinding | ✅ 表存在 | Hermes 子代理绑定（hermesAgentId, soulMdContent, toolAllowList, memoryNamespace） |
| HermesProfileService | ✅ 服务存在 | 创建/查询/更新绑定 |
| HermesAdapter | ✅ 适配层存在 | KAOR → Hermes Runtime 桥接 |
| **媒体域 Agent 绑定** | ❌ **未实现** | `HermesProfileBinding` 表中 **media 域 agent 无记录**，Profile/Instance 有 Hermes 配置但无运行时连接 |
| **SOUL.md 注入** | ❌ **未实现** | AI 员工无个性化灵魂文件，agent 无身份认知 |

**结论**：Agent 三层模型物理存在，但 **媒体域 AI 员工没有真正运行 Hermes 子代理**。Profile/Instance 只是数据记录，不是运行实体。

### 1.3 Scheduler/Worker/Execution — ⚠️ 骨架存在

| 组件 | 状态 | 说明 |
|------|------|------|
| AgentSchedule | ✅ 表 + 服务 | cron 排程（支持 daily/weekly/cron，nextRunAt 到期触发） |
| AgentScheduler | ✅ 运行时时钟 | 每分钟 tick 检查到期任务 |
| AgentOutcome | ✅ 表 + 写入 | 执行结果（outcomeType, metricValue, metadata） |
| AgentGoal | ✅ 表 | 日目标（goalType: scan/analyze/content/outreach, targetCount/actualCount） |
| Worker Runtime | ✅ 存在 | `worker-runtime-bridge.ts` 连接队列和执行引擎 |
| **媒体域 Schedule** | ❌ **无数据** | AgentSchedule 表中 **无 media 域任务** |

### 1.4 Capability Binding — ❌ 形同虚设

| 检查项 | 状态 |
|--------|------|
| Capability 注册（Platform Capability Registry） | ✅ 框架存在 |
| Capability Resolver | ✅ 路由策略存在（balanced/cost-first/latency-first/quality-first） |
| Media Agent 绑定 Capability | ❌ **无 `media.*` Capability 注册** |
| TASK_CAPABILITY_MAP | ⚠️ 仅映射 `career_agent`，无媒体任务 |

### 1.5 Permission Control — ❌ 完全缺失

| 检查项 | 状态 |
|--------|------|
| AI 可执行动作白名单 | ❌ 无 |
| 用户审批模式 | ❌ 无 |
| 自动模式 | ❌ 无 |
| 紧急停止 | ❌ 无 |
| 操作日志 | ⚠️ AgentAuditTrail 存在但非权限模型 |

### 📊 小结

```
AgentTemplate/Profile/Instance    ✅ PASS
Hermes Runtime 绑定               ⚠️ PARTIAL (仅招聘域)
Scheduler/Worker/Execution        ⚠️ PARTIAL (骨架有，无媒体任务)
Capability Binding                ❌ FAIL
Permission Control                ❌ FAIL
```

**综合：PARTIAL** — 有 AI 员工的三层数据模型，但 **媒体域 AI 员工不是运行实体**，只是数据库里的记录。

---

## 2. 当前 Workspace 是否只是 CRUD 页面？

### 2.1 页面审查

| 页面 | 真实 AI 员工数据 | 空壳/静态 | 说明 |
|------|-----------------|-----------|------|
| `index.vue` | ✅ 读 overview API | — | 驾驶舱：agents/today/calendar/usage，有真实数据（但 overview 是聚合统计，非 AI 员工视角） |
| `team.vue` | ⚠️ 读 overview + 静态 roster | 半空壳 | agents 列表真实，但标准编制（未解锁）= 硬编码假数据；渠道状态矩阵 = 硬编码假映射 |
| `accounts.vue` | ✅ BrowserWorkspace + ChannelAccount | — | 真实数据：AI员工→工作电脑→平台账号，但 **不是 AI 驱动**，是手动扫码 |
| `content.vue` | ❌ | ✅ 静态 | 生产线六道工序 = 纯 UI，零后端数据 |
| `messages.vue` | ❌ | ✅ 静态 | 六步客户运营流程 = 纯 UI |
| `shop.vue` | ❌ | ✅ 静态 | 商品/订单/销售 = 纯 UI，全部 "等待连接" |
| `analytics.vue` | ❌ | ✅ 静态 | 数据分析 = 纯 UI，全部 "待数据回流" |
| `intelligence.vue` | ❌ | ✅ 静态 | 行业雷达 = `supported:false`，四象限全部空 |
| `customers.vue` | ❌ | ✅ 静态 | 客户中心 = 纯 UI |

### 2.2 缺失的 AI 员工要素

| 要素 | 存在? | 应在哪里 |
|------|-------|---------|
| AI 员工身份（我是谁） | ❌ | team.vue 应展示：角色/灵魂/使命/状态 |
| AI 员工目标（今天要做什么） | ❌ | index.vue 应展示：今日目标/进度 |
| AI 员工长期任务 | ❌ | team.vue 应展示：周期性任务列表 |
| AI 员工执行记录 | ⚠️ | overview 有 recentOutcomes 但非员工视角 |
| AI 员工结果反馈 | ❌ | 无反馈闭环（执行→结果→优化→执行） |
| 人工接管入口 | ❌ | 无 "暂停 AI" / "我来处理" 按钮 |

### 📊 小结

**FAIL** — 9 个页面中 **7 个是静态空壳**，2 个有真实数据但视角是「账号管理」而非「AI 员工管理」。当前产品 ≈ **带 AI 员工皮肤的传统运营后台**，不是 AI Employee 驱动产品。

---

## 3. 外部平台接入矩阵

### 3.1 新媒体平台

| 平台 | Browser Automation | 官方 API | 凭证存储 | 会话管理 | 账号绑定 | 状态 |
|------|-------------------|----------|----------|----------|----------|------|
| 抖音 | ✅ Playwright + CDP | ❌ | ✅ Profile 持久化 | ✅ Cookie/Session | ✅ ChannelAccount | 🟡 登录已验证 |
| 快手 | ✅ Playwright + CDP | ❌ | ✅ Profile 持久化 | ✅ Cookie/Session | ✅ ChannelAccount | 🟡 登录已验证 |
| 小红书 | ✅ Playwright + CDP | ❌ | ✅ Profile 持久化 | ✅ Cookie/Session | ✅ ChannelAccount | 🟡 登录已验证 |
| 视频号 | ✅ Playwright + CDP | ❌ | ✅ Profile 持久化 | ✅ Cookie/Session | ✅ ChannelAccount | 🟡 登录已验证 |
| 微博 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |
| B站 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |

### 3.2 电商平台

| 平台 | Browser Automation | 官方 API | 凭证存储 | 会话管理 | 账号绑定 | 状态 |
|------|-------------------|----------|----------|----------|----------|------|
| 淘宝 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |
| 京东 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |
| 微信小店 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |
| 美团 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |
| 拼多多 | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 未接入 |

### 3.3 平台接入架构分析

```
当前架构（已实现）：
  用户 → 扫码 → Playwright 浏览器 → 持久化 Profile → Cookie/Session
    → EnterpriseChannelAccount（连接状态机）
    → BrowserWorkspace（数字电脑）
    → AgentBinding（AI员工绑定到 BrowserWorkspace）

缺失架构（未实现）：
  外部平台 → Webhook/Event → 事件总线 → AI员工感知
  AI员工 → Capability → 外部平台 API（发布内容/发私信/读数据）
  电商店铺 → SDK Adapter → 统一 ChannelAccount 模型
```

**关键问题**：当前平台接入只有「浏览器自动化」一条腿。电商店铺（淘宝/京东/美团）大多只有 API 没有浏览器页面，**纯浏览器路线无法覆盖电商**。

### 📊 小结

**PARTIAL** — 4 个新媒体平台已接入浏览器自动化，但 5 个电商平台完全空白，且缺乏 API 对接路径。

---

## 4. 宪法合规性审查

### 4.1 兼容项

| 宪法条款 | 状态 | 说明 |
|----------|------|------|
| KMKI-CONST-001 分层不可逆转 | ✅ | Workspace → Adapter → API → Runtime → Provider |
| KMKI-CONST-003 Platform 禁止 import Workspace | ✅ | 无反向依赖 |
| KMKI-CONST-011 Workspace 必须实现 Adapter | ✅ | media-department 有 adapters/ 目录 |
| KMKI-CONST-013 Adapter 属于 Workspace | ✅ | Adapter 在 media-department/ 下 |
| KMKI-CONST-015 Credential 在 Vault | ✅ | 凭证加密存储在 EnterpriseChannelAccount.credentialEncrypted |
| KMKI-CONST-020 架构分层归属 | ✅ | Presentation/Application/Runtime/Provider 分层清晰 |
| BYOK 铁律 | ✅ | 所有 AI 调用走 UserModelConfigV2 |
| Runtime Principles 第 4 条 Worker 独占 | ✅ | AI 调用走 Worker Runtime |

### 4.2 冲突/缺失项

| 宪法条款 | 状态 | 问题 |
|----------|------|------|
| KMKI-CONST-005 Capability 唯一入口 | ⚠️ | Capability Registry 框架有，但**无 `media.*` Capability 注册** |
| KMKI-CONST-008 所有 AI 调用可追踪 | ⚠️ | AgentAuditTrail 存在，但无 Trace Event 结构化 |
| KMKI-CONST-009 统一 Response Schema | ✅ | overview API 已用 `{code, data}` 格式 |
| KMKI-CONST-012 Workspace 禁现 Provider 名 | ✅ | 无硬编码 |
| KMKI-CONST-024 数据唯一所有权 | ❌ | **无新媒体数据 → Owner Center 映射** |
| KMKI-CONST-021 状态唯一所有权 | ⚠️ | BrowserWorkspace 状态谁 Owner？定义模糊 |
| **AI Agent 权限模型** | ❌ | **宪法完全缺失** |

### 📊 小结

**PARTIAL** — 架构分层和 BYOK 合规良好，但 Capability 缺失、数据所有权未映射、权限系统完全空白。

---

## 5. 基础设施评估

### 5.1 已有能力（可复用）

| 能力 | 组件 | 状态 |
|------|------|------|
| 浏览器自动化 | `browser-runtime.service.ts` (Playwright + CDP + Profile) | ✅ 生产级 |
| AI Agent 三层模型 | AgentTemplate/Profile/Instance | ✅ 数据层完整 |
| Hermes 子代理绑定 | HermesProfileBinding | ✅ 绑定层完整 |
| 定时任务引擎 | AgentScheduler + AgentSchedule | ✅ 运行中 |
| 执行结果层 | AgentOutcome (SSOT) | ✅ 写入链路 |
| 目标追踪 | AgentGoal (goalType/targetCount/actualCount) | ✅ 数据模型 |
| 渠道路由 | Capability Resolver (4 种策略) | ✅ 框架就绪 |
| 凭证加密 | EnterpriseChannelAccount.credentialEncrypted | ✅ 已实现 |
| 排他锁 | per-session 串行锁 | ✅ 防止并发踩踏 |

### 5.2 缺失能力（需新建）

| 能力 | 优先级 | 说明 |
|------|--------|------|
| AI 员工 → Hermes 子代理实际运行 | P0 | 当前仅绑定记录，无运行时灵魂注入、无子代理进程 |
| Capability `media.*` 注册 | P0 | content.generate/trend.analysis/competitor.analysis/customer.profile 等 |
| 客户图谱数据模型 | P0 | CustomerIdentity/Relation 表 + 图查询 |
| AI Agent 权限系统 | P0 | 动作白名单/审批/自动/停止/日志 |
| 外部平台 Adapter 接口 | P1 | 统一 ChannelAccount 行为 |
| 内容/发布/私信执行层 | P1 | 通过 Capability 路由到具体执行器 |
| 行业雷达数据源 | P2 | 热点/竞品/规则数据采集 |
| 电商平台 SDK Adapter | P2 | 淘宝/京东/美团 API 适配 |
| 实时事件总线 | P2 | Webhook 接收外部平台事件 |

---

## 6. 结论

### 一句话

**当前新媒体运营工作台是「带 AI 员工皮肤的传统账号管理系统」，不是 AI Employee 驱动产品。**

### 距离 AI Employee 产品的差距

| 维度 | 当前 | 目标 | 差距 |
|------|------|------|------|
| AI 员工运行 | ❌ 数据记录 | ✅ Hermes 子代理持续运行 | 🔴 大 |
| 自主执行 | ❌ 无定时任务 | ✅ 定时分析+发布+互动 | 🔴 大 |
| 客户图谱 | ❌ 无数据模型 | ✅ 跨平台客户统一视图 | 🔴 大 |
| 权限控制 | ❌ 无 | ✅ 分级模式+审批+紧急停止 | 🔴 大 |
| 电商接入 | ❌ 0/5 | ✅ 5 店铺平台 | 🔴 大 |
| 新媒体接入 | ✅ 4/6 | ✅ 6 平台 | 🟡 中 |
| 浏览器自动化 | ✅ 生产级 | ✅ 直接复用 | 🟢 小 |
| 三层 Agent 模型 | ✅ 数据层 | ✅ 运行时注入 | 🟡 中 |
| 定时引擎 | ✅ 骨架 | ✅ 填充媒体任务 | 🟡 中 |

### 最大瓶颈

不是代码，是**产品架构未定义**。当前代码是「先做页面再想 AI」的产物，需要「先定义 AI 员工做什么，再设计页面怎么展示」。

---

# Part 2: Product Blueprint — 产品蓝图

## 1. 产品定位

### 旧定位（当前）

> 「新媒体运营工具」— 用户手动管理账号、手动发布内容、手动回复客户

### 新定位

> **「昆仑镜 AI 员工驱动的新媒体商业运营中心」**
>
> 用户授权账号 → AI 员工接管运营 → 用户只看报告、做决策、处理异常

### 核心价值主张

| 用户痛点 | 旧模式 | AI Employee 模式 |
|---------|--------|-----------------|
| 每天要看热点 | 手动刷各平台 | AI 员工自动分析，推送日报 |
| 不知道发什么 | 拍脑袋选题 | AI 员工分析竞品+热点，生成内容建议 |
| 发布耗时 | 每个平台手动发 | AI 员工定时自动发布（用户可审批） |
| 客户消息漏回 | 24h 盯着 | AI 员工自动回复，复杂转人工 |
| 数据分散 | 各平台后台来回看 | AI 员工汇总分析，一屏全览 |
| 差评处理慢 | 发现时已发酵 | AI 员工实时监控，建议回复策略 |

---

## 2. 核心模型

```
┌─────────────────────────────────────────────────────────────┐
│                      昆仑镜平台 (Platform)                    │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │Hermes   │ │Capability│ │Credential│ │  External       │ │
│  │Runtime  │ │Registry  │ │Vault     │ │  Platform       │ │
│  │         │ │          │ │          │ │  Adapter        │ │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └───────┬─────────┘ │
│       │           │            │               │           │
│  ────┴───────────┴────────────┴───────────────┴───────────  │
│                      Platform API Layer                      │
│  ────┬───────────┬────────────┬───────────────┬───────────  │
│       │           │            │               │           │
│  ┌────┴────┐ ┌────┴─────┐ ┌───┴──────┐ ┌──────┴────────┐ │
│  │ AI      │ │ Content  │ │ Customer │ │  Analytics    │ │
│  │ Employee│ │ Factory  │ │ Graph    │ │  Engine       │ │
│  │ Adapter │ │ Adapter  │ │ Adapter  │ │  Adapter      │ │
│  └────┬────┘ └────┬─────┘ └───┬──────┘ └──────┬────────┘ │
│       │           │            │               │           │
│  ────┴───────────┴────────────┴───────────────┴───────────  │
│                   Media Workspace (Application)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AI 员工团队  │  内容生产线  │  客户中心  │  数据智能  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 关键实体关系

```
User (平台用户)
  │
  ├── Organization (企业/团队)
  │     └── EnterpriseAgentProfile (AI 员工档案)
  │           └── EnterpriseAgentInstance (运行实例)
  │                 └── HermesProfileBinding (Hermes 子代理绑定)
  │
  ├── ChannelAccount (授权账号)
  │     ├── platform: douyin/kuaishou/xiaohongshu/shipinhao/taobao/jd/meituan
  │     ├── credentialEncrypted (加密凭证)
  │     ├── connectionStatus (状态机)
  │     └── browserWorkspace (数字电脑)
  │
  ├── CustomerIdentity (客户身份)
  │     └── CustomerRelation (跨平台关联)
  │
  └── AgentSchedule (定时任务)
        └── AgentOutcome (执行结果)
```

---

## 3. AI 员工团队（默认编制）

### 3.1 运营总监 (Operations Director)

| 属性 | 值 |
|------|-----|
| **角色** | 新媒体运营团队负责人 |
| **SOUL** | 资深运营专家，擅长策略制定、数据分析、团队协调 |
| **职责** | 每日热点分析、竞品监控、运营策略制定、内容规划、数据复盘 |
| **Capabilities** | `media.trend.analysis`, `media.competitor.analysis`, `media.content.strategy`, `media.report.generate` |
| **定时任务** | 每日 08:00 热点日报、每日 20:00 竞品周报、每周一 运营策略建议 |
| **输出** | 运营日报、竞品分析、内容日历、策略建议 |

### 3.2 内容运营 (Content Creator)

| 属性 | 值 |
|------|-----|
| **角色** | 内容生产专家 |
| **SOUL** | 创意文案，精通各平台内容调性，擅长选题策划 |
| **职责** | 选题策划、脚本撰写、标题优化、图片建议、视频发布 |
| **Capabilities** | `media.content.generate`, `media.content.schedule`, `media.content.publish` |
| **定时任务** | 每日 09:00 选题建议、每日 10:00 内容生成、定时发布 |
| **输出** | 内容日历、发布队列、效果跟踪 |

### 3.3 用户增长 (Growth Specialist)

| 属性 | 值 |
|------|-----|
| **角色** | 用户互动与客户运营专家 |
| **SOUL** | 温暖客服，擅长理解需求、建立关系、促进复购 |
| **职责** | 评论管理、私信回复、客户识别、画像构建、复购提醒 |
| **Capabilities** | `media.customer.profile`, `media.message.reply`, `media.lead.management` |
| **定时任务** | 实时监控评论/私信、每日 14:00 互动报告、每周客户画像更新 |
| **输出** | 客户图谱、互动记录、销售线索、复购提醒 |

---

## 4. 用户旅程

### Day 0 — 开通

```
1. 用户进入「新媒体运营中心」
2. 系统检测：无 AI 员工 → 展示「开通引导」
3. 用户选择套餐（基础/专业/企业）
4. 系统自动创建 3 个默认 AI 员工
5. 用户授权第一个平台账号（如抖音）
6. AI 员工初始化：SOUL 注入 + 能力绑定 + 定时任务创建
7. 引导完成 → 进入「今日 AI 工作状态」
```

### Day 1 — 首次运营

```
08:00  运营总监自动执行「热点分析」→ 生成日报推送给用户
09:00  内容运营自动执行「选题建议」→ 推送 5 个选题
09:30  用户审批/修改选题 → 内容运营生成内容
10:00  用户审批内容 → 进入发布队列
12:00  定时发布执行（抖音+小红书+视频号）
14:00  用户增长执行「评论监控」→ 自动回复普通评论
       复杂评论标记「需人工」→ 推送给用户
20:00  运营总监生成「今日运营总结」
```

### Day 7 — 第一周复盘

```
运营总监生成「周报告」：
  - 内容发布统计（平台×数量×效果）
  - 热点趋势变化
  - 竞品动态摘要
  - 客户增长数据
  - 下周策略建议
```

---

## 5. 与现有系统的关系

### 5.1 复用（不重复造轮子）

| 现有组件 | 复用方式 |
|---------|---------|
| AgentTemplate/Profile/Instance | 直接扩展，增加 media 域模板 |
| HermesProfileBinding | 直接绑定媒体 AI 员工 |
| AgentSchedule + AgentScheduler | 直接创建媒体定时任务 |
| AgentOutcome | 直接记录媒体执行结果 |
| AgentGoal | 直接设定媒体日目标 |
| BrowserRuntime (Playwright) | 直接复用于平台自动化 |
| EnterpriseChannelAccount | 扩展支持电商平台 |
| Capability Registry | 注册 `media.*` Capability |
| Credential Vault | 存储所有平台凭证 |
| UserModelConfigV2 (BYOK) | AI 模型调用走用户自有 Key |

### 5.2 新增（必须创建）

| 新组件 | 优先级 | 说明 |
|--------|--------|------|
| `media.*` Capability 注册 | P0 | 内容/热点/竞品/客户/发布/私信 |
| AI Agent 权限系统 | P0 | 动作分级 + 审批/自动/停止 |
| CustomerIdentity 数据模型 | P0 | 跨平台客户统一身份 |
| 内容执行器 (Content Executor) | P0 | 通过 Capability 路由到具体平台 |
| 客户图谱服务 | P1 | 图查询 + 关系推理 |
| 行业雷达数据采集 | P2 | 热点/竞品/规则数据源 |
| 电商 Adapter | P2 | 淘宝/京东/美团 API |

---

## 6. 宪法合规声明

本产品设计严格遵守：

- **KMKI-CONST-001** 分层不可逆转 — Media Workspace 通过 Adapter 调 Platform API
- **KMKI-CONST-005** Capability 唯一入口 — 所有 AI 调用走 Capability Registry
- **KMKI-CONST-011** Workspace Adapter 层 — 每个功能都有对应 Adapter
- **KMKI-CONST-015** Credential 在 Vault — 凭证不离开 Credential Vault
- **KMKI-CONST-024** 数据唯一所有权 — 见 Task 07 数据所有权映射
- **BYOK 铁律** — 所有 LLM 调用走 UserModelConfigV2
- **Runtime Principles** — DB=真相源 / UI 不拥有执行权 / Worker 独占 Provider

---

# Part 3: AI Employee Spec — AI 员工产品模型

## 1. AI 员工 ≠ 聊天机器人

### 1.1 本质区别

| 维度 | 聊天机器人 | AI 员工 |
|------|-----------|---------|
| 触发方式 | 用户提问 | 定时任务 + 事件驱动 |
| 记忆 | 单次对话 | 长期 Memory Namespace |
| 身份 | 无 | SOUL.md + 角色定义 |
| 主动性 | 被动等待 | 主动执行 + 主动汇报 |
| 目标 | 无 | 日/周/月 KPI |
| 工具 | 有限 | Capability 全链路 |
| 权限 | 全有或全无 | 分级（读/写/发/改） |
| 反馈 | 单次回复 | 执行→结果→优化闭环 |
| 人工接管 | 无 | 随时暂停/接管/回滚 |

### 1.2 AI 员工完整模型

```
AI Employee = Identity + Goal + Capability + Schedule + Permission + Memory + Execution History + Human Override

┌──────────────────────────────────────────────────┐
│                 AI Employee                      │
├──────────────────────────────────────────────────┤
│ Identity     │ SOUL.md, Name, Avatar, Role      │
│ Goal         │ Daily/Weekly/Monthly KPI          │
│ Capability   │ Bound Capability List             │
│ Schedule     │ Cron Tasks, Event Subscriptions   │
│ Permission   │ Action Allow/Deny List, Mode      │
│ Memory       │ Namespace: tenant/{t}/agent/{a}   │
│ Execution    │ Outcome Chain + Audit Trail       │
│ Override     │ Pause / Resume / Rollback / Takeover│
└──────────────────────────────────────────────────┘
```

---

## 2. 三大默认 AI 员工

### 2.1 运营总监 — Alice

```
Identity:
  Name: Alice
  Role: AI 运营总监
  Avatar: 👩‍💼
  SOUL: |
    你是 Alice，昆仑镜新媒体运营团队的运营总监。
    你的老板是一位忙碌的创业者，ta 把新媒体运营交给了你。
    你的使命：让老板每天花 10 分钟就能掌握运营全貌。

    你的工作方式：
    - 每天 08:00 分析过去 24h 行业热点，推送「晨间运营日报」
    - 每天 20:00 复盘当日运营数据，推送「今日运营总结」
    - 每周一制定下周运营策略建议
    - 发现异常（差评爆发、流量骤降）立即预警

    你的原则：
    - 数据驱动：用数据说话，不凭感觉
    - 风险意识：发现异常第一时间报告
    - 诚实：数据不足时说「数据不足」，不编造
    - 节省老板时间：老板看报告就能决策，不需要自己分析

Goal:
  Daily: 1份热点日报 + 1份运营复盘 + 异常监控
  Weekly: 1份竞品周报 + 1份策略建议

Capability:
  - media.trend.analysis    (热点分析)
  - media.competitor.monitor (竞品监控)
  - media.strategy.formulate (策略制定)
  - media.report.generate    (报告生成)
  - media.data.read          (数据读取)

Schedule:
  - 08:00 daily → 热点分析 + 日报
  - 20:00 daily → 运营复盘
  - Mon 09:00 weekly → 策略建议
  - Wed 09:00 weekly → 竞品周报

Permission:
  Mode: AUTO_WITH_ALERT
  Allow: [数据读取, 热点分析, 竞品监控, 报告生成, 内容建议]
  Deny:  [自动发布, 自动私信, 自动回复评论]
  AlertOn: [异常检测, 内容建议, 策略变更]

Memory:
  Namespace: tenant/{tenantId}/agent/alice
  Retention: 90 days
  Key Context: 老板偏好、行业特征、竞品名单、历史策略
```

### 2.2 内容运营 — Bob

```
Identity:
  Name: Bob
  Role: AI 内容运营员工
  Avatar: 🎨
  SOUL: |
    你是 Bob，昆仑镜新媒体运营团队的内容运营。
    你的老板（运营总监 Alice）给你分配任务。
    你的使命：持续产出高质量内容，让老板的内容日历排得满满当当。

    你的工作方式：
    - 接收 Alice 的内容规划
    - 根据热点和产品调性生成内容
    - 每条内容生成 3 个备选方案
    - 定时发布到已授权平台
    - 跟踪发布效果，优化后续内容

    你的原则：
    - 原创性：绝不抄袭，所有内容原创
    - 平台适配：不同平台不同表达
    - 数据迭代：根据效果反馈优化
    - 安全第一：敏感内容必须人工审批

Goal:
  Daily: 生成 5 条内容建议 + 发布 3 条内容
  Weekly: 内容效果分析 + 优化建议

Capability:
  - media.content.generate   (内容生成)
  - media.content.schedule   (内容排期)
  - media.content.publish    (内容发布)
  - media.content.analyze    (效果分析)
  - media.hashtag.recommend  (标签推荐)

Schedule:
  - 09:00 daily → 选题建议
  - 10:00 daily → 内容生成
  - 12:00/18:00 daily → 定时发布
  - Fri 17:00 weekly → 内容复盘

Permission:
  Mode: APPROVAL_REQUIRED
  Allow: [内容生成, 内容排期, 标签建议]
  Deny:  [自动发布] → 需用户审批
  AutoPublish: false
  Approval: 每日 10:00 推送待审批内容列表

Memory:
  Namespace: tenant/{tenantId}/agent/bob
  Retention: 30 days
  Key Context: 内容风格、历史内容、平台规则、禁用词
```

### 2.3 用户增长 — Carol

```
Identity:
  Name: Carol
  Role: AI 用户增长员工
  Avatar: 💬
  SOUL: |
    你是 Carol，昆仑镜新媒体运营团队的用户增长专家。
    你的使命：让每一个关注者都被认真对待。

    你的工作方式：
    - 实时监控所有平台评论和私信
    - 普通咨询/夸赞 → 自动温暖回复
    - 投诉/复杂问题 → 标记「需人工」并建议回复策略
    - 识别高价值客户，构建客户画像
    - 每日推送互动报告

    你的原则：
    - 真诚：不机械回复，让每个消息被认真对待
    - 边界：不确定时转人工，不瞎编
    - 保护：绝不泄露其他客户信息
    - 效率：常见问题秒回，复杂问题 5min 内标记

Goal:
  Daily: 评论回复率 > 90% + 私信响应 < 5min
  Weekly: 客户画像更新 + 高价值客户识别

Capability:
  - media.comment.monitor    (评论监控)
  - media.message.reply      (私信回复)
  - media.customer.profile   (客户画像)
  - media.lead.identify      (线索识别)
  - media.sentiment.analyze  (情感分析)

Schedule:
  - Real-time → 评论/私信监控
  - 14:00 daily → 互动日报
  - Wed 14:00 weekly → 客户画像更新

Permission:
  Mode: TIERED_AUTO
  Allow: [读取评论, 自动回复普通评论, 私信回复常见问题]
  Deny:  [自动回复投诉, 自动承诺, 自动退款]
  AutoReply: 
    - 普通咨询 → 自动
    - 夸赞 → 自动感谢
    - 投诉 → 标记「需人工」
    - 涉及金额/法律 → 标记「紧急人工」

Memory:
  Namespace: tenant/{tenantId}/agent/carol
  Retention: 180 days
  Key Context: 客户名单、常见问题库、回复风格、禁忌话题
```

---

## 3. AI 员工生命周期

```
创建 → 绑定 → 配置 → 运行 → 监控 → 优化 → 暂停/恢复/销毁
```

### 3.1 创建

```
User Action: 开通 AI 员工
System:
  1. 从 AgentTemplate 创建 EnterpriseAgentProfile (media 域)
  2. 创建 EnterpriseAgentInstance (绑定 profile)
  3. 创建 HermesProfileBinding (绑定 Hermes 子代理)
  4. 注入 SOUL.md → soulMdContent
  5. 绑定 Capability 列表
  6. 创建默认 AgentSchedule 任务
  7. 返回 AI 员工卡片
```

### 3.2 运行

```
Trigger: AgentScheduler tick() → 到期任务
System:
  1. 加载 AI 员工上下文 (Profile + Binding + Memory)
  2. 检查 Permission (当前模式是否允许)
  3. 执行任务 (通过 Capability → Hermes → External Platform)
  4. 写入 AgentOutcome
  5. 如需审批 → 推送通知
  6. 异常 → 触发 Alert
```

### 3.3 监控

```
Dashboard:
  - AI 员工状态灯 (🟢运行中 / 🟡等待审批 / 🔴异常 / ⚪暂停)
  - 今日完成任务数
  - 待处理事项 (需人工)
  - 本周效果趋势
```

---

## 4. 人工接管模型

| 触发条件 | 行为 |
|---------|------|
| 用户点击「暂停」 | 立即停止当前任务，保留状态 |
| 用户点击「我来处理」 | 转交控制权，AI 进入观察模式 |
| AI 检测到超权限操作 | 自动暂停，等待审批 |
| 异常检测（风控/错误） | 自动暂停 + 告警 |

---

# Part 4: Capability Map — 能力地图

## 1. 原则

```
┌─────────────────────────────────────────────────────┐
│                   Platform Layer                     │
│  "能做什么" — 原子能力，与业务无关                    │
│  Browser / LLM / Search / Notif / Credential / ...  │
└─────────────────────────────────────────────────────┘
                       ↑
                  Adapter 层 (翻译)
                       ↑
┌─────────────────────────────────────────────────────┐
│                  Media Workspace Layer               │
│  "做什么" — 业务编排，与场景相关                      │
│  热点分析 / 内容生成 / 客户画像 / 定时发布 / ...      │
└─────────────────────────────────────────────────────┘
```

**宪法纪律**：
- Platform 不知道「热点」「竞品」「客户」等业务词
- Media Workspace 不知道 Browser/CDP/Provider 等技术词
- 一切通过 Capability 名称交流

---

## 2. Platform Capabilities（平台提供）

### 2.1 基础能力

| Capability ID | 名称 | 实现 |
|---------------|------|------|
| `platform.browser.navigate` | 浏览器导航 | Playwright |
| `platform.browser.extract` | 页面数据提取 | Playwright + DOM |
| `platform.browser.screenshot` | 截图 | Playwright |
| `platform.browser.act` | 浏览器操作 | Playwright |
| `platform.credential.get` | 获取凭证 | Credential Vault |
| `platform.credential.rotate` | 轮换凭证 | Credential Vault |
| `platform.llm.generate` | AI 生成 | Hermes + Provider |
| `platform.search.web` | 网络搜索 | Search Engine |
| `platform.search.trends` | 趋势搜索 | 外部数据源 |
| `platform.storage.put/get` | 存储读写 | Object Storage |
| `platform.notification.push` | 推送通知 | Notification Center |
| `platform.schedule.create/cancel` | 定时任务 | Scheduler |
| `platform.audit.log` | 审计日志 | Audit Center |

### 2.2 新媒体专用能力（Platform 层）

| Capability ID | 名称 |
|---------------|------|
| `media.platform.auth` | 平台账号授权 |
| `media.platform.profile.read` | 读取账号信息 |
| `media.platform.content.publish` | 发布内容 |
| `media.platform.content.list` | 内容列表 |
| `media.platform.comment.list` | 评论列表 |
| `media.platform.comment.reply` | 回复评论 |
| `media.platform.message.send` | 发送私信 |
| `media.platform.message.list` | 私信列表 |
| `media.platform.analytics.read` | 读取数据 |
| `media.platform.product.update` | 商品操作 |

---

## 3. Workspace 编排（Media 业务逻辑）

### 3.1 热点分析
```
Capability: media.trend.analysis
编排: platform.search.trends → platform.search.web → platform.llm.generate → platform.storage.put
输出: 热点日报 + 选题建议
```

### 3.2 竞品分析
```
Capability: media.competitor.analysis
编排: platform.browser.navigate → platform.browser.extract → platform.llm.generate → platform.storage.put
输出: 竞品周报 + 策略建议
```

### 3.3 内容生成
```
Capability: media.content.generate
编排: platform.llm.generate (正文+标题+标签) → platform.storage.put
输出: 待审批内容列表
```

### 3.4 定时发布
```
Capability: media.content.publish
编排: platform.schedule.create → trigger → platform.credential.get → platform.browser.navigate → platform.browser.act → platform.audit.log → platform.storage.put → platform.notification.push
输出: 发布结果 + 链接
```

### 3.5 客户画像
```
Capability: media.customer.profile
编排: platform.browser.navigate → platform.browser.extract → platform.llm.generate → platform.storage.put
输出: 客户列表 + 画像标签 + 价值分级
```

### 3.6 自动回复
```
Capability: media.message.reply
编排: platform.llm.generate (判断类型) → [普通|投诉|紧急] → platform.message.send → platform.audit.log
输出: 回复结果 + 需人工列表
```

---

## 4. 禁止清单

| 禁止 | 正确做法 |
|------|---------|
| Media Workspace 直接 `import playwright` | 通过 `media.platform.navigate` Capability |
| Media Workspace 直接读 `UserModelConfigV2` | 通过 `platform.llm.generate` Capability |
| Media Platform 出现「热点」「竞品」 | 只保留「搜索」「生成」「导航」等通用词 |
| Media Workspace 直接写 AgentOutcome | 通过 Platform Execution Service 写入 |
| Capability 绕过 Permission 检查 | 每个 Capability 执行前检查 Permission |

---

# Part 5: Adapter Spec — 外部平台 Adapter 架构

## 1. 设计原则

```
┌───────────────────────────────────────────────────────────┐
│                    Media Workspace                         │
│   media.trend.analysis  ──→  TrendAnalysisAdapter          │
│   media.content.publish ──→  ContentPublishAdapter         │
└────────────────────────┬──────────────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────────────┐
│              External Platform Adapter Interface            │
│   interface IPlatformAdapter { authorize(), getProfile(),  │
│     publishContent(), getComments(), replyComment(), ... } │
└────────┬──────────────┬──────────────┬─────────────────────┘
         │              │              │
    ┌────┴────┐   ┌─────┴────┐  ┌─────┴────┐
    │ Browser │   │ Official │  │  Hybrid  │
    │Automation│   │   API    │  │ (Both)   │
    └─────────┘   └──────────┘  └──────────┘
```

**核心原则**：
1. **不写「如果抖音就...」** — 所有平台通过统一接口
2. **每个平台一个 Adapter 文件** — 不互相依赖
3. **Adapter 不包含业务逻辑** — 只做翻译和调用
4. **新增平台 = 新增文件，零修改已有代码**

---

## 2. 统一 ChannelAccount 模型

```typescript
interface ChannelAccount {
  id: string
  platform: PlatformType       // douyin | kuaishou | xiaohongshu | ...
  accountType: 'media' | 'ecommerce' | 'messaging'
  accountName: string          // 平台真实账号名（只读，来自平台）
  avatarUrl: string            // 平台真实头像
  externalAccountId: string    // 平台用户ID
  connectionStatus: ConnectionStatus
  credentialRef: string        // → Credential Vault 引用（不存储明文）
  sessionRef: string           // → Browser Session 引用（如适用）
  grantedScopes: string[]      // 已授权权限列表
  connectedAt: Date
  lastSyncAt: Date
  health: 'healthy' | 'expired' | 'revoked' | 'error'
  metadata: Record<string, any>
}
```

---

## 3. Adapter 分类

### 3.1 浏览器自动化 Adapter（新媒体平台）

适用: 抖音、快手、小红书、视频号、微博、B站
原理: Playwright + 持久化 Profile + Cookie/Session

基类 BrowserAdapter 提供: navigate / extract / act / screenshot / getCookies / saveSession / restoreSession

### 3.2 官方 API Adapter（电商平台）

适用: 淘宝、京东、美团、拼多多、微信小店
原理: 平台开放 API + OAuth 2.0 + Webhook

基类 ApiAdapter 提供: authenticate / refreshToken / callApi / registerWebhook / handleWebhook

---

## 4. 各平台 Adapter 规格

| 平台 | 方式 | 风险 | 状态 |
|------|------|------|------|
| 抖音 | Browser Automation | 高（风控严格） | 🟡 已接入 |
| 快手 | Browser Automation | 中 | 🟡 已接入 |
| 小红书 | Browser Automation | 高（反爬严格） | 🟡 已接入 |
| 视频号 | Browser Automation | 中 | 🟡 已接入 |
| 微博 | Browser Automation | — | 🔴 待接入 |
| B站 | Browser Automation | — | 🔴 待接入 |
| 淘宝 | 官方 API | 低 | 🔴 待接入 |
| 京东 | 官方 API | 低 | 🔴 待接入 |
| 美团 | 官方 API | 低 | 🔴 待接入 |

---

## 5. Adapter 工厂

```typescript
class PlatformAdapterFactory {
  static create(platform: PlatformType, config: AdapterConfig): IPlatformAdapter {
    switch (platform) {
      case 'douyin':       return new DouyinBrowserAdapter(config)
      case 'kuaishou':     return new KuaishouBrowserAdapter(config)
      case 'xiaohongshu':  return new XhsBrowserAdapter(config)
      case 'wechat_video': return new WeChatVideoBrowserAdapter(config)
      case 'weibo':        return new WeiboBrowserAdapter(config)
      case 'bilibili':     return new BiliBrowserAdapter(config)
      case 'taobao':       return new TaobaoApiAdapter(config)
      case 'jd':           return new JdApiAdapter(config)
      case 'meituan':      return new MeituanApiAdapter(config)
      case 'pinduoduo':    return new PddApiAdapter(config)
      case 'wechat_shop':  return new WeChatShopApiAdapter(config)
      default:             return new NullAdapter(platform)
    }
  }
}

class NullAdapter implements IPlatformAdapter {
  // 未接入平台返回「未接入」而非 mock（Reality Gate）
  authorize() { return { ok: false, error: 'PLATFORM_NOT_SUPPORTED' } }
}
```

---

# Part 6: Permission Model — AI Agent 权限系统

## 1. 设计原则

```
AI 员工权限 = 动作分级 × 运行模式 × 用户覆盖
```

---

## 2. 动作分级

### Tier 1: 读取（自动允许）

| 动作 | Capability |
|------|-----------|
| 读取账号信息 | `media.platform.profile.read` |
| 读取热点/趋势 | `platform.search.trends` |
| 读取评论/私信 | `media.platform.comment.list` |
| 读取数据面板 | `media.platform.analytics.read` |
| 读取商品/订单 | `media.platform.product.read` |

策略: AI 自动执行，无需通知，记录审计日志

### Tier 2: 创建（建议+审批）

| 动作 | Capability |
|------|-----------|
| 生成内容草稿 | `media.content.generate` |
| 生成分析报告 | `media.report.generate` |
| 生成竞品分析 | `media.competitor.analysis` |
| 生成客户画像 | `media.customer.profile` |

策略: AI 自动生成，推送给用户审批

### Tier 3: 发送（分级自动）

| 动作 | Capability |
|------|-----------|
| 回复普通评论 | `media.platform.comment.reply` |
| 回复常见问题私信 | `media.platform.message.send` |
| 发布已审批内容 | `media.platform.content.publish` |
| 发送复购提醒 | `media.platform.message.send` |

策略:
- 普通咨询/夸赞 → 自动回复
- 投诉/复杂问题 → 标记「需人工」
- 涉及金额/法律 → 标记「紧急人工」

### Tier 4: 修改（严格审批）

| 动作 | Capability |
|------|-----------|
| 修改商品价格 | `media.platform.product.update` |
| 上下架商品 | `media.platform.product.update` |
| 删除内容 | `media.platform.content.delete` |
| 修改店铺信息 | `media.platform.shop.update` |
| 退款/赔付 | `media.platform.order.refund` |

策略: 所有 Tier 4 必须人工审批，AI 仅建议

---

## 3. 运行模式

| 模式 | 适用 | 行为 |
|------|------|------|
| AUTO | Tier 1 + Tier 3 低风险 | AI 执行 → 记录日志 → 汇总报告 |
| APPROVAL_REQUIRED | Tier 2 + Tier 3 中风险 | AI 生成 → 推送审批 → 用户确认 → 执行 |
| ALERT_FIRST | 异常检测 + 紧急响应 | AI 检测异常 → 立即告警 → 同时执行应急 |
| MANUAL | Tier 4 + 高风险 | AI 建议 → 用户手动执行 |

### 默认模式配置

| AI 员工 | 默认模式 |
|---------|---------|
| Alice（运营总监） | AUTO (T1) + APPROVAL (T2) |
| Bob（内容运营） | APPROVAL_REQUIRED (T2+T3) |
| Carol（用户增长） | TIERED_AUTO (T1自动, T3分级) |

---

## 4. 用户覆盖机制

### 暂停/恢复
```
暂停: 当前任务停止 → 队列挂起 → 定时任务禁用 → PAUSED
恢复: 从断点继续 → 队列恢复 → 定时任务启用 → ACTIVE
```

### 接管
```
我来处理: AI 进入 OBSERVE 模式 → 用户手动操作 → AI 记录 → 用户完成 → AI 恢复
```

### 紧急停止
```
所有 AI 暂停 → 定时任务禁用 → 队列清空 → 推送确认 → 需逐个恢复
```

### 回滚
```
查找最近 AI 操作 → 生成回滚方案 → 用户确认 → 执行回滚 → 记录日志
```

---

## 5. 用户控制界面

```
AI 员工卡片 → 权限设置:
  ┌─────────────────────────────────────┐
  │ 模式: [全自动 ▼]                     │
  │ ✅ 读取数据（自动）                   │
  │ ✅ 生成内容（需审批）                 │
  │ ✅ 回复评论（分级自动）               │
  │ ├── 普通评论: 自动回复               │
  │ ├── 投诉: 标记「需人工」              │
  │ └── 涉及金额: 标记「紧急」            │
  │ ⚠️ 发布内容（需审批）                 │
  │ ❌ 修改商品（禁止）                   │
  │ 频率: 评论 ≤ 30/h, 私信 ≤ 20/h      │
  │ 通知: 实时推送待审批                  │
  │ [暂停] [恢复] [紧急停止]             │
  └─────────────────────────────────────┘
```

---

# Part 7: Data Ownership Map — 数据所有权映射

## 1. 新媒体运营数据对象 → Owner Center 完整映射

| 数据对象 | Owner Center | 说明 |
|---------|-------------|------|
| **凭证 (Credentials)** | **AI Center (Credential Vault)** | 加密存储，Workspace 不接触明文 |
| **平台账号身份** | **Identity Center** | 账号名/头像/外部ID（只读） |
| **客户身份** | **Identity Center** | CustomerIdentity 表 |
| **客户图谱关系** | **Identity Center + Knowledge Center** | 图数据 |
| **内容资产** | **Asset Center** | 图片/视频/文案草稿 |
| **发布记录** | **Asset Center** | 已发布内容元数据 |
| **热点/趋势数据** | **Knowledge Center** | 知识对象 |
| **竞品数据** | **Knowledge Center** | 竞品分析报告 |
| **执行记录 (Outcome)** | **Runtime Center** | AgentOutcome 统一结果层 |
| **排程 (Schedule)** | **Runtime Center** | AgentSchedule |
| **用量/成本 (Usage)** | **AI Center + Billing Center** | UsageLog 归因 |
| **分析报告** | **Media Workspace** | 业务分析报告（Workspace 自有） |
| **运营策略** | **Media Workspace** | 用户/AI 制定的运营策略 |
| **审批记录** | **Governance Center** | 审批流日志 |
| **审计日志** | **Governance Center** | AgentAuditTrail |

---

## 2. 新增数据模型需求

### CustomerIdentity（客户统一身份）
```
Owner: Identity Center
字段: id, platform, platformUserId, platformUserName, platformAvatar, 
      unifiedIdentity?, firstInteractionAt, lastInteractionAt, tags, metadata
索引: [platform + platformUserId] 唯一
```

### CustomerRelation（客户关系图谱）
```
Owner: Identity Center + Knowledge Center
节点: CustomerIdentity
边: SAME_PERSON, REFERRAL, FOLLOW, PURCHASE
```

---

## 3. 数据删除规则

| 数据对象 | 删除时机 | 删除方式 |
|---------|---------|---------|
| 凭证 | 用户解除绑定时 | Credential Vault 立即销毁 |
| 客户身份 | 用户要求删除 | Identity Center 软删除+30天清 |
| 执行记录 | 180天后 | 自动归档（可配置） |
| 发布内容 | 用户删除/平台删除 | 保留元数据，删内容文件 |
| 分析报告 | 用户删除 | 硬删除 |

---

# Part 8: UX Blueprint — UX 蓝图

## 1. 设计理念

```
传统后台:     「用户找功能」→ 点按钮 → 填表单 → 提交 → 看结果
AI员工中心:   「AI 汇报，用户决策」→ 看报告 → 审审批 → 做决策 → AI 执行
```

设计原则: AI主动人审核 / 10分钟原则 / 异常优先 / 员工视角 / 诚实展示

---

## 2. 核心页面

### 2.1 今日 AI 工作状态（首页/驾驶舱）

展示: AI 员工团队状态（🟢运行中/🟡等待审批/🔴异常）+ 今日报告（热点TOP5 + 账号表现）+ 待处理事项（审批+异常+同步）

### 2.2 AI 员工详情页

展示: 角色/灵魂/状态 + 本周目标进度条 + 定时任务列表 + 最近执行记录 + 权限设置面板 + 暂停/恢复/紧急停止

### 2.3 展示: 待审批列表（内容审批+策略审批） + 审批操作（通过/修改后通过/驳回/延后）

### 2.4 客户图谱视图

展示: 客户列表（平台+标签+最近互动） + 客户详情（跨平台ID+标签+互动历史+分级）

### 2.5 空态设计（诚实展示）

展示: 未接入功能的「待激活」状态 + 数据源连接进度 + 订阅就绪通知

---

## 3. 设计规范

| 状态 | 颜色 | 含义 |
|------|------|------|
| 🟢 运行中 | #34D399 | 正常执行 |
| 🟡 等待中 | #FBBF24 | 等待审批/数据 |
| 🔴 异常 | #EF4444 | 需立即处理 |
| ⚪ 待启动 | #94A3B8 | 功能未激活 |
| 🔵 完成 | #3B82F6 | 任务已完成 |

---

# Part 9: Design Gate — 设计放行审查

## 验收清单

| # | 内容 | 状态 |
|---|------|------|
| 1 | Reality Audit | ✅ |
| 2 | Product Blueprint | ✅ |
| 3 | AI Employee Spec | ✅ |
| 4 | Capability Map | ✅ |
| 5 | Adapter Spec | ✅ |
| 6 | Permission Model | ✅ |
| 7 | Data Ownership Map | ✅ |
| 8 | UX Blueprint | ✅ |
| 9 | Design Gate | ✅ |

---

## 产品级问题审查

### Q1: 现在是不是 AI Employee 产品？
设计目标达成后 → **是 AI Employee 产品**

### Q2: Hermes 是否成为唯一执行 Runtime？
✅ Hermes 是唯一 AI 执行 Runtime，Browser 是工具

### Q3: Workspace 是否符合宪法边界？
✅ 符合宪法边界（KMKI-CONST-001/005/011/015/024 + BYOK + Runtime Principles）

### Q4: 外部平台是否可扩展？
✅ 可扩展（4 新媒体已接入 + 5 电商待接入 + NullAdapter 诚实模式）

### Q5: 用户是否拥有控制权？
✅ 用户拥有完全控制权（分级权限 + 暂停/恢复/紧急停止 + 人工接管）

### Q6: 是否具备商业 SaaS 能力？
✅ 具备 SaaS 商业化技术基础（多租户 + BYOK + 按量计费 + 多平台覆盖）

---

## 设计决策风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 浏览器自动化稳定性 | 高 | HealthGuard + 自动重试 + 账号保护 |
| 各平台风控策略 | 高 | 模拟真人节奏 + 异常检测 + 紧急停止 |
| Hermes 子代理并发成本 | 中 | 队列调度 + 并发预算 + 租户隔离 |
| 电商 API 审核周期 | 中 | 先做新媒体深度，电商并行推进 |
| 行业雷达数据源获取 | 低 | Sprint-MEDIA-03 阶段推进 |

---

## 开发放行建议

### 通过条件
- [x] 9 份设计文档齐备
- [x] 宪法合规审查通过
- [x] AI Employee 产品模型定义完成
- [x] Capability Map 清晰
- [x] 权限系统定义完成
- [x] 数据所有权映射完成
- [x] UX 蓝图完成

### 开发优先级

```
P0 Sprint (4 周):
  1. AI 员工运行时注入（Hermes 子代理 + SOUL）
  2. Capability `media.*` 注册
  3. 内容发布 Capability（抖音/快手/小红书）
  4. 定时任务引擎填充（热点分析 + 发布）
  5. 权限系统基础框架

P1 Sprint (4 周):
  6. 客户图谱数据模型 + 基础服务
  7. 评论/私信自动回复
  8. 竞品分析 Capability
  9. 审批中心前端
  10. 每日报告生成

P2 Sprint (4 周):
  11. 行业雷达数据源接入
  12. 电商 Adapter（淘宝/京东）
  13. 高级客户画像
  14. 多平台内容同步发布
```

---

## 一句话总结

> **设计阶段完成。9 份文档齐备，宪法合规，产品架构从「运营后台」升级为「AI 员工指挥中心」。建议掌柜评审通过后进入 P0 Sprint 开发。**

---

*全部 9 个 Part 输出完毕。*
