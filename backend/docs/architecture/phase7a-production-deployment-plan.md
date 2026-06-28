# Phase 7A Production Deployment Plan

> 将 self-modifying execution OS 从设计验证 → 可部署生产级 runtime

## 0. 目标

构建一个 **deterministic, observable, rollback-safe execution runtime**，满足：
- 可部署（dist/ runtime bundle）
- 可恢复（checkpoint + replay）
- 可观测（event stream + metrics）
- 可隔离（3 层运行模式）
- 可回滚（execution / graph / policy 粒度）

---

## 1. dist/ 目标结构

```
dist/
├── runtime/
│   ├── kernel.bundle.js              ← 内核：SYNC/STREAM/ASYNC router
│   ├── async.runtime.js              ← 异步 tick loop
│   ├── stream.runtime.js             ← Stream plane 独立 runtime
│   ├── mutation.runtime.js           ← Mutation engine（可控关闭）
│   ├── optimization.runtime.js       ← 优化 loop（shadow/prod 切换）
│   └── policy.runtime.js             ← Policy 引擎+演化
├── transport/
│   ├── sse.server.js                 ← SSE 事件流
│   └── event.gateway.js              ← 内部事件总线网关
├── persistence/
│   ├── execution.store.js            ← 执行记录存储
│   └── checkpoint.store.js           ← 检查点存储
├── config/
│   ├── execution.config.json         ← 运行时配置
│   └── safety.constraints.json       ← 安全约束
├── observability/
│   ├── metrics.js                    ← 指标采集
│   └── trace.js                      ← 追踪
└── entry/
    └── server.js                     ← 启动入口
```

---

## 2. Runtime Boot Sequence

```
server.js
    ↓
load config/  (execution.config.json + safety.constraints.json)
    ↓
init KernelExecutionBus  (事件路由)
    ↓
init Kernel  (SYNC / STREAM / ASYNC 路由器)
    ↓
init EventMirror  (执行事件镜像)
    ↓
init SSE Transport  (对外事件流)
    ↓
init Persistence Layer  (执行存储 + 检查点)
    ↓
init Mutation Engine  (默认 OFF — SAFE mode)
    ↓
init Optimization Loop  (默认 SHADOW mode)
    ↓
init Policy Engine  (快照模式)
    ↓
start runtime loop
```

---

## 3. 三层运行模式

### 🟢 MODE 1 — SAFE EXECUTION（默认生产）
```
mutation       = OFF
optimization   = observation only
policy         = frozen snapshot
```
**用途：** 承载 production traffic
**保证：** 零自修改风险，纯执行

### 🟡 MODE 2 — SHADOW OPTIMIZATION
```
mutation       = OFF
optimization   = running in shadow mode
baseline vs optimized plan = compared
```
**用途：** 验证优化系统在真实流量下的效果
**保证：** 影响 production 路径，但结果只记录不执行

### 🔴 MODE 3 — CONTROLLED EVOLUTION
```
mutation       = ON (FORKED only)
formal guard   = STRICT
policy evolution = bounded
```
**用途：** batch / offline / test cluster
**保证：** 所有 mutation 经过 formal proof，可回滚

---

## 4. Runtime Safety Constraints

```json
{
  "mutationGuard": {
    "enabled": true,
    "requireProof": true,
    "requireDagAcyclicity": true,
    "requireReplayEquivalence": true
  },
  "crossPlaneIsolation": {
    "kernelTransport": "forbidden_import",
    "mutationExecution": "event_only",
    "optimizationKernel": "read_only"
  },
  "asyncRuntime": {
    "independentTickLoop": true,
    "noStreamDependency": true
  },
  "rollback": {
    "triggers": [
      "proof_failure",
      "drift_threshold_exceeded",
      "mutation_instability"
    ],
    "granularity": ["execution_instance", "graph_version", "policy_version"]
  }
}
```

---

## 5. Observability Layer

### Event Streams
```
execution.events      → 执行生命周期
mutation.events       → 变异事件
optimization.events   → 优化决策
policy.events         → 策略演化
replay.events         → 重放事件
```

### Metrics
```
latency_p50/p95/p99
mutation_rate         → mutations/min
rollback_count        → 累计回滚次数
drift_index           → 策略漂移指数
dag_complexity        → DAG 节点/边数追踪
replay_consistency    → 重放一致性比例
```

---

## 6. Rollback System

### Triggers
- **Proof failure**: formal guard 拒绝 mutation → 回滚到上一个已验证版本
- **Drift threshold exceeded**: 策略漂移超过阈值 → 回滚到基线策略
- **Mutation instability**: 连续突变导致性能退化 → 回滚到稳定版本

### Granularity
| 粒度 | 范围 | 回滚成本 |
|------|------|----------|
| execution instance | 单次执行 | 低 |
| graph version | 变异版本 | 中 |
| policy version | 策略快照 | 低 |

---

## 7. Deployment Modes Matrix

| Mode | Mutation | Optimization | Safety | 用途 |
|------|----------|-------------|--------|------|
| SAFE | OFF | OFF | MAX | production |
| SHADOW | OFF | ON (shadow) | HIGH | eval/validation |
| EVOLVE | ON (fork) | ON | STRICT | research/batch |

---

## 8. Key Engineering Facts

- **Not a single runtime** — 3-layer controllable execution system
- **Self-modification is not runtime behavior** — it's a *controlled mode switch*
- **Safe mode = zero mutation risk** — 纯执行，无自修改
- **Shadow mode = zero production impact** — 优化运行在旁路
- **Evolve mode = fully guarded** — 经过 formal proof 的受控演化

---

## 9. Deployment Principle

> **Self-modification is not runtime behavior — it is a controlled mode switch.**

Mutation 不是内核默认路径。它是你主动选择进入的模式。默认路径是纯执行——确定、可观测、不回滚。

---

## 10. Phase 7A 完成态交付定义

当 `dist/` 实现后，系统拥有：

- ✅ deterministic execution OS
- ✅ bounded mutation system
- ✅ formal proof guarded evolution
- ✅ observable optimization loop
- ✅ replayable execution history
- ✅ production-safe runtime modes

---

## 11. dist/ Builder 计划

```
scripts/
├── build-dist.sh              ← 主构建脚本
├── runtime-integrity.sh        ← 运行时完整性检查
```

### Build 步骤
1. `tsc` 编译 kernel + runtime
2. 按 dist/ 结构组织输出
3. 注入运行模式配置文件
4. 运行完整性检查
5. 输出 dist/ 报告

---

## 12. 状态

- Phase 7A 理论: **CLOSED**
- Phase 7A SAT: **PASSED**
- Phase 7A 生产化: **IN PROGRESS** ← 我们在这里
