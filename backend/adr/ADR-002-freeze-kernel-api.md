# ADR-002: Freeze Kernel API

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大 + OpenClaw
**Supersedes:** N/A

## Context

A3.5 结束时，已经建立了 8 个 Kernel API 模块（FilmLanguageIR / Diagnostics / Diff / Migration / Snapshot / ExecutionContext / CapabilityPlanner / GraphRuntime）。如果 A4 开始继续频繁修改这些接口，会导致：

- SceneGraph、Constraint Engine、Agent 等上层模块不断适配底层接口变化
- 无法积累稳定的 Benchmark
- 开发节奏停滞在"修复接口"而非"增加能力"

## Decision

冻结以下模块的接口，A4+ 只做向后兼容的扩展：

### Core Kernel
- FilmLanguageIR 类型（10 个模块）
- FilmIRMetadata / freezeFilmIR / cloneFilmIR / generateFilmIRId
- Diagnostics（Problem / Score / Summary）
- Diff Engine（diffFilmIR / formatDiff）
- Version Migration（migrateIR / registerMigration）
- Snapshot（FilmIRSnapshot / createSnapshot）

### Graph Kernel
- GraphRuntime 类型（nodes: Map + edges）
- GraphNode / GraphEdge / GraphNodeType / GraphEdgeType
- SceneGraphView / EventGraphView / TimelineView
- GraphRuntimeAPI 接口
- generateNodeId / generateEdgeId

### Execution Context
- ExecutionContext 类型（不包含任何 Provider 特定值）

### 兼容性规则

**允许：**
- 增加可选字段（`?`）
- 增加枚举值
- 增加新的 Migration 函数

**禁止：**
- 删除现有字段
- 修改现有字段类型
- 修改函数签名
- 修改评分算法

## Consequences

- 正面：上游模块可以放心依赖 Kernel API，不用担心被底层变更破坏
- 正面：Benchmark 可以在稳定接口上积累
- 正面：新团队成员只需理解一份稳定的 API Surface
- 成本：后续必须做破坏性变更时，走 `film-ir@0.2` / `@1.0` + Migration 升级路径

## Compliance

- kernel-compatibility.test.ts（14 个测试）
- 所有 Kernel API 变更必须通过 Freeze Gate
