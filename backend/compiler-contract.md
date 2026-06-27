# Compiler Contract v0

> **Date:** 2026-06-29
> **Status:** ✅ Approved

## Purpose

定义 `compileFromV3()` 作为 FilmLanguageIR 唯一正式入口的契约规范。
任何实现或重写此 Compiler 的代码必须满足以下全部保证。

## Input

```typescript
NarrativeConstitutionV3  // LLM 输出的世界模型
```

## Output

```typescript
Readonly<FilmLanguageIR> // 冻结的电影语言中间表示
```

## Guarantees

### ① Immutable

- 输出经过 `freezeFilmIR()`，`Object.isFrozen()` 为 `true`
- 所有嵌套对象和数组元素均已冻结
- 调用方无需防御性拷贝

### ② Deterministic

- 相同输入永远产生相同输出
- 不依赖随机数、时间戳、外部状态
- 输出中唯一可能变化的字段是 `metadata.id`（但不影响语义等价性）

### ③ Provider Agnostic

- 代码中不出现任何 Provider 名称（volcengine / veo / seedance / aliyun）
- 不推断模型能力
- 不查询 Capability Matrix

### ④ Schema Valid

- 输出的 `FilmLanguageIR` 满足所有类型约束
- 不允许字段缺失或 null（除非类型定义为可选）
- `metadata.createdBy` 标记为 `film-compiler@0.1`

### ⑤ Stable Identifier

- `metadata.id` 格式：`filmir_{timestamp}_{random}`
- `metadata.schemaVersion` 为 `film-ir@0.1`

### ⑥ Complete Metadata

```typescript
{
  id: string              // filmir_{timestamp}_{random}
  version: string          // "0.1.0"
  createdBy: string        // "film-compiler@0.1"
  createdAt: string        // ISO 8601
  source: string           // "film-compiler-v3"
  confidence: number       // 1.0（Compiler 输出确定性 100%）
  schemaVersion: string    // "film-ir@0.1"
}
```

## Non-guarantees（Compiler 不负责）

| 责任 | 归属 |
|------|------|
| 引用资产解析（references） | Reference Resolver |
| 角色参考图匹配 | Asset Service |
| Provider 能力匹配 | Capability Matrix |
| 执行调度 | Scheduler |
| 约束冲突解决 | Constraint Engine |

## 变更流程

修改 Compiler Contract 需要通过以下审查：
1. ADR 审查（是否影响 Kernel Freeze）
2. Deterministic Test 通过
3. Compiler Benchmark Hash 一致
