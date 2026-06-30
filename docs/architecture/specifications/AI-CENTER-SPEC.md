# KMKI Platform — AI Center Specification v1.0

> **Version**: 1.1  
> **Status**: Review Candidate  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-002, CONST-005, CONST-008, CONST-015  
> **ADR Alignment**: ADR-002, ADR-006, ADR-009, ADR-016  
> **Blueprint Alignment**: Ch 5.3, Ch 6  
> **Dependencies**: Identity Center, Observability Center  
> **Error Cascade Direction**: AI Center failure → all upstream Centers unreachable

---

## 1. Mission

统一管理 AI Provider 的生命周期、凭证、模型能力、配额、成本和健康状态，为 Capability Center 和 Runtime Center 提供可靠/可审计的 AI 执行基础。

## 2. Non-Responsibility

- 不执行 AI 调用（那是 Runtime）
- 不管理 Capability 策略（那是 Capability Center）
- 不做 Capability Resolution 或 Provider 选择（那是 Capability Center）
- 不存储业务数据
- 不处理用户配额（仅存储配额定义和用量原始数据）

## 3. Core Data Model

### 3.1 ER Diagram

```
Provider (1) ─────── (N) Model
    │                      │
    │                      ├── ModelProfile (1:1)
    │                      ├── ModelPricing (1:1)
    │                      ├── ModelCapabilityMapping (N:N)
    │                      └── ModelCompatibility (1:1)
    │
    ├── Credential (1:N)
    ├── Quota (1:1)
    ├── HealthRecord (1:N)
    ├── BenchmarkResult (1:N)
    └── PolicyOverride (1:N)

Quota (1) ─────── (N) QuotaUsage
    │
    └── QuotaPolicy (1:1)

CostEvent (N) ─────── ModelProfile (N:1)
```

### 3.2 Provider

```typescript
interface Provider {
  id: string                    // "openai" / "deepseek" / "claude"
  name: string                  // "OpenAI" / "DeepSeek" / "Claude"
  version: string               // "2.1.0"
  type: 'llm' | 'embedding' | 'image' | 'tts' | 'video'
  lifecycle: 'registered' | 'validated' | 'healthy' | 'degraded' | 'disabled' | 'removed'
  baseUrl: string
  models: string[]              // Model ID 列表
  region: string                // "us-east" / "cn-beijing"
  tags: string[]                // ["priority-a", "china-compliant"]

  // Feature Flags：运行时切换 Provider/Model 的某项能力开关
  // 优先于代码配置、数据库
  features: {
    enabledModes?: string[]     // 允许启用的 mode 白名单
    disabledCapabilities?: string[]  // 临时关闭的能力列表
    sandbox?: boolean           // 是否仅用于沙箱环境
    rollingUpdate?: boolean     // 是否正在滚动更新
  }

  // Provider Adapter 注册信息
  // 用于自动发现和注册 Provider Adapter 插件
  adapter: {
    adapterId: string           // "openai-v2" — 对应 ProviderAdapter 实现
    authType: 'api-key' | 'oauth' | 'bearer' | 'custom'
    sdkVersion: string          // Provider SDK 版本
    supportsWebhook: boolean    // Provider 是否支持 Webhook
    supportsBatch: boolean      // Provider 是否支持批量 API
    supportsFiles: boolean      // Provider 是否支持文件上传
    supportsRealtime: boolean   // Provider 是否支持 Realtime API
    manifestVersion: string     // Adapter Manifest 格式版本
  }

  createdAt: Date
  updatedAt: Date
  removedAt?: Date
}
```

### 3.3 Credential

```typescript
interface Credential {
  id: string
  providerId: string
  name: string                  // 别名，如 "production-key"
  type: 'api-key' | 'oauth' | 'bearer' | 'custom'
  // 凭证内容——加密存储，永远不返回明文
  encryptedValue: string
  keyHint: string               // 最后 4 位，用于识别 "sk-...a1b2"
  expiresAt?: Date
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

### 3.4 Model

```typescript
interface Model {
  id: string                    // "gpt-5"
  providerId: string
  name: string                  // "GPT-5"
  version: string               // "5.0.0"
  lifecycle: 'preview' | 'stable' | 'deprecated'
  contextWindow: number         // 最大上下文 Token 数
  maxOutput: number             // 最大输出 Token 数
  supports: ModelCapability[]
  pricing: ModelPricing
  latency: ModelLatency
  quality: number               // 质量评分 0-10（内部评估）
  capabilityTags: string[]      // 显式声明的 Capability 映射
  metadata: Record<string, any> // 扩展字段（Provider 特有属性）
  createdAt: Date
  updatedAt: Date
  deprecateAt?: Date
}
```

### 3.5 ModelProfile（完整定义）

```typescript
interface ModelProfile {
  // 标识
  id: string
  providerId: string
  displayName: string

  // 生命周期
  lifecycle: 'preview' | 'stable' | 'deprecated'

  // 能力声明
  capabilities: {
    text: boolean               // 文本生成 text.generate
    reasoning: boolean          // 推理 reason.generate
    coding: boolean             // 代码生成 code.generate
    toolCall: boolean           // Function Calling / Tool Use
    vision: boolean             // 视觉理解 vision.analyze
    imageGeneration: boolean    // 图像生成 image.generate
    audioTranscription: boolean // 语音转文字 audio.transcribe
    tts: boolean                // 文字转语音 audio.tts
    embedding: boolean          // 向量化 embedding.encode
    rerank: boolean             // 重排序 rerank.score
    jsonMode: boolean           // JSON 结构化输出
    streaming: boolean          // 流式 SSE
    thinking: boolean           // 推理过程可见
    parallelToolCalls: boolean  // 并行工具调用
    functionCalling: boolean    // 函数调用
    responseFormat: boolean     // response_format 参数
  }

  // 上下文窗口
  contextWindow: number         // Token
  maxOutputTokens: number       // Token

  // 定价（每百万 Token / 每千张 / 每分钟）
  pricing: {
    unit: 'per_1m_tokens' | 'per_1k_images' | 'per_minute'
    input: number               // 美元
    output: number
    cachedInput?: number        // 缓存命中折扣价
    batchInput?: number         // 批量 API 价格
    batchOutput?: number
  }

  // 性能
  latency: {
    p50: number                 // 毫秒
    p95: number
    p99: number
    timeToFirstToken: number    // TTFT，毫秒
  }

  // 质量
  quality: {
    overall: number             // 综合评分 0-10
    reasoning: number           // 推理质量
    coding: number              // 编码质量
    creative: number            // 创意写作
    instructionFollowing: number// 指令遵循
  }

  // Capability 映射
  capabilityTags: string[]      // ["reason.generate@v3", "text.generate@v2", ...]
                                  // 格式：{capabilityId}@{version}
                                  // AI Center 声明"此模型支持到该版本"（v1/v2/v3 全兼容）
                                  // Capability Center 根据版本约束进行匹配

  // 稳定性
  stability: {
    availability30d: number     // 最近 30 天可用率 (0-1)
    timeoutRate: number         // 超时率 (0-1)
    retryRate: number           // 重试率 (0-1)
    fallbackRate: number        // 触发 Fallback 的概率 (0-1)
    providerIncidents30d: number// 最近 30 天 Provider 事故次数
    lastIncidentAt?: Date       // 最近一次事故时间
  }

  // 执行模式
  supportedExecutionModes: {
    sync: boolean
    stream: boolean
    async: boolean
  }

  // Runtime 兼容性（Runtime Dispatcher 直接使用此字段做分发决策）
  runtimeCompatibility: ModelCompatibility

  // 元数据
  metadata: {
    region: string
    releasedAt: Date
    deprecatedAt?: Date
    providerNote: string
  }
}
```

### 3.6 Quota

```typescript
interface Quota {
  id: string
  providerId: string
  workspaceId?: string          // 为空则全局配额
  tier: 'free' | 'standard' | 'premium'
  modelId: string               // 可指定到模型级别
  limits: {
    rpd: number                 // 每日请求数
    tpm: number                 // 每分钟 Token 数
    rpm: number                 // 每分钟请求数
    tpd: number                 // 每日 Token 数
    costDaily: number           // 每日成本上限（美元）
    costMonthly: number         // 每月成本上限
  }
  current: {                    // 当前用量（运行时更新）
    requestsToday: number
    tokensToday: number
    costToday: number
    costThisMonth: number
  }
  resetInterval: 'daily' | 'monthly'
  lastResetAt: Date
}
```

### 3.7 CostEvent

```typescript
interface CostEvent {
  id: string
  traceId: string
  providerId: string
  modelId: string
  capabilityId: string
  workspaceId: string
  userId: string
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  cost: number                  // 美元
  latency: number
  timestamp: Date
}
```

### 3.8 HealthRecord

```typescript
interface HealthRecord {
  id: string
  providerId: string
  status: 'healthy' | 'degraded' | 'down'
  latency: number               // 毫秒
  errorRate: number             // 0-1
  lastSuccessAt: Date
  lastFailureAt?: Date
  consecutiveFailures: number
  lastCheckedAt: Date
  details?: string              // 错误详情
}
```

### 3.9 ModelCompatibility

```typescript
interface ModelCompatibility {
  supportsStreaming: boolean
  supportsToolCall: boolean
  supportsThinking: boolean
  supportsJSONMode: boolean
  supportsBatch: boolean
  supportsVisionInput: boolean
  supportsImageInput: boolean
  supportsVideoInput: boolean
  supportsFiles: boolean
  supportsRealtime: boolean
}
```

---

## 4. Eight Registries

### 4.1 Provider Registry

**Responsibility**: Provider 注册、发现、生命周期、版本管理。

**Internal Structure**:
```
ProviderRegistry
  ├── register(provider) → Provider
  ├── connect(providerId, credentialId) → void  (验证连通性)
  ├── disconnect(providerId) → void
  ├── getProvider(providerId) → Provider
  ├── listProviders(filter?) → Provider[]
  ├── updateLifecycle(providerId, lifecycle) → void
  └── removeProvider(providerId) → void       (标记 removed)
```

**Provider Lifecycle**:
```
registered → validated → healthy → degraded → disabled → removed
                 │           │          │          │
                 └───────────┴──────────┴──────────┘
                       回退到 validated
```

| Stage | Trigger | Health Check |
|-------|---------|-------------|
| registered | 手动注册 | — |
| validated | connect() 成功 | models() 调用成功 |
| healthy | 连续 3 次 health() 成功 | health() < 2000ms |
| degraded | 连续 3 次 health() 失败 或 latency > 5000ms | — |
| disabled | 手动操作 | — |
| removed | 确认无使用后移除 | — |

### 4.2 Credential Registry (Credential Vault)

**Responsibility**: 凭证的加密存储、注入、轮换、吊销。

**Internal Structure**:
```
CredentialVault
  ├── store(credential) → void                          (加密存储)
  ├── retrieve(providerId) → Credential                 (解密注入到 Adapter)
  ├── listCredentials(providerId) → Credential[]        (不返回 encryptedValue)
  ├── rotate(credentialId, newValue) → void
  ├── revoke(credentialId) → void
  ├── test(credentialId) → boolean                      (发送测试请求验证凭证有效)
  └── scheduleRotation(credentialId, cron) → void
```

**加密要求**:
- 通过 `SecretBackend` 抽象层存储，支持运行时切换后端
- 内置实现: Environment Variable Backend
- 可选实现: AWS Secrets Manager / GCP Secret Manager / Azure Key Vault
- `SecretBackend` 接口:

```typescript
interface SecretBackend {
  store(key: string, value: string): Promise<void>
  retrieve(key: string): Promise<string>
  rotate(key: string, newValue: string): Promise<void>
  test(key: string): Promise<boolean>        // 验证可连通
}
```

存储格式：
- 使用 AES-256-GCM 加密
- 加密密钥通过 SecretBackend 管理（非硬编码）
- storedValue = `{ciphertext}:{iv}:{authTag}`（AES-GCM）
- retrieve() 仅在 Runtime Dispatcher 请求 Credential 时解密，调用完立即清除内存
- 审计日志记录每次 retrieve()

**Credential Lifecycle**:
```
created → active → rotated → revoked
           │         │
           └─────────┘
             expired → archived
```

### 4.3 Model Registry

**Responsibility**: 模型注册、版本管理、Profile 维护。

**Internal Structure**:
```
ModelRegistry
  ├── register(model) → Model
  ├── updateProfile(modelId, profile) → void
  ├── getModel(modelId) → Model
  ├── listModels(filter?) → Model[]
  ├── getModelProfile(modelId) → ModelProfile
  ├── queryByCapability(capabilityTag) → Model[]       (Resolver 核心方法)
  ├── queryByProvider(providerId) → Model[]
  └── deprecateModel(modelId, deprecateAt) → void
```

**queryByCapability 算法**：
```
Input: capabilityTags: string[], filters?: { tier, maxCost, minQuality }
  │
  ▼ Load all Models with lifecycle = 'stable' or 'preview'
  │
  ▼ Filter by capabilityTags match（ModelProfile.capabilityTags 包含传入 tag）
  │
  ▼ Apply filters（tier/maxCost/minQuality）
  │
  ▼ Sort: lifecycle (stable > preview) → quality → cost
  │
  ▼ Output: Model[]
```

### 4.4 Quota Registry

**Responsibility**: 配额定义、用量实时更新、阈值告警。

**Internal Structure**:
```
QuotaRegistry
  ├── define(quota) → Quota
  ├── check(workspaceId, modelId, estimatedCost) → {pass, reason}
  ├── consume(workspaceId, modelId, tokens, cost) → void        (原子递增)
  ├── getQuota(workspaceId, modelId) → Quota
  ├── listQuotas(filter?) → Quota[]
  └── resetQuota(workspaceId, modelId) → void
```

**Quota Check 算法**:
```
Input: workspaceId, modelId, estimatedTokens, estimatedCost
  │
  ▼ Load Quota for workspaceId + modelId
  │  如果不存在 → pass（无配额限制）
  │
  ▼ Check limits:
  │  requestsToday + 1 > rpd? → reject: "rate limit exceeded"
  │  tokensToday + estimatedTokens > tpd? → reject: "token limit exceeded"
  │  costToday + estimatedCost > costDaily? → reject: "cost limit exceeded"
  │
  ▼ pass
```

### 4.5 Cost Registry

**Responsibility**: 成本记录、计费原始数据、趋势分析。

**Internal Structure**:
```
CostRegistry
  ├── record(event: CostEvent) → void
  ├── query(filter?) → CostEvent[]
  ├── aggregateGroupByModel(start, end) → {modelId, totalCost}[]
  ├── aggregateGroupByWorkspace(start, end) → {workspaceId, totalCost}[]
  ├── getCostTrend(modelId, days) → {date, cost}[]
  ├── getBill(workspaceId, month) → {total, byModel, byCapability}

  // Forecast
  ├── forecastMonthly(workspaceId?) → {estimate, confidence, burnRate, risk}
  ├── forecastDaily(workspaceId?) → {days: {date, estimate}[], trend}
  ├── forecastBurnRate(workspaceId?) → {
  │     dailyBurnRate: number,      // 当前日均消耗
  │     monthlyForecast: number,    // 预计月末总额
  │     budget: number,             // 预算
  │     overBudget: boolean,
  │     riskLevel: 'low' | 'medium' | 'high'
  │   }
  └── forecastByModel(workspaceId?) → {modelId, forecast, budget}[]
```

**Forecast 算法**:
```
forecastMonthly():
  │
  ▼ 过去 7 天日均消耗 × 月天数 = 线性预测
  │
  ▼ 过去 30 天消耗增长率 = 非线性修正系数
  │
  ▼ 当日/当月已消耗 + 修正后预测 = 最终预测
  │
  ▼ 与预算对比 → risk:
  │  < 80% 预算: low
  │  80-95% 预算: medium
  │  > 95% 预算: high
  │
  ▼ 返回 forecast
```

**数据存储策略**:
- 实时记录写入消息队列，异步批量写入 CostRegistry
- 原始数据保留 90 天
- 聚合数据保留 2 年
- 超过 2 年的数据归档到冷存储

### 4.6 Health Registry + Circuit Breaker

**Responsibility**: Provider 健康状态监控、延迟统计、断路保护、告警。

**Circuit Breaker States**:
```
Closed (健康)
  │ 连续失败 ≥ threshold → Open
  ▼
Open (断开)
  │ 等待 timeout → HalfOpen
  ▼
HalfOpen (半开)
  │ 测试请求成功 → Closed
  │ 测试请求失败 → Open（重置 timer）
  ▼
Closed (恢复)
```

**Internal Structure**:
```
HealthRegistry
  ├── healthCheck(providerId) → {status, latency, error}
  ├── recordResult(providerId, isSuccess, latency) → void       (更新 Circuit Breaker)
  ├── getStatus(providerId) → 'healthy' | 'degraded' | 'down'  (含 Circuit Breaker 状态)
  ├── getBreakerState(providerId) → {state, openedAt, nextRetryAt}
  ├── getHistory(providerId, hours) → HealthRecord[]
  ├── getMetrics() → ProviderHealthSummary[]
  └── subscribeAlerts(providerId, webhook) → void
```

**Health Check Policy**（可配置，非固定值）:
```typescript
interface HealthPolicy {
  providerId: string
  interval: number              // 检查间隔（秒），默认 60
  timeout: number               // 单次检查超时（毫秒），默认 5000
  retryOnFailure: number        // 失败重试次数，默认 0
  jitter: number                // 随机偏移百分比，默认 0.1（±10%）
  failureThreshold: number      // 连续失败次数阈值 → Open，默认 3
  successThreshold: number      // 连续成功次数 → Closed，默认 2
  halfOpenTimeout: number       // Open → HalfOpen 等待秒数，默认 30
  latencyDegradedThreshold: number  // 延迟超过该值标记 degraded，默认 5000ms
  errorRateDegradedThreshold: number // 错误率超过该值标记 degraded，默认 0.05
}
```

**Circuit Breaker 决策流程**:
```
每次 healthCheck() 调用后:
  │
  ▼ 如果请求成功:
  │  consecutiveFailures = 0
  │  if breakerState == HalfOpen && consecutiveSuccess >= successThreshold:
  │    breakerState = Closed
  │
  ▼ 如果请求失败:
  │  consecutiveFailures++
  │  if consecutiveFailures >= failureThreshold:
  │    if 当前不是 Open:
  │      breakerState = Open
  │      openedAt = now
  │      nextRetryAt = now + halfOpenTimeout
  │      发布 provider.degraded.v1 事件
  │
  ▼ 如果是 Open 状态且 now >= nextRetryAt:
      breakerState = HalfOpen
      发送一次测试请求
```

### 4.7 Policy Registry

**Responsibility**: 运行时策略覆盖，允许管理员在不修改代码/数据库的情况下控制 Provider 行为。

**Internal Structure**:
```
PolicyRegistry
  ├── setOverride(override: PolicyOverride) → void
  ├── getEffectivePolicy(providerId, context) → EffectivePolicy
  ├── listOverrides(filter?) → PolicyOverride[]
  ├── removeOverride(overrideId) → void
  ├── getOverrideHistory(providerId, hours) → PolicyOverride[]
  └── evaluatePolicy(providerId, context) → PolicyDecision
```

**PolicyOverride 结构**:
```typescript
interface PolicyOverride {
  id: string
  type: 'provider-block' | 'model-block' | 'model-pin' | 'region-ban' | 'emergency-fallback'
  scope: {
    providerId?: string
    modelId?: string
    workspaceId?: string
    tier?: string
  }
  action: 'allow' | 'block' | 'redirect' | 'override'
  value?: {
    redirectToProvider?: string
    redirectToModel?: string
    overrideParams?: Record<string, any>
  }
  priority: number              // 高优先级覆盖低
  reason: string                // 必须填写原因
  expiresAt?: Date              // 可选过期时间
  enabled: boolean
  createdBy: string
  createdAt: Date
}
```

**使用场景**:
| 场景 | Override Type | 示例 |
|------|--------------|------|
| 紧急停用 Provider | provider-block | GPT-5 全部停用，因为检测到质量退化 |
| 临时切换到备选 | emergency-fallback | OpenAI 宕机，所有请求切到 DeepSeek |
| A/B 测试某个模型 | model-pin | 5% 流量走新模型 |
| 合规封锁某区域 | region-ban | 禁止 cn-beijing 区域的 Provider 用于海外租户 |
| 手动指定 Provider | model-pin | 某个 Workspace 固定使用 Claude |

Policy Registry 在 Resolver 链中位于第一步（覆盖优先）：
```
Policy Override Check → Permission → Tenant → Lifecycle → Health → Cost → Latency → Fallback
```

### 4.8 Benchmark Registry

**Responsibility**: 模型基准评测数据管理，为 Resolver 提供客观质量比较依据。

**Internal Structure**:
```
BenchmarkRegistry
  ├── recordBenchmark(benchmark: BenchmarkResult) → void
  ├── getBenchmark(modelId, benchmarkName) → BenchmarkResult
  ├── compareModels(modelIds[], benchmarkName) → BenchmarkComparison[]
  ├── getModelSummary(modelId) → {mmlu, humaneval, livebench, swebench, ...}
  └── listAvailableBenchmarks() → string[]         // ["MMLU", "HumanEval", ...]
```

**BenchmarkResult 结构**:
```typescript
interface BenchmarkResult {
  modelId: string
  providerId: string
  benchmarkName: string         // "MMLU" | "HumanEval" | "LiveBench" | "SWE-Bench" | "VideoBench" | ...
  score: number                 // 0-100
  subScores?: Record<string, number>  // 子维度分数，如 MMLU 的 {"stem": 92, "humanities": 88}
  source: 'official' | 'community' | 'internal'
  evaluatedAt: Date
  metadata?: Record<string, any>
}
```

**Benchmark Summary 集成到 ModelProfile**:
```
ModelProfile.quality.source = 'benchmark' | 'manual'
ModelProfile.quality.mmlu = score     // 由 BenchmarkRegistry 提供，非人工
ModelProfile.quality.humaneval = score
ModelProfile.quality.livebench = score
ModelProfile.quality.swebench = score
```

Resolver 的 Ranking Engine 可以直接查询 Benchmark Registry 来做质量排序。

**HealthRegistry 对外直接提供 Circuit Breaker 状态**（无需每个调用者各自实现）：

---

## 5. Public API

### 5.1 Provider Management

```
GET    /api/ai/providers                  → Provider[]          # 列表
GET    /api/ai/providers/:id              → Provider            # 详情
POST   /api/ai/providers                  → Provider            # 注册
PATCH  /api/ai/providers/:id              → Provider            # 更新
DELETE /api/ai/providers/:id              → void                # 移除（软删除）
POST   /api/ai/providers/:id/test         → {status, latency}   # 连通性测试
POST   /api/ai/providers/:id/sync         → Provider            # 同步模型列表
```

### 5.2 Credential Management

```
GET    /api/ai/credentials                → Credential[]        # 列表（不返回值）
POST   /api/ai/credentials                → Credential          # 创建（加密存储）
PUT    /api/ai/credentials/:id            → Credential          # 更新
DELETE /api/ai/credentials/:id            → void                # 删除
POST   /api/ai/credentials/:id/test       → boolean             # 凭证验证
POST   /api/ai/credentials/:id/rotate     → Credential          # 轮换
```

### 5.3 Model Management

```
GET    /api/ai/models                     → Model[]             # 模型列表
GET    /api/ai/models/:id                 → Model               # 详情
GET    /api/ai/models/:id/profile         → ModelProfile        # 模型 Profile
POST   /api/ai/models                     → Model               # 注册
PATCH  /api/ai/models/:id                 → Model               # 更新
POST   /api/ai/models/:id/profile         → ModelProfile        # 更新 Profile
DELETE /api/ai/models/:id                 → void                # 移出
POST   /api/ai/models/:id/deprecate       → void                # 标记废弃
```

### 5.4 Quota Management

```
GET    /api/ai/quotas                     → Quota[]             # 配额列表
POST   /api/ai/quotas                     → Quota               # 创建配额
PATCH  /api/ai/quotas/:id                 → Quota               # 更新配额
DELETE /api/ai/quotas/:id                 → void                # 删除配额
GET    /api/ai/quotas/:id/usage           → QuotaUsage          # 当前用量
```

### 5.5 Health

```
GET    /api/ai/health                     → HealthSummary[]     # 所有 Provider 健康摘要
GET    /api/ai/health/:providerId         → HealthRecord        # 单 Provider 健康
GET    /api/ai/health/:providerId/history → HealthRecord[]      # 最近 24h 记录
```

### 5.6 Costs

```
GET    /api/ai/costs                      → CostSummary         # 成本摘要
GET    /api/ai/costs/by-model             → CostAggregation[]   # 按模型聚合
GET    /api/ai/costs/by-workspace         → CostAggregation[]   # 按工作台聚合
GET    /api/ai/costs/forecast             → CostForecast        # 成本预测
GET    /api/ai/costs/forecast/burn-rate   → BurnRateForecast    # 燃烧率预测
```

### 5.7 Model Query (Capability Center 调用的内部 API)

```
GET    /api/ai/models?capability=text.generate          → ModelProfile[]
GET    /api/ai/models?provider=openai                   → ModelProfile[]
GET    /api/ai/models?supportsStreaming=true             → ModelProfile[]
GET    /api/ai/models/by-ids?ids=id1,id2,id3            → ModelProfile[]
```

AI Center 只回答"有哪些模型及其能力"，不回答"应该选谁"。选择逻辑在 Capability Center。

---

## 6. Events

AI Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `provider.registered.v1` | `{providerId, name, type, lifecycle, models[]}` | Exactly Once | Capability Center, Observability |
| `provider.removed.v1` | `{providerId, reason}` | Exactly Once | Capability Center, Runtime Center |
| `provider.degraded.v1` | `{providerId, status, latency, errorRate, since}` | At Least Once | Runtime Center, Capability Center |
| `model.registered.v1` | `{modelId, providerId, capabilityTags[]}` | Exactly Once | Capability Center |
| `model.deprecated.v1` | `{modelId, providerId, deprecateAt}` | Exactly Once | Capability Center |
| `credential.expiring.v1` | `{credentialId, providerId, expiresAt}` | At Least Once | Developer Center, Admin |
| `quota.threshold.v1` | `{workspaceId, modelId, type, current, limit}` | At Least Once | Billing Center |
| `policy.override.set.v1` | `{overrideId, type, scope, reason}` | Exactly Once | Capability Center, Observability |
| `policy.override.removed.v1` | `{overrideId, type, scope}` | Exactly Once | Capability Center |

AI Center 订阅（Subscriber）：

| Event | Subscriber Handler |
|-------|-------------------|
| `identity.token_revoked.v1` | 清除 Token 相关会话 |

---

## 7. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Center Service                          │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Provider    │  │ Credential   │  │ Model Registry     │  │
│  │ Registry    │  │ Vault        │  │  ├── Model CRUD    │  │
│  │  ├── CRUD   │  │  ├── Store   │  │  ├── Profile Mgr  │  │
│  │  ├── Sync   │  │  ├── Rotate  │  │  ├── queryByCap.  │  │
│  │  └── Health │  │  └── Test    │  │  └── Version Mgr  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌────────┴───────────┐  │
│  │ Quota       │  │ Cost         │  │ Health Registry    │  │
│  │ Registry    │  │ Registry     │  │  ├── Checker       │  │
│  │  ├── Check  │  │  ├── Record  │  │  ├── Aggregator    │  │
│  │  ├── Consume│  │  ├── Query   │  │  ├── Circuit Brkr  │  │
│  │  └── Reset  │  │  ├── Trend   │  │  └── Alert         │  │
│  └─────┬───────┘  │  └── Forecast │  └────────┬───────────┘  │
│        │          └──────┬───────┘            │              │
│  ┌─────┴─────────────────┴────────────────────┴──────────┐   │
│  │  Policy Registry                                       │   │
│  │  ├── setOverride                                       │   │
│  │  ├── evaluatePolicy                                    │   │
│  │  └── listOverrides                                     │   │
│  └────────────────────────────────────────────────────────┘   │
│        │          └──────┬───────┘            │              │
│        │                 │                    │              │
│  ┌─────┴─────────────────┴────────────────────┴──────────┐   │
│  │                  Cache Layer                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │   │
│  │  │ Provider │  │ Model/   │  │ Health + Circuit     │ │   │
│  │  │ Cache    │  │ Profile  │  │ Breaker Cache        │ │   │
│  │  │ TTL: 60s │  │ Cache    │  │ TTL: 30s             │ │   │
│  │  └──────────┘  │ TTL: 60s │  └──────────────────────┘ │   │
│  │                └──────────┘                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │   │
│  │  │ Quota    │  │ Policy   │  │ Credential Cache     │ │   │
│  │  │ Cache    │  │ Cache    │  │ TTL: 300s (up to     │ │   │
│  │  │ TTL: 5s  │  │ TTL: 60s │  │ 5 min fallback)     │ │   │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  Repository Layer                         ││
│  │  ProviderDAO │ CredentialDAO │ ModelDAO │ QuotaDAO       ││
│  │  CostDAO │ HealthDAO │ EventDAO                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  Event Publisher                          ││
│  │  ProviderEventEmitter │ CredentialEventEmitter           ││
│  │  ModelEventEmitter │ QuotaEventEmitter                   ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Cache 淘汰策略**:

| Cache | Key | TTL | 主动失效 |
|-------|-----|-----|----------|
| Provider Cache | providerId | 60s | Provider 变更时手动失效 |
| Model/Profile Cache | modelId / capabilityTag | 60s | 模型注册/废弃时手动失效 |
| Health + Circuit Breaker Cache | providerId | 30s | 每次健康检查结果更新 |
| Quota Cache | workspaceId + modelId | 5s | quota.consume() 后手动失效 |
| Credential Cache (fallback) | providerId | 300s (仅失败时) | 每次 retrieve() 成功后更新 |
| Policy Cache | — | 60s | Policy 变更时手动失效 |

---

## 8. Failure Mode

| 场景 | 行为 |
|------|------|
| Provider Health Check 连续失败 ≥5 次 | Provider 标记 down，发布 `provider.degraded.v1`，Resolver 将其从可用列表移除 |
| Credential 解密失败 | 返回 Storage UNAVAILABLE，Provider 回退到 cached credential（如果有上次成功的凭证，最多使用 5 分钟）|
| Model Registry 不可用 | 使用本地缓存（Resolver 缓存 Model Profile 列表，TTL 5 分钟）|
| Quota Registry 不可用 | 允许所有请求通过（不设配额限制），发布告警 |
| Cost Registry 不可用 | 请求量入内存缓冲队列，最多缓冲 10000 条，超过后丢弃旧数据 |
| AI Center 整体不可用 | Capability Center 检测到 AI Center 不可用，拒绝所有 Capability 调用请求，返回 503 Service Unavailable |

---

## 9. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| Provider 从 down 恢复 | health() 连续 2 次成功 → 自动 transition 到 degraded → 再连续 2 次成功 → healthy |
| Credential 过期 | Admin 收到告警后更新凭证；Platform 不自动恢复 |
| Model Registry 恢复 | 从数据库重新加载所有 Model Profile，更新缓存 |
| Quota Registry 恢复 | 从数据库重新加载当前用量 |
| 完整恢复 | 启动时依次：连接数据库 → 加载 Provider → 加载 Credential → 加载 Model → 验证 Connectivity → 就绪 |

---

## 10. Replacement Strategy

AI Center 整体可替换。替换条件：

1. 新 AI Center 实现相同的 Public API（Section 5）并发布相同的事件（Section 6）
2. 新 AI Center 注册到 Developer Center
3. Capability Center 和 Runtime Center 切换到新 AI Center
4. 旧 AI Center 保持 3 个月双运行
5. 确认无流量后移除旧 AI Center

---

## 11. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `ai_provider_total` | Gauge | providerId, lifecycle | Provider 数量 |
| `ai_provider_health_status` | Gauge | providerId | 健康状态 (0=down, 1=degraded, 2=healthy) |
| `ai_provider_health_check_latency` | Histogram | providerId | 健康检查延迟 |
| `ai_credential_total` | Gauge | providerId, enabled | 凭证数量 |
| `ai_model_total` | Gauge | providerId, lifecycle | 模型数量 |
| `ai_quota_usage_ratio` | Gauge | workspaceId, modelId | 配额使用率 (0-1) |
| `ai_cost_total` | Counter | providerId, modelId | 累积成本 |
| `ai_resolve_time` | Histogram | — | Resolver 查询耗时 |

---

## 12. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    cache: { status: 'ok' | 'error', latency: number },
    credential_vault: { status: 'ok' | 'error' },
    // 每个关键 Provider 的健康摘要
    provider_summary: {
      healthy: number,
      degraded: number,
      down: number,
      total: number
    }
  },
  dependencies: {
    identity: 'ok' | 'degraded' | 'down',
    observability: 'ok' | 'degraded' | 'down'
  }
}
```

---

## 13. SLO

| SLI | Target |
|-----|--------|
| Provider Health Check latency P95 | < 200ms |
| Resolver query latency P99 | < 100ms |
| Credential retrieve latency P99 | < 50ms |
| Quota check latency P99 | < 30ms |
| Cost record latency P99 (write) | < 100ms |
| Availability (per month) | 99.95% |

---

## 14. 按模型类型扩展能力声明

不同模型类型的 Capability 不同。下文按 Provider 类型声明 `supports` 字段定义（AI 在注册时自动推断或在 Admin 界面手动声明）：

| Type | Capabilities |
|------|-------------|
| `llm` | text, reasoning, coding, toolCall, vision, jsonMode, streaming, thinking |
| `embedding` | embedding, rerank |
| `image` | imageGeneration, vision |
| `tts` | tts |
| `video` | videoGeneration, vision |

---

## 15. 安全约束

| 约束 | 规则 |
|------|------|
| 凭证存储 | 通过 SecretBackend 抽象层 + AES-256-GCM 加密 |
| API 认证 | 所有 Public API 需经 Gateway 认证 |
| 成本数据访问 | 仅 Workspace Admin 可查看自身成本 |
| 跨模型资源隔离 | 多租户环境下，Quota 按 workspaceId 隔离 |
| 审计日志 | Credential retrieve() 操作必须记录审计事件 |

---

## 16. Event Contract 详细定义

### provider.registered.v1

```json
{
  "eventId": "evt_a1b2c3d4",
  "event": "provider.registered.v1",
  "timestamp": "2026-07-20T10:00:00Z",
  "version": "1",
  "guarantee": "exactly-once",
  "payload": {
    "providerId": "deepseek",
    "name": "DeepSeek",
    "type": "llm",
    "lifecycle": "registered",
    "models": [
      { "id": "deepseek-r2", "version": "2.0" },
      { "id": "deepseek-r1", "version": "1.5" }
    ]
  }
}
```

### provider.degraded.v1

```json
{
  "eventId": "evt_b2c3d4e5",
  "event": "provider.degraded.v1",
  "timestamp": "2026-07-20T10:30:00Z",
  "version": "1",
  "guarantee": "at-least-once",
  "payload": {
    "providerId": "openai",
    "status": "degraded",
    "latency": 6500,
    "errorRate": 0.08,
    "since": "2026-07-20T10:28:00Z",
    "reason": "high latency detected"
  }
}
```

---

> **This specification is the contract for AI Center implementation. Every data model, API, event, and failure mode must be reflected in the actual code.**
