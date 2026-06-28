# Execution Theory Kernel

> 将 R9–P5 从"昆仑镜实现"中抽象为 runtime-neutral 执行系统科学范式。
> 本 kernel 不依赖任何具体 runtime、graph system、agent framework。

---

## 核心主张（Core Thesis）

**任何执行系统都存在三个本质问题：**
1. **真理定义**（什么是不变的事实）
2. **行为观测**（系统实际发生了什么）
3. **行为治理**（什么是被允许的）

R9–P5 是解决这三个问题的五层最小结构。
Execution Theory Kernel 是这个结构的形式化抽象。

---

## 五层公理（Five Layers, Nine Axioms）

### R9 — Truth Anchor
| # | 公理 | 说明 |
|---|------|------|
| A1 | 系统必须有一个不可变的真实来源 | 不可变锚点，所有观测、证明、约束以此为基 |
| A2 | 真实来源必须可以快照冻结 | 快照是 "系统在某时刻的完整真实状态" |
| A3 | 快照一旦确定，不得修改 | 修改快照 = 失去真理锚点 |

**数学形式：**
- 令 S(t) 为系统在时刻 t 的所有可观察状态的集合
- 快照：Snapshot(t₀) = S(t₀)，并且 Snapshot(t₀) 是 frozen

---

### R10 — Proof Engine
| # | 公理 | 说明 |
|---|------|------|
| A4 | 系统变化必须是可证明的 | diff → 前后状态对比，证明"发生了什么" |
| A5 | 系统行为必须是可重放的 | replay → 确定性复现，证明"可以复现" |

**数学形式：**
- diff：Δ = Snapshot(t₁) ∖ Snapshot(t₀)
- replay：对于同一次执行，所有重放产出相同的 Δ

**最小 diff 语义（已冻结）：**
- EQUAL（无变化）
- MODIFIED（状态变更）
- ADDED（新增状态）
- REMOVED（移除状态）

---

### R11 — Observability Stack
| # | 公理 | 说明 |
|---|------|------|
| A6 | 系统必须有四种正交观测维度 | 空间(结构)、变化(diff)、过程(replay)、时间(drift) |
| A7 | 观测层不得影响执行层 | 零耦合原则，观测永远不污染 runtime |

**观测层约束：**
```
graph  ≠ runtime        (结构不等于执行)
diff   ≠ correction     (变化不等于修正)
replay ≠ reinterpret    (重放不等于重新解释)
drift  ≠ diagnosis      (漂移不等于诊断)
```

**铁律：**
- ui is a projector, not a thinker
- 不做解释、不做标注、不引入新语义

---

### P4 — Constraint Layer
| # | 公理 | 说明 |
|---|------|------|
| A8 | 观测结果必须可以转化为系统约束 | 从 "系统发生了变化" 到 "系统不能随意变化" |

**约束结构：**
- warnThreshold：低于此值发出警告
- blockThreshold：低于此值阻止执行
- SLA baseline + driftBudget：基线 fidelity + 允许偏移量

**判定优先级：** BLOCK > WARN > OK

---

### P5 — Causal Layer
| # | 公理 | 说明 |
|---|------|------|
| A9 | 约束违反必须有可追溯的归因链 | 从 "系统违反了规则" 到 "为什么违反" |

**归因传播链（确定性）：**
```
adapter change
  → graph structure shift
    → execution path divergence
      → policy regression
```

**铁律：**
- 只做确定性规则匹配，不做推断
- 不自动修复
- 不修改系统

---

## 系统不变性（System Invariants）

以下性质对任何遵守本 kernel 的实现成立：

| 不变性 | 说明 |
|--------|------|
| **Truth Immutability** | 快照一旦冻结，不得修改 |
| **Reproducibility** | 同输入 → 同 diff / 同 replay |
| **Observational Purity** | 观测不改变被观测系统 |
| **Constraint Determinism** | 相同 fidelity → 相同决策 |
| **Attribution Determinism** | 相同 drift delta → 相同归因链 |

---

## 分层依赖图

```
R9 (truth anchor) — 无依赖
  ↓ 提供基线
R10 (proof engine) — 依赖 R9
  ↓ 提供可证明性
R11 (observability) — 依赖 R10
  ↓ 提供可观测性
P4 (constraint layer) — 依赖 R11
  ↓ 提供可约束性
P5 (causal layer) — 依赖 R11 + P4
  ↓ 提供可归因性
```

**依赖规则：**
- 上层可以访问下层，下层不可知上层存在
- R9 是唯一不依赖任何层的基底层

---

## 全局铁律（Constitutional Rules）

| 规则 | 适用范围 | 层级 |
|------|---------|------|
| 不持有 API Key | BYOK | 宪法级 |
| 不做自动修复 | P4+P5 | 宪法级 |
| 不做 AI 推断 | P5 | 宪法级 |
| 观测不污染执行 | R11 | 宪法级 |
| 快照不可变 | R9 | 宪法级 |
| 不自适应修改 graph | 全局 | 宪法级 |
| feature-gated | 全部 | 规范级 |

---

## 内核范围边界（Scope Boundary）

### 在边界内
- diff / replay / drift 语义
- fidelity 度量方法
- policy 阈值结构
- 因果归因规则
- adapter 接口契约
- 依赖树与分层

### 在边界外
- 具体 runtime 实现
- 具体 graph system
- 具体 agent framework
- 具体储存方案
- 具体前端实现
- 具体部署策略

---

## 版本

`execution-theory-kernel v1.0.0`

本 kernel 的语义版本：
- MAJOR：公理变更（打破兼容性）
- MINOR：公理澄清或补充（向后兼容）
- PATCH：术语/文档修正（无语义变化）
