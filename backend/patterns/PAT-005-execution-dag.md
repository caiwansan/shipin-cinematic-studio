# PAT-005: Execution DAG

**适用场景：** 多步骤执行任务需要处理依赖关系、并行执行、重试和缓存

## 问题

传统的串行执行计划（Execution Plan as a list）无法表达：
- 哪些步骤可以并行
- 哪些步骤依赖前面的输出（如关键帧 → 视频）
- 哪些步骤可以独立重试
- 不同 Provider 的步骤如何调度

## 方案

```
Execution DAG（有向无环图）
    │
    ├── Keyframe（Provider A）────→ Shot 1（Provider A）
    │                                │
    ├── Character Ref──────────────→ Shot 2（Provider B）
    │                                │
    └── Audio──────────────────────→ Shot 3 + Lip Sync（Provider C）
```

### 核心机制

1. **ExecutionStep**：每个步骤包含 `stepId / type / provider / requiredCapabilities / dependencies / payload`
2. **dependencies**：表达步骤间的依赖关系（keyframe → shot → lip-sync）
3. **rootSteps**：无依赖的入口步骤（可以并行启动）
4. **Capability Planner** 负责：FilmIR → 能力匹配 → 步骤拆分 → DAG 构建

### 示例

```typescript
const dag: ExecutionDAG = {
  dagId: 'dag_xxx',
  steps: [
    { stepId: 'kf_1', type: 'keyframe', provider: 'volcengine', dependencies: [], ... },
    { stepId: 'shot_1', type: 'video', provider: 'volcengine', dependencies: ['kf_1'], ... },
    { stepId: 'lip_1', type: 'lip-sync', provider: 'veo', dependencies: ['shot_1'], ... },
  ],
  rootSteps: ['kf_1'],
}
```

## 约束

- DAG 必须是**有向无环图**（Scheduler 应做环检测）
- 每个步骤的 `requiredCapabilities` 必须可被至少一个 Provider 满足
- 步骤之间的依赖通过 `stepId` 表达（不是通过数据）
- Scheduler 可以并行执行无依赖的 rootSteps

## 相关模式

- PAT-002: Capability Adapter（Planner 通过 Capability Matrix 分配 Provider）
