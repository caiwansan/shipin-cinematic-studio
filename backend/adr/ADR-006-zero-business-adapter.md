# ADR-006: Zero-Business Adapter

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

早期 Video Adapter 包含大量业务推断逻辑：
- `if (narrative.includes("慢慢")) cameraMovemen = "gentle"`
- `if (narrative.match(/推/)) cameraMovemen = "push"`
- 从文本中推断运镜、景别、天气等信息

这导致：
- Adapter 不可被其他 Provider 复用
- 修改 Prompt 或 FilmIR Schema 时，Adapter 也需要同步修改
- 业务逻辑跑到了架构的最底层，难以管理和测试

## Decision

**Adapter 只做字段映射（Field Mapping），不做业务推断。**

```
FilmLanguageIR    ← 所有推断在 Planner / Compiler 层完成
        │
        ▼
Provider Adapter  ← 只做格式转换
        │
        ▼
Provider API
```

Adapter 只允许：
- 字段名映射（FilmIR.camera.movement → Provider.cameraMotion）
- 值格式转换（enum → Provider 特定枚举）
- 技术兼容性处理（如图片宽高比检查）

Adapter 不允许：
- 从 narrative 中推断运镜/景别/天气
- 修正或补充 filmIR 字段
- 对不同 Provider 做不同的业务策略判断

## Consequences

- 正面：新增 Provider 只需实现字段映射，复用底层逻辑
- 正面：Adapter 可以统一测试和验证
- 正面：业务逻辑集中在 Compiler / Planner 层，架构分层清晰
- 成本：Phase A 遗留的部分物理规则注入（physicsRules）需要在 A5 后清零

## Compliance

- Drift Detector ⑥ 号规则检测 `narrative.includes` / `narrative.match` 等推断逻辑
- Phase A warn only，A5 后必须 fail
