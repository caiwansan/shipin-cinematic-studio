# SPRINT-MEDIA-WORKSPACE-RECONSTRUCTION-01 — Reality Audit

> **Date**: 2026-08-08
> **Auditor**: OpenClaw (AI Architect)
> **Scope**: 前端 9 页面 + 后端媒体服务 + 数据库 + Runtime 全链路
> **方法**: 代码逐行审查 + 模型映射 + API 端点追踪

---

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

*审计完成。建议进入 Task 02-09 设计阶段。*
