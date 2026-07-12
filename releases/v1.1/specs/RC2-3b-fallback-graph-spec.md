# RC2-3b — Fallback Graph Spec

**版本:** v1.0 (thin spec)
**定位:** Execution-time substitution graph — 不是 router extension，是 graph transformation layer
**依赖:** RC2-3a Circuit Breaker（只读 availability signal）
**上游:** RC2-1 CapabilityRouter（非调用，只参考 provider 列表）
**下游:** RC2-3c Dead Letter Queue
**架构约束:**
- FallbackGraph 不修改 CB 状态（只读 available providers）
- FallbackGraph 不参与 routing decision（不覆盖 CapabilityRouter）
- FallbackGraph 不触发 retry（retry 属于 RC2-2 职责）
- FallbackGraph 不做 policy decision（不判断 provider health）

---

## 1. 核心概念

### FallbackGraph ≠ Router

Router 做的是：给定能力→选择 Provider

FallbackGraph 做的是：给定失败节点→生成替换执行子图

```
原始 DAG:
  A → B → C

B 失败后 FallbackGraph 输出:
  A → B(failed) → C
        │
        └── B2(primary_fallback) → B3(secondary_fallback)
```

### Key: FallbackGraph 不修改原始 DAG
- 不在原图上替换节点
- 生成一个**并行 fallback 子图**
- DAG Scheduler 在收到 `node_fallback` 事件后调度 fallback 节点

---

## 2. 类型定义

```typescript
// ===================================================
// FallbackGraph — RC2-3b
// 不继承 RFC2 FallbackRouter（只保留作为接口锚点）
// 而是作为独立的 graph transformation layer
// ===================================================

export interface FallbackNode {
  id: string
  originalNodeId: string      // 原始节点 ID
  provider: string            // fallback provider
  capability: string          // fallback capability
  fallbackLevel: number       // 降级层级（1=主备, 2=次备...）
  priority: number            // fallback 链内优先级
}

export interface FallbackGraph {
  id: string
  originalNodeId: string      // 触发 fallback 的原始节点
  fallbackNodes: FallbackNode[]  // 降级节点链
  selectedNode: string | null    // 最终选中的 fallback node id
  status: 'pending' | 'active' | 'completed' | 'exhausted'
  createdAt: string
}

export interface FallbackConfig {
  maxFallbackLevel: number      // 最大降级层数（默认 2）
  requireCircuitCheck: boolean  // 是否检查 CB 状态（默认 true）
}
```

---

## 2.5 Fallback 触发边界（关键决策）

Fallback 永远在 Retry 耗尽之后触发。不会抢在 Retry 前面。

```
Node failed/timeout
  → RetryPolicy.evaluate()
    ├─ retry 可用 (attempt < maxRetries) → RetryScheduler（RC2-2），不进入 fallback
    └─ retry 耗尽 (attempt >= maxRetries)
         → CircuitBreaker.allowRequest()?
           ├─ CB OPEN（返回 false）→ **触发 fallback**
           └─ CB CLOSED（返回 true）→ 最终失败 → **触发 fallback**
```

这样保证了：
1. Retry 和 Fallback 互斥 — 不会同时触发
2. Fallback 触发时 retry 已经被耗尽 — 不浪费备选 provider 的重试机会
3. DLQ（RC2-3c）只收 "retry 耗尽 + fallback chain 耗尽" 的最终孤儿
4. 事件链清晰：node_failed → node_retry × N → node_fallback → node_completed | node_exhausted → DLQ

### 触发条件
只有以下条件允许进入 fallback：
- `node_failed` + retry exhausted
- `node_timeout` + retry exhausted
- `circuit_breaker_open`（直接 fallback，无需 retry）

### Fallback 自身级别内的重试
Fallback 不触发 RetryPolicy。如果 fallback provider 也失败，直接继续 fallback chain 下一级，而不是重试同一 provider。

---

## 3. Fallback Resolution Rule（关键）

### 3.1 解析规则（确定性）

```
输入: failedNode, availableProviders[]
输出: fallbackGraph

规则:
1. 取 failedNode.capability
2. 在当前 ExecutionGraph 中查找已使用的 provider 列表
3. 从 availableProviders[] 中排除已使用的 provider
4. 按 provider priority 排序
5. 如果 requireCircuitCheck=true:
   - 对每个 provider 调用 allowRequest()
   - 排除 allowRequest=false 的 provider
6. 取前 maxFallbackLevel 个作为 fallback chain
7. 生成 fallbackGraph
```

### 3.2 不在 fallback 范围内的 provider
- 已经在当前 executionGraph 中用于其他节点的
- Circuit Breaker 标记为 OPEN（被拒绝的）
- 和原始节点相同的 provider（同 provider 失败→应触发 CB，不应立即重试同 provider）

---

## 4. Event

复用 RC1 ExecutionEvent 系统。新增 event type：

```typescript
'node_fallback'  // 节点触发 fallback
```

事件数据结构：

```typescript
{
  type: 'node_fallback',
  nodeId: string,
  data: {
    originalNodeId: string,
    originalProvider: string,
    fallbackChain: FallbackNode[],
    selectedNodeId: string,
    fallbackProvider: string,
    fallbackLevel: number,
    remainingLevels: number,
  }
}
```

### 何时产生 event
- FallbackGraph 创建时 → `node_fallback` event
- FallbackGraph 切换备用节点时 → 再次 `node_fallback` event
- FallbackGraph 所有降级全部失败 → 不产生 event（留给 RC2-3c DLQ 处理）

---

## 5. 接口定义

```typescript
export interface IFallbackResolver {
  /**
   * 为失败的节点构建 fallback graph
   * @param failedNode — 失败的 ExecutionNode
   * @param availableProviders — 当前可用的 provider 列表（从 CapabilityRouter/Pipeline 传入）
   * @param executionGraph — 当前执行图（用于排除已使用 provider）
   * @param circuitBreaker — 可选，用于检查 CB 状态
   */
  resolve(
    failedNode: ExecutionNode,
    availableProviders: ProviderRegistration[],
    executionGraph: ExecutionGraph,
    circuitBreaker?: ICircuitBreaker,
  ): Promise<{
    fallbackGraph: FallbackGraph
    events: ExecutionEvent[]
  }>

  /**
   * 选中 fallback 链中的下一个 provider
   * @param fallbackGraph — 当前 fallback graph
   */
  selectNext(fallbackGraph: FallbackGraph): Promise<{
    nextNode: FallbackNode | null
    events: ExecutionEvent[]
  }>
}

export interface FallbackResolverConfig {
  maxFallbackLevel: number
  requireCircuitCheck: boolean
}
```

---

## 6. 与 DAG Scheduler 的关系（graph safe 关键）

### 6.1 Scheduler 不修改原始 DAG
```
正确:
  Scheduler 收到 node_failed
  → 通知 FallbackResolver
  → FallbackResolver 返回 fallbackGraph
  → Scheduler 在 DAG 之外调度 fallbackGraph 的节点
  → fallback 完成后恢复原始 DAG 的后续节点

错误:
  Scheduler 修改 ExecutionGraph.nodes
  → 替换失败节点
  → 破坏 execution graph 的完整性
```

### 6.2 FallbackGraph 是“悬挂子图”
- 不插入到 ExecutionGraph.nodes
- 由 Scheduler 单独维护 fallbackExecutionList
- 每个 fallback 节点执行完成后：
  - 成功 → 标记原始节点下游的依赖为 ready
  - 失败 → 继续 fallback chain 或标记为 exhausted

---

## 7. 测试场景

| # | 场景 | 输入 | 预期输出 |
|---|------|------|---------|
| 1 | 主备 fallback | B 失败，A→B→C，备选 P2 | FallbackGraph with B2(P2), B→B2→C |
| 2 | 多级 fallback | B 失败，3 个备选 | 3-level fallback chain |
| 3 | CB 排除 | B 失败，P2 熔断，P3 正常 | 跳过 P2，选中 P3 |
| 4 | 无可用备选 | 所有备选都熔断 | status=exhausted, events empty |
| 5 | 全部 provider 已使用 | 所有 provider 都在图里 | exhausted |
| 6 | selectNext | B2 失败，B3 可用 | 返回 B3 + node_fallback event |
| 7 | selectNext 无可用 | 全部失败 | 返回 null |
| 8 | 不修改原始 DAG | 任意场景 | ExecutionGraph.nodes 不变 |

---

## 8. 文件结构

```
execution/
├── fallback/
│   ├── fallback.types.ts   # FallbackNode, FallbackGraph, FallbackConfig
│   └── fallback-resolver.ts # IFallbackResolver 实现
├── ... (RC1 + RC2-1 + RC2-2 + RC2-3a 文件不变)
```

---

## 9. DoD

- [ ] FallbackNode / FallbackGraph / FallbackConfig 类型定义完成
- [ ] IFallbackResolver 接口定义完成
- [ ] resolve() 实现通过 5 个测试场景
- [ ] selectNext() 实现通过 2 个测试场景
- [ ] 8 个测试场景全部通过
- [ ] 不修改原始 ExecutionGraph.nodes
- [ ] 产生正确的 node_fallback ExecutionEvent
- [ ] 不调用 CapabilityRouter（只接收 availableProviders 作为参数）
- [ ] 不修改 Circuit Breaker 状态
- [ ] 编译零新增错误
- [ ] RC1 + RC2-1 + RC2-2 + RC2-3a 回归全绿
