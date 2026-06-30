# KMKI Platform Blueprint v2.0

> **Version**: 2.0  
> **Status**: Review Candidate  
> **Date**: 2026-07-20  
> **Supersedes**: All prior platform architecture blueprints  
> **Document Hierarchy**:  
> ```
> KMKI Platform Constitution v1.1（最高级，29 条不可违反规则）
>   └── KMKI Platform Blueprint v2.0（本文件，平台如何实现）
>         ├── Center Specifications
>         └── Workspace Specifications
>               └── Implementation Guides
> ```

> **Constitution 定义"不能违反什么"，Blueprint 定义"应该如何实现"。Blueprint 不新增原则。**

---

# Ch 1 — Platform Execution Flow

> **Why**: Constitution 定义了分层不可逆转（CONST-001）和调用链方向，但未定义请求如何在各层之间流动。本章定义四条贯穿全平台的执行主链，所有 Center 的设计都是插在这四条链上的节点。

## 1.1 Request Flow (请求流)

```
Workspace
  │ 调用 Adapter
  ▼
Workspace Adapter
  │ 格式转换 + 认证 Token 注入
  ▼
┌─────────────────────────────────────────────┐
│              Platform Gateway                │
│  ┌──────────┬──────────┬──────────────────┐  │
│  │ Auth     │ Rate Lim │ Trace Injection  │  │
│  └──────────┴──────────┴──────────────────┘  │
│  │ 路由                                     │
│  ▼                                          │
│  Controller → Service → Repository          │
└─────────────────────────────────────────────┘
  │ Capability.invoke({capabilityId, params, context})
  ▼
┌─────────────────────────────────────────────┐
│            Capability OS                     │
│  Registry → Resolver → Policy Engine        │
│  │ Prompt Enhancement                       │
│  ▼ Execution Plan                           │
└─────────────────────────────────────────────┘
  │ ExecutionPlan{capability, provider, timeout, retry, streaming, cost}
  ▼
┌─────────────────────────────────────────────┐
│           Runtime Center                     │
│  Planner → Dispatcher → Executor            │
│  │ Provider Adapter Invocation              │
│  ▼                                          │
└─────────────────────────────────────────────┘
  │ ProviderAdapter.generate(request) / stream(request)
  ▼
┌─────────────────────────────────────────────┐
│            Provider Adapter                  │
│  │ Provider SDK 调用                         │
│  ▼                                          │
└─────────────────────────────────────────────┘
  │ HTTP / gRPC
  ▼
Provider API (OpenAI / DeepSeek / Claude / …)
```

## 1.2 Response Flow (响应流)

```
Provider API
  │ JSON Response / Stream Chunks
  ▼
Provider Adapter
  │ 统一格式转换（NormalizeResponse）
  ▼
Runtime Executor → Result Collector
  │ 结果聚合、Trace 记录
  ▼
Capability OS → Output Validator → Normalizer
  │ 验证输出 Schema → 标准化
  ▼
Gateway → Controller
  │ 统一 Response Schema 包装
  ▼
Workspace Adapter
  │ 翻译回 Workspace 业务语义
  ▼
Workspace
```

## 1.3 Event Flow (事件流)

```
Publisher Center
  │ 发布事件（Event Bus Client）
  ▼
Event Bus
  │ 事件路由（Topic-based）
  │ 持久化 → 投递 → 重试 → 死信
  ▼
Subscriber Center(s)
  │ 幂等处理
  ▼
Action (状态更新 / 触发流程 / 通知)
```

关键设计：
- 事件不承载业务 Response（Response 走同步路径）
- 事件用于：状态变更通知、异步编排、可观测性数据
- 每个事件必须幂等（至少一次投递 + 去重）

## 1.4 Trace Flow (追踪流)

```
Trace ID 生成
  │ Gateway 入口处生成（UUID v4）
  │ 格式: {prefix}-{timestamp}-{random}
  ▼
Trace Context
  │ 通过 HTTP Header / Event Metadata 传播
  │ Headers: X-Trace-Id, X-Span-Id, X-Parent-Span-Id
  ▼
Span 记录
  │ 每个 Center 的每个模块记录开始/结束/错误
  │ Span 结构: {traceId, spanId, parentSpanId, service, operation, startTime, endTime, status, error?, metadata}
  ▼
Trace Collector
  │ Observability Center 负责聚合
  ▼
Trace Storage (Elasticsearch / ClickHouse)
```

---

# Ch 2 — Platform Gateway Architecture

> **Why**: Constitution CONST-010（所有 API 必须认证）和 CONST-009（统一 Response Schema）要求统一的入口层。Gateway 是 Platform 的唯一入口。

## Responsibility

所有外部请求（Workspace Adapter 发出的 HTTP 调用）的单一入口。负责认证、授权、限流、Trace 注入、请求路由。

## Non-Responsibility

不包含业务逻辑。不缓存业务数据。不直接调用 Provider。

## Public Contract

### 请求结构（所有 POST/PUT/PATCH 请求）

```json
{
  "params": { ... },
  "context": {
    "traceId": "kmki-20260720-a1b2c3d4",
    "workspaceId": "brand-geo",
    "userId": "u_abc123"
  },
  "options": {
    "timeout": 30000,
    "priority": "normal"
  }
}
```

### 响应结构（所有响应）

```json
{
  "success": true,
  "data": { ... },
  "message": "",
  "traceId": "kmki-20260720-a1b2c3d4",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156
  }
}
```

### HTTP 状态码

| Code | 含义 | 处理方式 |
|------|------|----------|
| 200 | 成功 | 正常返回 |
| 400 | 参数校验失败 | Adapter 修正后重试 |
| 401 | 认证失败 | Adapter 刷新 Token |
| 403 | 权限不足 | 不重试，上报 |
| 404 | 资源不存在 | 不重试 |
| 429 | 限流 | Adapter 退避重试 |
| 500 | 服务端错误 | Adapter 可重试 |
| 504 | 超时 | Adapter 可重试 |

## Internal Architecture

```
Gateway
  │
  ├── Middleware Chain (顺序执行)
  │   ├── Authentication
  │   │   └── JWT / Bearer Token 验证、Token Refresh
  │   ├── Authorization
  │   │   └── RBAC 检查、Workspace 权限
  │   ├── Rate Limiting
  │   │   └── Token Bucket / Sliding Window / 租户级限流
  │   ├── Trace Injection
  │   │   └── Trace ID 生成或透传、Span 初始化
  │   └── Validation
  │       └── Schema 校验、参数类型检查
  │
  ├── Controller
  │   ├── 参数解析与绑定
  │   ├── 权限检查（细粒度）
  │   ├── 调用 Service
  │   └── 响应格式化
  │
  ├── Service
  │   ├── 业务编排
  │   ├── 跨 Center 协调
  │   └── 错误处理与降级
  │
  └── Repository
      ├── 数据访问
      ├── 缓存策略
      └── 事务管理
```

## Data Ownership

Gateway 不拥有业务数据。只维护：Rate Limit 计数器（Redis）、Token 黑名单。

## Failure Mode

| 场景 | 行为 |
|------|------|
| Authentication Service 不可用 | 拒绝所有请求，返回 503 |
| Rate Limit Store 不可用 | 降级为本地计数器（有误差），不拒绝全部请求 |
| 后端 Service 超时 | 返回 504 Gateway Timeout |
| 请求过大 | 返回 413 Payload Too Large |

## Evolution

- 新增 Middleware：注册到 Middleware Chain
- 新增 API：注册新的 Route + Controller
- 不可修改：Response Schema、认证流程

---

# Ch 3 — Capability Operating System

> **Why**: Constitution CONST-005（Capability 是唯一 AI 调用入口）和 CONST-006（Capability Contract 不可破坏）要求 Capability 层不仅仅是一个注册表，而是一个完整的执行操作系统。

## Responsibility

Capability 的注册、发现、路由、策略执行、请求增强、响应标准化。

## Non-Responsibility

不执行模型调用（那是 Runtime）。不管理 Provider 凭证（那是 AI Center）。

## Public Contract

### CapabilityDefinition（完整结构）

```typescript
interface CapabilityDefinition {
  id: string
  version: string
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated' | 'removed'
  owner: string
  tier: 'free' | 'standard' | 'premium'
  timeout: number
  retry: { maxAttempts: number; backoff: 'linear' | 'exponential' }
  cache: { ttl: number; strategy: 'none' | 'simple' | 'semantic' }
  cost: { perToken: number; perRequest: number }
  permission: string[]
  observability: { trace: boolean; logBody: boolean }
  sla: { p99: number; availability: number }
  fallback: string[]
  providerPolicy: 'cost-first' | 'latency-first' | 'manual-pin'
  schema: { input: JSONSchema; output: JSONSchema }
}
```

### Capability.invoke API

```typescript
POST /api/capability/invoke
{
  "params": {
    "capabilityId": "reason.generate",
    "version": "2.1.0",
    "input": { "prompt": "...", "temperature": 0.7 }
  },
  "context": { "traceId": "...", "workspaceId": "...", "userId": "..." }
}
→ {
  "success": true,
  "data": { "reasoning": "...", "answer": "...", "confidence": 0.95 },
  "traceId": "..."
}
```

## Internal Architecture

```
Capability OS
  │
  ├── Registry
  │   ├── 注册 / 注销 Capability
  │   ├── 版本管理（semver 兼容性检查）
  │   ├── 生命周期管理（experimental → stable → deprecated）
  │   └── Schema 校验（输入输出 Contract）
  │
  ├── Resolver
  │   ├── Capability → Provider 策略匹配
  │   ├── 考虑因素：tier、成本、延迟、SLA
  │   └── 输出：Provider 选择 + Model 选择
  │
  ├── Policy Engine
  │   ├── Execution Policy（超时、重试、流式）
  │   ├── Prompt Policy（System Prompt 注入、格式增强）
  │   ├── Output Policy（Schema 验证、内容过滤）
  │   ├── Cost Policy（配额检查、成本上限）
  │   ├── Fallback Policy（降级链定义）
  │   └── Streaming Policy（Chunk 聚合、中断处理）
  │
  └── Execution Pipeline
      ├── 请求增强（Prompt Enhancement）
      ├── 调用 Runtime
      ├── 响应标准化（Normalizer）
      └── 输出验证
```

## 3.5 Capability Resolution Algorithm

Resolver 的 Provider 选择算法，按顺序执行各阶段：

```
Input: Capability ID + Workspace Context
  │
  ▼ Step 1: Find All Eligible Providers
  │   query Model Registry → 返回支持该 Capability 的所有 Provider+Model
  │
  ▼ Step 2: Permission Filter
  │   Workspace Tier ↔ Capability Tier 匹配
  │   排除无权调用的 Provider
  │
  ▼ Step 3: Tenant Filter
  │   多租户环境下，排除被租户管理员禁用的 Provider
  │
  ▼ Step 4: Lifecycle Filter
  │   stable > preview > experimental
  │   排除 deprecated / removed
  │
  ▼ Step 5: Health Filter
  │   排除 health status = "down" 的 Provider
  │   排除 error rate > threshold 的 Provider
  │   排除 latency > SLA 的 Provider
  │
  ▼ Step 6: Cost Policy
  │   "cost-first": 选择单价最低的 Provider
  │   "latency-first": 选择延迟最低的 Provider
  │   "manual-pin": 使用 Workspace 指定的固定 Provider
  │
  ▼ Step 7: Build Fallback Chain
  │   [primary, secondary, tertiary, ...]
  │   Runtime 按顺序执行，失败则 Fallback
  │
  ▼ Output: { provider, model, fallbackChain }
```

## 3.6 Capability Metadata 扩展

CapabilityDefinition 新增字段 `executionMode`：

```typescript
interface CapabilityDefinition {
  // 既有字段...
  executionMode: {
    sync: boolean    // 同步请求-响应模式
    stream: boolean  // 流式 SSE 模式
    async: boolean   // 异步提交-回调模式
  }
  // ...
}
```

| Capability | sync | stream | async |
|-----------|------|--------|-------|
| `text.generate` | ✅ | ✅ | ❌ |
| `reason.generate` | ✅ | ✅ | ❌ |
| `embedding.encode` | ✅ | ❌ | ❌ |
| `video.generate` | ❌ | ❌ | ✅ |
| `image.generate` | ✅ | ❌ | ❌ |
| `audio.tts` | ✅ | ✅ | ❌ |

Runtime 根据 Capability 的 executionMode 声明选择执行路径，不自行猜测。

## Data Ownership

| Data | Owner |
|------|-------|
| Capability Definition | Capability Center |
| Policy Config | Capability Center |
| Schema Definition | Capability Center |

## Failure Mode

| 场景 | 行为 |
|------|------|
| Registry 不可用 | 使用本地缓存（最终一致性），拒绝新注册 |
| Resolver 不可用 | 使用默认 Provider 策略 |
| Policy Engine 不可用 | 使用默认 Policy |
| Fallback 链全部失败 | 返回降级响应 |

## Evolution

- 新增 Capability：Register 即可
- 新增 Policy：扩展 Policy Engine
- 不可修改：invoke API 的 Schema

---

# Ch 4 — Runtime Architecture

> **Why**: Constitution CONST-007（Runtime 不允许出现业务逻辑）和 CONST-008（所有 AI 调用必须可追踪）要求 Runtime 是一个纯粹的、可观测的执行引擎。

## Responsibility

AI 调度的执行层。Planner → Dispatcher → Executor → Result Collector 四阶段。

## Non-Responsibility

不包含任何业务逻辑。不管理 Provider 配置。不决定 Capability 路由。

## Public Contract

### ExecutionPlan 结构

```typescript
interface ExecutionPlan {
  planId: string
  capabilityId: string
  providerId: string
  modelId: string
  timeout: number
  retry: { maxAttempts: number; backoff: 'linear' | 'exponential' }
  streaming: boolean
  concurrency: number
  cost: number
  traceId: string
}
```

## Internal Architecture

```
Runtime Center
  │
  ├── Planner
  │   ├── 超时计算（根据 Capability 定义 + Workspace 选项）
  │   ├── 优先级队列（FIFO / Priority）
  │   ├── 并发控制（Semaphore / 租户级配额）
  │   ├── 流式策略（Chunk 大小、缓冲策略）
  │   └── 输出：ExecutionPlan
  │
  ├── Dispatcher
  │   ├── Provider 选择（根据 Policy Engine 输出）
  │   ├── 区域路由（就近路由 / 跨区域 Fallback）
  │   ├── Fallback 链执行（主 Provider → 次 Provider → 降级）
  │   └── 输出：DispatchDecision{provider, endpoint, credential}
  │
  ├── Executor
  │   ├── Provider Adapter 调用
  │   ├── 同步模式（HTTP Request → Wait → Response）
  │   ├── 流式模式（HTTP SSE → Stream Chunks → Aggregate）
  │   ├── 重试逻辑（指数退避 + Jitter）
  │   └── 输出：RawResult
  │
  └── Result Collector
      ├── 结果聚合（流式模式下合并 Chunks）
      ├── 响应标准化（NormalizeResponse）
      ├── Trace 记录（记录调用耗时、Token 消耗、错误）
      └── 输出：NormalizedResult
```

### Retry 策略算法

```
retryableErrors = [429, 500, 502, 503, 504]
maxAttempts = ExecutionPlan.retry.maxAttempts

for attempt = 1 to maxAttempts:
  result = await Executor.execute()
  if result.success: return result
  if result.httpStatus not in retryableErrors: return result
  if attempt < maxAttempts:
    wait = backoff(attempt)  // exponential with jitter
    await sleep(wait)
return Result{success:false, error:"max retries exceeded"}
```

## 4.1 Execution State Machine

每个 Execution Plan 的生命周期状态：

```
Created ──→ Queued ──→ Planning ──→ Dispatching ──→ Running ──→ Completed
                │                                    │              │
                │                                    ├── Streaming ─┤
                │                                    │              │
                │                                    ├── Failed ────┤
                │                                    │              │
                │                                    └── TimedOut ──┤
                │                                                   │
                └────────────────────── Cancelled ←─────────────────┘
```

| State | 含义 |
|-------|------|
| Created | ExecutionPlan 已创建，等待调度 |
| Queued | 进入等待队列（并发控制） |
| Planning | Planner 正在计算超时/优先级/策略 |
| Dispatching | Dispatcher 正在选择 Provider |
| Running | Executor 正在执行 |
| Streaming | 流式模式，持续输出 Chunks |
| Completed | 执行成功，结果已收集 |
| Failed | 执行失败（重试次数耗尽） |
| Cancelled | 被用户或系统取消 |
| TimedOut | 超时未完成 |

所有状态变更必须记录 Trace Span，不可跳跃（如 Running → Completed 必须经过 Result Collector）。

## Data Ownership

| Data | Owner |
|------|-------|
| Execution Trace | Runtime Center (write) → Observability (read) |
| Execution Plan (in-flight) | Runtime Center only |
| Cached Results | Runtime Center (TTL-based) |

## Failure Mode

| 场景 | 行为 |
|------|------|
| Provider 全部不可用 | 返回 Service Unavailable |
| 部分 Provider 不可用 | Dispatcher 自动 Fallback |
| Runtime 过载 | 请求排队，返回 429 |
| 流式中断 | 客户端重连 + Resend 指针 |

## Evolution

- 新增调度策略：扩展 Planner
- 新增 Provider 类型：扩展 Dispatcher 的路由逻辑
- 不可修改：Executor → Provider Adapter 接口

---

# Ch 5 — Platform Centers

## 5.1 Center Template

每个 Center 使用完全一致的模板：

```
Mission（一句话使命）
Responsibilities（职责列表）
Forbidden（绝对不做什么）
Modules（内部模块）
Public APIs（对外 API 列表，每个含方法/入参/出参）
Public Events（对外事件列表，每个含名称/payload/publisher/subscriber）
Storage（数据存储）
Metrics（暴露的指标）
Health（健康检查端点）
Dependencies（依赖的 Center）
Failure（故障模式）
Replacement Strategy（替换策略）
```

## 5.2 Identity Center

**Mission**: 平台唯一身份认证和权限管理。

**Modules**: Auth Service / Token Manager / Role Manager / SSO Gateway

**Public APIs**:
- `POST /api/identity/auth` — 登录，返回 JWT
- `POST /api/identity/token/refresh` — 刷新 Token
- `GET /api/identity/permissions` — 查询权限

**Public Events**: `identity.token_revoked.v1`

**Storage**: 用户表、角色表、权限表（独立 Schema）

**Dependencies**: Observability Center

## 5.3 AI Center

**Mission**: 管理 AI Provider、Credential、Model、Quota、Cost 和 Health。

**Modules**（6 个 Registry + 1 个 Profile）:
1. **Provider Registry** — Provider 注册/发现/生命周期
2. **Credential Registry (Credential Vault)** — 凭证加密存储/注入
3. **Model Registry** — 模型列表/版本/能力声明
4. **Model Profile** — 每个模型的详细能力描述（如下）
5. **Quota Registry** — 配额管理/用量统计
6. **Cost Registry** — 成本记录/计费原始数据
7. **Health Registry** — Provider 健康状态/延迟统计

**Public APIs**:
- `GET /api/ai/providers` — Provider 列表
- `GET /api/ai/models` — 模型列表
- `GET /api/ai/health/:providerId` — 查询 Provider 健康状态
- `POST /api/ai/credentials` — 注册凭证（仅管理员）

**Public Events**:
- `provider.registered.v1`
- `provider.degraded.v1`
- `provider.removed.v1`

**Storage**: Provider 表、Model 表、Credential 表（加密）、Quota 表、Cost 表（独立 Schema）

**Dependencies**: Identity Center, Observability Center

**Replacement Strategy**: 所有 Provider Registry 可热插拔

### Model Profile 结构

每个模型在 Model Registry 中应有完整的 Profile：

```typescript
interface ModelProfile {
  id: string                    // "gpt-5"
  providerId: string            // "openai"
  version: string               // "5.0"
  lifecycle: 'preview' | 'stable' | 'deprecated'

  // 能力声明
  supports: {
    text: boolean               // text.generate
    reason: boolean             // reason.generate
    tool: boolean               // Function Calling
    vision: boolean             // vision.*
    stream: boolean             // 流式输出
    thinking: boolean           // 推理过程可见
    json: boolean               // JSON Mode
    embedding: boolean          // embedding.*
  }

  // 上下文窗口
  contextWindow: number         // 最大 token 数

  // 定价（每百万 token）
  pricing: {
    input: number               // 输入价格 ($/1M tokens)
    output: number              // 输出价格
    cachedInput?: number        // 缓存命中价格
  }

  // 性能
  latency: {
    p50: number                 // 中位数延迟 (ms)
    p95: number
    p99: number
  }

  // Capability 映射（此模型支持哪些 Capability）
  capabilityTags: string[]      // ["text.generate", "reason.generate", ...]
}
```

Capability Resolver 实际查询的是 Model Profile，而非 Provider。Provider 替换后只需更新 Model Profile 中的 `providerId`，Resolver 逻辑不需要修改。

## 5.4 Capability Center

**Mission**: 管理 Capability OS——注册、策略、执行管线。参见 Ch 3。

**Public APIs**: `POST /api/capability/invoke`

**Public Events**: `capability.registered.v1`

## 5.5 Runtime Center

**Mission**: 执行 AI 调用。参见 Ch 4。

**Public APIs**:
- `POST /api/runtime/execute` — 提交执行
- `GET /api/runtime/status/{planId}` — 查询状态
- `GET /api/runtime/result/{planId}` — 获取结果

**Public Events**:
- `runtime.completed.v1`
- `runtime.failed.v1`

## 5.6 Knowledge Center

**Mission**: 统一知识管理，所有 Workspace 的知识共享层。

**Modules**: Knowledge Object Manager / Graph Engine / Semantic Search / Entity Linker

**Public APIs**:
- `GET /api/knowledge/objects` — 知识对象列表
- `POST /api/knowledge/search` — 语义搜索
- `GET /api/knowledge/graph` — 知识图谱查询

**Public Events**: `knowledge.updated.v1`

**Dependencies**: AI Center (Embedding), Asset Center, Identity Center

## 5.7 Trust Center

**Mission**: 跨 Workspace 的信任框架。不是 GEO 的 Evidence Framework，而是通用的可信度引擎。

**Modules**:
- Evidence Manager（证据收集与权重）
- Claim Verifier（声明验证）
- Source Quality Analyzer（来源质量分析）
- Freshness Tracker（时效性追踪）
- Consistency Checker（一致性检查）
- Citation Confidence Engine（引用置信度计算）
- Trust Score Calculator（综合信任分）

**Public APIs**:
- `POST /api/trust/verify` — 验证声明
- `GET /api/trust/score/{entityId}` — 获取信任分
- `POST /api/trust/evidence` — 提交证据

**Public Events**: `trust.updated.v1`

**Dependencies**: AI Center (LLM), Knowledge Center, Identity Center

## 5.8 Asset Center

**Mission**: 统一资产管理（图片、视频、文件、Prompt、模板）。

**Public Events**: `asset.uploaded.v1`

## 5.9 Billing Center

**Mission**: 用量计费和配额管理。

**Public Events**: `cost.threshold_reached.v1`

## 5.10 Observability Center

**Mission**: 全平台的可观测性。

**Modules**: Log Aggregator / Metrics Collector / Trace Collector / Audit Logger / Alert Manager

**Each Center must expose**:
- `GET /health` → `{status, checks: {database: "ok", cache: "ok"}}`
- `GET /metrics` → Prometheus format
- `GET /events` → Recent events
- `GET /version` → Version info
- `GET /dependencies` → Dependency status

## 5.11 Developer Center

**Mission**: 开发者门户、SDK、文档、沙箱。

---

# Ch 6 — Provider Adapter Specification

> **Why**: Constitution CONST-002（核心模块不依赖 Provider SDK）要求 Provider SDK 调用必须隔离在独立 Adapter 层。

## 统一接口

```typescript
interface ProviderAdapter {
  /** 文本/推理生成 */
  generate(request: GenerateRequest): Promise<GenerateResponse>

  /** 流式生成 */
  stream(request: StreamRequest): AsyncIterable<StreamChunk>

  /** 向量化 */
  embed(request: EmbedRequest): Promise<EmbedResponse>

  /** 健康检查 */
  health(): Promise<HealthStatus>

  /** 模型列表 */
  models(): Promise<ModelInfo[]>

  /** 用量查询 */
  usage(): Promise<UsageInfo>
}

interface GenerateRequest {
  model: string
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  traceId: string
}

interface GenerateResponse {
  content: string
  finishReason: 'stop' | 'length' | 'error'
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  latency: number
  model: string
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  lastCheck: string
  error?: string
}
```

## Provider 生命周期

```
Register → Validate → Healthy → Degraded → Disabled → Removed

Register:    Provider 注册到 Provider Registry
Validate:    credential 验证 + models() 调用确认可连通
Healthy:    health() 返回 healthy
Degraded:   health() 返回 degraded 或延迟超阈值
Disabled:   手动禁用
Removed:    从 Registry 注销
```

## Provider Adapter 结构

```typescript
class OpenAIAdapter implements ProviderAdapter { ... }
class DeepSeekAdapter implements ProviderAdapter { ... }
class ClaudeAdapter implements ProviderAdapter { ... }
```

每个 Adapter 独立打包，不进入 Platform 核心模块。

---

# Ch 7 — Event Bus & Event Contracts

> **Why**: Constitution CONST-022（Center 间事件优先通通信）要求统一的 Event Bus 作为异步通信主路径。

## 事件命名规范

格式：`{source}.{action}.v{version}`

全小写英文字母 + 点号分隔。

## Initial Event Contracts

| Event Name | Payload | Publisher | Subscriber |
|-----------|---------|-----------|------------|
| `capability.invoked.v1` | `{capabilityId, version, traceId, inputSize}` | Capability Center | Observability, Billing |
| `runtime.completed.v1` | `{planId, capabilityId, providerId, modelId, latency, tokenUsage, success}` | Runtime Center | Observability, Billing, Capability |
| `runtime.failed.v1` | `{planId, capabilityId, providerId, error, attempt}` | Runtime Center | Observability, Capability |
| `provider.registered.v1` | `{providerId, name, models[], version}` | AI Center | Capability Center, Observability |
| `provider.degraded.v1` | `{providerId, latency, errorRate, since}` | AI Center | Runtime Center, Capability Center |
| `provider.removed.v1` | `{providerId, reason}` | AI Center | Capability Center, Runtime Center |
| `trust.updated.v1` | `{entityId, score, dimension, source}` | Trust Center | Knowledge Center |
| `knowledge.updated.v1` | `{objectId, projectId, changeType}` | Knowledge Center | Trust Center, Search |
| `asset.uploaded.v1` | `{assetId, type, size, workspaceId}` | Asset Center | Knowledge Center |
| `cost.threshold_reached.v1` | `{workspaceId, tier, currentCost, threshold}` | Billing Center | AI Center, Developer Center |
| `identity.token_revoked.v1` | `{userId, tokenId, reason}` | Identity Center | Gateway, AI Center |

## Event Bus 架构

```
Publisher → Event Bus Client
  │ Serialize + 发布
  ▼
Event Bus (Kafka / RabbitMQ)
  │ Topic-based 路由
  │ 持久化到磁盘
  ▼
Subscriber → Event Bus Client
  │ Deserialize + 幂等检查
  ▼
Handler → Action
  │ 处理成功 → Ack
  │ 处理失败 → Retry (最多 3 次)
  │ 超过重试 → Dead Letter Queue
```

## 幂等性

每个事件携带 `eventId`（UUID v4）。Subscriber 维护已处理 Event ID 去重表。

## Delivery Guarantee（投递保障）

不同事件有不同的投递保障级别：

| Guarantee | 含义 | 适用事件 |
|-----------|------|----------|
| **At Most Once** | 最多投递一次，允许丢失 | `metrics.tick`（监控指标、可降级） |
| **At Least Once** | 至少投递一次，允许重复（Subscriber 幂等去重） | `runtime.completed.v1`, `runtime.failed.v1`, `trust.updated.v1`, `knowledge.updated.v1` |
| **Exactly Once** | 精确一次投递（逻辑语义） | `provider.registered.v1`, `provider.removed.v1`, `cost.threshold_reached.v1` |

| Event | Guarantee |
|-------|-----------|
| `capability.invoked.v1` | At Least Once |
| `runtime.completed.v1` | At Least Once |
| `runtime.failed.v1` | At Least Once |
| `provider.registered.v1` | Exactly Once |
| `provider.degraded.v1` | At Least Once |
| `provider.removed.v1` | Exactly Once |
| `trust.updated.v1` | At Least Once |
| `knowledge.updated.v1` | At Least Once |
| `asset.uploaded.v1` | At Least Once |
| `cost.threshold_reached.v1` | Exactly Once |
| `identity.token_revoked.v1` | At Least Once |

---

# Ch 8 — Storage & Data Architecture

> **Why**: Constitution Data Constitution（CONST-024~027）要求数据有明确 Owner 和 Truth Source。

## 数据所有权表

| Center | Owns | Reads | Never Writes |
|--------|------|-------|-------------|
| Identity Center | Users, Roles, Permissions, Tokens | — | 任何业务数据 |
| AI Center | Providers, Models, Credentials, Quotas, Costs, Health | — | 业务数据、执行结果 |
| Capability Center | Capability Definitions, Policies | AI Center (Provider) | 凭证、执行状态 |
| Runtime Center | Execution Plans, Execution Traces, Cached Results | AI Center (Provider config) | 业务数据 |
| Knowledge Center | Knowledge Objects, Entities, Relations | Asset Center (assets) | 信任分数 |
| Trust Center | Trust Scores, Evidence, Claims | Knowledge Center (facts) | 知识数据 |
| Asset Center | Assets (files, images, videos) | — | 知识数据 |
| Billing Center | Billing Records, Quota Usage | AI Center (cost raw data) | 业务数据 |
| Observability Center | Logs, Metrics, Traces, Audit Logs | All Centers | 业务数据 |
| Developer Center | API Docs, SDKs, Sandbox Config | All Centers | 生产数据 |

## 数据库架构原则

- 每个 Center 使用独立的 Database Schema（PostgreSQL Schema 或独立数据库实例）
- 跨 Center 数据访问必须通过 API，禁止直连其他 Center 的数据库
- 缓存（Redis）按 Center 隔离 Key Namespace
- 数据迁移脚本必须经过 Data Constitution 合规检查

---

# Ch 9 — Observability & Governance

> **Why**: Constitution CONST-008（可追踪）和 CONST-017（健康检查）要求所有 Center 可观测。

## 四层可观测性

```
Log（结构化日志）
  │ JSON 格式、日志级别（debug/info/warn/error/fatal）
  │ 日志采样策略（高 QPS 接口按比例采样）
  ▼
Metrics（指标）
  │ Counters / Histograms / Gauges
  │ SLI: 请求量、延迟、错误率、饱和度
  ▼
Trace（分布式追踪）
  │ Trace Context 传播（W3C Trace Context）、Span 树
  ▼
Audit（审计）
  │ 不可变日志、合规报告、操作记录
```

## 9.1 SLI / SLO / SLA 体系

所有 Capability 必须声明其 SLO，Observability Center 基于此监控。

```yaml
# Capability reason.generate 的 SLO 示例
capability: reason.generate
sli:
  - name: availability
    measurement: successful_requests / total_requests
    threshold: 99.9%
  - name: latency_p95
    measurement: p95 of request duration
    threshold: 3000ms
  - name: latency_p99
    measurement: p99 of request duration
    threshold: 6000ms
  - name: error_rate
    measurement: error_requests / total_requests
    threshold: 0.5%
```

| 概念 | 定义 |
|------|------|
| SLI (Service Level Indicator) | 实际测量的指标值（延迟、错误率、可用性） |
| SLO (Service Level Objective) | 目标阈值（P95 < 3s） |
| SLA (Service Level Agreement) | 对外承诺（违反有赔偿） |

每个 Center 必须为其核心能力定义 SLI/SLO。Observability Center 提供 SLI 仪表盘并在 SLO 逼近阈值时告警。

## 9.2 每个 Center 必须暴露的端点

```typescript
// 健康检查
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    cache?: { status: 'ok' | 'error', latency: number },
    dependencies: { [centerName]: 'ok' | 'degraded' | 'down' }
  }
}

// 指标
GET /metrics → Prometheus 格式文本

// 事件
GET /events → { events: EventRecord[] }

// 版本
GET /version → { version: string, buildTime: string, commit: string }

// 依赖
GET /dependencies → { dependencies: { [centerName]: { status, latency } } }
```

---

# Ch 10 — Deployment & Evolution

> **Why**: Constitution CONST-028（Center 可替换）和 CONST-023（公共契约生命周期）要求明确的部署和演进策略。

## Platform Lifecycle

```
Design → Register → Validate → Deploy → Observe → Optimize → Deprecate → Replace → Archive

Design:      设计文档 + Architecture Review
Register:    注册到 Developer Center + Observability Center
Validate:    Sandbox 验证 + 集成测试
Deploy:      灰度发布（10% → 50% → 100%）
Observe:     监控指标、错误率、性能
Optimize:    基于 Observability 数据优化
Deprecate:   标记 deprecated、通知消费者、维持 3 个月窗口
Replace:     替换实现
Archive:     代码归档、文档标记为历史
```

## 部署拓扑

```
单机部署（开发/测试）:
  All Centers in single process → SQLite + Redis

集群部署（生产）:
  Gateway Cluster (Nginx + Gateway instances)
  Center Services (Kubernetes, per-Center deployment)
  Database Cluster (PostgreSQL + Redis Cluster)
  Event Bus Cluster (Kafka)

多租户部署（SaaS）:
  + Identity Center 管理租户隔离
  + Storage per tenant (Schema-level isolation)
  + Rate Limiting per tenant
```

## 版本策略

| 组件 | 版本策略 |
|------|----------|
| Capability | semver（向后兼容 minor/patch） |
| Platform API | semver（major 变更需提前 3 个月 deprecated） |
| Event Schema | 事件名含版本（event.v1 → event.v2） |
| Provider Adapter | patch 级别热更新 |

## 回滚策略

- 回滚前自动触发 Schema 兼容性检查
- 数据库迁移支持向下兼容（add-only 原则）
- 灰度发布过程中监控错误率，超过阈值自动回滚

## Center 替换策略

1. 新 Center 部署并注册到 Developer Center
2. 旧 Center 标记为 deprecated（通知所有消费者）
3. 消费者迁移到新 Center（通过 Adapter 切换）
4. 旧 Center 保持 3 个月双运行
5. 确认无流量后移除旧 Center

---

> *This Blueprint is the answer to "how" — implemented within the boundaries defined by the Constitution.*
