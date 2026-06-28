# A3.5 Kernel Freeze & Compatibility

> 目标：冻结 A3 Kernel API，建立兼容性保障，为 A4+ 奠定稳定基础。
>
> 哲学：不增加任何新功能，只做 API 锁定、兼容性测试、回归基线、性能基线、文档基线。

## 冻结范围

以下模块视为 **Kernel API**，A4+ 只做向后兼容的扩展：

| 模块 | 文件 | 冻结状态 |
|------|------|----------|
| FilmLanguageIR 类型 | `runtime/film-language-ir.ts` | ✅ 冻结 v0.1 |
| FilmIRMetadata | `runtime/film-language-ir.ts` | ✅ 冻结 v0.1 |
| freezeFilmIR / cloneFilmIR | `runtime/film-language-ir.ts` | ✅ 冻结 |
| Diagnostics | `runtime/film-ir-diagnostics.ts` | ✅ 冻结 v0.1 |
| Diff Engine | `runtime/film-ir-diff.ts` | ✅ 冻结 v0.1 |
| Transform Record（内嵌于 Diff） | `runtime/film-ir-diff.ts` | ✅ 冻结 |
| Version Migration | `runtime/film-ir-version.ts` | ✅ 冻结 v0.1 |
| Capability Planner（接口） | `runtime/capability-planner.ts`① | 🚧 接口定义 |
| Execution Context | `runtime/execution-context.ts` | ✅ 冻结 v0.1 |

> ① Capability Planner 在 A3.5 只定义接口不实现，A4 实现。

## 兼容性规则

### 向后兼容扩展允许
- FilmLanguageIR 增加**可选**字段（`?`）
- diagnostics 增加 ProblemCategory 枚举值
- diff 增加新的 diff 类型
- migration 增加新的 `0.1.x → 0.1.y` 迁移函数

### 破坏性变更禁止
- 删除 FilmLanguageIR 任何现有字段
- 修改已有字段类型
- 修改 freezeFilmIR / cloneFilmIR 签名
- 修改 Diagnostics 评分算法
- 修改 Diff 输出结构

### 版本分隔
- 如果未来必须做破坏性变更：`film-ir@0.2` 或 `film-ir@1.0`
- 旧版本通过 Migration 升级，不同版本并在 pipeline 中共存

## 兼容性测试

A3.5 新增 `compatibility.test.ts`，覆盖：
1. 所有 Kernel API 模块编译通过
2. emptyFilmIR() 产生合法结构
3. freezeFilmIR() 后 Object.isFrozen 为 true
4. cloneFilmIR() 产生新 id + parentId
5. aggregateDiagnostics() 评分算法稳定
6. diffFilmIR() 输出结构稳定
7. RegisterMigration → migrateIR 版本升级
8. 模块之间可互相消费（filmIR → diagnostics → diff → migration）

## 性能基线

| 操作 | 目标 | 当前（估算） |
|------|------|-------------|
| freezeFilmIR | < 1ms | ~0.3ms |
| cloneFilmIR | < 2ms | ~1ms |
| diffFilmIR（10 字段变更） | < 3ms | ~1ms |
| aggregateDiagnostics（20 problems） | < 1ms | ~0.5ms |
| migrateIR（无实际迁移链） | < 0.1ms | ~0.05ms |

## Graph Contract（A3.5 冻结为接口契约，A4 实现为完整内核）

Graph Runtime 的接口和类型定义已冻结，属于第二个核心内核（Graph Kernel）。

### 冻结内容

```
GraphRuntime 类型（统一底层图数据，nodes: Map<string,GraphNode> + edges）
GraphNode / GraphEdge / GraphMetadata
GraphNodeType / GraphEdgeType（枚举值）
SceneGraphView / EventGraphView / TimelineView（投影视图类型）
GraphRuntimeAPI 接口（build / addNode / addEdge / 三视图 / checkConsistency）
generateNodeId() / generateEdgeId()（Stable Identifier）
```

### 向后兼容规则

与 Film Pipeline Kernel 一致：
- 允许增加可选字段、新增 GraphNodeType 枚举值、新增 GraphEdgeType 枚举值
- 禁止删除/修改现有字段、修改接口签名

---

## 治理规则（Drift Detector）

| # | 规则 | 级别 | 说明 |
|---|------|------|------|
| ⑥ | Zero-Business Adapter | Phase A warn | Adapter 不做业务推断 |
| ⑦ | SSOT | Phase A warn | Agent 不重新解析 Narrative |
| ⑧ | No Silent Mutation | Phase A warn | 不直接修改 filmIR |
| ⑨ | No Kernel Dependency Leak | **Zero Tolerance** | Kernel 不依赖 Extension |
| ⑩ | **Stable Identifier Principle** | **Zero Tolerance** | 核心对象使用稳定 ID |

---

## 文档基线

A3.5 产出：
- [ ] Kernel API 参考（本文档）
- [ ] 破坏性变更策略（migration + version bump）
- [ ] 各模块的边界契约（输入/输出/责任）
