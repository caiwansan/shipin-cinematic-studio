# ADR-002 — Execution Runtime 作为 GEO 横向执行平台

**状态:** Accepted
**日期:** 2026-07-05
**作者:** GEO Execution 架构团队

---

## 背景

Mission 需要从"建议"变为"可执行方案"；已有 Discovery/Knowledge/Verification/Publishing 流程需要统一调度平台。

Sprint 1 构建了 Explainability Platform v1.0（ADR-001），解决了 Explain 的横向化问题。但执行流程（Mission Execution、Verification 等）仍然分散在各业务模块中，缺乏统一的调度/容错/状态管理平台。

核心问题：
1. 每个执行类型自行管理 DAG 调度 — 重复造轮子
2. 没有统一的容错机制 — 重试/熔断/降级逻辑散落在各模块
3. 没有统一的状态追踪 — 审计和 Explain 依赖各模块自行埋点
4. 新增执行类型需要从零搭建调度基础设施

## 架构决策

### 1. Execution Runtime 是平台，不属于 Mission
Runtime 不绑定任何业务实体，Mission 只是 ExecutionRequest 的一种来源。Runtime 对所有执行类型一视同仁。

### 2. ExecutionRequest 是唯一入口
Mission/Verification/Knowledge/Discovery 都通过 Adapter 转换为 ExecutionRequest。Runtime 不感知业务来源，只处理 ExecutionRequest → ExecutionGraph。

### 3. Runtime 不包含业务规则
Runtime 只负责调度/执行/容错/状态管理；不负责推导 DAG、不负责决策。业务规则（如"Mission 应该如何编排步骤"）在 Adapter 和 Planner 中实现。

### 4. Planner 负责生成 DAG
Planner 将 ExecutionRequest 转换为 ExecutionGraph；Runtime 不推导 DAG。Runtime 接收已经规划好的 DAG，只负责按依赖关系调度执行。

### 5. Runtime 不直接访问 Explain
Runtime 只写 ExecutionTrace/ExecutionEvent 到 Repository；ExplainProvider 从 Repository 构建 ExplainDocument。Runtime 不调用任何 Explain 层的 API。

### 6. Provider 通过 Capability Router 调度
Runtime 不直接调用 Provider SDK，统一经过 CapabilityRouter → Unified AI Gateway。Runtime 按能力（capability）调度，不关心具体由哪个 Provider 执行。

### 7. 所有状态变化必须产生 Event
不依赖内存状态；所有状态变化写入 ExecutionEvent（NodeStarted/NodeCompleted/NodeFailed/NodeRetry/NodeTimeout/NodeFallback）。Timeline、Audit、Explain 均从 Event 重建视图。

### 8. 冻结版本 v1.0
以上 7 条规则在 v1.0 生命周期内不可违反。后续版本如需修改规则，需创建新 ADR 并注明取代 ADR-002。

---

## 架构图

```text
ExecutionRequest (via Adapter: Mission/Verification/Knowledge/Discovery)
       │
       ▼
ExecutionPlanner (RC3)   ← 生成 DAG，Runtime 不推导
       │
       ▼
DAG Runtime (RC1)       ← 调度 + 状态机
       │
       ▼
Provider Runtime (RC2)  ← CapabilityRouter → Unified AI Gateway → Provider
       │
       ▼
ExecutionEvent (所有状态变化) → ExecutionTraceRepository
       │
       ▼
ExecutionExplainProvider (RC4) → ExplainDocument → 复用 Sprint 1 Renderer
```

---

## 架构冻结规则（v1.0 Freeze）

以下规则在 Execution Runtime v1.0 生命周期内不可违反：

| # | 规则 | 说明 |
|---|------|------|
| 1 | Runtime 是平台，不绑定业务实体 | 禁止 Runtime 内部出现 Mission/Discovery 等业务模块的 import |
| 2 | ExecutionRequest 是唯一入口 | 禁止绕过 ExecutionRequest 直接调用 Scheduler |
| 3 | Runtime 不包含业务规则 | 禁止在 Runtime 内部推导 DAG 或做业务决策 |
| 4 | Planner 负责生成 DAG | 禁止 Runtime 调用或依赖 Planner，Runtime 只消费生成的 Graph |
| 5 | Runtime 不访问 Explain | 禁止 Runtime import 任何 Explain 层的组件 |
| 6 | Provider 通过 CapabilityRouter 调度 | 禁止 Runtime 直接调用 Provider SDK |
| 7 | 所有状态变化必须产生 Event | 禁止仅依赖内存状态进行状态管理 |
| 8 | 新增执行类型只需新增 Adapter + Provider | 禁止修改 Runtime 核心代码来适配新执行类型 |

---

## Consequences

### 正面
- 新增执行类型只需新增 Adapter，不修改 Runtime
- 新增 Provider 只需注册到 CapabilityRouter，不修改 Runtime
- Timeline/Audit/Explain 都消费 Event，不依赖 Runtime 内存状态
- 全部 8 条规则锁定后，RC1~RC4 可并行实现
- 与 ADR-001（Explainability Platform）天然对齐 — Event 驱动 Explain，不引入依赖环

### 负面
- 需要为每种执行类型编写 Adapter
- Event 持久化增加写入开销（可通过批量写入优化）
- CapabilityRouter 初期需要手动配置 Provider 映射
- 规则 3（Runtime 不含业务规则）需要严格的 Code Review 保证执行

---

## 实现状态

| 组件 | 状态 | RC |
|------|------|----|
| ExecutionGraph / ExecutionNode / ExecutionEdge | 📝 已设计（RFC2） | RC1 |
| ExecutionContext | 📝 已设计（RFC2） | RC1 |
| ExecutionArtifact | 📝 已设计（RFC2） | RC1 |
| ExecutionEvent | 📝 已设计（RFC2） | RC1 |
| DAGScheduler | ❌ 待实现 | RC1 |
| NodeStateMachine | ❌ 待实现 | RC1 |
| CapabilityRouter | ❌ 待实现 | RC2 |
| RetryStrategy | ❌ 待实现 | RC2 |
| CircuitBreaker | ❌ 待实现 | RC2 |
| FallbackRouter | ❌ 待实现 | RC2 |
| ProviderHealthService | ❌ 待实现 | RC2 |
| ExecutionRequest | 📝 已设计（RFC2） | RC3 |
| ExecutionPlanner | ❌ 待实现 | RC3 |
| MissionExecutionAdapter | ❌ 待实现 | RC3 |
| Execution API | ❌ 待实现 | RC4 |
| ExecutionTraceRepository | ❌ 待实现 | RC4 |
| ExecutionExplainProvider | ❌ 待实现 | RC4 |

---

## 相关 ADR

| ADR | 关联 |
|-----|------|
| ADR-001 | Explainability Platform — Execution Event 消费方 |
| ADR-003 | (未来) Provider Router + Capability 深度设计 |
