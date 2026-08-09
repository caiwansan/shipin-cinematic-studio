# 昆仑镜 AI 员工驱动的新媒体商业运营中心 — 产品蓝图

> **Version**: 1.0
> **Date**: 2026-08-08
> **Author**: OpenClaw (AI Architect)
> **Status**: Design Phase — NOT APPROVED FOR DEVELOPMENT

---

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

*Task 02 完成。进入 Task 03: AI Employee 产品模型。*
