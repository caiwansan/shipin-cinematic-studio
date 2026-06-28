# PAT-001: Immutable Object

**适用场景：** 核心数据对象（FilmLanguageIR、Diagnostics、Diff、Snapshot）需要保证不可变

## 问题

多个模块共享同一个对象时，如果某个模块直接修改字段，会导致其他模块读取到不一致的状态。传统的防御式拷贝（defensive copy）在复杂对象图中容易遗漏。

## 方案

```
创建 → freezeImmutable → 只读消费
                ↓ 需要修改时
           clone() → 新 ID + parentId → 在新对象上修改 → freezeImmutable
```

### 核心机制

1. **freeze()**：递归 `Object.freeze()` 冻结所有层级（包括嵌套对象和数组元素）
2. **clone()**：`JSON.parse(JSON.stringify())` 深拷贝 + 生成新 ID + `parentId` 记录血缘
3. **版本号 bump**：clone 时自动 `patch+1`

### 示例

```typescript
const ir = emptyFilmIR(5)
const frozen = freezeFilmIR(ir)         // 只读

const v2 = cloneFilmIR(frozen)          // 新 ID, parentId=ir.id
v2.camera.shotType = 'close-up'          // ✅ 修改的是 clone，不是原件
const frozen2 = freezeFilmIR(v2)

// Diff 在 freeze 的实例之间比较
const diff = diffFilmIR(frozen, frozen2)
```

## 约束

- 所有 Kernel 级别的数据对象必须遵循此模式
- 修改前必须 clone，禁止直接赋值
- clone 后的对象在返回给下一个模块前必须 freeze

## 相关模式

- PAT-003: Version Migration（clone 时记录版本号，支持升级）
- PAT-004: Snapshot Chain（Snapshot 本身就是 Immutable 的）
