# Architecture Freeze v1.0

> **Created:** 2026-06-29
> **Author:** 熊大
> **Status:** ✅ Approved

## 目的

记录 A4 完成后已冻结的架构决策。这份文档不是描述"现在怎么实现"，而是规定"以后只能怎样演进"。

---

## 1. 已冻结 API（不得破坏兼容）

### Compiler Frontend
- `normalizeV3(v3: NarrativeConstitutionV3): NarrativeConstitutionV3`
- `compileFromV3(v3: NarrativeConstitutionV3): FilmLanguageIR`
- 输入：必须接受 `NarrativeConstitutionV3`（不改变输入签名）
- 输出：必须返回 `Readonly<FilmLanguageIR>`（`Object.isFrozen()` 为 true）

### Graph Kernel
- `buildFromFilmIR(ir: FilmLanguageIR): { graph: GraphRuntime, validation: GraphValidationReport }`
- `validateGraph(graph: GraphRuntime): GraphValidationReport`
- `toSceneGraph()`, `toEventGraph()`, `toTimeline()`, `toDependency()` 四种投影视图

### Capability Planner
- `planFromGraph(graph: GraphRuntime): CapabilityPlan`
- 输出必须使用 level 体系（`full | partial | none`），不得使用 boolean
- 输出中不得出现任何 Provider 名称

### Capability Negotiator
- `negotiate(plan: CapabilityPlan, environment: ExecutionEnvironmentCapabilities): ExecutableCapabilityPlan`
- 必须使用 Capability ID 命名空间（`film.camera.path` 格式）
- **Negotiator Never Invents Capability**（只能保留/降级/拒绝，不能新增）

### Execution Planner
- `buildExecutionDAG(plan: ExecutableCapabilityPlan): { dag: ExecutionDAG, contract: ExecutionContractReport }`
- DAG 节点必须是 Capability Node（不包含 Provider 名 / Worker 名）
- DAG 边必须是 `depends-on` 类型

### Worker Runtime Bridge
- `bridgeDAG(dag: ExecutionDAG, projectId: string, userId: string): { tasks, trace, diagnostics }`
- **Bridge Never Changes the DAG**（不能增删改节点或依赖）
- **Bridge is a Translator, not a Planner**（不重写 worker-runtime）

---

## 2. 模块变更权限（扩展点 / 禁止区）

### 允许扩展的模块
| 模块 | 扩展方式 |
| --- | --- |
| Compiler | 新增 V4/V5 Normalizer 后追加 `compileFromV4()` |
| Graph Builder | 新增投影视图（如 Audio View / Emotion View） |
| Capability Planner | 新增能力类型（新增 FILM_CAPABILITIES 条目） |
| Capability Negotiator | 新增降级策略（新增 FALLBACK_STRATEGIES） |
| Worker Runtime Bridge | 新增 Task 类型映射（新增 CAPABILITY_TO_TASK_TYPE） |

### 禁止修改的模块
| 模块 | 禁止操作 |
| --- | --- |
| Compiler Contract | 禁止修改已冻结的 `Guarantees`（Immutability / Determinism / Agnostic） |
| Graph Runtime 接口 | 禁止修改 `GraphRuntimeAPI` 已冻结方法签名 |
| Execution Planner 输出格式 | 禁止在 DAG Node 中添加执行逻辑字段 |
| Negotiator | 禁止让 Negotiator 读取 Provider 信息 |
| Bridge | 禁止修改 DAG |

---

## 3. 新增能力的扩展流程

新增一种电影制作能力（如 `film.audio.waveform`）的流程：

```
Step 1: Compiler 层     → 新增 FilmLanguageIR 字段（向后兼容）
Step 2: Graph 层        → 新增边类型（如 audio-sync）
Step 3: Capability 层   → FILM_CAPABILITIES 新增条目
Step 4: Negotiator 层   → 可选新增 FALLBACK_STRATEGIES
Step 5: Bridge 层       → CAPABILITY_TO_TASK_TYPE 新增映射
Step 6: 测试            → Compiler Benchmark Hash 一致
```

任何新增能力**不能**修改现有的：
- Compiler Contract
- Graph Runtime 接口
- Capability Planner 输出格式
- Negotiator 输入输出签名
- Execution DAG 结构

---

## 4. 版本与变更管理

Architecture Freeze 版本：**v1.0**

变更此 Freeze 需要：
1. 影响评估（必须明确列出所有受影响模块的签名变化）
2. 所有 196+ 测试通过
3. Compiler Benchmark Hash 一致
4. 熊大审批

---

## 5. A4 Completion Checklist

- [x] A3.5 Kernel Freeze — Kernel API 契约冻结
- [x] S1 — Compiler v0（Normalizer + Compiler Contract）
- [x] S2 — Semantic Graph Builder（四视图 + Validator）
- [x] S3.1 — Capability Planner（理想能力，Provider 不可见）
- [x] S3.2 — Capability Negotiator（Negotiator Never Invents）
- [x] S3.3 — Execution Planner（声明式 DAG + Execution Contract）
- [x] S3.5 — DAG Simulator（拓扑排序验证）
- [x] S4 — Worker Runtime Bridge（Bridge Never Changes DAG）
- [ ] A4.5 — Production Validation
- [ ] Architecture Freeze v1.0 已审阅
