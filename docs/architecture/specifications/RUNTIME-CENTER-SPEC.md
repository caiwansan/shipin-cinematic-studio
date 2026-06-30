# KMKI Platform — Runtime Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-007 (Runtime pure), CONST-008 (Traceable), CONST-022 (Event-first)  
> **ADR Alignment**: ADR-004, ADR-008, ADR-018  
> **Blueprint Alignment**: Ch 4 (Runtime Architecture), Ch 4.1 (State Machine)  
> **Dependencies**: Capability Center (ExecutionPlan), AI Center (Credential injection), Identity Center (auth)  
> **Error Cascade Direction**: Runtime Center failure → all execution stops

---

## 1. Mission

根据 Capability Center 返回的 ExecutionPlan，安全、可靠、可恢复地完成一次 AI 执行。不做决策，不做能力解析，不包含业务逻辑。

## 2. Non-Responsibility

- 不决定用哪个 Provider（那是 Capability Center）
- 不管理 Provider 配置（那是 AI Center）
- 不包含任何业务逻辑
- 不存储业务数据
- 不管理 Capability

## 3. Runtime Kernel

Kernel 是整个 Runtime 的最小核心。不感知 OpenAI、DeepSeek、Claude。只认识 6 个抽象：

```
ExecutionRequest  →  发起执行
ExecutionSession  →  会话上下文
ExecutionGraph    →  执行 DAG
ExecutionNode     →  图中单步
ExecutionState    →  当前状态
ExecutionResult   →  最终结果
```

### 3.1 ExecutionRequest

```typescript
interface ExecutionRequest {
  planId: string                // 来自 Capability Center 的 ExecutionPlan
  capabilityId: string
  executionMode: 'sync' | 'stream' | 'async'
  input: any                    // 请求输入
  context: {
    workspaceId: string
    userId: string
    traceId: string
    tier: string
    variables?: Record<string, any>    // 运行时变量注入
    secrets?: string[]                 // 需要注入的凭证 key 列表
  }
  candidates: RankedCandidate[]        // 来自 Capability Center
  fallbackPlan: FallbackStep[]
  options?: {
    timeout?: number
    priority?: 'low' | 'normal' | 'high'
    checkpoint?: boolean        // 是否启用检查点（断点续执行）
    cacheKey?: string           // 执行缓存 key（相同 key 直接返回结果）
  }
}
```

### 3.2 ExecutionSession

```typescript
interface ExecutionSession {
  sessionId: string
  planId: string
  graphId: string               // DAG ID
  workspaceId: string
  userId: string
  traceId: string
  status: ExecutionStatus
  startedAt: Date
  endedAt?: Date
  currentNodeId?: string        // 当前执行到的节点
  currentStep: number
  retryCount: number
  fallbackDepth: number          // 当前降级深度（0 = 主 Provider）
  artifacts: ArtifactRef[]       // 已产生的产物
  metrics: {
    totalLatency: number
    totalCost: number
    totalPromptTokens: number
    totalCompletionTokens: number
    nodeCount: number
    completedNodeCount: number
  }
  checkpoint?: CheckpointRef     // 最近的检查点
  error?: ErrorRecord
}

type ExecutionStatus =
  | 'pending'
  | 'queued'
  | 'planning'
  | 'dispatching'
  | 'running'
  | 'streaming'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'

interface ErrorRecord {
  nodeId: string
  errorType: 'timeout' | 'provider_error' | 'credential_error' | 'quota_exceeded' | 'internal_error'
  message: string
  providerId?: string
  attempt: number
  timestamp: Date
}
```

### 3.3 ExecutionGraph (DAG)

```typescript
interface ExecutionGraph {
  graphId: string
  sessionId: string
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  status: ExecutionStatus
  createdAt: Date
}

interface ExecutionNode {
  nodeId: string
  type: 'prompt' | 'llm' | 'image' | 'video' | 'audio' | 'embedding' | 'rerank'
        | 'transform' | 'merge' | 'split' | 'validate' | 'postprocess'
  name: string
  config: {
    providerId: string
    modelId: string
    parameters: Record<string, any>   // temperature, maxTokens, etc.
    timeout: number
    retryPolicy: RetryPolicy
  }
  input: NodeIO
  output: NodeIO
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: Date
  endedAt?: Date
  latency?: number
  cost?: number
  error?: ErrorRecord
  retryAttempt: number
}

interface ExecutionEdge {
  edgeId: string
  fromNodeId: string
  toNodeId: string
  condition?: 'success' | 'failure' | 'always'
  dataMapping?: Record<string, string>  // 输出字段 → 输入字段映射
}

interface NodeIO {
  schema: Record<string, any>    // JSON Schema
  artifacts?: ArtifactRef[]      // 引用已产生的产物
  data?: any                     // 内联数据（小数据）
}

interface RetryPolicy {
  maxAttempts: number
  backoff: 'linear' | 'exponential'
  baseDelay: number              // 毫秒
  maxDelay: number
  jitter: number                 // 0-1
  retryableErrors: string[]      // [] = 全部重试
}
```

### 3.4 Step Result

```typescript
interface ExecutionResult {
  sessionId: string
  status: ExecutionStatus
  startedAt: Date
  endedAt: Date
  totalLatency: number
  totalCost: number
  output: any                    // 最终输出
  artifacts: ArtifactRef[]       // 所有产物引用
  trace: ExecutionTrace[]
  error?: ErrorRecord
}

interface ExecutionTrace {
  nodeId: string
  name: string
  providerId: string
  modelId: string
  status: 'completed' | 'failed'
  latency: number
  cost: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  retryAttempt: number
  error?: string
}
```

---

## 4. Registries (9)

### 4.1 Execution Registry

**Responsibility**: 管理 ExecutionSession 的生命周期。

```
ExecutionRegistry
  ├── createSession(request: ExecutionRequest) → ExecutionSession
  ├── getSession(sessionId) → ExecutionSession
  ├── updateStatus(sessionId, status) → void
  ├── listSessions(filter?) → ExecutionSession[]
  ├── endSession(sessionId, status) → void
  └── cancelSession(sessionId) → void
```

### 4.2 Execution Graph Registry

**Responsibility**: 管理 Execution DAG 的构建和持久化。

```
ExecutionGraphRegistry
  ├── buildGraph(plan: ExecutionPlan, input: any) → ExecutionGraph
  ├── getGraph(graphId) → ExecutionGraph
  ├── getNode(graphId, nodeId) → ExecutionNode
  ├── updateNodeStatus(graphId, nodeId, status) → void
  ├── getNextNodes(graphId, nodeId) → ExecutionNode[]    # DAG 后继
  ├── getDependencyNodes(graphId, nodeId) → ExecutionNode[]  # DAG 前驱
  └── validateGraph(graph: ExecutionGraph) → boolean
```

**DAG Build 算法**:
```
Input: ExecutionPlan + user input
  │
  ▼ 获取 CapabilityProfile（Constaints / requirements）
  │
  ▼ Step 1: 构建 LLM Node（使用 candidates[0] 的 provider+model）
  │   如果 executionMode == stream → 标记 node.config.streaming = true
  │
  ▼ Step 2: 构建 Transform Node（输入预处理，如 Prompt 组装）
  │
  ▼ Step 3: 构建 Validate Node（输出 Schema 校验）
  │
  ▼ Step 4: 构建 Postprocess Node（结果格式转换）
  │
  ▼ Step 5: 连接 DAG:
  │   Input → Transform → LLM → Validate → Postprocess → Output
  │
  ▼ Output: ExecutionGraph{nodes[], edges[]}
```

### 4.3 Context Registry

**Responsibility**: 管理执行上下文（变量、Prompt、Memory、Knowledge、Artifact 引用、凭证注入）。

```
ContextRegistry
  ├── initialize(request: ExecutionRequest) → RuntimeContext
  ├── getContext(sessionId) → RuntimeContext
  ├── setVariable(sessionId, key, value) → void
  ├── getVariable(sessionId, key) → any
  ├── injectSecrets(context, secrets) → void            # 调用 AI Center 注入凭证
  └── dispose(sessionId) → void

// RuntimeContext 支持未来 Agent 复用
interface RuntimeContext {
  sessionId: string
  variables: Record<string, any>         // 运行时变量
  prompt: { system: string, user: string, history: Message[] }
  memory?: { key: string, value: string }[]   // 短期记忆
  knowledge?: string[]                        // 引用的 Knowledge Object IDs
  secrets: Record<string, string>             // 解密后的凭证（用后清除）
  artifacts: ArtifactRef[]                    // 已产生的产物
  history: Message[]                          // 对话历史（用于多轮）
  environment: {
    workspaceId: string
    tier: string
    region: string
  }
}
```

### 4.4 Node Registry

**Responsibility**: 管理 ExecutionNode 的类型注册和实例化。

```
NodeRegistry
  ├── registerNodeType(type, handler) → void           # 注册节点处理器
  ├── executeNode(node: ExecutionNode, context: RuntimeContext) → NodeResult
  ├── getNodeHandler(type) → NodeHandler
  └── listNodeTypes() → string[]
```

**内置节点类型**:

| Node Type | Responsibility |
|-----------|---------------|
| `prompt` | Prompt 组装 + System Prompt 注入 |
| `llm` | AI 模型调用（通过 ProviderAdapter）|
| `image` | 图片生成 |
| `video` | 视频生成 |
| `audio` | 语音/音频 |
| `embedding` | 向量化 |
| `rerank` | 重排序 |
| `transform` | 数据转换（格式、提取、过滤）|
| `merge` | 多路结果合并 |
| `split` | 拆分输入（如长文本分块）|
| `validate` | 输出 Schema 校验 |
| `postprocess` | 输出格式标准化 |

注册新节点类型 = 平台扩展点。

### 4.5 Artifact Registry

**Responsibility**: 统一管理执行产生的所有产物（图片、视频、音频、文本、Prompt、文件）。

```
ArtifactRegistry
  ├── create(request: CreateArtifact) → ArtifactRef
  ├── get(artifactId) → Artifact
  ├── list(sessionId?) → Artifact[]
  ├── delete(artifactId) → void
  ├── linkToNode(artifactId, nodeId) → void
  ├── updateReferenceCount(artifactId, delta) → void
  └── cleanup(sessionId) → void               # 清理会话的所有产物

interface Artifact {
  id: string
  sessionId: string
  type: 'image' | 'video' | 'audio' | 'text' | 'prompt' | 'file' | 'structured_data'
  mime: string                      // "image/png" | "video/mp4" | ...
  size: number                      // bytes
  storage: {
    backend: 'local' | 's3' | 'oss' | 'memory'
    key: string                     // 存储路径
    url?: string                    // 访问 URL
  }
  checksum: string                  // SHA-256
  producerNodeId: string            // 产生此产物的节点
  consumerNodeIds: string[]         // 使用此产物的下游节点
  referenceCount: number
  metadata: Record<string, any>
  createdAt: Date
}

interface ArtifactRef {
  artifactId: string
  nodeId: string
  role: 'input' | 'output' | 'intermediate'
  checksum: string                  // 完整性验证
}
```

### 4.6 State Registry

**Responsibility**: 管理 ExecutionSession 的状态持久化和变更通知。

```
StateRegistry
  ├── setState(sessionId, status, metadata?) → void
  ├── getState(sessionId) → { status, metadata, changedAt }
  ├── getStateHistory(sessionId) → StateChange[]
  ├── subscribeState(sessionId, callback) → void
  └── validateTransition(from, to) → boolean

interface StateChange {
  from: ExecutionStatus
  to: ExecutionStatus
  changedAt: Date
  reason?: string
  triggeredBy?: string           // nodeId
}
```

**10 状态机**（Blueprint Ch 4.1 冻结）:
```
Created → Queued → Planning → Dispatching → Running → Completed
                │                 │            │
                │                 │            ├── Streaming
                │                 │            ├── Failed
                │                 │            └── TimedOut
                │                 │
                └──── Cancelled ←─┘

Running → Paused → Running（断点恢复）
```

### 4.7 Retry Registry

**Responsibility**: 管理重试策略、退避算法、补偿操作。

```
RetryRegistry
  ├── executeWithRetry(node: ExecutionNode, context, fallbackChain?) → NodeResult
  ├── getRetryPolicy(node) → RetryPolicy
  ├── registerCompensation(nodeType, handler) → void
  └── computeBackoff(policy: RetryPolicy, attempt: number) → number

Retry Flow:
  │
  ▼ attempt = 0
  │
  ▼ loop:
  │   result = executeNode(node, context)
  │   if result.success → return result
  │   if attempt >= maxAttempts → break
  │   if error not in retryableErrors → break
  │   wait = computeBackoff(attempt)
  │   wait with jitter
  │   attempt++
  │   goto loop
  │
  ▼ 重试耗尽 → 触发 Fallback Plan
  │
  ▼ Fallback 耗尽 → 执行 Compensation（如有）
  │
  ▼ 标记 Failed
```

### 4.8 Execution Cache Registry (Snapshot)

**Responsibility**: 执行检查点缓存，支持断点续执行。

```
ExecutionCacheRegistry
  ├── saveCheckpoint(sessionId, nodeId) → CheckpointRef
  ├── getCheckpoint(sessionId) → CheckpointRef?
  ├── resumeFromCheckpoint(sessionId) → ExecutionSession
  ├── invalidate(sessionId) → void
  └── getCacheStats() → { total, hitRate, avgRecoveryTime }

interface CheckpointRef {
  sessionId: string
  nodeId: string                      // 从哪个节点恢复
  capturedAt: Date
  contextSnapshot: string             // ContextRegistry 状态快照引用
  completedNodeIds: string[]          // 已完成的节点
  artifactIds: string[]               // 已产生的产物
}

Cache Key = sessionId (per session)
TTL = 24 hours
Clear: on session completed / failed / cancelled
```

### 4.9 Execution Policy Registry

**Responsibility**: 管理运行时策略（超时、并发、优先级、资源限制）。

```
ExecutionPolicyRegistry
  ├── getExecutionPolicy(workspaceId, tier) → ExecutionPolicy
  ├── checkConcurrency(workspaceId) → { pass, current, max }
  ├── acquireResource(resource: string) → boolean
  ├── releaseResource(resource: string) → void
  └── setPolicy(policy: ExecutionPolicy) → void

interface ExecutionPolicy {
  workspaceId?: string
  tier: 'free' | 'standard' | 'premium'

  concurrency: {
    maxConcurrentJobs: number          // 最大并发执行数
    maxQueueSize: number               // 最大队列长度
    queueTimeout: number               // 队列超时（毫秒）
  }

  timeout: {
    defaultNodeTimeout: number         // 节点默认超时
    minNodeTimeout: number
    maxNodeTimeout: number
    sessionTimeout: number             // 会话超时
  }

  retry: {
    maxRetryAttempts: number
    retryableErrors: string[]
  }

  resource: {
    maxOutputSize: number             // bytes
    maxArtifactCount: number
    maxCostPerSession: number         // 美元
  }

  priority: {
    default: 'low' | 'normal' | 'high'
    allowPriorityOverride: boolean
  }
}
```

---

## 5. Execution Pipeline

```
Input: ExecutionRequest
  │
  ▼ Step 1: Acquire
  │   Session → Resources → Context → Artifacts
  │   1a. createSession(request) → 锁定 Session ID
  │   1b. acquireResource(workspace) → 配额检查；超限则排队
  │   1c. initializeContext(request) → 注入凭证 + 变量
  │   1d. buildExecutionGraph(request) → DAG
  │   1e. publish execution.started.v1
  │
  ▼ Step 2: Execute Graph (DAG 引擎)
  │   while (有未完成的节点 且 前驱都已完成):
  │     node = getNextExecutableNode(graph)
  │     executeNode(node, context, fallbackCheck)
  │     saveCheckpoint(sessionId, nodeId)  // 每步后存档
  │     publish execution.node.completed.v1
  │
  │   DAG 执行规则:
  │   - 并行节点并行执行（无依赖关系的节点）
  │   - 串行节点依次执行（有依赖关系的节点）
  │   - 节点失败后按 Fallback Plan 降级
  │   - 超过重试次数后标记 failed
  │
  ▼ Step 3: Collect
  │   结果聚合 → Artifact 关联 → Trace 生成
  │   collectArtifacts(sessionId)
  │   buildExecutionTraces(sessionId)
  │
  ▼ Step 4: Persist
  │   Session → Artifacts → Metrics → Events
  │   saveExecutionResult(sessionId)
  │   updateMetrics(sessionId)
  │
  ▼ Step 5: Publish
  │   publish execution.completed.v1 (或 failed.v1)
  │   releaseResource(workspace)
  │   disposeContext(sessionId)  // 清除内存中的凭证
  │
  ▼ Output: ExecutionResult
```

---

## 6. Public API

### 6.1 Execution

```
POST   /api/runtime/execute              → {sessionId}         # 提交执行
GET    /api/runtime/session/:id          → ExecutionSession    # 查询会话状态
GET    /api/runtime/session/:id/result   → ExecutionResult     # 获取执行结果
GET    /api/runtime/session/:id/graph    → ExecutionGraph      # 获取 DAG
POST   /api/runtime/session/:id/cancel   → void                # 取消执行
POST   /api/runtime/session/:id/pause    → void                # 暂停
POST   /api/runtime/session/:id/resume   → void                # 恢复
```

### 6.2 Artifacts

```
GET    /api/runtime/artifacts/:id        → Artifact            # 获取产物详情
GET    /api/runtime/artifacts/:id/data   → binary              # 下载产物数据
GET    /api/runtime/artifacts?session=:id → Artifact[]         # 列出会话产物
DELETE /api/runtime/artifacts/:id        → void                # 删除产物
```

### 6.3 Health & Admin

```
GET    /api/runtime/health               → HealthStatus
GET    /api/runtime/metrics              → Prometheus format
GET    /api/runtime/queue/status         → { queued, running, waiting }
GET    /api/runtime/policies             → ExecutionPolicy[]
PUT    /api/runtime/policies             → void                # 更新策略
```

---

## 7. Events

Runtime Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `execution.started.v1` | `{sessionId, planId, capabilityId, workspaceId, mode}` | At Least Once | Observability, Billing |
| `execution.node.started.v1` | `{sessionId, nodeId, type, providerId, modelId}` | At Least Once | Observability |
| `execution.node.completed.v1` | `{sessionId, nodeId, latency, cost, tokenUsage}` | At Least Once | Observability, State |
| `execution.node.failed.v1` | `{sessionId, nodeId, error, attempt, fallbackUsed}` | At Least Once | Observability, State |
| `execution.paused.v1` | `{sessionId, nodeId, reason}` | At Least Once | Observability |
| `execution.resumed.v1` | `{sessionId, nodeId}` | At Least Once | Observability |
| `execution.completed.v1` | `{sessionId, totalLatency, totalCost, artifactCount}` | At Least Once | Observability, Billing, Capability |
| `execution.failed.v1` | `{sessionId, error, totalLatency, totalCost}` | At Least Once | Observability, Capability |
| `execution.cancelled.v1` | `{sessionId, reason}` | At Least Once | Observability |
| `artifact.created.v1` | `{artifactId, sessionId, type, size}` | At Least Once | Asset Center |
| `artifact.deleted.v1` | `{artifactId, sessionId}` | At Least Once | Asset Center |

Runtime Center 订阅（Subscriber）：

| Event | Handler |
|-------|---------|
| `provider.degraded.v1` | 对运行中的该 Provider 节点记录告警，但继续执行 |
| `credential.expiring.v1` | 记录告警 |

---

## 8. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Runtime Center Service                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Execution Pipeline                           ││
│  │  Acquire → Execute Graph (DAG) → Collect → Persist      ││
│  └──────────────────────────┬───────────────────────────────┘│
│                             │                                │
│  ┌──── W O R K E R S ──────┼──────────────────────────────┐ │
│  │  DAG Engine (Async Pool of Workers)                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ Worker 1 │ │ Worker 2 │ │ Worker 3 │ │ Worker N │  │ │
│  │  │ Node A,B │ │ Node C   │ │ Node D,E │ │ ...      │  │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │ │
│  └───────┼────────────┼────────────┼────────────┼──────────┘ │
│          │            │            │            │             │
│  ┌───────┴────────────┴────────────┴────────────┴──────────┐ │
│  │                 9 Registries                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │Execution │ │Graph     │ │Context   │ │Node      │   │ │
│  │  │Registry  │ │Registry  │ │Registry  │ │Registry  │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │Artifact  │ │State     │ │Retry     │ │Exec Cache│   │ │
│  │  │Registry  │ │Registry  │ │Registry  │ │Registry   │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  │  ┌──────────┐                                            │ │
│  │  │Exec      │                                            │ │
│  │  │Policy    │                                            │ │
│  │  │Registry  │                                            │ │
│  │  └──────────┘                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Repository + Cache Layer                     ││
│  │  SessionDAO | GraphDAO | ContextDAO | ArtifactDAO        ││
│  │  StateDAO | CheckpointDAO | PolicyDAO                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    Provider Adapter Layer                  ││
│  │  Node Handlers → ProviderAdapter.generate/stream/embed    ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Failure Mode

| 场景 | 行为 |
|------|------|
| Provider 调用超时 | Retry Registry 执行重试（指数退避），耗尽后触发 Fallback Plan |
| Fallback 链全部失败 | 节点标记 failed → 停止 DAG → 发布 execution.failed.v1 → 执行 Compensation |
| 节点执行失败 | 如已启用 checkpoint → 可从失败节点恢复 |
| Credential 注入失败 | 节点标记 credential_error → 尝试下一个 Provider（如不同凭证）|
| Context Registry 不可用 | 使用最后一次缓存 Context，拒绝新 session |
| Artifact 存储不可用 | 内存缓冲，降级到无产物执行模式 |
| State Registry 不可用 | 使用内存状态，确保执行可继续，重启后恢复 |
| 全部不可用 | 返回 503，所有请求排队 |

---

## 10. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| 节点失败（有 checkpoint）| 加载 Checkpoint → 从失败节点恢复执行 → 继续 DAG |
| 节点失败（无 checkpoint）| 从头执行该节点 → 重试 → Fallback |
| Session 中断 | 查询 State Registry → 从最后 known state 恢复 |
| 进程重启 | 启动时加载所有 pending/running session → 标记为 paused → 等待 resume |
| Credential 过期 | 暂停 session → 发布告警 → 等待凭证更新后 resume |

---

## 11. Replacement Strategy

1. 新 Runtime Center 实现相同的 Public API + 事件
2. 注册到 Developer Center
3. Capability Center 切换到新 Runtime Center
4. 旧 Runtime Center 保持 running session 完成 + 3 个月双运行
5. 确认无流量后移除

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `runtime_sessions_total` | Counter | status | 累计 session 数 |
| `runtime_sessions_active` | Gauge | — | 当前活跃 session 数 |
| `runtime_session_duration_ms` | Histogram | status | Session 执行时间 |
| `runtime_node_latency_ms` | Histogram | type, provider | 节点执行延迟 |
| `runtime_node_cost` | Counter | provider, model | 节点累计成本 |
| `runtime_retry_count` | Counter | nodeType | 重试次数 |
| `runtime_fallback_count` | Counter | — | Fallback 触发次数 |
| `runtime_checkpoint_saves` | Counter | — | 检查点写入次数 |
| `runtime_artifact_total` | Gauge | type | 产物总数 |
| `runtime_artifact_storage_bytes` | Gauge | type | 产物存储量 |
| `runtime_queue_depth` | Gauge | priority | 队列深度 |
| `runtime_cache_hit_rate` | Gauge | — | 执行缓存命中率 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    cache: { status: 'ok' | 'error', latency: number },
    queue_depth: { value: number, max: number },
    active_sessions: number,
    provider_adapters: { total: number, healthy: number, degraded: number }
  },
  dependencies: {
    capability_center: 'ok' | 'degraded' | 'down',
    identity: 'ok' | 'degraded' | 'down',
    ai_center: 'ok' | 'degraded' | 'down'
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| Session creation latency P95 | < 50ms |
| Node execution latency (non-LLM) P99 | < 500ms |
| Node execution latency (LLM) P99 | — (取决于 Provider) |
| Retry decision latency P99 | < 10ms |
| Fallback switch latency P99 | < 100ms |
| Checkpoint save latency P99 | < 200ms |
| Checkpoint resume latency P99 | < 500ms |
| Artifact storage write P99 | < 200ms |
| Queue wait time (high priority) P99 | < 1s |
| Queue wait time (normal) P99 | < 10s |
| Availability (per month) | 99.95% |

---

> **Kernel 不感知 Provider。Registries 不在 Kernel 中。DAG 引擎只跑节点。Runtime 不包含业务逻辑。**
