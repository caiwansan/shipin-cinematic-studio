# RFC2 — Execution Runtime 接口冻结文档

**状态:** Draft (接口冻结，待实现)
**对应 ADR:** ADR-002
**基线:** Sprint 1 Explainability Platform v1.0（ADR-001，已冻结）
**本文件不包含实现，仅定义接口冻结**

---

## 核心类型

### 状态枚举

```typescript
// ===================================================
// Execution Core Types (冻结 v1.0)
// RC1 — DAG Runtime Foundation
// ===================================================

export type NodeStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_dependency'
  | 'retrying'
  | 'fallback'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'timeout'

export type GraphStatus =
  | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type NodeType =
  | 'discovery' | 'knowledge' | 'recommendation' | 'mission'
  | 'verification' | 'publishing' | 'custom'
```

### ExecutionGraph

```typescript
export interface ExecutionGraph {
  id: string
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  status: GraphStatus
  context: ExecutionContext
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ExecutionNode {
  id: string
  label: string
  type: NodeType
  capability: string           // 所需能力（如 'reasoning', 'search', 'summary'）
  providerPolicy: ProviderPolicy
  config: Record<string, unknown>
  status: NodeStatus
  retryConfig: RetryConfig
  timeout: number              // ms
  dependencies: string[]       // 上游 node id
  artifact?: ExecutionArtifact | null
  error?: string | null
  startedAt?: string | null
  completedAt?: string | null
}

export interface ExecutionEdge {
  from: string
  to: string
  condition?: string  // 条件表达式；空表示无条件
}
```

### ExecutionContext（平台对象 1）

所有 Runtime 组件共享的上下文。

```typescript
export interface ExecutionContext {
  executionId: string
  brandId: string
  tenantId: string
  sourceType: string   // 'mission' | 'verification' | 'manual' 等
  sourceId: string     // 来源业务 ID
  variables: Record<string, unknown>
  providerPolicy: ProviderPolicy
  metadata: Record<string, unknown>
}
```

### ExecutionArtifact（平台对象 2）

所有 Node 输出的统一格式。

```typescript
export interface ExecutionArtifact {
  id: string
  type: string           // 'discovery_signal' | 'knowledge_object' | 等
  payload: unknown
  metadata: {
    nodeId: string
    graphId: string
    provider: string
    duration: number     // ms
    cost: number         // token/credits
    retryCount: number
  }
  createdAt: string
}
```

### ExecutionEvent（平台对象 3）

所有状态变化的事件记录。

```typescript
export type ExecutionEventType =
  | 'graph_created'
  | 'graph_completed'
  | 'graph_failed'
  | 'graph_cancelled'
  | 'node_queued'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_retry'
  | 'node_timeout'
  | 'node_fallback'
  | 'node_cancelled'
  | 'dependency_met'
  | 'circuit_breaker_open'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed'

export interface ExecutionEvent {
  id: string
  executionId: string
  graphId: string
  type: ExecutionEventType
  nodeId?: string
  timestamp: string
  data?: Record<string, unknown>
}
```

---

## RC1 接口 — DAG Runtime Foundation

### DAG Scheduler

```typescript
export interface IDAGScheduler {
  execute(graph: ExecutionGraph): Promise<ExecutionGraph>
  cancel(executionId: string): Promise<void>
  getStatus(executionId: string): Promise<ExecutionGraph>
}
```

### Node State Machine

```typescript
export interface INodeStateMachine {
  transition(node: ExecutionNode, event: ExecutionEventType): NodeStatus
  canTransition(from: NodeStatus, to: NodeStatus): boolean
}
```

---

## RC2 接口 — Provider Runtime

### Provider 路由

```typescript
export type ProviderPolicy =
  | 'FASTEST'
  | 'CHEAPEST'
  | 'MOST_RELIABLE'
  | 'LOCAL_ONLY'
  | 'CN_PROVIDER_FIRST'

export interface RouterContext {
  brandId?: string
  tenantId?: string
  sourceType?: string
  routingHints?: Record<string, unknown>
}

export interface CapabilityRouter {
  resolve(
    capability: string,
    policy: ProviderPolicy,
    context?: RouterContext
  ): Promise<string>
}
```

### 重试配置

```typescript
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
  useExponentialBackoff: boolean
}
```

### 熔断配置

```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number    // 连续失败次数
  recoveryTimeoutMs: number   // 熔断恢复时间
  halfOpenMaxRequests: number
}

export interface FallbackRouter {
  getFallbackProvider(primaryProvider: string, capability: string): string | null
}
```

### Provider 健康服务

```typescript
export interface IProviderHealthService {
  recordSuccess(provider: string, latency: number): void
  recordFailure(provider: string, error: string): void
  getHealth(provider: string): ProviderHealth
  isCircuitOpen(provider: string): boolean
}

export interface ProviderHealth {
  provider: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit_open'
  latencyP50: number
  latencyP99: number
  errorRate: number
  lastChecked: string
}
```

---

## RC3 接口 — Execution Planning

### ExecutionRequest

```typescript
export interface ExecutionRequest {
  id: string
  sourceType: string
  sourceId: string
  brandId: string
  tenantId: string
  priority: 'low' | 'normal' | 'high'
  steps: ExecutionStep[]
  providerPolicy: ProviderPolicy
  metadata: Record<string, unknown>
}

export interface ExecutionStep {
  id: string
  label: string
  type: NodeType
  capability: string
  dependencies: string[]
  config: Record<string, unknown>
}
```

### Adapter 接口

```typescript
export interface MissionExecutionAdapter {
  toExecutionRequest(mission: Mission): ExecutionRequest
}
```

### ExecutionPlanner

```typescript
export interface ExecutionPlanner {
  plan(request: ExecutionRequest): Promise<ExecutionGraph>
}
```

---

## RC4 接口 — Execution Explain & API

### Trace Repository

```typescript
export interface ExecutionTraceRepository {
  saveEvent(event: ExecutionEvent): Promise<void>
  getEvents(executionId: string): Promise<ExecutionEvent[]>
  getGraph(executionId: string): Promise<ExecutionGraph | null>
}
```

### ExecutionExplainProvider

```typescript
// 继承自 Sprint 1 的 ExplainProvider
// 不修改 Explain 层接口
// 新增 build 方法：从 ExecutionTraceRepository 读取 Event → 构建 ExplainDocument
export interface ExecutionExplainProvider {
  // Sprint 1 ExplainProvider 接口继承
  type: string  // 'execution'
  build(executionId: string): Promise<ExplainDocument>
}
```

---

## 接口不变量（冻结规则）

以下接口在 v1.0 生命周期内不允许修改（包括字段重命名、类型变更、删除）：

| # | 接口/类型 | 冻结规则 |
|---|-----------|----------|
| 1 | ExecutionGraph | 不可修改字段定义；新增可选字段需通过 metadata 扩展 |
| 2 | ExecutionContext | 不可修改 executionId/brandId/tenantId 结构 |
| 3 | ExecutionArtifact | 不可修改 metadata 结构（duration/cost/retryCount） |
| 4 | ExecutionEvent | 不可修改 type 枚举值（可新增，不可删除或重命名） |
| 5 | NodeStatus | 不可删除或重命名现有状态值 |
| 6 | GraphStatus | 不可删除或重命名现有状态值 |
| 7 | IDAGScheduler | 不可修改 execute/cancel/getStatus 签名 |
| 8 | INodeStateMachine | 不可修改 transition/canTransition 签名 |
| 9 | CapabilityRouter | 不可修改 resolve 签名 |
| 10 | ExecutionPlanner | 不可修改 plan 签名 |
| 11 | ExecutionRequest | 不可修改 steps/providerPolicy 结构 |
| 12 | ProviderPolicy | 不可删除或重命名现有策略值 |

---

## 建议目录结构

```
backend/src/services/geo/execution/
├── types.ts              # ExecutionGraph, ExecutionNode 等核心类型
├── context.ts            # ExecutionContext
├── artifact.ts           # ExecutionArtifact
├── event.ts              # ExecutionEvent + ExecutionEventType
├── scheduler/
│   ├── dag-scheduler.ts  # RC1
│   └── state-machine.ts  # RC1
├── provider/
│   ├── capability-router.ts    # RC2
│   ├── retry.ts                # RC2
│   ├── circuit-breaker.ts      # RC2
│   ├── fallback-router.ts      # RC2
│   └── health-service.ts       # RC2
├── planner/
│   ├── planner.ts              # RC3
│   └── adapters/
│       └── mission-adapter.ts  # RC3
├── explain/
│   └── execution-explain-provider.ts  # RC4
├── repository/
│   └── execution-trace.repository.ts  # RC4
├── routes/
│   └── execution.route.ts             # RC4
└── index.ts
```
