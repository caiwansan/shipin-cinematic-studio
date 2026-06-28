# Kernel Mapping Audit — Short Drama Workbench

> 将昆仑镜短剧工作台（Short Drama Workbench）完整投影到 Execution Theory Kernel v1.0.0 坐标系。
> 时间：2026-06-23 21:13
> 审计范围：后端 services + routes + agents + runtime + database + 前端 studio-v2

---

## 1. Theory Layer Mapping

### R9 — Truth Anchor（应在：不可变快照源）

| 实现 | 位置 | 状态 |
|------|------|------|
| Project 表（主数据） | Prisma schema | ⚠️ 半符合 — 有 time-series 但无冻结标记 |
| AiCharacterSpec / AiSceneSpec | Prisma schema | ❌ 无版本化、无冻结语义 |
| DbSnapshot 表 | Prisma schema | ⚠️ 存在但未用作 truth baseline |
| Asset 表 + COS bucket | COS + DB | ✅ R9 Truth 已实现（见 R9 审计） |
| PromptVersionSnapshot | Prisma schema | ✅ 符合（已版本化） |
| KernelStateSnapshot | Prisma schema | ✅ 符合 |
| DriftSnapshot | Prisma schema | ✅ 符合 |

**缺口：** 短剧工作台的核心模型（Project / Character / Scene）没有冻结快照机制。Truth 层只有 COS assets 和 R11 Prompt 版本化对象，不覆盖短剧自身的执行状态。

### R10 — Proof Engine（应在：diff + replay）

| 实现 | 位置 | 状态 |
|------|------|------|
| R11 DiffEngine | `r10/diff/` | ✅ 符合（完整 diff 语义） |
| R11 ReplayEngine | `r10/replay/` | ✅ 符合（确定性 hash） |
| DirectorTraceCollector | `src/replay-engine/` | ⚠️ 存在但未标准化为 R10 接口 |
| ReplayDataEmitter | `src/replay-engine/` | ⚠️ 独立实现，未通过 Adapter 接入 R11 |
| ExecutionTrace | `src/execution-trace/` | ❌ 未对齐 — 独立 trace 格式 |

**缺口：** 系统有多个 replay/trace 实现（replay-engine, execution-trace, R10），但未统一为 R10 语义。只有 R10 的 diff 遵守最小语义集合（EQUAL/MODIFIED/ADDED/REMOVED）。

### R11 — Observability Stack（应在：四维观测）

| 实现 | 位置 | 状态 |
|------|------|------|
| R11 Console UI | `frontend/pages/director-os/r11/` | ✅ 符合（Structure/Diff/Replay/Drift） |
| Telemetry Dashboard | `frontend/pages/director-os/aigc/telemetry.vue` | ⚠️ 部分符合 — 仅时序指标 |
| Prompt Telemetry | `routes/admin-prompt-telemetry.ts` | ✅ 符合（PromptOS 集成） |
| Prompt Trace | `routes/admin-prompt-trace.ts` | ✅ 符合 |
| Execution Observatory | `src/execution-observatory/` | ❌ 未对齐 — 独立实现未接入 R11 |
| Replay Analytics | `src/replay-analytics/` | ❌ 未对齐 — 独立实现 |

**缺口：** R11 UI 是正确的，但真实执行系统的数据未全部通过 Adapter 投影到 R11。execution-observatory 和 replay-analytics 是平行实现，与 R11 无数据流。

### P4 — Constraint Layer（应在：policy + SLA + governance）

| 实现 | 位置 | 状态 |
|------|------|------|
| R11 StabilityService | `r11/stability/` | ✅ 符合（完整 Phase 4） |
| Governance Core | `src/governance/core/` | ⚠️ 部分符合 — 独立实现 |
| PolicyEngine | `src/governance/core/policy-engine.ts` | ⚠️ 未对齐 — 与 R11 StabilityService 无引用 |
| PlanGuard | `src/services/member/plan-guard.ts` | ⚠️ 独立实现 |
| ConstraintPhysics | `src/core/constraint-physics/` | ❌ 未对齐 — 独立实现 |
| NarrativeConstraint | `src/narrative-constraint/` | ❌ 未对齐 — 独立实现 |

**缺口：** 系统有至少 **5 个独立的约束/治理实现**（R11 StabilityService, src/governance, PlanGuard, ConstraintPhysics, NarrativeConstraint），全部彼此无引用，无统一 policy 入口。P4 层在 Kernel 中是一层，在短剧工作台中有 5 个平行实例。

### P5 — Causal Layer（应在：归因链）

| 实现 | 位置 | 状态 |
|------|------|------|
| R11 CausalTracer | `r11/causal/` | ✅ 符合（完整 Phase 5） |
| Causal Engine | `src/causal-engine/` | ❌ 未对齐 — 独立实现 |
| Causal Graph | `src/causal-graph/` | ❌ 未对齐 — 独立实现 |
| ContractDriftAnalyzer | `src/governance/analyzers/` | ❌ 未对齐 — 独立 |

**缺口：** 有至少 4 个因果/归因相关模块，均与 R11 Causal 体系无数据流。

---

## 2. Execution Layer Mapping

### 核心执行链

```text
NarrativeScript
  ↓
ScriptBreakdownMaster (agent)    → 叙事分析 → R9? R10? 都不是
  ↓
AigcOrchestrator (agent)         → 剧情规划 → 跨层混合（execution + observation）
  ↓
DirectorAgent / SegmentCompiler  → prompt 编译 → transformation
  ↓
PipelineRunner                   → image gen → 执行（多个 stages）
  ↓
Queue + WorkerRuntime            → 异步运输
  ↓
CharacterImageDAG / SceneImage   → 资产产出 → R11 Truth
```

### Agent Structure

| Agent / Module | Input | Transformation | Output | Kernel Layer |
|---------------|-------|---------------|--------|-------------|
| ScriptBreakdownMaster | 原始剧本文本 | LLM 拆解为 6 维度叙事结构 | ScriptBreakdown schema | **NONE** — 既不是 R9 truth 也不是 R10 diff |
| AigcOrchestrator | 剧本分解 + 用户约束 | 多 Agent 编排 | 剧情蓝图 + 角色/场景/声音/画面 | **NONE** — 跨层混合 |
| CharacterAgent | 剧情蓝图 | LLM 生成角色描述 | CharacterSpec | **NONE** — 本质是 transformation |
| SceneImagePromptAgent | SceneSpec | LLM 生成场景 prompt | 图片 prompt | **NONE** — transformation |
| PortraitPromptAgent | Character | LLM 生成角色 prompt | 角色 prompt | **NONE** — transformation |
| DirectorAgent (前端) | 用户操作 + 执行状态 | 状态管理 + 决策编排 | 前端 state | **NONE** — frontend runtime |
| PipelineRunner | stage 配置 + assets | 顺序执行 validate/decision/submit/poll/postprocess | 图片 assets | **R9**（最终产出是 COS assets） |
| PromptCompiler | prompt 模板 + runtime | 模板编译 + 变量替换 | 编译后 prompt | **R10**（traceable） |

**关键发现：** 短剧工作台的 agent 层**没有映射到任何 Kernel 层**。所有 agent（ScriptBreakdownMaster, AigcOrchestrator, CharacterAgent 等）执行的是纯粹的 transformation 工作，既不是 R9 truth anchor，也不是 R10 proof，也不是 R11 observation。它们在 Kernel 坐标中处于 **定义之外的灰色空间**。

---

## 3. Violations Report

### V1 — Layer 0 Agents（严重）

**描述：** 核心 agent（ScriptBreakdownMaster, AigcOrchestrator, CharacterAgent 等）不映射到任何 Kernel 层。它们是系统的"执行主体"但不在五层结构中。

**违反：** 无直接 invariant，但违反 Kernel 的 completeness claim。
**位置：** `src/agents/`, `src/routes/script-breakdown.ts`
**建议：** 将 agents 定义为 R10 的 transformation function（δ），使 agent execution 成为可 diff 可 replay 的转换操作。

### V2 — 5 个平行约束层（严重）

**描述：** R11 StabilityService, src/governance, PlanGuard, ConstraintPhysics, NarrativeConstraint 五个约束实现互不感知。

**违反：** I8（No Self-Modification）被间接违反 — 多个约束层可能产生冲突决策。
**位置：** 多个目录
**建议：** 收敛至统一的 P4 Constraint Operator 入口，原有实现作为 Adapter。

### V3 — 3 个平行 replay 实现

**描述：** R10 ReplayEngine, src/replay-engine, src/execution-trace 三个独立的 replay/trace 体系。

**违反：** I2（Reproducibility）风险 — 不同 replay 实现可能对同输入产生不同结果。
**位置：** `r10/replay/`, `src/replay-engine/`, `src/execution-trace/`
**建议：** 统一 Replay 接口，其他实现降级为 Adapter。

### V4 — R11 与真实执行系统数据无连接

**描述：** R11 UI 正确实现了四个视图，但数据来自独立快照路径，不覆盖 agent execution / script breakdown / storyboard 等核心执行数据。

**违反：** I3（Observational Purity）技术上未违反，但实用性降低。
**位置：** `r11/ui/` vs `src/execution-observatory/`
**建议：** 将短剧工作台的核心数据通过 Adapter 接入 R11。

### V5 — Governance 自包含但未实例化为 Kernel layer

**描述：** `src/governance/` 是一个完整的自治治理系统（含 policy engine, audit log, DAG, contract registry, drift analyzer, report generator），但完全独立于 Kernel 的 P4/P5 定义。

**违反：** 无直接 invariant 违反，但存在语义重复风险。
**位置：** `src/governance/`
**建议：** 将 governance 的 policy-engine 作为 P4 的一个 Adapter 实现。

### V6 — 前端 DirectorAgent 跨层混合

**描述：** 前端 `DirectorAgent.ts` 同时做 transformation、state management、orchestration、observation — 至少跨 4 层职责。

**违反：** I9（Layer Isolation）
**位置：** `frontend/studio-v2/runtime/director-ai/DirectorAgent.ts`
**建议：** 解耦为：transformation（R10）/ state（R11）/ orchestration（execution layer）

---

## 4. Layer Coverage Summary

| Layer | Kernel 定义 | 系统实现 | 覆盖率 |
|-------|-----------|---------|--------|
| R9 | Truth Anchor | COS assets + PromptVersion + KernelSnapshots | ⚠️ 只覆盖资产/Prompt，不覆盖执行状态 |
| R10 | Proof Engine | R10 diff/replay + 遗留 replay-engine + execution-trace | ❌ 三套平行实现 |
| R11 | Observability | R11 UI + telemetry + execution-observatory + replay-analytics | ❌ 四套平行实现 |
| P4 | Constraint | R11 Stability + governance + PlanGuard + ConstraintPhysics + NarrativeConstraint | ❌ 五套平行约束 |
| P5 | Causal | R11 Causal + causal-engine + causal-graph + contract-drift-analyzer | ❌ 四套平行归因 |
| **Agents** | **未定义** | 8 个 agent + orchestrator + 前端 agent | **❌ 灰色空间** |

---

## 5. Optimization Recommendations

### Structural Alignment（必须做）

| # | 操作 | 范围 | 优先级 |
|---|------|------|--------|
| A1 | 将 agents 标准化为 R10 δ transformation | src/agents/ | P0 |
| A2 | 收敛 replay 到统一 R10 接口 | r10/replay + replay-engine + execution-trace | P1 |
| A3 | 收敛约束到统一 P4 入口 | governance + StabilityService + PlanGuard + ConstraintPhysics | P1 |
| A4 | 将 execution-observatory/replay-analytics 作为 R11 Adapter | execution-observatory | P2 |
| A5 | 解耦前端 DirectorAgent | frontend/studio-v2/runtime/ | P3 |

### 不做（DO NOT DO）

- ❌ 不新增 agent
- ❌ 不重构前端
- ❌ 不改数据库 schema
- ❌ 不引入新框架
- ❌ 不改已冻结的 R10 diff 语义

---

## 6. 结论

短剧工作台目前对 Execution Theory Kernel 的符合度为 **部分映射**：

- 资产层（R9）✅ 已正确映射
- Prompt 系统（R9+R10+R11）✅ 已全部对齐
- 执行层（agents）❌ 五层外灰色空间
- 治理层（P4）❌ 五套平行约束
- 因果层（P5）❌ 四套平行归因

**核心矛盾：** 短剧工作台的 agent 层是系统的"心脏"，但在 Kernel 坐标系中没有位置。agents 不在 R9-R11-P4-P5 的任何一层中。

**修正路径：** 将 agent execution 定义为 R10 的 transformation function（δ），使 agent 成为"可证明的转换操作"，而非不可观测的黑盒。
