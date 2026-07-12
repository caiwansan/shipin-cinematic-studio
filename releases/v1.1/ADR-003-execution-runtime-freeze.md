# ADR-003 — Execution Runtime Core 冻结

**状态:** Accepted
**日期:** 2026-07-25
**依赖:** ADR-001 (Explainability Platform), ADR-002 (Execution Runtime 架构原则)

---

## 背景

经过 Sprint 2 RC 系列实现（RC1 + RC2-1 + RC2-2 + RC2-3a + RC2-3b + RC2-3c），Execution Runtime 已经形成完整的平台级能力：

- DAG 调度核心（DAGScheduler + State Machine）
- Provider 路由（CapabilityRouter + ProviderRegistry + ProviderHealth）
- 执行韧性（RetryPolicy + TimeoutTracker）
- 系统隔离（CircuitBreaker）
- 执行降级（FallbackGraph）
- 最终持久化（Dead Letter Queue）

全部 6 个 RC 累计 120 个测试用例全部通过，0 编译错误，所有回归全绿。

现在需要冻结 Runtime Core，防止后续 RC3（Planner）和 RC4（Explain/UI）反向侵入。

---

## 架构决策

### 1. Runtime Core 边界（冻结）

Runtime Core 的职责仅限于：

| 职责 | 包含 |
|------|------|
| DAG 执行 | 调度节点、解析依赖、管理 Ready Queue |
| 状态管理 | NodeStateMachine（10 种状态，12 条转换路径） |
| Provider 生命周期 | 注册、路由、健康追踪 |
| 执行韧性 | Retry、Timeout、Circuit Breaker、Fallback、DLQ |
| 事件产生 | 所有状态变化 → ExecutionEvent |
| Trace 写入 | 通过 Repository 持久化 ExecutionEvent |

Runtime Core 的职责**不包含**：

| 非职责 | 说明 |
|--------|------|
| ❌ Mission 规划 | 属于 RC3 Planner |
| ❌ AI 推理 | 属于 Provider（统一经过 CapabilityRouter） |
| ❌ Explain 渲染 | 属于 RC4 ExecutionExplainProvider（消费 Repository） |
| ❌ Dashboard/KPI | 属于 RC4 或 Sprint 3 |
| ❌ 成本优化策略 | 属于 RC3-3 |
| ❌ 业务规则 | Runtime 不知道 Discovery/Knowledge/Mission/Verification/Publishing |

### 2. ExecutionGraph 作为唯一执行模型

ExecutionGraph 是 Runtime 唯一执行模型。禁止：

- ❌ Planner 直接操作 Runtime Scheduler
- ❌ Provider 修改 Graph
- ❌ Fallback 修改原始 DAG（FallbackGraph 是悬挂子图）
- ❌ 任何模块直接修改 NodeStatus

允许：
- ✅ Runtime 更新 NodeStatus（通过 StateMachine）
- ✅ Runtime 写 ExecutionEvent
- ✅ Runtime 写 Trace
- ✅ 外部模块只读查询 ExecutionGraph

### 3. ExecutionEvent 冻结

以下 Event 类型在 v1.0 生命周期内不可新增/修改：

| Event | 生产者 | 消费者 |
|-------|--------|--------|
| `graph_created` | Scheduler | Timeline, Audit |
| `graph_completed` | Scheduler | Timeline, Audit |
| `graph_failed` | Scheduler | Timeline, Audit |
| `graph_cancelled` | Scheduler | Timeline, Audit |
| `node_queued` | Scheduler | Timeline, Audit |
| `node_started` | Scheduler | Timeline, Audit |
| `node_completed` | Scheduler | Timeline, Audit |
| `node_failed` | Scheduler | Timeline, Audit |
| `node_retry` | RetryScheduler | Timeline, Audit |
| `node_timeout` | TimeoutTracker | Timeline, Audit |
| `node_fallback` | FallbackResolver | Timeline, Audit |
| `node_dead_lettered` | DLQService | Timeline, Audit |
| `circuit_breaker_open` | CircuitBreakerService | Health Dashboard |
| `circuit_breaker_half_open` | CircuitBreakerService | Health Dashboard |
| `circuit_breaker_closed` | CircuitBreakerService | Health Dashboard |
| `dependency_met` | Scheduler | (内部使用) |
| `dlq_replayed` | DLQService | Audit |
| `dlq_archived` | DLQService | Audit |

### 4. NodeStatus 冻结

10 种节点状态在 v1.0 生命周期内不可新增/修改：

```
pending → queued → running → completed
                         ├→ retrying → running
                         ├→ timeout → fallback → running
                         ├→ failed → fallback → running
                         └→ cancelled
```

完整状态列表：`pending`, `queued`, `running`, `waiting_dependency`, `retrying`, `fallback`, `cancelled`, `completed`, `failed`, `timeout`

### 5. Provider Contract 冻结

Provider 只需要实现以下接口（Stateless）：

- `execute(node: ExecutionNode, context: ExecutionContext): Promise<ExecutionResult>`
- `cancel(executionId: string): Promise<void>`（可选）
- `health(): Promise<ProviderHealth>`（可选）
- `metadata(): ProviderMetadata`（可选）

Provider 不包含：
- ❌ Retry 逻辑（属于 RetryScheduler）
- ❌ Fallback 逻辑（属于 FallbackResolver）
- ❌ Circuit Breaker 逻辑（属于 CircuitBreakerService）
- ❌ 业务规则（Discovery/Knowledge/Mission 等）

### 6. 三层架构分层（最终）

```
Layer 3  Workspace UI (Sprint 3)
         ─────────────────────
Layer 2  Explainability Platform v1.0 (冻结, ADR-001)
         │
         ├─ ExecutionExplainProvider (RC4, 只读 Repository)
         └─ ExplainDocument Renderer
         ─────────────────────
Layer 1  Execution Runtime Core (冻结, ADR-003)
         │
         ├─ DAG Runtime (RC1)
         ├─ Provider Runtime (RC2)
         └─ Execution Repository
         ─────────────────────
         Discovery / Knowledge / Mission / Verification / Publishing (业务层)
```

### 7. 冻结范围

| 组件 | 文件 | 状态 |
|------|------|------|
| ExecutionGraph / ExecutionNode / ExecutionEdge | `types.ts` | 🟢 已冻结 |
| ExecutionContext | `context.ts` | 🟢 已冻结 |
| ExecutionArtifact | `artifact.ts` | 🟢 已冻结 |
| ExecutionEvent / ExecutionEventType | `event.ts` | 🟢 已冻结 |
| DAGScheduler | `scheduler/dag-scheduler.ts` | 🟢 已冻结 |
| NodeStateMachine | `scheduler/state-machine.ts` | 🟢 已冻结 |
| ProviderRegistry | `provider/provider-registry.ts` | 🟢 已冻结 |
| CapabilityRouter | `provider/capability-router.ts` | 🟢 已冻结 |
| ProviderHealthService | `provider/provider-health.ts` | 🟢 已冻结 |
| RetryPolicy / RetryScheduler | `retry/retry-policy.ts`, `retry-scheduler.ts` | 🟢 已冻结 |
| TimeoutTracker | `retry/timeout.ts` | 🟢 已冻结 |
| CircuitBreakerService | `circuit-breaker/circuit-breaker.ts` | 🟢 已冻结 |
| FallbackResolver | `fallback/fallback-resolver.ts` | 🟢 已冻结 |
| DLQService | `dlq/dlq.service.ts` | 🟢 已冻结 |
| ExecutionTraceRepository | `repository/execution-trace.repository.ts` | 🟢 已冻结 |
| CircuitBreakerRepository | `repository/circuit-breaker.repository.ts` | 🟢 已冻结 |
| DLQRepository | `repository/dlq.repository.ts` | 🟢 已冻结 |
| ProviderHealthRepository | `repository/provider-health.repository.ts` | 🟢 已冻结 |

### 8. 后续模块的约束

| 模块 | 可消费 | 不可修改 |
|------|--------|---------|
| RC3 Planner | ExecutionGraph (只读), ExecutionNode (只读), ProviderRegistry (只读) | Runtime Core |
| RC4 Explain Provider | ExecutionTraceRepository (只读) | Runtime Core, Explain Platform |
| RC4 Timeline | ExecutionTraceRepository (只读) | Runtime Core |
| RC4 Dashboard | ExecutionTraceRepository (只读), DLQRepository (只读) | Runtime Core |
| Sprint 3 Workspace UI | 所有 API | Runtime Core, Explain Platform |

---

## Consequences

### 正面
- RC3/R4 可以在不修改 Runtime Core 的前提下独立演进
- Planner 不会反向侵入 Scheduler（常见 anti-pattern）
- Explain Provider 只读 Repository，不破坏 Runtime 生命周期
- 12 个冻结保证不会出现"改了 Runtime 导致全平台回归"的情况
- 120 个测试用例构成回归安全网

### 负面
- 如果在冻结后发现 Runtime Core 设计缺陷，需要通过 ADR 变更流程修改
- 冻结后 RC3 Planner 无法在 ExecutionNode 上新增业务字段（必须通过 `config` 字段扩展）
- 冻结后 RC4 Timeline 无法增加 Event 类型（只能消费现有 Event）

---

## 测试与验证

| 测试集 | 测试数 | 状态 |
|--------|--------|------|
| RC1 DAGScheduler | 20 | ✅ 全绿 |
| RC2-1 Router | 28 | ✅ 全绿 |
| RC2-2 Retry | 26 | ✅ 全绿 |
| RC2-3a Circuit Breaker | 23 | ✅ 全绿 |
| RC2-3b Fallback | 11 | ✅ 全绿 |
| RC2-3c DLQ | 12 | ✅ 全绿 |
| **合计** | **120** | **✅ 全绿** |

编译验证：`tsc --noEmit` 零 execution 模块错误。

---

## 相关 ADR

| ADR | 关系 |
|-----|------|
| ADR-001 | Explainability Platform v1.0 冻结 |
| ADR-002 | Execution Runtime 架构原则（8 条） |
| ADR-003 | **本文 — Runtime Core 冻结** |

## 签名

**冻结版本:** Execution Runtime Core v1.0
**冻结日期:** 2026-07-25
**冻结范围:** `backend/src/services/geo/execution/` 下的 17 个核心文件
**后续:** RC3 Execution Planner（计划 Sprint 2 后半）
