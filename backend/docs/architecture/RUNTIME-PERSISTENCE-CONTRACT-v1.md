# Runtime Persistence Contract v1

> **Phase W.0 — 契约冻结，禁止在 W.0 阶段写任何 Serializer/Snapshot/Replay 逻辑。**

---

## 1. RuntimeStateV1 Schema

```typescript
interface RuntimeStateV1 {
  schemaVersion: '1.0'          // Schema 版本（用于未来迁移）
  workbenchId: string           // 工作台唯一标识
  metadata: {
    type: 'ppt' | 'storyboard' | 'novel'
    title?: string
    createdAt?: string
    updatedAt?: string
  }
  entities: Record<string, unknown>   // 实体池
  graph: {
    nodes: unknown[]
    edges: unknown[]
  }
  runtime: Record<string, unknown>    // 子系统状态
  artifacts: {
    images: unknown[]
    videos: unknown[]
    audio: unknown[]
    documents?: unknown[]
  }
  uiState: Record<string, unknown>
}
```

## 2. RuntimeAdapter Contract

```typescript
interface RuntimeAdapter {
  serialize(): Promise<RuntimeStateV1>
  deserialize(state: RuntimeStateV1): Promise<void>
}
```

每个工作台类型（ppt/storyboard/novel）必须实现此接口。

## 3. Serialization Invariants

```text
serialize(deserialize(serialize(runtime)))
    → 必须产生等价的 RuntimeStateV1
```

即：序列化→反序列化→再序列化，两次结果必须语义等价。

## 4. Snapshot Lifecycle

```
用户操作
    ↓
RuntimeAdapter.serialize()
    ↓
RuntimeStateV1
    ↓
WorkbenchSnapshot (DB)
    ↓
恢复时：
WorkbenchSnapshot (DB)
    ↓
RuntimeAdapter.deserialize(state)
    ↓
Runtime 恢复
```

## 5. Recovery Lifecycle

```
打开工作台
    ↓
load latest snapshot by workbenchId
    ↓
RuntimeAdapter.deserialize(snapshot.state)
    ↓
Runtime 恢复
    ↓
开始工作
```

## 6. Replay Dependencies

Replay 的完整依赖链：

```text
WorkbenchOperationLedger (Phase W.3)
    ↓
有序事件日志
    ↓
ReplayRuntime
    ↓
可视化回放
```

**当前状态：** Replay 尚未进入设计阶段。必须先完成 W.3 WorkbenchOperationLedger。

## 7. Compatibility Rules

### Append-only 原则

RuntimeStateV1 是 append-only，禁止：

- ❌ 删除字段
- ❌ 重命名字段
- ❌ 变更字段语义

允许：

- ✅ 新增 optional 字段
- ✅ 增加 deprecation 标记

### 版本升级规则

```
V1 → V2：新增字段必须 optional
V2 → V3：同前，必须提供迁移函数
```

禁止任何 breaking change 不附带 migration path。

---

## Phase W 执行顺序

| Phase | 内容 | 状态 |
|-------|------|------|
| W.0 | RuntimePersistenceContract | **当前（冻结）** |
| W.1 | Unified Snapshot Layer | 未开始 |
| W.2 | Runtime Serializer | 未开始 |
| W.3 | Workbench Operation Ledger | 未开始 |
| W.4 | AutoSave Engine | 未开始 |
| W.5 | Runtime Recovery | 未开始 |
| W.6 | Replay Foundation | 未开始 |
| W.7 | Replay Runtime | ❌ 不做 |

## Constitution

1. **W.0.1** — RuntimeStateV1 是 append-only，禁止删除/重命名字段
2. **W.0.2** — RuntimeAdapter 是所有工作台的唯一序列化入口
3. **W.0.3** — 禁止绕过 RuntimeAdapter 直接操作 RuntimeState
4. **W.0.4** — 未来升级到 V2 时必须提供 migration path
5. **W.0.5** — 禁止在 W.0 阶段写任何 Serializer/Snapshot/Replay 逻辑
6. **W.1.1** — 所有历史 Snapshot 系统必须通过 Adapter 兼容，禁止结构性迁移旧数据模型
7. **W.1.2** — 禁止重写 legacy schema。Adapter 是桥梁，不是拆迁队
