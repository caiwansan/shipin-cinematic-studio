# PAT-003: Version Migration

**适用场景：** 数据结构升级时需要对历史数据做向后兼容

## 问题

随着平台演进，FilmLanguageIR 的 Schema 会变化。如果没有 Migration 机制：
- 旧项目打开时会因字段缺失而崩溃
- 新旧版本数据无法共存
- 回滚部署时数据格式不兼容

## 方案

```
旧版本 IR
    │
    ▼
Migration Chain（0.1.0 → 0.1.1 → 0.2.0 → ...）
    │
    ▼
当前版本 IR
```

### 核心机制

1. **版本号**：所有 FilmIR 实例携带 `metadata.version`（semver 格式）
2. **Migration 注册**：每个版本升级注册一个迁移函数
3. **自动链式升级**：`migrateIR(ir, targetVersion)` 自动执行从当前版本到目标版本的所有迁移

### 示例

```typescript
// 注册迁移
registerMigration('0.1.0', '0.2.0', (ir) => ({
  ...ir,
  scene: { ...ir.scene, year: ir.scene.year || 'unknown' },
}))

// 自动升级
const migrated = migrateIR(oldIr, '0.2.0')
```

### 向后兼容规则

| 变更类型 | 处理方式 |
|----------|----------|
| 增加可选字段 | 无需 Migration（`?` 已兼容） |
| 增加必填字段 | 需 Migration（旧数据补默认值） |
| 删除字段 | 不可行（必须保留或标记 deprecated） |
| 修改字段类型 | 不可行（必须推 `film-ir@1.0`） |

## 约束

- 破坏性 Schema 变更必须推新主版本（`film-ir@1.0`）
- 旧版本通过 Migration 升级，不同版本可在 Pipeline 中共存
- Migration 函数必须是确定性的（同一输入永远产生同一输出）

## 相关模式

- PAT-001: Immutable Object（Migration 输入是冻结的 IR）
