# MEDIA-DEPARTMENT M1-A Repository Reality Map

> **Generated**: 2026-07-19 19:16 UTC
> **Project**: shipin-cinematic-studio
> **Scope**: backend/src
> **Mapper**: OpenClaw (autonomous scan)
> **Constraint**: 仅扫描分析 | 零写入 | 零修改

---

## ============ Phase 1 — Backend Structure Scan ============

### 一级目录（M1-A Assumed → Actual Mapping）

| M1-A 假设模块 | 实际路径 | 状态 |
|---|---|---|
| `auth` | `plugins/auth.ts` + `middleware/require-admin.ts` + `middleware/tenant-guard.ts` | ⚠️ 无独立模块 |
| `user` | Prisma `User` model only | ⚠️ 无独立 Service |
| `tenant` | `middleware/tenant-guard.ts` + `GovOrganization`/`GovUser` (governance schema) | ⚠️ 无独立模块 |
| `organization` | `services/enterprise/organization/` + `services/platform/` + Prisma `Organization` | ✅ 存在 |
| `enterprise` | `services/enterprise/` + `routes/enterprise*.ts` | ✅ 存在 |
| `subscription` | `services/platform/governance/subscription/` + `routes/platform/governance/subscription.route.ts` | ✅ 存在 |
| `agent` | `services/platform/agent/` + `agent-runtime/` | ✅ 存在 |
| `runtime` | `agent-runtime/` + `core-runtime/` + `services/*/runtime/` | ✅ 存在 |
| `provider` | `core/provider-registry/` + `services/enterprise/organization/ai-provider-config.service.ts` | ✅ 存在 |

### 一级目录完整清单（backend/src）

```
admin, agent-runtime, agents, ai, api, audits, authority,
autonomous-director, benchmark, billing, bootstrap, causal-engine,
causal-graph, character-persistence, cinematic-compiler, cinematic-grammar,
cinematic-motion-planner, config, config-runtime, contracts, control-layer,
control-plane, core, core-runtime, creative-economy, creative-os-gateway,
data, decision-runtime, director, director-economy, director-intelligence,
director-ir, director-marketplace, director-registry, director-runtime,
director-v2, domain, engine, engines, enterprise, events, execution,
execution-debug, execution-intelligence, execution-memory, execution-observatory,
execution-safety, execution-trace, gateway, governance, graph-optimization,
graph-patch, guards, health, infra, jobs, kernel, lib,
llm-execution-graph-v2, middleware, model-adapters, narrative-constraint,
observability, optimization, payment, platform, plugins, plugin-sandbox,
production-loop, production-validation, prompts, providers, queue, replay,
replay-analytics, replay-engine, rfvl, routes, runtime, safety,
schema-runtime, schemas, scripts, security, services, shared, storage,
style-dsl, style-runtime, temporal-engine, tir, truth, types, utils,
workbench, worker, workers, workflow
```

> 项目模块数：~80 个一级目录。M1-A Plan 假设 ~9 个核心模块。差距巨大。

---

## ============ Phase 2 — Identity Reality Check ============

### AUTH_REALITY_MAP

```
Request (HTTP)
    ↓
plugins/auth.ts — JWT decode → prisma.user.findUnique → tokenVersion check
    ↓
middleware/tenant-guard.ts — User.email → govUser → govOrganization
    ↓
middleware/require-admin.ts — extractAdmin → admin username
    ↓
request.user = { id, email, tokenVersion, ... }
    ↓
getEffectiveTier(membership, memberTier)
    ↓
userModelConfigV2 — AI provider routing config
```

### 关键事实

- **登录机制**: JWT + 数据库 User 表（`tokenVersion` 防降级）
- **不存在独立 auth 模块**: 认证逻辑散落在 `plugins/auth.ts` 和 `middleware/` 中
- **tenant-guard 使用 Governance 体系**: `User.email → govUser → govOrganization` (governance_organization)
- **不存在 `req.tenant` context service**: tenant 信息通过 middleware 注入 request，无统一 Context 抽象
- **Access Decision**: 基于 `getEffectiveTier()` + role + capability 混合判断

### 缺失构件（M1-A 所需）

| 构件 | 状态 |
|---|---|
| `TenantContext` / `IContextService` | ❌ 不存在 |
| `IEntitlementGuard` | ❌ 不存在 |
| `IAgentAccessResolver` | ❌ 不存在 |
| `IProviderResolver` | ❌ 不存在 |
| Request-scope Context DI | ❌ 不存在 |

---

## ============ Phase 3 — Subscription Reality Check ============

### 双订阅体系并存

#### 体系 A: Organization-Centric (B2B Enterprise)

```
Organization
    ↓ 1:1
EnterpriseSubscription
    ↓ Many:1
EnterprisePlan (`enterprise_plan`)
    ↓ 1:1
EnterpriseEntitlement (`enterprise_entitlement`)
```

- **路由**: `routes/enterprise*.ts`, `routes/subscription.ts`, `routes/entitlement.ts`
- **服务**: 无独立 SubscriptionRuntime，逻辑在 routes 中
- **Plan Snapshot**: EnterpriseSubscription 支持购买时快照冻结（snapshotName, snapshotPrice 等）

#### 体系 B: Governance Tenant-Centric (Platform)

```
governance_user → governance_organization (tenantId)
    ↓
Tenant
    ↓ 1:Many
Subscription → SubscriptionPlan (productType: "MEDIA_DEPARTMENT")
    ↓
CapabilityGrant (planId + capability + limits)
    ↓
Role (tenantId + code + capabilities JSON)
```

- **路由**: `routes/platform/governance/subscription.route.ts`
- **服务**: `services/platform/governance/subscription/subscription-runtime.ts`
  - `SubscriptionRuntime` class (exported & instantiated as `subscriptionRuntime`)
- **授权**: `services/platform/governance/authorization/capability-auth.ts`
  - `CapabilityAuth` class (exported & instantiated as `capabilityAuth`)
- **Plan 含 productType**: `"MEDIA_DEPARTMENT"` 作为一等公民类型存在

### MEDIA_DEPARTMENT Plan 配置

```prisma
model SubscriptionPlan {
  productType  String  @default("MEDIA_DEPARTMENT")  // ← 原生支持
  capabilities String  // JSON — {"ai_employee":20, "platforms":10, ...}
  // ... yearlyPrice, billingCycle, etc.
}
```

> ✅ Governance Subscription 体系完全支持 MEDIA_DEPARTMENT productType。调用点已存在。

---

## ============ Phase 4 — Agent Runtime Reality Check ============

### Agent 执行链路

```
Task Trigger (API / Workflow)
    ↓
agent-runtime/orchestrator/AgentOrchestrator.executeTask()
    ↓
validateAgentAccess(agentId, context, 'agent:execute')
    ↓
WorkflowEngine.execute() → StepExecutor.executeStep()
    ↓
Dispatch to Provider (model-adapters/providers/*)
    ↓
LLM Response → CharacterAnimation → SceneAssembly
```

### agent-runtime 模块结构

```
agent-runtime/
  brain/             ← Agent intent classification & planning
  context/           ← Runtime state management
  execution/         ← StepExecutor + WorkflowEngine + WorkflowState
  gateway/           ← External trigger entry
  interfaces/        ← Agent contracts
  lifecycle/         ← Agent spawn/dispose
  orchestrator/      ← AgentOrchestrator (central coordinator)
  types/             ← Shared type definitions
  workflow/          ← Workflow state machines
```

### 关键事实

- **Agent Runtime 完整存在**: 8 个子模块，含 orchestrator + executor
- **validateAgentAccess 是核心 guard**: 已在 AgentOrchestrator 中调用
- **task → agent → runtime → LLM 链路完整**: 无需新建 runtime 层
- **services/** 中存在大量 agent 相关运行时: `services/goal/`, `services/platform/agent/`, `services/platform/workspace/`
- **Missing**: 没有统一的 `AgentAccessResolver` 抽象 — access 逻辑可能耦合在 orchestrator 内部

---

## ============ Phase 5 — Provider Reality Check ============

### Provider 存储位置

| 存储方式 | 位置 | 状态 |
|---|---|---|
| **Prisma DB (BYOK)** | `ai_provider_config` 表 | ✅ 主路径 |
| **Plugin Registry** | `core/provider-registry/plugin-registry.ts` | ✅ 适配器注册 |
| **Env Vars** | `config/env.ts` (process.env) | ✅ 全局 fallback |
| **User Model Config** | `user_model_config_v2` 表 | ✅ 用户级覆盖 |

### AIProviderConfig Schema (Prisma)

```prisma
model AIProviderConfig {
  id              String  @id @default(uuid())
  organizationId  String
  provider        String  // deepseek | openai | claude | qwen | zhipu
  encryptedApiKey String
  baseUrl         String?
  model           String  // deepseek-chat | gpt-4o | ...
  maxTokensPerDay Int     @default(0)
  enabled         Boolean @default(true)
  status          String  @default("active")  // active | expired | rate_limited
  @@unique([organizationId, provider, model])
}
```

### Provider 服务层

| 文件 | 作用 |
|---|---|
| `services/enterprise/organization/ai-provider-config.service.ts` | AIProviderConfig CRUD + 加解密 |
| `core/provider-registry/plugin-registry.ts` | 运行时 PluginAdapter 注册 |
| `core/provider-registry/fallback-resolver.ts` | fallback chain → Candidate 解析 |
| `core/provider-registry/types.ts` | Candidate, ProviderDescriptor, ModelPluginAdapter |
| `model-adapters/llm/` | 具体 Provider 适配器 (OpenAI, DeepSeek, ...) |
| `model-adapters/images/` | 图像 Provider 适配器 |
| `model-adapters/video/` | 视频 Provider 适配器 |

### BYOK 流程

```
Organization creates AIProviderConfig (encryptedApiKey + provider + model)
    ↓
PluginRegistry route by provider → ModelPluginAdapter
    ↓
FallbackResolver: [deepseek, openai] → Candidates[]
    ↓
Worker dispatcher: select by (provider, capability)
    ↓
Execute API call with decrypted key
```

> ✅ BYOK 完整实现。无需新建 Provider 体系。

---

## ============ Phase 6 — Final Decision ============

### 架构匹配度评估

| M1-A 抽象 | 已有对应 | 差距 | 建议 |
|---|---|---|---|
| `ContextService` | middleware 注入 request + govUser/govOrganization | ❌ 无统一抽象 | **创建 Service + DI** |
| `EntitlementGuard` | CapabilityAuth (governance) + EnterpriseEntitlement | ⚠️ 两套体系 | **Adapter + 统一入口** |
| `AgentAccessResolver` | validateAgentAccess in AgentOrchestrator | ⚠️ 耦合在 orchestrator | **抽取为独立 Service** |
| `ProviderResolver` | AIProviderConfigService + PluginRegistry | ✅ 基本就绪 | **轻量包装即可** |

### 关键双系统问题

项目存在**两套并行**的 tenant/subscription/agent 体系：

| 维度 | Org-Centric (Enterprise) | Governance-Centric (Platform) |
|---|---|---|
| User Identity | `User` + `OrgMember` | `GovUser` + `governance_user` |
| Tenant/Org | `Organization` | `GovOrganization` + `Tenant` |
| Subscription | `EnterpriseSubscription` + `EnterprisePlan` | `Subscription` + `SubscriptionPlan` |
| Entitlement | `EnterpriseEntitlement` | `CapabilityGrant` + `Role` |
| Agent Access | per-org AIProviderConfig | per-tenant capabilities |
| User Tier | `User.memberTier` + `Membership` | `governance_role.capabilities` |

> ⚠️ M1-A 的 MediaDepartmentContextService 必须决定：
> - 走 Governance 体系（推荐，productType 原生支持 MEDIA_DEPARTMENT）
> - 还是走 Enterprise 体系（老路径，plan snapshot 支持更好）
> - 或是 Bridge 两者

---

## ============ FINAL VERDICT ============

```
╔══════════════════════════════════════════════════════════════╗
║  RESULT:  C — Only Design Exists / Foundation Fragmented    ║
║                                                              ║
║  Architecture partially exists but NO unified context/\      ║
║  entitlement/provider abstraction layer.                     ║
║                                                              ║
║  Decision: Need ADAPTER LAYER + selective foundation.        ║
╚══════════════════════════════════════════════════════════════╝
```

### M1-A 必须采取的策略

1. **不新建 auth / tenant / subscription / provider 基础层** — 避免重复造轮子
2. **创建 MediaDepartmentContextService** — 统一包装 govUser/govOrganization 查询
3. **创建 EntitlementAdapter** — 桥接 EnterpriseEntitlement × CapabilityGrant
4. **抽取 AgentAccessResolver** — 从 AgentOrchestrator 中解耦
5. **ProviderResolver = 薄包装** — AIProviderConfigService + PluginRegistry 之上
6. **统一走 Governance 体系** — productType = "MEDIA_DEPARTMENT" 已有完整支持

### 风险

| 风险 | 可能性 | 影响 |
|---|---|---|
| 双体系混淆 (Org vs Governance) | 高 | 数据不一致 |
| AIProviderConfig 并行 Source-of-Truth | 中 | 配置漂移 |
| validateAgentAccess 耦合 | 中 | 难以独立测试 |
| SubscriptionRuntime vs Direct Route Logic | 高 | 订阅状态不一致 |

### 建议顺序

```
Step 1:  MediaDepartmentContextService     [接入 govUser/govOrganization]
Step 2:  EntitlementAdapter                 [桥接 Enterprise × Governance]
Step 3:  AgentAccessResolver                [抽取自 AgentOrchestrator]
Step 4:  ProviderResolver                   [包装已有 service + registry]
Step 5:  MEDIA_DEPARTMENT Plan Capability    [写入 SubscriptionPlan.capabilities]
```

---

*End of Report — OpenClaw Repository Reality Mapper v1.0*
