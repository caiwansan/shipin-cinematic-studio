# ADR-006: Capability Planner + Capability Negotiator

**Status:** ✅ Approved
**Date:** 2026-06-29
**Author:** 熊大

## Context

A4 需要 Capability Planner 来将 Graph Runtime 的语义关系映射为执行所需的能力集合。

有两种设计方向：

**A）Planner 依赖 Provider Capability Matrix**
```
Graph → Capability Planner ← Provider Matrix
         ↓
         Feasible Plan（已裁剪）
```

**B）Planner 保持 Provider 无关，引入独立 Negotiation 层**
```
Graph → Capability Planner（理想能力）
         ↓
         Capability Negotiator ← Provider Capability Profile
         ↓
         Executable Plan（实际可行）
```

方向 A 破坏了已建立的 **Capability over Provider** 原则，使 Planner 从第一天起就感知 Provider。
方向 B 保持了架构分层，且 Planner 与 Negotiator 的生命周期不同（Planner 随电影语言演化，Negotiator 随执行环境变化）。

## Decision

**采用方向 B：Capability Planner + Capability Negotiator 分离。**

```
Layer 3：Planner
───────────────
FilmIR → Graph Runtime → Capability Planner
                           ↓
                    Capability Plan（理想能力）
                    - camera_path
                    - physics_constraint
                    - keyframe
                    - character_reference
                    （始终回答"电影需要什么"，不问"谁能做"）

Layer 3.5：Negotiator
────────────────────
Capability Plan → Capability Negotiator ← Provider Capability Profile
                    ↓
                    Executable Capability Plan（实际可行）
                    - fulfilled:
                        keyframe: full
                      degraded:
                        camera_path: static_camera(fallback)
                    （回答"在当前 Provider 上能做到多少"）

Layer 4：Execution Planner
──────────────────────────
Executable Capability Plan → Execution Planner
                              ↓
                              Execution DAG
```

## 核心原则

### Capability Planner
- **Provider 永远不可见**
- 输入：Graph Runtime
- 输出：理想 Capability Plan（level 体系：full / partial / none）
- KPI：是否完整表达电影需求
- 随 FilmLanguageIR 版本演化

### Capability Negotiator
- 输入：Capability Plan + Provider Capability Profile
- 输出：Executable Capability Plan（含 fulfilled / degraded / unresolved）
- KPI：是否尽可能满足能力需求
- 随 Provider 版本更新

### Provider Capability Profile（数据层，非代码逻辑）
- 声明式 Schema，非硬编码
- 字段使用 level 体系（full / partial / none / prompt-only），不用 boolean
- 由 adapter 维护或 Provider 官方声明，不写进 Planner
- 不随平台代码发布（可外部配置）

## Consequences

- 正面：Planner / Negotiator / Execution 生命周期完全独立
- 正面：Veo 升级支持 camera_path 后只需更新 Profile，Planner 不动
- 正面：Negotiator 可以独立测试降级策略
- 成本：多一层抽象，但职责边界清晰
- 成本：Provider Capability Profile 需要持续维护

## Compliance

- Capability over Provider（ADR-003）保持无损
- Kernel / Execution 解耦保持
- 不破坏已冻结的 Kernel API
