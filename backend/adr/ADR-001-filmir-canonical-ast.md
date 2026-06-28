# ADR-001: Adopt FilmLanguageIR as Canonical AST

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大 + OpenClaw

## Context

A2 阶段前，视频描述在系统内部以混合文本形式存在——narrative 字段同时承载"给用户看的自然语言"和"给视频模型理解的物理描述"。这导致：

- 不同 LLM 调用输出格式不稳定（有时 JSON、有时纯文本）
- 下游模块（Validator / Agent / Adapter）各自解析 narrative，逻辑重复且不一致
- 增加新 Provider 时，需要重新设计整套 Prompt

## Decision

建立 **FilmLanguageIR**（Film Language Intermediate Representation）作为系统的规范运行时：

```
Narrative（用户展示层，纯自然语言）
        ↓ LLM 优化 / FilmCompiler
FilmLanguageIR（规范运行时，结构化 JSON）
        ↓ Adapter
Provider API
```

- FilmLanguageIR 不属于任何 Provider，属于昆仑镜
- 所有下游模块（Validator / Agent / Prompt Builder / Adapter）以 FilmLanguageIR 为唯一输入
- 包含 10 个模块：global / scene / characters / camera / lighting / action / environment / style / constraints / references

## Consequences

- 正面：Provider 切换只需修改 Adapter，Agent 无需感知具体模型
- 正面：Narrative 回归到"给用户看"的纯展示层角色
- 正面：系统诊断、Diff、Validation 可以在结构化数据上进行
- 成本：Phase A 由 LLM 直接输出 filmIR（不确定但可运行），Phase B 的 Deterministic FilmCompiler 解决一致性

## Compliance

- Drift Detector SSOT 规则：Agent 不得从 narrative 解析信息
- Pipeline 中所有 Agent 的输入输出都是 FilmIR
