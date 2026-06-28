# ADR-003: Single Source of Truth

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

早期架构中，多个模块独立从 narrative 文本中解析信息：
- Agent 用 `narrative.includes("慢慢")` 推断运镜
- Adapter 用 `narrative.match(/推|拉|摇|移/)` 提取 camera movement
- Validator 用 `narrative.includes("门")` 检查物理规则

这种模式导致：
- 同一段 narrative 被不同模块以不同方式解析，结果不一致
- 修改 narrative 文本时，所有解析逻辑都需要同步更新
- 下游模块的输出不可预测

## Decision

**FilmLanguageIR 是所有生产决策的唯一输入和唯一输出。**

```
Narrative（用户编辑）
        │
        ▼
     FilmLanguageIR ← SSOT
        │
   ┌────┼────┬────┬────┐
   ▼    ▼    ▼    ▼    ▼
Validator  Agent  Compiler  Adapter  Diagnostics
```

- 任何 Agent 不得重新解析 Narrative
- 任何 Agent 不得从文本中推断信息
- Narrative 只属于用户体验层
- 所有模块消费 FilmLanguageIR 中的结构化字段

## Consequences

- 正面：所有下游模块共享同一信息源，消除不一致
- 正面：修改 narrative 不影响下游逻辑
- 正面：新增模块不需要重新实现 narrative 解析
- 成本：Phase A 的 LLM 输出 filmIR 不够稳定，需要 Phase B FilmCompiler 解决

## Compliance

- Drift Detector ⑧ 号规则检测 `narrative.includes` / `narrative.match` 等违规模式
- Phase A 为 warn 级别，Phase B（A6）后应清零
