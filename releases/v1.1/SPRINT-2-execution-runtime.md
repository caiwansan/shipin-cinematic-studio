# Sprint 2 — Execution Runtime

**Priority:** P1 — Platform Foundation
**基线:** Explainability Platform v1.0（Sprint 1，已冻结，ADR-001）
**Runtime Core 状态:** ✅ 已冻结（ADR-003，2026-07-25）
**架构决策文档:**
- [ADR-002](ADR-002-execution-runtime.md) — Execution Runtime 架构冻结（8 条规则）
- [ADR-003](ADR-003-execution-runtime-freeze.md) — Execution Runtime Core 冻结（17 个文件）
**接口冻结文档:** [RFC2](RFC2-execution-runtime-interfaces.md) — 按 RC 分组的接口定义（无实现）
**建议目录结构:** 见下文附录

**架构原则:**
- Execution Runtime 不修改 Explain 层，只消费它
- Explain 永远只读 Runtime 的 Repository，不直接访问 Runtime
- 新增三个平台对象：ExecutionContext / ExecutionArtifact / ExecutionEvent
- Runtime Core 已冻结，后续 RC3/RC4 只消费不修改

---

## 架构总览

```
ExecutionRequest (Mission / Verification / Discovery / ...)
       │
       ▼
┌─────────────────────────────────┐
│  Execution Planner (RC3)        │
│   ExecutionRequest → DAG        │
└────────────┬────────────────────┘
             │ ExecutionGraph
             ▼
┌─────────────────────────────────┐
│  DAG Runtime (RC1)              │
│   Scheduler + State Machine     │
│   Ready Queue + Dependency      │
└────────────┬────────────────────┘
             │ ExecutionNode
             ▼
┌─────────────────────────────────┐
│  Provider Runtime (RC2)         │
│   CapabilityRouter + Retry      │
│   Circuit Breaker + Fallback    │
│   Provider Policy               │
└────────────┬────────────────────┘
             │ ExecutionEvent (所有状态变化→写Event)
             ▼
┌─────────────────────────────────┐
│  ExecutionTraceRepository       │
│  ExecutionExplainProvider (RC4) │
│   Trace → ExplainDocument       │
└────────────┬────────────────────┘
             │ ExplainDocument
             ▼
         Explain Renderer (Sprint 1, 已冻结)
```

---

## 四个 RC 拆分

### RC1 — Execution Runtime Foundation

**范围:** DAG 调度引擎核心，不涉及 Provider/Planner

**产出:**
- `ExecutionGraph`, `ExecutionNode`, `ExecutionEdge` 类型定义
- `ExecutionContext` — 运行时上下文（brandId, missionId, executionId, variables, providerPolicy）
- `ExecutionArtifact` — 统一 Node 输出格式（type, payload, metadata, producer, createdAt）
- `ExecutionEvent` — 所有状态变化的事件记录（NODE_STARTED, COMPLETED, FAILED, RETRY, TIMEOUT, FALLBACK）
- `GraphStatus`, `NodeStatus` 枚举（9 种状态）
- `DAGScheduler` — Ready Queue + Dependency Resolver + 并行执行
- `ExecutionStateMachine` — 节点状态机流转

**DoD:**
- [ ] DAG 可定义 3 节点链（A→B→C），正确解析依赖
- [ ] Ready Queue 按依赖就绪自动调度
- [ ] 并行节点正确执行
- [ ] 状态变化写入 ExecutionEvent
- [ ] 编译零错误

### RC2 — Provider Runtime

**范围:** Provider 路由 + 容错，不涉及 Planner

**产出:**
- `CapabilityRouter` — 按能力路由，不绑定具体 Provider
- `ProviderPolicy` — FASTEST/CHEAPEST/MOST_RELIABLE/LOCAL_ONLY
- `RetryStrategy` — 指数退避 + jitter
- `CircuitBreaker` — N 次失败 → 熔断 M 秒
- `FallbackRouter` — 主失败 → 备用
- `DeadLetterQueue` — 最终无法处理入 Dead Letter
- `ProviderHealthService` — 延迟/错误率/熔断状态追踪

**DoD:**
- [ ] CapabilityRouter 按 Policy 返回 Provider
- [ ] Retry + 指数退避可配置
- [ ] Circuit Breaker 触发和自动恢复
- [ ] Fallback 切换生效
- [ ] 编译零错误

### RC3 — Execution Planning

**范围:** Mission → DAG 的转换逻辑

**产出:**
- `ExecutionRequest` — 统一的执行请求格式（不绑定 Mission）
- `MissionExecutionAdapter` — Mission → ExecutionRequest 转换
- `ExecutionPlanner` — ExecutionRequest → ExecutionGraph
- `CostEstimator` — 预估 Provider 成本
- `DurationEstimator` — 预估执行时间

**DoD:**
- [ ] Mission → ExecutionGraph 转换验证通过
- [ ] Planner 不依赖 Scheduler（只生成 Graph）
- [ ] 编译零错误

### RC4 — Execution Experience

**范围:** 前端 + API + Explain

**产出:**
- `POST /api/execution` — 创建执行
- `GET /api/execution/:id` — 查询执行状态
- `GET /api/execution/:id/events` — 事件流
- `ExecutionExplainProvider` — Trace → ExplainDocument（复用 Sprint 1 Renderer）
- 前端 Execution Timeline 可视化
- Dashboard 集成 Execution 状态

**DoD:**
- [ ] Execution Explain Provider 输出 ExplainDocument
- [ ] 前端 Execution Timeline 展示 DAG 流转
- [ ] Dashboard 展示执行历史
- [ ] Dogfood 全绿
- [ ] Explainability Platform 未被修改

---

## Backlog（按 RC 分组）

### RC1 — Runtime Foundation

| ID | 任务 | 工作量 |
|----|------|--------|
| GEO-301 | ExecutionGraph / ExecutionNode / ExecutionEdge 类型定义 | M |
| GEO-302 | ExecutionContext 平台对象 | S |
| GEO-303 | ExecutionArtifact 统一输出格式 | S |
| GEO-304 | ExecutionEvent 事件模型 | S |
| GEO-305 | NodeStatus / GraphStatus 状态枚举（9 种） | S |
| GEO-306 | DAGScheduler（Ready Queue + Dependency Resolver） | XL |
| GEO-307 | ExecutionStateMachine（节点状态流转） | M |
| GEO-308 | Execution 单元测试 | M |

### RC2 — Provider Runtime

| ID | 任务 | 工作量 |
|----|------|--------|
| GEO-401 | CapabilityRouter 接口 + 策略实现 | M |
| GEO-402 | ProviderPolicy 枚举（FASTEST/CHEAPEST/MOST_RELIABLE/LOCAL_ONLY） | S |
| GEO-403 | RetryStrategy（指数退避 + jitter + 可配置） | M |
| GEO-404 | CircuitBreaker（N 次失败 → 熔断 M 秒） | M |
| GEO-405 | FallbackRouter | M |
| GEO-406 | DeadLetterQueue | S |
| GEO-407 | ProviderHealthService | M |
| GEO-408 | Provider Runtime 集成测试 | L |

### RC3 — Execution Planning

| ID | 任务 | 工作量 |
|----|------|--------|
| GEO-501 | ExecutionRequest 类型定义 | S |
| GEO-502 | MissionExecutionAdapter（Mission → ExecutionRequest） | M |
| GEO-503 | ExecutionPlanner（ExecutionRequest → ExecutionGraph） | L |
| GEO-504 | CostEstimator / DurationEstimator | M |
| GEO-505 | Planner 单元测试 | M |

### RC4 — Execution Experience

| ID | 任务 | 工作量 |
|----|------|--------|
| GEO-601 | Execution API（CRUD + Event Stream） | L |
| GEO-602 | ExecutionTraceRepository | S |
| GEO-603 | ExecutionExplainProvider（Trace → ExplainDocument） | M |
| GEO-604 | 前端 Execution Timeline 组件 | L |
| GEO-605 | Dashboard 执行状态集成 | M |
| GEO-606 | Dogfood 验收场景 | M |

---

## 集成约束

### 输入
- **Mission** → `MissionExecutionAdapter` → `ExecutionRequest` → `Planner`
- **ExecutionRequest** 可来自任何来源（不绑定 Mission），后续 Knowledge/Verification 也可触发

### 输出
- **ExplainDocument**（type='execution'）— 通过 `ExecutionExplainProvider` 输出，复用 Sprint 1 Renderer
- **ExecutionEvent** — 直接写入 Repository，Timeline/Audit/Trace 均从 Event 读取

### 不修改
- Explainability Platform（Sprint 1，ADR-001 冻结）
- Discovery Engine 2.0
- Consumer Registry
- Mission Engine

---

## 附录：建议目录结构

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
