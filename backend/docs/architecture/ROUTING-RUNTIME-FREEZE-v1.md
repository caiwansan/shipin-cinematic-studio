# Routing Runtime Freeze v1

> **冻结状态：STABLE** — 自 2026-06-19 Phase 2.2 完成后正式封顶。
> 本文件声明路由子系统的架构边界、冻结范围和未来禁区。

---

## 1. 当前架构

```
请求
  │
  ▼
provider-middleware.ts (orchestrator)
  │ 编排层：只做编排，不包含决策逻辑
  │
  ▼
model-selection-engine.ts (deterministic brain)
  │ 确定性评分函数：
  │   score = priority(×0.6) + capability(×0.3)
  │          - latency(×0.05) - cost(×0.05)
  │
  ▼
DB model_route_config (primary truth source)
  │ 三层降级：DB → legacy route_config → shim
  │
  ▼
Provider Handler Execution
  │
  ▼
RoutingSignal → MetricsStore (5min sliding window)
     + Provider Health (observation only)
```

## 2. 决策流程

```
resolveRoute(modelName) {
  IF USE_DB_PRIMARY_ROUTING:
    dbRoute = model_route_config.find(model)
    IF dbRoute: ↓ engine.selectRoute(candidates)
    ELSE:      ↓ legacy.resolveLegacyModelRoute(model)
  ELSE:
    legacy route (backward compatible)
  
  IF USE_SHADOW_MODE:
    compare DB route vs legacy route
    log divergence
}
```

## 3. Feature Flags

| Flag | 默认值 | 作用 |
|------|--------|------|
| `USE_DB_ROUTING` | `true` | 启用 DB 路由 shadow |
| `USE_DB_PRIMARY_ROUTING` | `false` | DB 主决策（安全观望） |
| `USE_SHADOW_MODE` | `true` | DB vs legacy 对比观测 |

## 4. 路由宪法（不可违反）

1. **确定性原则** — 相同输入永远输出相同路由决策
2. **BYOK 铁律** — 所有模型调用走用户自配 Key，平台不持有
3. **编排/决策分离** — middleware 只编排，model-selection-engine 只决策
4. **静态权重原则** — 所有权重是编译时常量，禁止运行时调整
5. **无 AI 原则** — 路由层禁止 LLM/ML/自适应算法

## 5. 冻结边界

### 锁定文件（不可新增功能）

- `runtime/provider-middleware.ts` — 编排层
- `runtime/routing/model-selection-engine.ts` — 确定性评分引擎
- `runtime/routing/routing-metrics-store.ts` — 内存信号聚合器
- `runtime/routing/routing-signal.ts` — 统一信号模型
- `services/provider-registry.service.ts` — DB 路由真相源
- `services/runtime-event-ledger.ts` — 事件日志

### 允许的变更

- Bug fix
- 可观测性增强（加日志、加字段，不影响路由逻辑）
- Provider 注册/模型路由配置（只改 DB 数据，不改代码）
- Schema 迁移兼容
- 安全补丁

### 禁止的变更

- ❌ 自适应路由
- ❌ AI/LLM 参与路由决策
- ❌ 动态权重调优
- ❌ Latency 预测
- ❌ 流量预测
- ❌ Provider 自动学习
- ❌ 任何非确定性路由逻辑

## 6. 未来 Phase 3 构想（不可执行）

> ⚠️ 以下仅为理论构想，当前不得实施。如需进入 Phase 3，需重新评估收益并得到显式授权。

- **Multi-Provider Fan-Out** — 同一请求发到多个 provider，取最优结果
- **Streaming Merge** — 多 provider 流式输出合并
- **Cost-Constrained Routing** — 在预算约束下优化 provider 选择
- **Failure Prediction** — 基于统计的 provider 故障提前预判
- **Traffic-Aware Balancing** — 根据 provider 负载动态分配

---

## 下一优先级

**P0: Workbench Runtime Persistence & Productization**

1. Workbench Snapshot System
2. Runtime Persistence Layer
3. AutoSave Engine
4. Execution Replay
5. Artifact Management
6. Asset Library
7. Multi-Session Workspace
8. Runtime Recovery
