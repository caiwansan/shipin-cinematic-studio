# KMKI Platform — Capability Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-005, CONST-006, CONST-009, CONST-023  
> **ADR Alignment**: ADR-003, ADR-009, ADR-014  
> **Blueprint Alignment**: Ch 3 (Capability OS), Ch 3.5 (Resolution Algorithm), Ch 3.6 (executionMode)  
> **Dependencies**: Identity Center (permissions), AI Center (Model Query + Benchmarks + Policy Overrides)  
> **Error Cascade Direction**: Capability Center failure → all Workspace calls fail  
> **AI Center Boundary**: Capability Center 调用 AI Center 的 `/api/ai/models?capability=...` 获取候选模型列表，不直接管理 Provider/Credential/Health/Quota/PolicyOverrides，仅消费 AI Center 的查询结果和事件。

---

## 1. Mission

回答唯一问题：**"当前请求应该使用哪些模型，优先级和降级链路是什么？"** 不执行 AI 调用，不做 Provider 选择，仅输出有序候选列表。

## 2. Non-Responsibility

- 不执行 AI 调用（那是 Runtime Center）
- 不管理 Provider 凭证、健康、配额（那是 AI Center）
- 不管理 Feature Flags / Policy Overrides（那是 AI Center）
- 不存储用户业务数据
- 不决定具体使用哪个 Provider（仅排序候选）

## 3. Core Data Model

### 3.1 ER Diagram

```
Capability (1) ─────── (N) CapabilityVersion
    │                         │
    │                         └── CapabilityProfile (1:1)
    │
    ├── CapabilityTag (N:N) ←→ ModelProfile (from AI Center)
    │
    └── CapabilityDependency (N:N)

ExecutionPlan (1) ─────── Candidate (N) —──→ RankingResult (1)
    │                           │
    │                           ├── ModelProfile (query from AI Center)
    │                           └── Score (N)
    │
    ├── FallbackPlan (1)
    └── ExecutionTrace (N)
```

### 3.2 Capability

```typescript
interface Capability {
  id: string                    // "reason.generate"
  name: string                  // "Reasoning Generation"
  description: string
  owner: string                 // Team / Workspace
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated' | 'removed'
  tier: 'free' | 'standard' | 'premium'
  since: string                 // 引入版本号

  // 执行模式
  executionMode: {
    sync: boolean               // 支持同步请求-响应
    stream: boolean             // 支持流式 SSE
    async: boolean              // 支持异步提交-回调
  }

  // 默认策略
  defaultTimeout: number        // 毫秒
  defaultProviderPolicy: 'cost-first' | 'latency-first' | 'manual-pin'
  defaultFallbackModelIds: string[]   // 默认降级模型 ID

  // 输入输出 Schema（JSON Schema）
  inputSchema: Record<string, any>
  outputSchema: Record<string, any>

  createdAt: Date
  updatedAt: Date
  deprecatedAt?: Date
}
```

### 3.3 CapabilityProfile

```typescript
interface CapabilityProfile {
  capabilityId: string
  version: number               // v1, v2, v3...
  lifecycle: 'experimental' | 'preview' | 'stable' | 'deprecated'

  // 能力约束
  requirements: {
    minContextWindow: number          // 所需最小上下文（Token）
    minOutputTokens: number           // 所需最小输出（Token）
    maxLatencyP95: number             // 所需最大延迟（毫秒）
    minQuality: number                // 所需最低质量分 0-10
    requiredCapabilities: string[]    // 必须支持的原始能力
  }

  // 输入输出 Schema 约束
  constraints: {
    maxInputSize: number              // 最大输入大小（字符）
    acceptedInputTypes: string[]      // ["text", "image", "audio", "video"]
    outputFormat: 'text' | 'json' | 'structured'
    streamingSupported: boolean
  }

  // 治理
  sla: {
    availability: number              // 99.9
    p95Latency: number                // 毫秒
    p99Latency: number
    errorRate: number                 // 0.5%
  }

  // 策略默认值
  defaultStrategy: {
    executionMode: 'sync' | 'stream' | 'async'
    timeout: number
    retryMax: number
    cacheTTL: number
    costCap: number                   // 单次调用成本上限（美元）
  }

  // 版本兼容性
  compatibleVersions: number[]        // 向前兼容的旧版本
  breakingChanges: string[]           // 与本版相比的破坏性变更

  createdAt: Date
  updatedAt: Date
}
```

### 3.4 ExecutionPlan

```typescript
interface ExecutionPlan {
  planId: string
  capabilityId: string
  capabilityVersion: number
  executionMode: 'sync' | 'stream' | 'async'

  // 候选列表（按排名排序）
  candidates: RankedCandidate[]

  // 降级计划（A → B → C）
  fallbackPlan: FallbackStep[]

  // 策略决策
  strategy: {
    policyApplied: string
    selectedCost: number
    estimatedLatency: number
    rankingReason: string         // 简短解释排序原因
  }

  // 来源追踪
  traceId: string
  resolvedAt: Date
  cached: boolean
  cacheKey?: string
}

interface RankedCandidate {
  modelId: string
  providerId: string
  rank: number
  score: number                   // 0-100
  scoreBreakdown: {
    quality: number
    cost: number
    latency: number
    stability: number
    benchmarkScore: number
  }
  health: 'healthy' | 'degraded' | 'down'
  estimatedCost: number
  estimatedLatency: number
}

interface FallbackStep {
  step: number                    // 1, 2, 3...
  modelId: string
  providerId: string
  condition: 'timeout' | 'error' | 'quota-exceeded' | 'health-down'
}
```

### 3.5 ResolverCache

```typescript
interface ResolverCacheEntry {
  cacheKey: string                // capabilityId + version + workspaceId + context hash
  plan: ExecutionPlan
  cachedAt: Date
  ttlSeconds: number
  hitCount: number
}
```

---

## 4. Core Modules

### 4.1 Capability Registry

**Responsibility**: Capability 注册、版本管理、生命周期、Schema 校验。

**Internal Structure**:
```
CapabilityRegistry
  ├── register(capability: Capability) → void
  ├── getCapability(capabilityId) → Capability
  ├── setVersion(capabilityId, version: number) → void
  ├── getProfile(capabilityId, version?) → CapabilityProfile
  ├── listCapabilities(filter?) → Capability[]
  ├── updateLifecycle(capabilityId, lifecycle) → void
  ├── deprecate(capabilityId, deprecateAt) → void
  └── remove(capabilityId) → void
```

**Capability 生命周期**:
```
experimental → preview → stable → deprecated → removed
     │            │         │           │
     └── 随时可删除   └── 30天通知 └── 3个月 └── 彻底清除
```

### 4.2 Resolver Pipeline

**Responsibility**: 按固定流水线执行多阶段过滤和排序，输出 `ExecutionPlan`。

**Pipeline 架构**:
```
Input: capabilityId + version + workspace context
  │
  ▼ Step 0: Cache Hit
  │   查询 ResolverCache → 命中直接返回
  │
  ▼ Step 1: Policy Override Check
  │   调用 AI Center PolicyRegistry.getEffectivePolicy()
  │   → 有 override? 直接应用，跳过后续步骤
  │
  ▼ Step 2: Query Eligible Models
  │   GET /api/ai/models?capability={id}@{version}
  │   返回 AI Center 过滤后的 ModelProfile[]
  │
  ▼ Step 3: Permission Filter
  │   Workspace Tier ↔ Capability Tier
  │   排除无权限的模型
  │
  ▼ Step 4: Tenant Filter
  │   排除租户/Workspace 禁用模型
  │
  ▼ Step 5: Lifecycle Filter
  │   stable > preview > experimental
  │   排除 deprecated / removed
  │
  ▼ Step 6: Health Filter
  │   查询 AI Center HealthRegistry.getStatus(providerId)
  │   排除 Circuit Breaker = Open 或 health = down
  │   将 degraded 的排到低优先级
  │
  ▼ Step 7: Constraint Filter
  │   匹配 CapabilityProfile.requirements:
  │   contextWindow / latency / quality / capabilities
  │   排除不满足约束的模型
  │
  ▼ Step 8: Ranking Engine（评分 + 排序）
  │   见 4.3 Ranking Engine
  │
  ▼ Step 9: Build Fallback Plan
  │   见 4.4 Fallback Plan Builder
  │
  ▼ Output: ExecutionPlan{candidates[], fallbackPlan, strategy}
  │
  ▼ Cache 结果
```

### 4.3 Ranking Engine

**Responsibility**: 对候选模型进行多维度评分。不选择 Provider，仅输出排序列表及评分原因。

**Scoring Algorithm**:
```
Input: ModelProfile[] (已过滤)
  │
  ▼ For each candidate:
  │
  │  qualityScore = candidate.quality.overall × 0.30
  │    （或 Benchmark 平均分标准化后 × 0.30）
  │
  │  costScore = normalize(candidate.pricing.output, minCost, maxCost) × 0.20
  │    （越低越好，线性归一化到 0-100）
  │
  │  latencyScore = normalize(candidate.latency.p50, minLatency, maxLatency) × 0.20
  │    （越低越好）
  │
  │  stabilityScore = candidate.stability.availability30d × 0.20
  │    （越高越好）
  │
  │  benchmarkScore = average(candidate.benchmarkScores) × 0.10
  │    （如有 Benchmark 数据）
  │
  │  totalScore = qualityScore + costScore + latencyScore + stabilityScore + benchmarkScore
  │
  ▼ Sort by totalScore DESC
  │
  ▼ For each candidate, record scoreBreakdown
  │
  ▼ Output: RankedCandidate[]
```

**权重可配置**（通过 CapabilityProfile.defaultStrategy）：
```
reason.generate:
  quality: 0.35
  stability: 0.25
  cost: 0.20
  latency: 0.20

text.generate:
  cost: 0.35
  latency: 0.30
  quality: 0.20
  stability: 0.15

embedding.encode:
  cost: 0.50
  latency: 0.40
  quality: 0.10
```

### 4.4 Fallback Plan Builder

**Responsibility**: 预生成降级链路，避免 Runtime 临时计算。

**Build Algorithm**:
```
Input: RankedCandidate[] (已排序)
  │
  ▼ 取 Top 3 候选作为降级链
  │   Step 1: Primary = rank 0 candidate
  │   Step 2: Secondary = rank 1 candidate（不同 Provider）
  │   Step 3: Tertiary = rank 2 candidate（不同 Provider）
  │
  ▼ 如果 Top 3 中有同 Provider → 跳过，选下一个不同 Provider
  │
  ▼ 生成 FallbackStep:
  │   [{step: 1, candidate A, condition: "error"},
  │    {step: 2, candidate B, condition: "timeout"},
  │    {step: 3, candidate C, condition: "health-down"}]
  │
  ▼ 如果候选不足 3 个 → 补一个降级响应 Capability
```

### 4.5 Resolver Cache

**Responsibility**: 缓存 Resolver 结果，避免重复查询。

**Cache 策略**:
```
Cache Key = capabilityId + version + workspaceId + tier
TTL = 30 秒（可配置）
失效条件:
  - AI Center 发送 provider.degraded.v1 → 清除相关缓存
  - AI Center 发送 model.registered.v1 → 清除全局缓存
  - Policy Override 变更 → 清除全局缓存
```

---

## 5. Public API

### 5.1 Resolve

```
POST /api/capability/resolve
{
  "params": {
    "capabilityId": "reason.generate",
    "version": 3,
    "executionMode": "stream"
  },
  "context": {
    "workspaceId": "brand-geo",
    "userId": "u_abc123",
    "tier": "premium"
  }
}
→ {
  "success": true,
  "data": {
    "planId": "plan_a1b2c3d4",
    "capabilityId": "reason.generate",
    "executionMode": "stream",
    "candidates": [
      {
        "modelId": "deepseek-r2",
        "providerId": "deepseek",
        "rank": 1,
        "score": 92.5,
        "scoreBreakdown": {
          "quality": 28.5,
          "cost": 19.0,
          "latency": 18.0,
          "stability": 18.0,
          "benchmarkScore": 9.0
        },
        "health": "healthy",
        "estimatedCost": 0.0032,
        "estimatedLatency": 1200
      },
      {
        "modelId": "gpt-5",
        "providerId": "openai",
        "rank": 2,
        "score": 88.0,
        ...
      }
    ],
    "fallbackPlan": [
      { "step": 1, "modelId": "deepseek-r2", "condition": "error" },
      { "step": 2, "modelId": "gpt-5", "condition": "timeout" },
      { "step": 3, "modelId": "claude-5", "condition": "health-down" }
    ],
    "strategy": {
      "policyApplied": "latency-first",
      "selectedCost": 0.0032,
      "estimatedLatency": 1200,
      "rankingReason": "DeepSeek-R2 rank 1: best quality (95) + competitive latency"
    },
    "traceId": "kmki-...",
    "resolvedAt": "2026-07-20T12:00:00Z"
  }
}
```

### 5.2 Capability Management

```
GET    /api/capability                     → Capability[]        # 列表
GET    /api/capability/:id                 → Capability          # 详情
POST   /api/capability                     → Capability          # 注册
PATCH  /api/capability/:id                 → Capability          # 更新
DELETE /api/capability/:id                 → void                # 移除
POST   /api/capability/:id/version         → CapabilityProfile   # 创建新版本
GET    /api/capability/:id/versions        → CapabilityProfile[] # 版本列表
PUT    /api/capability/:id/profile         → CapabilityProfile   # 更新 Profile
```

### 5.3 Execution Plan (Runtime 调用)

```
GET    /api/capability/plan/:planId        → ExecutionPlan       # 查询已缓存的 Plan
POST   /api/capability/refresh/:planId     → ExecutionPlan       # 强制重新解析
```

### 5.4 Cache Management

```
POST   /api/capability/cache/clear         → void                # 清除全局缓存
POST   /api/capability/cache/clear/:capabilityId → void          # 清除指定 Cap 缓存
GET    /api/capability/cache/stats         → CacheStats          # 缓存命中率等
```

---

## 6. Events

Capability Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `capability.registered.v1` | `{capabilityId, version, lifecycle}` | Exactly Once | Developer Center, Observability |
| `capability.deprecated.v1` | `{capabilityId, deprecateAt}` | Exactly Once | Developer Center |
| `capability.resolved.v1` | `{planId, capabilityId, candidateCount, latency}` | At Least Once | Observability Center |

Capability Center 订阅（Subscriber）：

| Event | Handler |
|-------|---------|
| `provider.registered.v1` | 评估新 Provider 是否可支持已有 Capability |
| `provider.degraded.v1` | 清除相关 Provider 的 Resolve 缓存 |
| `model.registered.v1` | 清除全局缓存（新模型可能成为已有 Capability 的候选）|
| `model.deprecated.v1` | 清除全局缓存 |
| `policy.override.set.v1` | 清除全局缓存 |
| `policy.override.removed.v1` | 清除全局缓存 |

---

## 7. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Capability Center Service                      │
│                                                              │
│  ┌───────────────────┐  ┌──────────────────────────────────┐ │
│  │ Capability        │  │ Resolver Pipeline                │ │
│  │ Registry          │  │                                  │ │
│  │  ├── CRUD         │  │  Step 0: Cache Hit               │ │
│  │  ├── Version      │  │  Step 1: Policy Override         │ │
│  │  ├── Schema       │  │  Step 2: Query Eligible Models   │ │
│  │  └── Lifecycle    │  │  Step 3: Permission Filter       │ │
│  └───────┬───────────┘  │  Step 4: Tenant Filter           │ │
│          │              │  Step 5: Lifecycle Filter         │ │
│          │              │  Step 6: Health Filter            │ │
│          ▼              │  Step 7: Constraint Filter        │ │
│     Profile Loader     │  Step 8: Ranking Engine           │ │
│          │              │  Step 9: Build Fallback Plan     │ │
│          │              └────────────────┬─────────────────┘ │
│          │                               │                   │
│  ┌───────┴──────────┐  ┌─────────────────┴─────────────┐   │
│  │ Ranking Engine   │  │ Fallback Plan Builder          │   │
│  │  ├── Scorer      │  │  ├── Build primary chain       │   │
│  │  ├── Weights     │  │  ├── Validate diversity        │   │
│  │  └── Reasons     │  │  └── Output steps              │   │
│  └──────────────────┘  └───────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Resolver Cache Layer                         ││
│  │  Cache Key: capability+version+workspace+tier            ││
│  │  TTL: 30s  |  Hit Rate Target: > 85%                     ││
│  │  Clear: on provider.degraded / model.registered          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Repository Layer                             ││
│  │  CapabilityDAO | ProfileDAO | PlanDAO | CacheDAO         ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
   AI Center          Identity Center     Event Bus
  (Model Query)       (Permissions)
```

---

## 8. Public Contract

### 8.1 Capability.invoke 完整定义

```typescript
POST /api/capability/resolve
{
  "params": {
    "capabilityId": "string",       // 必需
    "version": "number",            // 可选，默认最新 stable
    "executionMode": "sync|stream|async",  // 可选，按 Capability 声明
    "input": { ... },               // 可选，用于 Constraint Filter 阶段的上下文约束
    "preferredProviders"?: string[] // 可选，用户偏好 Provider
  },
  "context": {
    "workspaceId": "string",        // 必需
    "userId": "string",             // 必需
    "tier": "free|standard|premium" // 必需
  }
}
→ ExecutionPlan
```

### 8.2 HTTP 状态码

| Code | 含义 |
|------|------|
| 200 | 成功返回 ExecutionPlan |
| 400 | 参数校验失败（Capability 不存在/版本不支持）|
| 403 | 权限不足（Tier 不匹配）|
| 404 | Capability 不存在 |
| 429 | 限流 |
| 503 | Capability Center 不可用 / AI Center 不可用 |

---

## 9. Failure Mode

| 场景 | 行为 |
|------|------|
| AI Center 不可用 | 尽力使用本地缓存（ResolverCache），超时后返回 503 |
| Model Query 超时 | 使用本地 Model Profile 缓存（上次成功加载的，TTL 5 分钟兜底）|
| 无候选模型 | 返回空 candidates + fallbackPlan，Runtime 应返回降级响应 |
| Ranking Engine 不可用 | 使用默认排序（quality DESC）|
| Cache 不可用 | 跳过缓存，直接执行完整 Pipeline |
| Policy Registry 不可用 | 跳过 Policy Override 步骤 |
| 全部不可用 | 返回 503 |

---

## 10. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| AI Center 恢复 | 清除 ResolverCache，重新加载 Model Profile |
| Model Profile 过期 | 自动刷新（TTL 兜底，最多使用 5 分钟前的数据）|
| 完整恢复 | 加载 Capability Registry → 加载 Profile → 预热缓存 → 就绪 |

---

## 11. Replacement Strategy

1. 新 Capability Center 实现相同的 Public API（Section 5）并发布相同事件（Section 6）
2. 注册到 Developer Center
3. Workspace Adapter 指向新 Capability Center
4. 旧 Capability Center 保持 3 个月双运行
5. 确认无流量后移除

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `capability_total` | Gauge | lifecycle | Capability 数量 |
| `capability_resolve_count` | Counter | capabilityId | 解析次数 |
| `capability_resolve_latency_ms` | Histogram | — | 解析耗时 |
| `capability_cache_hit_rate` | Gauge | — | 缓存命中率 |
| `capability_fallback_count` | Counter | capabilityId | 降级触发次数 |
| `capability_no_candidate_count` | Counter | capabilityId | 无候选次数 |
| `capability_candidate_avg` | Gauge | capabilityId | 每次解析平均候选数 |
| `capability_score_mean` | Gauge | capabilityId | 候选平均分 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    cache: { status: 'ok' | 'error', latency: number },
    ai_center: { status: 'ok' | 'degraded' | 'down', latency: number }
  },
  dependencies: {
    identity: 'ok' | 'degraded' | 'down',
    ai_center: 'ok' | 'degraded' | 'down'
  },
  capability_summary: {
    total: number,
    stable: number,
    deprecated: number
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| Resolve latency P50 (cache hit) | < 20ms |
| Resolve latency P95 (cache miss) | < 200ms |
| Cache hit rate | > 85% |
| Fallback plan build latency P99 | < 50ms |
| Availability (per month) | 99.95% |

---

## 15. 缓存与数据流动

```
Capability Center
  │
  ├── 静态数据（本地存储）
  │   ├── Capability 定义 + Profile
  │   └── 权重配置
  │
  ├── 动态数据（实时从 AI Center 查询）
  │   ├── Model Profile（缓存 TTL 60s）
  │   ├── Provider 健康状态 + Circuit Breaker（缓存 TTL 30s）
  │   └── Policy Override（缓存 TTL 60s）
  │
  └── 派生数据（本地缓存）
      └── ExecutionPlan（缓存 TTL 30s，按 AI Center 事件失效）
```

---

> **This specification is the contract for Capability Center implementation. Capability Center is the "brain" of the platform — it decides what can be used, in what order, and what to do if things fail. It does not execute anything.**
