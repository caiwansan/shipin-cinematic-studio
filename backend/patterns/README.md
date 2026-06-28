# Architecture Patterns

> 本目录记录昆仑镜架构中经过验证的可复用设计模式。
> 任何模块需要新增关键架构设计时，应首先查是否已有对应 Pattern。
> AI Agent 写代码时，应优先参考已有 Pattern，而不是重新设计。

## 索引

| 编号 | 模式 | 层级 | 适用场景 |
|------|------|------|----------|
| PAT-001 | Immutable Object | Kernel | 数据对象不可变，修改时 clone |
| PAT-002 | Capability Adapter | Extension | 模块不感知 Provider，只感知能力 |
| PAT-003 | Version Migration | Kernel | 数据结构升级时做向后兼容 |
| PAT-004 | Snapshot Chain | Pipeline | 完整制作状态的快照链 |
| PAT-005 | Execution DAG | Pipeline | 多步骤执行的有向无环图 |
| PAT-006 | Triple View Projection | Graph | 同一份图数据的三个投影视图 |
