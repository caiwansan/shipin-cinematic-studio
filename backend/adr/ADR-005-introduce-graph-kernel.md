# ADR-005: Introduce Graph Kernel

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

A4 需要实现 SceneGraph（空间关系）、EventGraph（事件关系）、Timeline（时间关系）。如果分别实现三个独立模块，会导致：

- 重复的数据同步逻辑
- 修改角色位置需要同时更新多个结构
- Constraint Engine 需要从不同数据源拉取信息
- 跨视图一致性难以保证

## Decision

**建立 Graph Kernel，Scene / Event / Timeline 只是同一份图数据的不同投影视图。**

```
Graph Kernel（Canonical Graph — Map<id, Node> + Edges）
        │
   ┌────┼────┐
   ▼    ▼    ▼
Scene  Event Timeline
View   View   View
```

- 底层一份统一图数据
- 三种 View 只是查询投影，不独立存储
- 所有节点和边使用稳定 ID（`node_xxx` / `edge_xxx`）
- Constraint Engine 跨视图检查一致性

## Key Principle

> **Graph Runtime 不存储信息，只表达关系。**

FilmLanguageIR 保存数据（角色属性、镜头参数、环境描述）。
Graph Runtime 保存关系（谁影响谁、谁依赖谁、谁触发谁）。

Graph 不重复存储 Film Language IR 中的字段值。
Graph 只存储：Shot01 --uses--> Camera01。

这样 SSOT 才能真正成立：
- FilmIR = 数据的唯一来源
- Graph = 关系的唯一来源

## 视图

| 视图 | 表达的关系 | 消费者 |
|------|-----------|--------|
| Scene View | 空间关系（located_in / stands_in / holds） | Constraint Engine |
| Event View | 事件关系（causes / triggers / interacts） | Timeline Builder |
| Timeline View | 时间关系（follows / overlaps / contains） | Scheduler |
| Dependency View | 执行依赖（keyframe -> shot -> lip-sync） | Capability Planner / Scheduler |

## Consequences

- 正面：修改一个节点自动在所有视图中反映
- 正面：新增视图只需新的投影函数
- 正面：Diff Engine 可以比较图级别的变更
- 正面：Dependency View 使 Scheduler 直接消费 Graph
- 成本：需要 A4 完整实现 Builder + View Projector + Consistency Checker

## Compliance

- graph-runtime.ts 接口已冻结（A3.5）
- Stable Identifier Principle 确保节点和边 ID 永久稳定
- Graph Validator 检查：孤立节点 / 循环依赖 / 不存在引用 / 重复边 / 非法关系
