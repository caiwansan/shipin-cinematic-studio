# ADR-007: Stable Identifier Principle

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

A3.5 实现了 clone / Migration / Diff / Snapshot 等生命周机制。但在没有稳定 ID 的情况下：
- Migration 后无法追踪对象的原始身份
- Clone 后对象与源对象的关系难以表示
- Diff 只能比较值，不能追踪"哪个对象变了"
- 多 Agent 协同编辑时无法判定"谁改了什么"

## Decision

**所有核心对象使用永久稳定 ID，ID 格式包含前缀 + 时间戳 + 随机因子。**

| 对象 | ID 格式 | 生成函数 |
|------|---------|----------|
| FilmIR | `filmir_{timestamp}_{random}` | `generateFilmIRId()` |
| Snapshot | `snap_{timestamp}_{random}` | `generateSnapshotId()` |
| Graph Node | `node_{timestamp}_{random}` | `generateNodeId()` |
| Graph Edge | `edge_{timestamp}_{random}` | `generateEdgeId()` |

即使经过 Migration / Clone / Merge / Split：
- 新对象获得新 ID（独立身份）
- 通过 `parentId` 记录血缘关系
- Diff Engine 使用 ID 追踪变更，而非值比较

## Consequences

- 正面：对象的生命周期可以完整追踪（Create → Clone → Migrate → Diff → Snapshot）
- 正面：多 Agent 协同编辑时可以判定冲突
- 正面：Diff Engine 可以产生精确的变更记录
- 正面：Undo / Redo 和崩溃恢复可以基于 Snapshot 链
- 成本：不能使用自增数字或短 ID，需要足够的随机性保证 ID 唯一性

## Compliance

- Drift Detector ⑩ 号规则：检测 ID 生成函数是否包含随机因子
- Kernel API 中所有 ID 生成函数必须使用 `Math.random()`
