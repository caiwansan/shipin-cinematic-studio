# PDRA System Identity Contract v1.0

> **PromptIR Deterministic Runtime Architecture** — 系统身份文件
> 类型: System Identity Contract（非工程升级）
> 等级: 系统宪法级
> 目标: 定义「昆仑镜视频编译器」的不变性边界
> 状态: ✅ 固化完成，不进入代码层，不触发重构

---

## 1. 三层模型 + Semantic Constraint Layer（2026-06-24 升级）

```
┌──────────────┐
│     UI       │  ← Projection Layer（不可靠，只负责展示和编辑）
└──────┬───────┘
       │
       ▼
┌───────────────────┐
│   PromptIR AST    │  ← Single Source of Truth（剧本层 — "发生了什么"）
└────────┬──────────┘
         │
         ▼
┌───────────────────────────┐
│   ShotIR (Visual Decomp)  │  ← Visual Decomposition Layer（分镜层 — "怎么拍"）
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ FactGrid v2 (SCL)         │  ← Semantic Constraint Layer（宪法法院）
│  ├─ L0: Explicit Facts    │     "镜头语言的事实边界治理系统"
│  ├─ L1: Implied Actions   │
│  ├─ L1E: Environment Comp │
│  └─ 🌡️ Budget Guard (3-5)│
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Deterministic Compiler    │  ← Pure Function（无副作用）
└───────────────────────────┘
```

### 1.0 ShotIR（新增 — 2026-06-24）
- 职责：将 PromptIR.script 展开为镜头语言序列
- 约束：Narrative Preservation Invariant（叙事守恒律）— 不允许引入新事实
- 输出装入 PromptIR.breakdown.shots[]
- 宪法级定义：ShotIR 是 camera-constrained visual planner，不是世界生成器

### 1.0 Semantic Constraint Layer（新增 — 2026-06-24）
- 约束对象：ShotIR 生成过程
- 护栏机制：FactGrid v2（三层事实网格）+ Environment Budget Constraint
- 禁项：Entity Injection, Narrative Mutation, World Building
- 文档独立：`E0-FACTGRID-SPEC-v2.md`

---

## 2. 系统不变量（Invariants — 不可违反）

### 2.1 Determinism Invariant
```
same input AST + same runtime config → same output
```

### 2.2 UI Non-Authority Invariant
```
UI never affects execution semantics
```

### 2.3 Execution Purity Invariant
```
compiler = pure function (no hidden state)
```

### 2.4 Traceability Invariant
```
every output must map to traceId
```

---

## 3. 核心工程法则

> **Architecture must lag behind observed failure, not precede it.**

### 3.1 当前阶段
```
Phase: Pre-Observation Stabilization
Mode: Deterministic baseline secured
Next step: real-world trace collection
```

### 3.2 禁止行为
- ❌ ExecutionGraph DAG 重构
- ❌ compileVideo 主链路结构性修改
- ❌ Normalization Engine 重写
- ❌ Pipeline 结构性改造

### 3.3 允许行为
- ✅ trace 记录与收集
- ✅ bug fix（安全 / 崩溃）
- ✅ 观测与报告

---

## 4. 版本信息
```
Contract Version: PDRA-System-Contract-v2.0
Type: System Identity Contract + Semantic Constraint Layer
Status: FROZEN（不进入代码层）
Last upgraded: 2026-06-24
升级内容: 新增 ShotIR + FactGrid v2 (SCL) + Budget Guard
Previous: PDRA-System-Contract-v1.0
```
