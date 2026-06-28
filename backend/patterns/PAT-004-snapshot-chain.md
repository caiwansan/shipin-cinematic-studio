# PAT-004: Snapshot Chain

**适用场景：** 需要记录、回放或恢复完整的制作状态

## 问题

多 Agent 协同编辑时，每个 Agent 修改都会改变系统状态。如果没有快照机制：
- Agent 之间无法共享状态
- 无法回滚到之前的版本
- 崩溃后无法恢复
- 无法对历史状态做 Diff

## 方案

```
Snapshot v1  ←  baseline
    │
    ├── Snapshot v2  ←  Camera Agent 修改后
    │       │
    │       └── Snapshot v3  ←  Lighting Agent 修改后
    │
    └── Snapshot v4  ←  Physics Agent 修改后（并行分支）
```

### 核心机制

1. **三件套**：每份 Snapshot 包含 `filmIR + context + diagnostics`
2. **Transform Record**：每次修改记录 `{ agent, reason, changes, confidence }`
3. **血缘链**：`parentSnapshotId` 形成链条，支持 Undo / Redo
4. **`createSnapshot()`**：从冻结的 FilmIR 创建 Snapshot

### 示例

```typescript
const base = createEmptySnapshot(freezeFilmIR(ir))

// Agent 修改后产生新快照
const v2 = createSnapshot(freezeFilmIR(v2IR), {
  parentSnapshotId: base.snapshotId,
  source: 'camera-agent',
  transformHistory: [{
    agent: 'camera-agent',
    reason: '补充 Camera Path',
    changes: ['camera.movement=dolly-in'],
    confidence: 0.91,
    timestamp: new Date().toISOString(),
  }],
})
```

## 约束

- Snapshot 不可变（创建后不能修改）
- 每个 Agent 的输出都是一个 Snapshot
- Pipeline 是 Snapshot 链

## 相关模式

- PAT-001: Immutable Object（Snapshot 中的 filmIR 必须是冻结的）
- PAT-003: Version Migration（Snapshot 中的 IR 版本应与当前 Schema 兼容）
