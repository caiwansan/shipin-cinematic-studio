# Phase A: V2 Runtime Migration Roadmap

> **Status:** ✅ FOUNDATION PHASE COMPLETE — ID 23 (2026-06-29)
> **Foundation Archive:** `CONSTITUTION.md` / `adr/` / `patterns/`
> **Next Phase:** A4 — Graph Kernel Implementation (Capability First)
> **Goal:** Migrate current V1 Runtime to V2 Protocol Runtime via dual-track migration
> **Principle:** Never modify frozen protocols during migration — any protocol change requires Freeze Gate review

---

## Overview

This is not a feature upgrade. It is a **Runtime Kernel Migration** — from V1's 8-Agent LLM orchestration + rule-driven ShotGraph to V2's 6-Protocol architecture.

Migration strategy: **Dual-track migration** — V1 Legacy Path and V2 Protocol Path run in parallel, A/B comparable, until V2 is verified stable.

---

## Migration Architecture

```
                   Runtime V1 (Legacy)
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     Old Path       New Path        Old Path
     (unchanged)    (V2 Protocol)    (direct)
          │              │              │
          ▼              ▼              ▼
    [Existing UI]   [A/B Compare]   [Existing Provider]
                          │
                    ┌─────┴─────┐
                    │           │
                Match?     Mismatch?
                    │           │
               Continue    Debug & Fix
                    │           │
                    └─────┬─────┘
                          │
                    [Remove Legacy]
                    (after A5 verified)
```

---

## Phase Breakdown

### Phase A1: Protocol Foundation (P0)

**Goal:** Establish all six protocol types as TypeScript types + runtime contracts. No business logic changes.

**Output Artifacts:**
- `src/director/v2/protocols/director-decision.ts` — DirectorDecision interface (SegmentDecision, CameraDecision, EmotionDecision, CharacterPresenceDecision, EnvironmentDecision, ActionDecision, SceneDecision, StoryArcDecision)
- `src/director/v2/protocols/execution-plan.ts` — ExecutionPlan, CameraPlan (with types for ActorPlan, MotionPlan, AudioPlan, LightingPlan as reserved)
- `src/director/v2/protocols/constraint.ts` — Constraint unified interface (ConstraintSource, ConstraintPriority, ConstraintState, ConstraintScope)
- `src/director/v2/protocols/reference-assignment.ts` — ReferenceAssignment, ReferenceCoverage, ResolvePolicy
- `src/director/v2/protocols/recovery-action.ts` — RecoveryAction, RootCauseGraph, RootCauseNode, DiagnosisChainEntry, FailureCategory
- `src/director/v2/protocols/route-decision.ts` — RouteDecision, RouteDecisionType, ProtocolComplianceReport, ProtocolScore, BusinessScore, QualityTrend, OverallVerdict, RuntimeCertification
- `src/director/v2/protocols/index.ts` — barrel export

**Non-output:**
- No changes to V1 code (no imports from V2 protocols in V1 files)
- No LLM calls, no UI changes, no provider changes

**Exit Gate (Compile Gate):**
```
✅ TypeScript compiles with strict mode — 0 errors
✅ All protocol types have unit tests (serialization, defaults, edge cases)
✅ hexValue/DirectorDecision auto-increment UUID ✅
✅ V1 code still runs untouched
```

---

### Phase A2: Pipeline Migration (P0)

**Goal:** Replace `Storyboard → ShotGraph` with `Storyboard → DirectorDecision → ExecutionPlan`. Keep old ShotGraph as compatibility layer.

**Changes:**
- `aigc-orchestrator.ts` — Add V2 path alongside V1 path
  - V1 path: `buildV3SpecOutput()` → `AigcSpecOutput` (unchanged)
  - V2 path: `buildDirectorDecision()` → `DirectorDecision` → `buildExecutionPlan()` → `ExecutionPlan[]`
- `src/director/v2/` — New directory:
  - `director-brain.ts` — `DirectorBrain` adapter: translates V3 → DirectorDecision (zero semantic loss)
  - `camera-plan-builder.ts` — `CameraPlanBuilder`: DirectorDecision → ExecutionPlan
  - `beat-planner.ts`, `shot-planner.ts`, `performance-director.ts` — adapters as needed
- A/B compare: generate both paths, compare `DirectorDecision.semanticHash` vs `ShotGraph.checksum`

**Exit Gate (Protocol Gate):**
```
✅ DirectorDecision produced for any valid script (V3 → DirectorDecision mapping verified)
✅ ExecutionPlan produced deterministically from same DirectorDecision
✅ Implicit Intent Principle enforced (DirectorDecision never modified downstream)
✅ A/B comparison shows semantic consistency between V1 and V2 outputs
```

**Sacrifices (P2, deferred):**
- Full zero semantic loss (95%+) — Phase A target: 70%+, improved iteratively
- All 8 DirectorDecision sub-interfaces fully populated — Phase A target: SegmentDecision + CameraDecision populated, others stubbed

---

### Phase A3: Constraint Runtime (P0)

**Goal:** Migrate all DirectorialConstraint to unified Constraint[]. Implement lifecycle states and scope hierarchy.

**Changes:**
- `DirectorialConstraintEngine` → wrap to produce `Constraint[]` as output
- Add `ConstraintState` lifecycle: ACTIVE → SATISFIED / COMPROMISED / VIOLATED / OVERRIDDEN / EXPIRED
- Add `ConstraintScope` enforcement: SHOT → SHOT_PAIR → SCENE → SEQUENCE → GLOBAL
- Add `ConstraintSource` tracking: where each constraint comes from
- Recovery Router begins consuming `Constraint[]` for scope-aware recovery

**Exit Gate:**
```
✅ Constraint[] produced alongside old DirectorialConstraint for A/B compare
✅ Constraint lifecycle states properly transition
✅ Scope hierarchy enforced (GLOBAL > SEQUENCE > SCENE > SHOT)
✅ No V1 code depends on new Constraint[] for functionality
```

---

### Phase A4: Recovery Runtime (P0)

**Goal:** Implement `RecoveryAction` protocol, `RecoveryRouter`, `RootCauseGraph`. **Delete autoFix direct mutation.**

**The most dangerous phase.** This replaces the current `feedback-loop/auto-fixer.ts` which directly mutates `VideoPromptSpec`.

**Changes:**
- **DELETE** `autoFix()` direct mutation path
- **New:**
  - `RecoveryRouter` — receives `ContinuityReport` + `RouteDecision`, produces `RecoveryAction[]`, routes to target modules
  - `RootCauseEngine` — produces `RootCauseGraph` (DAG of root causes)
  - `DiagnosisEngine` — produces structured diagnosis chains
  - `FailureCategory` taxonomy (9 classes): IDENTITY / SPATIAL / TEMPORAL / STYLE / REFERENCE / CONSTRAINT / EXECUTION / PROVIDER / INTENT
  - `ContinuityReport` — structured output with 10-dimension continuity matrix
- **Partial Recovery First principle** enforced:
  ```
  REFERENCE → CONSTRAINT → EXECUTION_PLAN → INTENT_REVISION → FULL_REPLAN
  ```

**Exit Gate:**
```
✅ No module directly mutates another module's protocol objects
✅ RecoveryAction[] produced with proper scope, confidence, routing
✅ Partial Recovery First order enforced
✅ RootCauseGraph produced (non-flat, DAG structure)
✅ autoFix removed — no direct mutation path remains
```

---

### Phase A5: Evaluation Runtime (P0)

**Goal:** Implement `IEvaluationEngine` (Collect → Score → Route). Evaluation takes over as quality gate.

**Changes:**
- `EvaluationEngine` — consumes 6 protocol objects, produces `RouteDecision`
- `ProtocolScore` — 6-dimension (Intent / Execution / Constraint / Reference / Recovery / Provider)
- `BusinessScore` — 8-dimension (creative quality, preserved from V1)
- `ProtocolComplianceCheck` — 5 principle checks (Immutable Intent, Constraint Monotonicity, No Direct Mutation, Partial Recovery First, Provider Neutrality)
- `QualityTrend` — historical run comparison
- `RouteDecision` — replaces `passed: boolean` with structured routing
- `OverallVerdict` + `RuntimeCertification` — including `FreezeGate` status

**Critical rule:** Evaluation never calls `recover()`, `resolve()`, or `replan()`. It only emits `RouteDecision`.

**Exit Gate (Runtime Gate — first checkpoint):**
```
✅ Protocol Compliance Check passes for all valid inputs
✅ Protocol Score + Business Score both populated
✅ RouteDecision produced (PASS / AUTO_RECOVER / HUMAN_REVIEW / FULL_REPLAN / ARCHITECTURE_FAIL)
✅ Full end-to-end: Storyboard → DirectorDecision → ExecutionPlan → Constraint → Evaluation → RouteDecision
✅ Real video generation through V2 path (with legacy provider fallback)
```

---

### Phase A6: Reference & Asset Engine (P1)

**Goal:** Implement Asset Graph (DAG), AssetRevision (versioned), ReferenceCoverage, VisualAssetBuilder.

**Changes:**
- `AssetGraph` — DAG with `AssetNode` (11 node types), edges, cross-graph relationships
- `AssetRevision` — version chain: `previousRevisionId` / `nextRevisionId`, status, locking
- `IAssetRepository` — `getAssetNode()`, `getRevision()`, `storeAsset()`, `linkAssetToAsset()`
- `ReferenceResolver` — resolves ReferenceAssignment → produce ReferenceCoverage
- `ReferenceCoverage` — character/scene/shot coverage scores, critical gap detection
- `IVisualAssetBuilder` — triggered when coverage insufficient: `generate() → AssetNode[]`
- Key frame generation flow:
  ```
  Reference Coverage Check → Coverage < threshold? → VisualAssetBuilder → Asset Graph → Re-resolve → Video Gen
  ```

**Exit Gate:**
```
✅ Asset Graph built and queryable (DAG, not flat pool)
✅ AssetRevision chain functional (versioning, rollback, locking)
✅ ReferenceCoverage computed with actionable gap detection
✅ Coverage insufficient → VisualAssetBuilder triggered → re-resolve completes
✅ A/B compare: old flat pool → new Asset Graph produces equivalent or better bindings
```

---

### Phase A7: Provider Migration (P1)

**Goal:** Transform Provider Adapters from string-prompt receivers to structured Film Language translators.

**Changes:**
- `ProviderCompiler` interface: `compile(input: ProviderInput) → ProviderPrompt`
- `ProviderInput` — structured: `DirectorDecision` + `Shot` + `Beat` + `Performance` + `SpatialLayout` + `CameraIntent` + `ReferenceAssignment`
- `ProviderPrompt` — structured output: `prompt` + `negativePrompt` + `referenceImages` + `providerParams` + `cameraControl` + `characterControl` + `translationTrace`
- Per-provider compilers: `SeedanceCompiler`, `WanCompiler`, `KlingCompiler`, `VeoCompiler` (stubs for not-yet-supported providers)
- `translationTrace` — logs what was lost/gained in translation
- `validate()` — checks prompt validity before sending

**Exit Gate:**
```
✅ ProviderAdapter receives structured ProviderInput, not string prompts
✅ Each provider has its own compile implementation
✅ translationTrace produced for every request
✅ validate() catches prompt errors before hitting provider API
✅ Video generation quality maintained or improved vs V1 path
```

---

## Phase Gates

Three gates per phase (compile, protocol, runtime), but the overall architecture has explicit checkpoints:

```
A1 → A2 → A3 → A4 ───────→ A5 → A6 → A7
                  │                        │
                  │                   [Remove Legacy]
                  │                   (after A5 stable)
                  │
      ╔═══════════╧═══════════╗
      ║   Runtime Gate 1     ║
      ║  (After A5, before   ║
      ║   deleting legacy)   ║
      ╚═══════════════════════╝
      Criteria:
      - End-to-end: script → video
      - Real provider execution (Wan/Seedance)
      - A/B compare: V2 vs V1 output quality
      - No regression in video quality
```

### Gate Definitions

| Gate | When | Criteria |
|------|------|----------|
| **Compile Gate** | End of A1 | TypeScript strict mode: 0 errors. All protocol types have tests. |
| **Protocol Gate** | End of each phase | Phase-specific protocol compliance verified. No direct mutation. |
| **Runtime Gate 1** | After A5 | First end-to-end real video. A/B compare V2 vs V1. No regression. |
| **Runtime Gate 2** | After A7 | Full V2 path operational. Legacy V1 path candidates for removal. |

---

## Dual-Track Migration Strategy

```
┌─────────────────────────────────────────────────────┐
│                  Storyboard Input                     │
└──────────────┬──────────────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                  ▼
┌────────────┐   ┌──────────────────┐
│ V1 Legacy  │   │ V2 Protocol Path │
│ (unchanged) │   │ (new code)       │
│             │   │                  │
│ ShotGraph   │   │ DirectorDecision │
│ ↓           │   │ ↓                │
│ AigcSpecOut │   │ ExecutionPlan    │
│ ↓           │   │ ↓                │
│ VidPrompt   │   │ Constraint[]     │
│ ↓           │   │ ↓                │
│ Provider    │   │ Evaluation       │
│             │   │ ↓                │
│             │   │ Provider         │
└────────────┘   └──────────────────┘
      │                    │
      └────────┬───────────┘
               ▼
      ┌─────────────────┐
      │  A/B Comparator  │
      │  (output diff)   │
      └────────┬─────────┘
               ▼
      ┌──────────────────────┐
      │  Match? → Continue   │
      │  Mismatch? → Debug   │
      └──────────────────────┘
```

**Why Dual-Track:**
1. **Rollback safety** — V1 path untouched until V2 is stable
2. **A/B comparison** — same input, two outputs, measure semantic preservation
3. **Incremental confidence** — each phase validated before next begins
4. **Legacy removal** — only after A5 Runtime Gate 1 passes, start removing V1 code

---

## Dependency Graph

```
A1 (Protocol Types)
 │
 ├────► A2 (DirectorDecision → ExecutionPlan)
 │
 ├────► A3 (Constraint Runtime)
 │          │
 │          └────► A4 (Recovery Runtime)
 │                      │
 │                      └────► A5 (Evaluation Runtime)
 │                                  │
 │                                  └────► A6 (Reference & Asset)
 │                                              │
 │                                              └────► A7 (Provider)
 │
 └────► (Parallel) V1 Legacy untouched until A5 Runtime Gate passes
```

Dependencies flow strictly: A1 → A2/A3 (parallel) → A4 → A5 → A6 → A7

No circular dependencies. Each phase builds on previous protocol types.

---

## Risk Register

| Risk | Phase | Likelihood | Impact | Mitigation |
|------|-------|------------|--------|------------|
| Protocol types drift from spec during implementation | A1 | Low | High | Freeze Gate review requirement; spec as single truth source |
| A/B comparison shows semantic regression >30% | A2 | Medium | High | Dual-track allows rollback; improve DirectorBrain adapter |
| Recovery migration breaks existing feedback loops | A4 | High | High | Stage rollout: first on non-critical shots, then full; keep autoFix as fallback for 1 release cycle |
| Real video generation on V2 path fails quality check | A5 | Medium | High | Fallback to V1 path automatically; Runtime Gate 1 blocks legacy removal |
| Visual Asset Builder quality insufficient | A6 | Medium | Medium | Coverage threshold adjustable per project; human-in-the-loop override |
| Provider API compatibility issues with structured input | A7 | Medium | Medium | translationTrace captures loss; gradual rollout per provider |

---

## Appendix: Phase A1 Type Definitions

See `src/director/v2/protocols/` for the actual TypeScript types.

Reference: `DIRECTOR_ENGINE_V2_SPEC.md` — chapters ①, ⑤, ⑥, ⑦, ⑧, ⑪

---

*Document version: 1.0.0 — 2026-06-28*
*Next review: After A1 Compile Gate passes*

---


## A3.5 — Kernel Freeze & Compatibility (2026-06-29)

> **Status:** ✅ Completed
> **Goal:** 冻结 A3 Kernel API，建立兼容性保障，为 A4+ 奠定稳定基础。
> **Philosophy:** 不增加任何新功能，只做 API 锁定、兼容性测试、回归基线、性能基线、文档基线。

### 冻结的 Kernel API

```
Kernel（冻结 — src/runtime/）
├── film-language-ir.ts     FilmIR 类型 + metadata + freeze + clone
├── film-ir-diagnostics.ts  统一诊断对象
├── film-ir-diff.ts         Diff Engine（结构化变更记录）
├── film-ir-version.ts      Version Migration（semver 升级链）
├── film-ir-snapshot.ts     Snapshot（完整制作状态）
├── execution-context.ts    运行环境上下文
├── capability-planner.ts   Capability Planner 接口（A4 实现）
└── graph-runtime.ts        Graph Runtime 接口（A4 实现）

Extension（可扩展）
├── SceneGraph              ← 依赖 Kernel
├── EventGraph              ← 依赖 Kernel
├── Timeline                ← 依赖 Kernel
└── Constraint Engine       ← 依赖 Kernel

Execution（可替换）
└── Provider Adapter        ← 依赖 Kernel + Extension
```

### 兼容性规则

**向后兼容扩展允许：**
- 增加可选字段（`?`）
- 增加枚举值
- 增加新的 Migration 函数
- 以上必须保持旧 Consumer 不受影响

**破坏性变更禁止：**
- 删除现有字段
- 修改现有字段类型
- 修改 freeze / clone / diff / diagnostics 签名
- 修改评分算法

版本分隔策略：必须做破坏性变更时 → `film-ir@0.2` 或 `@1.0`，旧版本通过 Migration 升级。

### 治理规则（Drift Detector）

| # | 规则 | 说明 |
|---|------|------|
| ⑥ | Zero-Business Adapter | Adapter 不做业务推断（Phase A warn, A5 后强制） |
| ⑦ | SSOT | Agent 不重新解析 Narrative（Phase A warn） |
| ⑧ | No Silent Mutation | 不直接修改 filmIR 字段（Phase A warn） |
| ⑨ | No Kernel Dependency Leak | Kernel 不依赖 Extension / Execution / Provider |

### 测试基线

```
5 测试文件 → 66 测试全部通过
├── pipeline-migration.test.ts (26)
├── runtime-contract.test.ts (5)
├── constraint-runtime.test.ts (14)
├── architecture-drift.test.ts (9)  ← 新增 4 条治理规则
└── kernel-compatibility.test.ts (14)  ← 新增
```

---

## A4 — Graph Kernel & Capability Runtime

> **Status:** 🚧 Planned
> **Core Goal:** **建立 Graph Runtime 生态**，使 Graph Kernel 成为继 FilmLanguageIR 之后的第二个核心抽象。
>
> Graph Runtime 关系：
> ```
> FilmLanguageIR（Canonical AST）
>        │
>        ▼
> Graph Builder
>        │
>        ▼
> Graph Runtime（Canonical Graph）← Graph Kernel
>        │
>   ┌────┼────┐
>   ▼    ▼    ▼
> Scene  Event Timeline
> View   View   View
> ```
>
> - FilmLanguageIR 负责表达电影语言
> - Graph Runtime 负责表达电影内部的关系
> - Scene / Event / Timeline 是同一个图的不同投影视图，不是三个独立数据源
> - 所有节点和边使用稳定 ID（Stable Identifier Principle）
> - 与 FilmLanguageIR 形成双 Kernel 架构

### 核心交付

**Graph Runtime（底层）**
- 统一图数据：GraphNode + GraphEdge
- 三种投影视图：SceneGraphView / EventGraphView / TimelineView
- 跨视图一致性检查

**Capability Planner 实现**
- 从 FilmIR 需求 → Provider 能力矩阵 → Execution DAG
- Execution DAG 表达并行/依赖/重试/缓存

**Reference Resolver**
- 角色/场景/道具参考图 → Asset Graph
- 自动匹配和冲突检测

**Constraint Engine**
- 从 FilmIR.constraints 实例化运行时约束
- 空间/物理/时间/连续性约束检查

### 架构数据流

```
FilmLanguageIR
      │
      ▼
Graph Runtime ───► SceneGraphView
      │                  │
      ├──────────────────► EventGraphView
      │                  │
      └──────────────────► TimelineView
                          │
                          ▼
                  Capability Planner
                          │
                          ▼
                  Execution DAG
                          │
                          ▼
                  Scheduler
                          │
                          ▼
                  Provider Adapter
                          │
                          ▼
                  Provider API
```

---


## Architecture Decision Records（ADR）

本阶段（A2-A3.5）形成了 7 个影响长期架构的决策，已记录在 `adr/` 目录中：

| ADR | 标题 | 状态 |
|-----|------|------|
| 001 | Adopt FilmLanguageIR as Canonical AST | ✅ |
| 002 | Freeze Kernel API | ✅ |
| 003 | Single Source of Truth | ✅ |
| 004 | Capability over Provider | ✅ |
| 005 | Introduce Graph Kernel | ✅ |
| 006 | Zero-Business Adapter | ✅ |
| 007 | Stable Identifier Principle | ✅ |

后续新增架构决策必须通过 ADR 流程，并在 Drift Detector 中增加对应规则。

---

## 新增阶段 A6.5 — Film Language IR（电影语言中间表示）

### 定位（经熊大 2026-06-29 纠正）
**不是"生成 Prompt 的模块"，而是"生成与 Provider 无关的电影语言中间表示（Intermediate Representation, IR）"。**

**Film Language Protocol 是第七个核心协议**，与六大协议平级，拥有独立的所有权、生命周期、不变量和验证规则。

这个区别是整个架构的分水岭：
- ❌ **V1 模式**：ExecutionPlan → 拼 JSON → Prompt → 火山引擎
- ✅ **V2 模式**：ExecutionPlan → Film Language IR → Provider Compiler → Provider Prompt → Video Model

### Architecture Position
```
A6 Reference & Asset
  ↓
A6.5 Film Language IR  ← Provider Neutral，不包含任何 Provider 规则
  ↓
A7 Provider Compiler   ← 翻译器角色，将 IR 转换为各模型最佳输入
```

### 核心职责
Film Language Compiler **只回答一个问题**：
> 如果让一个专业导演把这一镜交给摄影、美术、灯光和演员执行，它会包含哪些信息？

它输出如下结构（示意 FilmLanguageFrame）：
```typescript
interface FilmLanguageFrame {
  subject: {
    primary: SubjectInfo      // 主角（含 ReferenceBinding）
    secondary: SubjectInfo[]  // 次要元素（含视觉权重）
    visualWeight: Record<string, number>  // 主体优先级：沈三笑 0.55，老槐树 0.35...
  }
  camera: {
    composition: string       // 叙事型："古槐占据画面左2/3"
    shotType: string          // "Low Angle Reveal"
    narrativeIntention: string // "以老槐树的永恒衬托人物的短暂"
  }
  blocking: {
    characterPosition: string // "沈三笑立于茶馆门口，面朝老槐树"
    movement: string
  }
  motion: {
    camera: string            // Camera Motion（极慢匀速上升）
    character: string         // Character Motion（微风吹衣角）
    environment: string       // Environment Motion（嫩芽轻摇，树梢微颤）
    particles: string         // Particle Motion（晨光灰尘漂浮）
  }
  environment: {
    scene: string             // 场景描述
    timeOfDay: string
    weather: string
  }
  lighting: {
    source: string            // "春日清晨的漫射天光"
    quality: string           // "柔光，略带散射"
    direction: string
  }
  emotion: string             // "宁静春日，生机与深邃"
  visualAssets: Array<{       // 视觉世界固定锚
    name: string
    type: 'character' | 'scene' | 'prop'
    assetNodeId: string
    role: 'primary' | 'secondary' | 'background'
  }>
  constraints: Array<{        // 连续性+空间约束
    element: string
    description: string
    priority: 'must' | 'should' | 'nice'
  }>
  narrativeIntent: string     // 简洁叙事（控制在 100 token 以内）
}
```

### Film Language IR 不包含什么
- ❌ 即梦的 JSON 格式
- ❌ 可灵的参数结构
- ❌ Veo 的 API 字段
- ❌ Runway 的 DSL
- ❌ 任何 Provider 特定的参考图排列方式

所有 Provider 相关的东西都是 **A7 Provider Compiler** 的职责。

### 与 Provider Compiler 的关系

```
Film Language IR  ← 完全不变
     ↓
Provider Compiler  ← 翻译层
     ↓
Provider A: {"camera": {"low_angle": true}}
Provider B: "低角度仰拍镜头"
Provider C: DSL: low-angle-reveal
```

**同一个 FilmLanguageFrame 可以翻译成不同 Provider 的格式，Film Language 本身完全不感知 Provider。**

### 新增全局原则：Semantic Preservation Principle（语义保持原则）

**定义：**
Provider Compiler 可以改变表达方式，但不能改变 Film Language IR 的语义。

**例子：**
```
Film Language: "Low-angle reveal"
→ Provider A: camera.low_angle = true     ✅ 可以
→ Provider A: "Top-down shot"             ❌ 不行（语义已变）
```

此原则是 Provider Neutrality（已冻结）的强化——不仅是"不依赖 Provider"，还要"保持语义刚性"。

### 新增评估维度：Semantic Fidelity Score

A5 Evaluation Framework 中新增一个维度：

**定义：** Provider 输出是否忠实表达了 Film Language IR 的语义。

**例子：**
```
Film Language IR: "Hero remains screen-left."
Provider 输出：Hero 出现在右侧 → 语义偏移 → Semantic Fidelity Score 降低
```

这不是 Prompt 文采问题，而是**语义偏移问题**。低分可触发 Recovery（局部恢复）：
- 语义偏移 → 触发 Provider Compiler 重新翻译
- 连续性断裂 → 触发 Continuity & Recovery Engine 介入
- 超出语义保真度阈值 → Evaluation 发出 `HUMAN_REVIEW` 或 `FULL_REPLAN`

### 为什么放在 A6 和 A7 之间

时序依赖：
- A6 (Reference & Asset)：影响 FilmLanguageFrame.visualAssets
- A4 (Recovery)：影响 FilmLanguageFrame.constraints
- A3 (Constraint)：影响 FilmLanguageFrame.constraints
- A6.5 (Film Language IR) ← 需要上述四个依赖都就位
- A7 (Provider Compiler) ← 需要 A6.5 的输出

A6.5 **不能**放在 A2 之前，因为没有确定参考资产和约束无法生成有意义的 IR。

### 对长期演进的意义

1. **Provider 更换**：主要发生在 Provider Compiler，上层导演逻辑和 Film Language 保持稳定
2. **新模型接入**：新增 Provider Compiler + 写翻译规则，不需要改 Film Language
3. **模型升级**：优化 Provider Compiler 的翻译策略，Film Language 不变
4. **昆仑镜平台化**：GEO 工作台、PPT 工作台、小说工作台都可以复用 Film Language IR 层

### 架构强制：唯一合法路径

```
DirectorDecision → ExecutionPlan → Constraint → Reference → FilmLanguageIR → ProviderCompiler
```

**禁止路径（架构违规）：**
```
ProviderCompiler → ExecutionPlan（直接读取 ExecutionPlan 字段）
```

任何 Provider Compiler 直接读取 ExecutionPlan 字段，视为 Architecture Violation。
这确保 Film Language IR 不会被架空。
---

## 附录：AST 愿景（未来方向）

Film Language Protocol 确立后，Runtime 已经越来越像编译器。未来的自然方向是：

### 当前
```
Storyboard → DirectorDecision JSON → ExecutionPlan JSON → FilmLanguageIR JSON → Provider JSON
```

### 愿景（AST 化）
```
Storyboard → DirectorDecision AST → ExecutionPlan AST → FilmLanguage AST
```
Recovery、Evaluation、Provider 全部消费 AST，而不是 JSON。

**AST 化带来的能力：**
- **增量编译**：用户修改"把这里改成长焦"→ Runtime 不做全量重新生成
- **AST Diff**：Camera Layer `35mm → 85mm` → 只重新编译受影响的部分
- **精确 Recovery**：RecoveryAction 可以定位到 AST 节点级别，不需要整帧恢复
- **Evaluation 归因**：Semantic Fidelity Score 可以精确到 AST 节点（"Camera Layer 偏移了，Subject Layer 没变"）

这不是 Phase A 的目标，但 Phase A 的协议设计（强类型、确定性、可验证）是 AST 化的前置条件。


---

## 附录 C：三工程保障（2026-06-29 熊大确立）

### C.1 Runtime Contract Test：全链路编译测试

**定位：** 验证整个 Runtime 链路的完整性，是整个 Runtime 的"编译测试"。

**覆盖：**
```
Story → DirectorDecision → ExecutionPlan → Constraint → Reference → FilmLanguageIR
```

**自动检查：**
- 每一层不为空
- Fingerprint 连续（同输入同 IR）
- Provenance 完整（每层 ID 链）
- 所有协议满足 Invariant
- Governance Layer 合流检查

**代码位置：** `src/director/v2/__tests__/runtime-contract.test.ts`（5 项测试）

### C.2 Runtime Certification：生产准入

**定义：** 任何改动必须重新通过以下认证门禁才能进入生产：

| 维度 | 检查项 |
|------|--------|
| Architecture | 所有架构原则满足 |
| Determinism | 同输入→同输出 |
| Semantic | Semantic Preservation 原则 |
| Recovery | Recovery Protocol 正常 |
| Provider Neutrality | Provider 不侵犯决策层 |
| Information Preservation | 信息无损 |

### C.3 Architecture Drift Detector：长期维护

**定义：** 在 CI 中自动运行的架构违规检测，覆盖 5 类违反场景。

**原则：** 任何违反 → CI FAIL。冻结才是真正冻结。

**白名单：** V1 Legacy 文件在 Phase A 双轨过渡期间豁免，Phase A 完成后清空。

**代码位置：** `src/director/v2/__tests__/architecture-drift.test.ts`（5 项测试）

---

## 附录 D：Runtime 四层命名体系（2026-06-29 熊大确立）

| 层级 | 组成 | 职责 |
|------|------|------|
| Decision Layer | Intent, Execution | 导演决策 |
| Governance Layer | Constraint, Recovery, Evaluation | 运行治理 |
| Representation Layer | Reference, Film Language | 世界表达 |
| Compilation Layer | Provider Compiler | 模型适配 |

**使用约定：**
- "这是 Governance Layer 的问题。"（不要再说 "Prompt 有问题"）
