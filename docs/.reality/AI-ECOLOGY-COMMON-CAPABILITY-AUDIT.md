# AI-ECOLOGY-COMMON-CAPABILITY-AUDIT.md

> **昆仑镜 AI 应用生态平台 — Task 01 全站能力审计**
> 版本：V1.0 | 类型：只读审计 | 日期：2026-08-03
> 执行纪律：零代码改动、零数据库改动、零删除

---

## 一、审计范围与方法

### 1.1 审计对象

| 层 | 范围 | 规模 |
|----|------|------|
| Backend | `backend/src` 全部模块 | 2,852 个 TS 文件 |
| Data | `backend/prisma/schema.prisma` | 461 个模型 |
| Frontend | `frontend/pages|components|stores|modules|workspaces` | 9 大工作台 |
| Desktop | `desktop/`（Electron 壳） | main.js / preload.js / web |
| Shared | `packages/studio-platform` | 平台共享包 |

### 1.2 现有工作台清单（9 个）

| # | 工作台 | 前端路由域 | 后端模块域 | 成熟度信号 |
|---|--------|-----------|-----------|-----------|
| 1 | AI短剧工作台 | `director` / `director-os` / `studio-v2` | `director*` / `cinematic-*` | 最成熟，多期 Gate 验收 |
| 2 | 小说工作台 | `novel` / `hdz` | `hdz*` / `narrative-constraint` | 已冻结（HDZ-NOVEL-FREEZE） |
| 3 | 法律工作台 | `workspaces/legal` | `legal*` | 独立工作台 |
| 4 | 求职招聘工作台 | `enterprise`（jobs/recruitment） | `enterprise/jobs` / `recruitment-*` | 有 Reality Gate 记录 |
| 5 | 商城 | `mall` | `mall*` / `ecom*` / `creative-economy` | 独立域 |
| 6 | 音乐工作台 | `studio`（MUSIC/MV） | `music` 相关 | 阶段化配置 |
| 7 | 广告工作台 | `studio`（AD） | `ad` 相关 | 阶段化配置 |
| 8 | GEO优化工作台 | `workspaces/geo` | `geo*` / `graph-optimization` | 独立域 |
| 9 | 新媒体运营工作台 | `media-department` | `enterprise/channel` | Reality Closure 阶段 |

### 1.3 审计问题（回答目标）

1. 哪些能力已经重复建设？
2. 哪些应该抽离平台层？
3. 哪些必须保留工作台私有？
4. 未来插件调用哪些公共能力？

---

## 二、能力现状地图

### 2.1 已存在的「平台级」能力（被多域引用的核心）

| 能力域 | 代表模块/模型 | 当前归属 | 被引用方 |
|--------|--------------|---------|---------|
| Identity/用户 | `User` / `Membership` / `Captcha` / `SmsCode` / `EmailCode` | auth 域 | 全站 |
| Tenant/组织 | `Organization` / `EnterpriseProfile` / `GovOrganization` / `GovUser` / `OrgMember` | governance 域 | 全站 |
| RBAC/权限 | `Role` / `Policy` / `CapabilityGrant` / `authorizeProjectOwner` / `governance` | governance/security | 全站 |
| 模型网关 | `AiModel` / `AiProvider` / `AiRoutingPolicy` / `model-adapters/` / `ai-router.service` | model 域 | 全站 |
| 成本计费 | `AiModelPriceHistory` / `CostBudget` / `UsageRecord` / `LLMUsageRecord` | model 域 | 全站 |
| 订阅授权 | `SubscriptionPlan` / `Subscription` / `EnterpriseSubscription` / `EnterpriseEntitlement` / `PersonalEntitlement` | commerce 域 | 全站 |
| 支付 | `PaymentOrder` / `PaymentConfig` / `RechargeOrder` / `payment/` | commerce 域 | 商城+订阅 |
| 任务队列 | `TaskQueue` / `TaskExecution` / `WorkerTaskAssignment` / `queue/` / `workers/` | core 域 | 全站 |
| 资产存储 | `AssetRegistry` / `UnifiedAsset*` / `StorageConfig` / `storage/` | core 域 | 全站 |
| 审计 | `AuditLog` / `AgentAuditTrail` / `EventTraceLog` / `audits/` | governance 域 | 全站 |
| AI员工 | `AgentDefinition` / `EnterpriseAgentInstance` / `AgentTemplate` / `HermesProfileBinding` / `agent-runtime/` | agents 域 | 多工作台 |
| 模型能力矩阵 | `ModelCapabilityCompatibility` / `capability-registry.ts` | model 域 | 全站 |

### 2.2 工作台私有能力（领域价值所在）

| 工作台 | 私有能力（必须保留） |
|--------|---------------------|
| 短剧 | 分镜/角色/场景谱系、导演状态机、叙事约束、镜头运动规划、Cinematic Grammar |
| 小说 | 世界观/角色记忆、章节状态机、风格 DNA、稿纲管理、连载发布 |
| 法律 | 法条库、合同模板、案件模型、法规检索、AI 提示词库 |
| 招聘 | 简历解析、候选人匹配、面试评估、招聘管线、人才画像 |
| 商城 | 商品/订单/购物车/优惠券/分销 |
| 音乐 | 音乐生成两阶段（歌词→曲）、Suno/Mureka/Music15 提供商编排 |
| 广告 | 品牌资产、脚本→分镜→视频三阶段 |
| GEO | SEO 扫描、实体图谱、Schema 标记、验证报告、新鲜度评分 |
| 新媒体 | 渠道账号生命周期、浏览器运行时、身份探针、凭证管理、指标提取 |

---

## 三、重复建设审计（问题 1 回答）

### 3.1 已确认的重复建设点

| # | 重复能力 | 出现位置 | 严重度 | 说明 |
|---|---------|---------|--------|------|
| R1 | **任务执行/工作流** | `workflow/` + `workflow-definition` + `llm-execution-graph-v2` + `execution-*` + `temporal-engine` + `pipeline-*` + `jobs/` | 🔴 高 | 至少 5 套任务编排语义并存，无统一契约 |
| R2 | **Agent 定义** | `AgentDefinition` + `EnterpriseAgentInstance` + `MarketAgent` + `CareerAgentTask` + `HdzAgentTask` + `WorkerTask` | 🔴 高 | 6 种 agent 实体，生命周期/权限/记忆各写各的 |
| R3 | **记忆系统** | `AgentMemory` + `AgentContextMemory` + `GrowthMemory` + `CustomerChatMemory` + `CharacterMemory` + `HdzMemory` + `DirectorMemory` | 🟠 中 | 7 种记忆表，无统一 Memory API |
| R4 | **模型调用入口** | `narrative-gateway` + `model-adapters/llm` + `ai-router` + `creative-os-gateway` + `providers/` | 🟠 中 | 网关层重复，路由策略多套 |
| R5 | **工作台脚手架** | 每个工作台独立 `pages/workspace-config` + 阶段编排 | 🟡 低 | 前端阶段化配置模式一致但未抽公共组件 |
| R6 | **权限校验** | `authorizeProjectOwner` + `ChannelAccessService` + `governance` + `tool-permission` | 🟠 中 | 后端权限入口分散，前端 middleware 另有一套 |
| R7 | **资产/文件** | `Asset` + `UnifiedAsset*` + `AssetRegistry` + `KnowledgeAsset` + `StorageConfig` | 🟠 中 | 资产模型分裂，统一资产体系未完全收敛 |
| R8 | **成本计量** | `CostBudget` + `UsageRecord` + `LLMUsageRecord` + `CoinLog` + `DailyUsage` | 🟠 中 | 计费口径多表并存 |

### 3.2 重复建设根因

1. **工作台平行开发**：9 个工作台按领域团队平行推进，公共能力以「复制后改」起步，未强制走平台层。
2. **WORKSPACE-DOMAIN-MATRIX 冻结**：矩阵冻结了「禁止拆分/复制」的 Core 能力，但**没有定义平台层 API 契约**，导致复制仍以模块级发生。
3. **缺少插件边界**：没有「公共能力只能通过 SDK/网关调用」的强制机制，域间直接 import 成常态。

---

## 四、平台层抽离建议（问题 2 回答）

### 4.1 应抽离为「生态公共能力」的清单

按「被多域引用 + 无领域语义 + 有独立生命周期」三条件筛选：

| 能力 | 抽离为 | 现状资产 | 生态化后形态 |
|------|--------|---------|-------------|
| Identity + Tenant + Membership | **Platform Identity Service** | `User/Organization/GovUser/OrgMember` | 插件开发者零感知，随平台账户体系 |
| RBAC/Policy | **Platform Permission Service** | `Role/Policy/CapabilityGrant/Policy` | 插件 Manifest 声明权限 → 平台授权 |
| 模型网关 + 路由 + 成本 | **Model Gateway（统一）** | `model-adapters/` + `ai-router` + `AiModel` | 插件声明 model 需求，网关计价 |
| 订阅 + 授权 + 计费 | **Commerce Core** | `Subscription*/Entitlement/BillingRecord/PaymentOrder` | 插件订阅收入分账底座 |
| 任务/工作流编排 | **Workflow Engine（统一）** | `workflow-definition`（收敛其余 4 套） | 插件 workflow 类型注册 |
| Agent 生命周期 | **Hermes Runtime** | `agent-runtime/` + `EnterpriseAgentInstance` + `HermesProfileBinding` | 插件 = agent 模板 + 配置 |
| 记忆 | **Memory Service** | `AgentMemory` + `memory-namespace` | 插件命名空间隔离记忆 |
| 资产/存储 | **Storage Service** | `UnifiedAsset*` + `StorageConfig` | 插件资产挂载 |
| 审计/可观测 | **Observability** | `AuditLog` + `EventTraceLog` + `observability/` | 插件行为审计自动接入 |
| 浏览器运行时（新媒体特有但可复用） | **Local Device Runtime（Hermes 扩展）** | `enterprise/channel` 的 BrowserRuntime | 本地应用 + 浏览器控制的基础 |

### 4.2 抽离原则

- **先契约后抽离**：不物理搬代码，先定义平台层 API 契约（`platform/` 目录已有雏形），域内实现逐步适配。
- **冻结扩展优先**：新工作台一律只允许通过平台 API 访问公共能力，禁止直接 import 域模块。
- **双通道过渡**：现有域直接调用保留（兼容期），新代码走平台 API；Reality Gate 后冻结旧通道。

---

## 五、必须保留工作台私有的能力（问题 3 回答）

判定标准：**包含领域语义、被单一工作台独占、抽离会造成抽象泄漏**。

| 工作台 | 私有能力 | 抽离风险 |
|--------|---------|---------|
| 短剧 | 分镜谱系、导演状态机、叙事约束引擎、镜头语法 | 抽离=把领域逻辑塞进平台，平台膨胀 |
| 小说 | 世界观记忆、章节状态机、风格 DNA、稿纲 | 同上 |
| 法律 | 法条/合同/案件模型、法律提示词 | 领域数据模型，平台无意义 |
| 招聘 | 简历解析、匹配算法、面试评估 | 领域算法 |
| GEO | 实体图谱、Schema 标记、扫描验证 | 领域算法 + 领域数据 |
| 新媒体 | 平台身份探针、凭证管理、指标提取器 | **部分可下沉**（浏览器控制→Local Device Runtime；探针/提取器→插件私域，按平台配置化注册） |
| 商城 | 商品/订单/分销 | 领域交易模型（但支付/结算走 Commerce Core） |

**核心结论**：工作台私有的本质是「领域模型 + 领域算法 + 领域提示词」，平台公共的本质是「账户/权限/模型/任务/记忆/资产/计费/审计」。这条分界线就是未来插件系统的边界。

---

## 六、未来插件调用公共能力的方式（问题 4 回答）

### 6.1 插件运行时能力获取模型

```
Plugin (Manifest 声明 permissions + models + storage)
    │
    ├─→ Platform SDK（类型安全客户端）
    │       ├─ identity: getUser/tenant/membership
    │       ├─ permission: require('browser','content')
    │       ├─ model: call({model:'gpt-4o', messages})
    │       ├─ task: submit(workflowId) / poll(status)
    │       ├─ memory: ns.get/put/delete（命名空间隔离）
    │       ├─ storage: asset.upload/download
    │       ├─ billing: usage.report（网关自动）
    │       └─ audit: log（自动）
    │
    ├─→ Hermes Runtime（Agent 插件专用）
    │       ├─ lifecycle: start/pause/stop
    │       ├─ tools: tool.register / tool.invoke
    │       ├─ scheduler: cron/trigger
    │       └─ local: device.browser.control（本地运行时）
    │
    └─→ 领域私有能力（工作台提供）
            └─ 以「能力注册」方式暴露，非直接 import
```

### 6.2 关键设计决策

1. **插件不得 import 平台内部模块**：只允许 `@kunlun/platform-sdk` 类型化入口。
2. **权限以 Manifest 声明、平台强制**：`permissions:["browser","content"]` 由平台授权后注入运行时。
3. **模型调用按网关计价**：插件无需自建计费，网关按 token/任务自动记账到插件订阅。
4. **记忆/资产按命名空间隔离**：`tenant/{tenantId}/plugin/{pluginId}/...`，防串号（复用新媒体多租户隔离经验）。

---

## 七、风险清单

| # | 风险 | 等级 | 缓解 |
|---|------|------|------|
| 1 | 抽离 5 套工作流引擎的收敛成本高 | 🔴 | 分阶段：先统一契约，再迁移高频路径，旧引擎冻结 |
| 2 | 平台层膨胀为「万能层」 | 🟠 | 严格按 4.2 抽离原则 + 领域语义豁免清单 |
| 3 | 现有 9 工作台回归风险 | 🟠 | 兼容期双通道 + Reality Gate 逐工作台验证 |
| 4 | 插件安全边界（工具权限/数据隔离） | 🔴 | 复用新媒体 ChannelAccessService 的 owner∪share 模型 + 插件沙箱（plugin-sandbox 已有） |
| 5 | 过度设计（生态先行、产品未稳） | 🟠 | **Online First 原则**：新媒体本地化试点先行，生态层随试点收敛 |

---

## 八、审计结论

1. **昆仑镜已有平台级能力基础**：Identity/Tenant/RBAC/Model Gateway/Subscription/Billing/Asset/Audit 均已存在并被多域引用——不是从零建平台，是**收敛与契约化**。
2. **重复建设真实存在**（8 类），根因是「无平台 API 契约 + 平行复制」，抽离不是重构而是立规矩。
3. **分界线清晰**：领域模型/算法/提示词私有，账户/权限/模型/任务/记忆/资产/计费公共。
4. **Hermes 已是事实上的 Agent 底座**：`agent-runtime/` + `HermesProfileBinding` 就是「AI 员工 = 插件实例」的雏形，生态化只需在其上包一层插件注册/订阅/分发。
