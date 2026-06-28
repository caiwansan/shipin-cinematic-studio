# A4.5 Production Validation Plan

> **Status:** 🚧 Planned
> **Phase After:** A4 Graph Kernel 实现完成
> **Goal:** 验证双 Kernel 架构能否支撑真实生产负载，而非仅通过单元测试

## Validation Benchmark

### 数据规模

| 维度 | 当前（A3.5） | A4.5 目标 |
|------|-------------|-----------|
| 单片段镜头数 | 1 | **50** |
| 角色数 | 1-2 | **5-10** |
| 场景数 | 1 | **3-5** |
| Provider 数 | 1（volcengine） | **2-3** |
| 约束类型 | 1（physics） | **5+** |

### 验证流程

```
短剧片段（50 镜头）
        │
        ▼
    FilmLanguageIR
        │
        ▼
    Graph Runtime（节点数、边数、三视图投影）
        │
        ▼
    Capability Planner（多 Provider 拆分）
        │
        ▼
    Execution DAG（并行度、依赖链长度）
        │
        ▼
    Scheduler（总耗时、重试率）
        │
        ▼
    Provider Adapter（字段映射正确性）
```

### 观测指标

| 指标 | 目标 | 说明 |
|------|------|------|
| Graph 节点数 | < 500/node | 50 镜头合理上限 |
| Graph 构建耗时 | < 10ms | 单请求内完成 |
| Scene View 投影 | < 2ms | 投影计算 |
| Event View 投影 | < 2ms | 投影计算 |
| Timeline View 投影 | < 2ms | 投影计算 |
| Consistency Check | < 5ms | 全图一致性检查 |
| Capability Planner | < 20ms | 50 镜头计划 |
| Execution DAG 节点数 | < 100 | 合理 DAG 大小 |
| Diff 生成 | < 5ms | 两次 pipeline 之间 |
| Snapshot 创建 | < 1ms | 序列化状态 |

### 验收标准

1. **功能完整**：三视图投影正确，约束检查无遗漏
2. **性能达标**：所有指标在目标范围内
3. **可重复**：同一份 FilmIR 两次 pipeline 产生一致的 Graph + Views
4. **可回放**：从 Snapshot 链可以完整重建任一中间状态
5. **可替换**：更换 Provider 只需修改 Capability Matrix，不需修改 Agent

## 风险清单

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Graph 节点过多 | 中 | 性能下降 | 限制单 graph 上限 |
| 多 Provider 调度死锁 | 低 | 任务卡死 | DAG 环检测 |
| Snapshot 链过长 | 中 | 内存膨胀 | 定期压缩 + 归档 |
| FilmIR 与 Graph 不一致 | 低 | 数据错误 | Consistency Check 自动报警 |
