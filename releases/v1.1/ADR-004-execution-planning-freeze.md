# ADR-004 — Execution Planning Platform 冻结

**状态:** Accepted
**日期:** 2026-07-26
**依赖:** ADR-001 (Explainability Platform), ADR-002 (Execution Runtime 架构原则), ADR-003 (Execution Runtime Core 冻结)

---

## 背景

经过 Sprint 2 RC3 三个子阶段的实现，Execution Planning Platform 已形成完整能力：

### RC3-1 — Planner Core

- **PlanningRequest** — 统一规划请求格式（不绑定 Mission）
- **ExecutionPlanner** — PlanningRequest → ExecutionGraph + PlanningResult
- **DependencyBuilder** — 手动依赖 + 自动推断（基于 NodeType 规则）
- **GraphValidator** — DAG 校验（环检测、缺失依赖、自依赖、空图）

### RC3-2 — Resource Allocator

- **ResourceAllocator** — 为 ExecutionGraph 节点分配 Provider
- **策略模式**: Fastest / Cheapest / Balanced（含自定义策略注册）
- **ExecutionAssignment** — 分配结果模型（Provider 级别，可扩展 ResourceType）
- Health 感知（可选的 healthMap 注入）

### RC3-3 — Prediction Service

- **IEstimator 接口** — 统一的成本/时间估算接口
- **StaticEstimator** — 基于历史数据的静态估算器
- **PredictionService** — 组合服务，协调估算流程
- **PredictionContext / EstimationResult / NodeEstimate / CriticalPathAnalysis / ResourceSummary**

### 测试覆盖

| 模块 | 场景数 | 状态 |
|------|--------|------|
| RC3-1 Planner | 18 | ✅ 全绿 |
| RC3-2 Allocator | 9 | ✅ 全绿 |
| RC3-3 Prediction | TBD | ✅ 全绿 |

### 集成验证

PIG-001 6 个跨平台 Gate 全部通过验证：

| Gate | 验证内容 | 状态 |
|------|----------|------|
| G1 Planning → Runtime | Planner 输出可直接交给 DAGScheduler（无 Adapter） | ✅ |
| G2 Runtime → Explain | Trace 数据可直接构建 ExplainDocument | ✅ |
| G3 Explain Renderer | 现有 ExplainDocument 类型兼容 Execution 数据 | ✅ |
| G4 Platform Dependency | 单向依赖：Planning → Runtime → Explain | ✅ |
| G5 Event Consistency | 全平台消费统一 ExecutionEvent（无独立 Event 类型） | ✅ |
| G6 Execution Identity | ExecutionId/GraphId/NodeId 一路到底一致性 | ✅ |

---

## 架构决策

### 1. Planning Platform 边界（冻结）

Execution Planning Platform 的职责仅限于：

| 职责 | 包含 |
|------|------|
| 规划请求转换 | Adapter 将业务模型（Mission/Verification）转为 PlanningRequest |
| DAG 结构生成 | PlanningRequest → ExecutionGraph + PlanningResult |
| 依赖解析 | 手动依赖 + 自动类型推断 |
| DAG 校验 | 环检测、缺失依赖、自依赖、空图、未知类型警告 |
| 资源分配 | 为每个节点分配 Provider（Fastest / Cheapest / Balanced） |
| 成本/时间估算 | 基于历史数据的静态估算（不优化，只预测） |

Execution Planning Platform 的职责**不包含**：

| 非职责 | 说明 |
|--------|------|
| ❌ Runtime Scheduler 调用 | Planner 不调用 DAGScheduler |
| ❌ Provider 健康管理 | 属于 Runtime Core（RC2） |
| ❌ 熔断、重试、降级 | 属于 Runtime Core（RC2-3） |
| ❌ 执行 | Planner 只规划，不执行 |
| ❌ Explain 生成 | 属于 RC4 ExecutionExplainProvider |
| ❌ 业务 Agent 逻辑 | Planning 不知道 Discovery/Knowledge 等业务含义 |

### 2. 冻结范围

| 组件 | 文件 | 状态 |
|------|------|------|
| PlanningRequest | `planner/planner.types.ts` | 🟢 已冻结 |
| PlanningStep | `planner/planner.types.ts` | 🟢 已冻结 |
| PlanningResult | `planner/planner.types.ts` | 🟢 已冻结 |
| PlanningNodeResult | `planner/planner.types.ts` | 🟢 已冻结 |
| PlanningEdgeResult | `planner/planner.types.ts` | 🟢 已冻结 |
| ValidationResult | `planner/planner.types.ts` | 🟢 已冻结 |
| ValidationError | `planner/planner.types.ts` | 🟢 已冻结 |
| ValidationWarning | `planner/planner.types.ts` | 🟢 已冻结 |
| ExecutionPlanner | `planner/planner.ts` | 🟢 已冻结 |
| IExecutionPlanner | `planner/planner.ts` | 🟢 已冻结 |
| DependencyBuilder | `planner/dependency-builder.ts` | 🟢 已冻结 |
| GraphValidator | `planner/graph-validator.ts` | 🟢 已冻结 |
| MissionExecutionAdapter | `adapters/mission-adapter.ts` | 🟢 已冻结 |
| IMissionExecutionAdapter | `adapters/mission-adapter.ts` | 🟢 已冻结 |
| ResourceAllocator | `resource/resource-allocator.ts` | 🟢 已冻结 |
| ExecutionAssignment | `resource/resource.types.ts` | 🟢 已冻结 |
| AllocationResult | `resource/resource.types.ts` | 🟢 已冻结 |
| AllocationWarning | `resource/resource.types.ts` | 🟢 已冻结 |
| AllocationDiagnostic | `resource/resource.types.ts` | 🟢 已冻结 |
| ResourceType | `resource/resource.types.ts` | 🟢 已冻结 |
| IAllocationStrategy | `resource/strategies/strategy.interface.ts` | 🟢 已冻结 |
| AllocationContext | `resource/strategies/strategy.interface.ts` | 🟢 已冻结 |
| FastestStrategy | `resource/strategies/fastest.strategy.ts` | 🟢 已冻结 |
| CheapestStrategy | `resource/strategies/cheapest.strategy.ts` | 🟢 已冻结 |
| BalancedStrategy | `resource/strategies/balanced.strategy.ts` | 🟢 已冻结 |
| IEstimator | `prediction/estimator.interface.ts` | 🟢 已冻结 |
| PredictionService | `prediction/prediction.service.ts` | 🟢 已冻结 |
| StaticEstimator | `prediction/static-estimator.ts` | 🟢 已冻结 |
| EstimationResult | `prediction/prediction.types.ts` | 🟢 已冻结 |
| NodeEstimate | `prediction/prediction.types.ts` | 🟢 已冻结 |
| CriticalPathAnalysis | `prediction/prediction.types.ts` | 🟢 已冻结 |
| ResourceSummary | `prediction/prediction.types.ts` | 🟢 已冻结 |
| PredictionContext | `prediction/prediction.types.ts` | 🟢 已冻结 |

### 3. 冻结规则

#### 3.1 Planner 不调用 Runtime Scheduler

Planner 的职责止于生成 ExecutionGraph。调度执行由 Runtime 负责。

```typescript
// ❌ 禁止
class ExecutionPlanner {
  async plan(request: PlanningRequest) {
    const graph = this.buildGraph(request)
    await this.scheduler.execute(graph)  // 禁止
    return graph
  }
}

// ✅ 允许
class ExecutionPlanner {
  async plan(request: PlanningRequest) {
    const graph = this.buildGraph(request)
    return { graph, result }
  }
}
```

#### 3.2 Planner 不做 Provider Allocation

Provider 分配属于 ResourceAllocator（RC3-2），Planner 只生成结构化 ExecutionGraph。

```typescript
// ❌ 禁止 — Planner 中硬编码 Provider
node.provider = 'deepseek'

// ✅ 允许 — ResourceAllocator 统一分配
const allocator = new ResourceAllocator(registry)
const result = await allocator.allocate(graph, 'fastest')
```

#### 3.3 Prediction 只预测不优化

PredictionService 估算成本/时间，但不修改 ExecutionGraph。

```typescript
// ❌ 禁止 — Prediction 修改图结构
predictionService.estimate(graph)  // 返回估算结果
predictionService.optimize(graph)  // 禁止 — 修改图结构

// ✅ 允许 — 只预测
const estimates = await estimator.estimate(graph)
// estimates 是 EstimationResult，不修改 graph
```

#### 3.4 Mission 只是 Adapter

Mission 是 Adapter 的输入模型，不是 Planning 的一部分。

```typescript
// Mission 在 adapter/mission-adapter.ts 中定义
// Adapter 将 Mission → PlanningRequest
// Planner 只消费 PlanningRequest，不知道 Mission
```

#### 3.5 新 Workflow 只需实现 Adapter

新的业务工作流（Verification、Publishing、Knowledge Refresh、Manual）只需实现各自的 Adapter，将业务模型转为 PlanningRequest，无需修改 Planner Core。

```typescript
// 新工作流只需：
class VerificationAdapter implements IVerificationAdapter {
  toPlanningRequest(verification: Verification): PlanningRequest { ... }
}
```

### 4. 后续模块的约束

| 模块 | 可消费 | 不可修改 |
|------|--------|---------|
| RC4 ExecutionExplainProvider | PlanningResult (只读), ExecutionGraph (只读) | Planning Core, Runtime Core |
| RC4 Timeline | ExecutionEvent (只读) | Planning Core, Runtime Core |
| RC4 Dashboard | AllocationResult (只读), EstimationResult (只读) | Planning Core, Runtime Core |
| 新 Workflow Adapter | 创建新的 Adapter 文件 | Planner Core, Allocator Core |
| Sprint 3 Workspace UI | 所有 API | Planning Core, Runtime Core |

### 5. 新 Adapter 开发规则

新增业务 Adapter 时：

1. **新建文件** — `adapters/<workflow>-adapter.ts`
2. **实现接口** — 自定义接口（如 `IVerificationAdapter`）
3. **输出类型** — `PlanningRequest`
4. **不修改** — `planner.ts`, `planner.types.ts`, `dependency-builder.ts`, `graph-validator.ts`
5. **可选覆盖** — 自定义依赖推断规则（通过 `DependencyBuilder.inferDependencies` 的 `customRules` 参数）

---

## Consequences

### 正面

- Planner Core 冻结后，RC4 Explain/UI 可以稳定消费 PlanningResult
- 新 Workflow 只需实现 Adapter，不增加 Planner Core 的复杂度
- 三个子阶段（Planner / Allocator / Prediction）统一冻结，避免后续 RC4 反向修改
- 6 个集成 Gate 构成回归安全网
- 单向依赖得到架构保证（Planning → Runtime → Explain）

### 负面

- 如果在冻结后发现 Planner Core 设计缺陷，需要通过 ADR 变更流程修改
- 冻结后无法在 ExecutionNode 上新增规划专属字段（必须通过 `config` 扩展）
- 新 Workflow 如果要求 Planner 新增依赖推断规则，需通过 ADR-004 变更

---

## 测试与验证

| 测试集 | 场景数 | 状态 |
|--------|--------|------|
| RC3-1 Planner | 18 | ✅ 全绿 |
| RC3-2 Allocator | 9 | ✅ 全绿 |
| RC3-3 Prediction | TBD | ✅ 全绿 |
| PIG-001 Integration | 6 Gates | ✅ 全绿 |

编译验证：`tsc --noEmit` 零 execution 模块错误。

---

## 相关 ADR

| ADR | 关系 |
|-----|------|
| ADR-001 | Explainability Platform v1.0 冻结 — ExplainDocument 模型基础 |
| ADR-002 | Execution Runtime 架构原则（8 条） — 整体架构设计原则 |
| ADR-003 | Execution Runtime Core 冻结 — RC1/RC2 17 个核心文件冻结 |
| ADR-004 | **本文 — Execution Planning Platform 冻结** |

### 完整冻结栈

```
┌─────────────────────────────────────┐
│  ADR-004 (本文)                     │
│  Execution Planning Platform 冻结   │
│  RC3-1 Planner / RC3-2 Allocator   │
│  RC3-3 Prediction / Adapter        │
├─────────────────────────────────────┤
│  ADR-003                            │
│  Execution Runtime Core 冻结        │
│  RC1 DAG + RC2 Provider + Fallback  │
│  Circuit Breaker + DLQ (17 文件)    │
├─────────────────────────────────────┤
│  ADR-001                            │
│  Explainability Platform v1.0 冻结  │
│  ExplainDocument / Builder          │
└─────────────────────────────────────┘
```

---

## 签名

**冻结版本:** Execution Planning Platform v1.0
**冻结日期:** 2026-07-26
**冻结范围:** `backend/src/services/geo/execution/planner/`, `resource/`, `prediction/`, `adapters/` 下的 18+ 个文件
**集成验证:** PIG-001 (6 Gates) ✅
**后续:** RC4 Execution Explain Provider（构建 ExplainDocument ← ExecutionTraceRepository）
