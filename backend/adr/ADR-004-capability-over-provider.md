# ADR-004: Capability over Provider

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大 + OpenClaw

## Context

传统视频生成平台直接对接 Provider API，Agent 知道"我在用 VolcEngine"或"我在用 Veo"。这导致：

- 切换 Provider 时需修改 Agent 逻辑
- 新增 Provider 时需要重新设计 Prompt
- Agent 无法做出"这个模型不支持 X、换那个模型做 X"的智能决策

## Decision

**Agent 不感知 Provider，只感知 Capability。**

```
FilmIR
    │
    ▼
Capability Planner  ← 唯一感知 Provider 的模块
    │
    ▼
Execution DAG（steps with requiredCapabilities）
    │
    ▼
Scheduler → Provider Adapter
```

Capability 枚举：
- `camera-path` / `character-reference` / `multi-image-reference` / `physics-constraint` / `lip-sync` / `depth-control` / `scene-transition` / `keyframe-reference` / `motion-control` / `style-reference` / `pose-reference` / `lora-control`

Provider Capability Matrix：每个 Provider 注册它支持的能力和质量评分。

## Consequences

- 正面：新增 Provider 只需注册 Capability Matrix，无需修改 Agent
- 正面：多模型协同成为自然架构（Planner 可拆分任务到不同 Provider）
- 正面：Agent 逻辑与 Provider 技术细节完全解耦
- 成本：需要统一的 Capability 枚举 + Provider 能力注册机制（A4 实现）

## Compliance

- Capability Planner 接口已冻结（A3.5）
- Zero-Business Adapter 规则确保 Adapter 不做业务推断
