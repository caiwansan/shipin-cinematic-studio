# Formal Specification — Execution Theory Kernel

> 将 R9–P5 五层结构形式化为 typed system。
> 本 spec 定义 state / trace / transformation 三元模型，以及 9 个 invariants。

---

## 1. 基础符号与约定（Notation）

| 符号 | 含义 |
|------|------|
| 𝕊 | 状态空间（所有可能的系统状态） |
| 𝕋 | 执行轨迹空间（所有可能的执行序列） |
| 𝔽 | 状态转换函数集合 |
| ℙ | 观测投影算子集合 |
| ℂ | 约束算子集合 |
| 𝔸 | 归因函数 |

**时间离散化：** 系统状态在离散时间点 t₀, t₁, t₂, ... 采样。

---

## 2. R9 — Truth Space

### 2.1 定义

Truth Space 是状态空间 𝕊 的一个子集，标记为 𝕋𝕣𝕦𝕥𝕙 ⊆ 𝕊，满足以下三条公理：

**A1（存在性）：** 对任意有效系统，存在唯一的瞬时快照函数 σ: ℝ → 𝕊。

**A2（可冻结性）：** 快照冻结算子 Φ: 𝕊 → 𝕊 满足：
- Φ(σ(t)) = σ(t)（幂等）
- Φ(σ(t)) ≠ σ(t+ε) 对于任意 ε > 0（冻结后不受后续状态影响）

**A3（不可变性）：** 对冻结后的快照 s₀ = Φ(σ(t₀)) 和任意后续时间 t > t₀：
- s₀ 的所有属性保持不变

### 2.2 形式化快照

```
Snapshot = { id: ID, timestamp: ℝ, data: 𝕊, frozen: true }
```

### 2.3 Truth 锚定

系统选择一个初始冻结快照 s* 作为 Truth Anchor：
- s* 是所有观测、证明、约束的基线
- s* 不参与任何形式的状态演化

---

## 3. R10 — Transition Function

### 3.1 定义

Transition Function δ: 𝕊 × 𝕊 → Δ 将一对状态映射到 diff 语义空间 Δ。

**A4（可证明性）：** 对任意两个冻结快照 s₁, s₂ ∈ 𝕊：

```
δ(s₁, s₂) ∈ Δ
```

其中 Δ 是 diff 语义集合，固定为：

```
Δ = {EQUAL, MODIFIED, ADDED, REMOVED}
```

**A5（可重放性）：** 对任意执行轨迹 τ ∈ 𝕋：

```
Replay(τ, t₀) = Replay(τ, t₁)   ∀ t₀, t₁
```

即重放是时序无关的。

### 3.2 Diff 代数

Diff 满足以下代数性质：

```
(1) δ(s, s) = {id → EQUAL ∀ id ∈ s}     （自反性）
(2) δ(s₁, s₂) ≠ δ(s₂, s₁) → asymmetry    （非对称性）
(3) δ(s₁, s₂) = δ(s₁, s₃) + δ(s₃, s₂)    （近似可加性，见后）
```

### 3.3 重放确定性

```
∀ τ ∈ 𝕋: Hash(Replay(τ)) = deterministic
```

其中 Hash 只对结构字段敏感（排除 meta.timestamp）。

---

## 4. R11 — Observation Manifold

### 4.1 定义

Observation Manifold 是 𝕊 上的四维投影空间，包含四个正交投影算子：

**A6（正交性）：** 四个观测维度两两正交：

```
projection: 𝕊 → 𝕆ₓ       （空间/结构）
diff: 𝕊 × 𝕊 → 𝕆ₐ          （变化）
replay: 𝕊 → 𝕆ᵣ             （过程）
drift: 𝕊ⁿ → 𝕆ₜ             （时间）
```

正交性意味着：任两个维度的信息不能互相推导。

**A7（零耦合）：** 观测投影不影响被观测对象：

```
projection ∘ state = projection'(state)
∀ t: σ(t) ∉ observable_changes(projection)
```

即观测算子不引起系统状态变化。

### 4.2 四维结构

| 维度 | 算子 | 作用域 | 输出 |
|------|------|--------|------|
| Structure | Pₓ | 𝕊 | 节点/边集合 |
| Diff | Pₐ | 𝕊² | Δ 序列 |
| Replay | Pᵣ | 𝕊 | 有序执行步骤 |
| Drift | Pₜ | 𝕊ⁿ | 时间序列上的 Δ 模式 |

### 4.3 Drift 形式化

Drift 是在时间序列上的结构变化检测：

```
drift(t₁, t₂) = ∥Pₓ(σ(t₁)) ⊕ Pₓ(σ(t₂))∥
```

其中 ⊕ 是结构对称差，∥·∥ 是 hash 比较（相等为 0，不等为 >0）。

---

## 5. P4 — Constraint Operator

### 5.1 定义

Constraint Operator ℂ: 𝕆 → {OK, WARN, BLOCK} 将观测结果映射为约束决策。

**A8（可约束性）：** 对任意 domain d 和观测值 o：

```
ℂₚ(o) ∈ {OK, WARN, BLOCK}
```

其中 p = (warnThreshold, blockThreshold, enabled) 是 policy 配置。

### 5.2 Policy 代数

```
若 enabled = false:  ℂ(o) = OK     ∀ o
若 o ≥ warn:         ℂ(o) = OK
若 block ≤ o < warn: ℂ(o) = WARN
若 o < block:        ℂ(o) = BLOCK
```

### 5.3 SLA 形式化

SLA 是漂移预算约束：

```
SLA(d, t₁, t₂) = { ok: |f(t₂) - f(t₁)| ≤ budget }
```

其中 f(t) 是时刻 t 的 fidelity 值。

---

## 6. P5 — Causal Mapping Function

### 6.1 定义

Causal Mapping Function 𝔸: 𝔻 × 𝕊ⁿ → ℂ⁺ 将 drift 事件映射为有向无环因果图。

**A9（可归因性）：** 对任意 drift 事件 e ∈ 𝔻 和状态历史 s₁, s₂, ..., sₙ ∈ 𝕊：

```
𝔸(e, {sᵢ}) = (V, E, r)
```

其中：
- V 是因果节点集合（adapter / graph / runtime / policy）
- E ⊆ V × V 是有向边（causal propagation direction）
- r ∈ V 是根因节点

### 6.2 归因规则（确定性的）

```
规则 1: adapter_change → graph_shift
规则 2: graph_shift → runtime_divergence
规则 3: runtime_divergence → policy_regression
规则 4: 无 adapter change 但有 projection drift → graph_shift（自身变化）
规则 5: 仅 replay drift → runtime_non_determinism
```

### 6.3 因果图性质

```
(1) 𝔸 的产出始终是 DAG（有向无环图）     （无循环）
(2) r 是唯一入度为 0 的节点               （唯一根因）
(3) |r.children| ≥ 1                      （根因至少有一个下游）
```

---

## 7. Invariant System

以下 invariants 是任何遵守本 spec 的实现必须满足的约束：

### I1 — Truth Immutability

```
∀ s ∈ 𝕋𝕣𝕦𝕥𝕙, ∀ t > freeze_time(s): s = s₀
```

快照冻结后状态不变。

### I2 — Reproducibility

```
∀ τ ∈ 𝕋: Replay(τ, context₁) = Replay(τ, context₂)
```

同输入 → 同重放（输出独立于上下文/环境）。

### I3 — Observational Purity

```
∀ P ∈ ℙ, ∀ s ∈ 𝕊: H(P, s) = 0
```

其中 H(P, s) 是观测算子 P 对状态 s 的影响度量。必须为 0。

### I4 — Deterministic Diff

```
∀ s₁, s₂ ∈ 𝕊, ∀ o ∈ observers: δ(s₁, s₂) = δ'(s₁, s₂)
```

Diff 是客观的，与观测者无关。

### I5 — Orthogonal Projection

```
∀ o₁, o₂ ∈ ℙ, o₁ ≠ o₂:
    ∃ s₁, s₂: o₁(s₁) = o₁(s₂) ∧ o₂(s₁) ≠ o₂(s₂)
```

每个维度至少对一个状态差异敏感，而对其他维度不敏感。

### I6 — Constraint Determinism

```
∀ o ∈ 𝕆, ∀ p = (wt, bt, en):
    ℂₚ(o) 完全由 (o, wt, bt, en) 的纯函数决定
```

无随机性、无遗忘、无上下文影响。

### I7 — Causal Acyclicity

```
∀ e ∈ 𝔻: ∃ 𝔸(e) = (V, E, r) 满足 E 不包含环
```

因果归因路径始终是无环的。

### I8 — No Self-Modification

```
∀ 算子 ∈ {Φ, δ, Replay, Pₓ, Pₐ, Pᵣ, Pₜ, ℂ, 𝔸}:
    算子不能修改其输入状态
```

所有算子都是纯函数，不修改输入。

### I9 — Layer Isolation

```
操作   R9  R10  R11  P4  P5
读取     ⊥   R9   R10  R11 R11+P4
写入     ⊥    ⊥   ⊥    ⊥   ⊥
```

下层不可知上层存在。只有 R9 读不到任何层——它是根。

---

## 8. 系统整体

### 8.1 完整形式

```
ExecutionSystem = (𝕊, 𝕋, 𝔽, ℙ, ℂ, 𝔸, 𝕀)
```

其中 𝕀 是 9 个 invariants 的集合。

### 8.2 数学承诺

一个系统 C 是 Execution Theory Kernel 的合法实现，当且仅当：

```
valid(C) ⇔ satisfy(C, A1 ∧ A2 ∧ ... ∧ A9 ∧ I1 ∧ I2 ∧ ... ∧ I9)
```

### 8.3 最小兼容性

一个系统只需满足 A1-A3 + I1 即可声称"R9 兼容"。
一个系统需满足全部 A1-A9 + I1-I9 才可声称"Full Kernel Compatible"。

---

## 9. 版本

`formal-spec v1.0.0`

基于 Execution Theory Kernel v1.0.0 的形式化定义。
