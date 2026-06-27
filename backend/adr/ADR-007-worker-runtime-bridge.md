# ADR-007: Worker Runtime Bridge

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

A4 声明式流水线（V3 → Normalizer → Compiler → Graph → Planner → Negotiator → Execution DAG）已冻结。
S4 需要将声明式 Execution DAG 接入现有 `worker-runtime.ts`。

有两种方向：

**A) Bridge — 纯翻译层**
```
Execution DAG → Bridge → Worker Tasks → worker-runtime
```
- Bridge 只做 Node → Task 映射
- 不修改 DAG，不重写 Runtime
- 支持 Legacy + New Pipeline 双运行模式

**B) Rewrite — 重写 worker-runtime**
- 替换现有 worker 调度逻辑
- 高风险，涉及 50 镜头短剧生产链

## Decision

**采用 A：Bridge — 纯翻译层。**

```
Execution DAG（声明式）
    │
    ▼
Worker Runtime Bridge（Adapter 模式）
    │  ├── DAG Node → Worker Task
    │  ├── Dependency → 执行顺序
    │  ├── Capability → Worker 参数
    │  └── Execution Trace（可回放）
    │
    ▼
Worker Task[] → worker-runtime.ts（现有，不改）
```

## Governance

### Bridge Never Changes the DAG
- Bridge 不能增加、删除、修改 DAG Node 或 Dependency
- 不能补 Capability
- 发现 DAG 问题 → 返回 Diagnostics，不修正

### Bridge is a Translator, not a Planner
- Bridge 不重写 worker-runtime
- Bridge 不修改 Execution Planner 输出
- Bridge 不调度、不重试、不超时

## Key Design

### Dual Mode（双运行模式）

保留 Legacy 和 New 两条链：
- **Legacy:** `V3 → worker-runtime`（现有，不改）
- **New:** `V3 → Compiler → Graph → Planner → Negotiator → DAG → Bridge → worker-runtime`

用于 A4.5 的对比验证。

### Execution Trace

Bridge 输出 Trace 记录：
```yaml
dagNodeId: dag_node_xxx
workerTaskId: task_001
capability: film.render.shot
executionOrder: 1
workerParams: { ... }
```

用于 Production Replay（可回放 Pipeline，无需重新解析）。

## Consequences

- 正面：Legacy Pipeline 不受影响
- 正面：Bridge 失败不影响旧流程
- 正面：Trace 可驱动 Production Replay
- 成本：双运行模式需要维护两套路径
- 成本：Bridge 需要保持与 DAG 契约同步

## Compliance

- Bridge Never Changes the DAG
- Bridge is a Translator, not a Planner
