# v1.2 — Execution System Taxonomy Schema

> Execution Theory Kernel 的"分类学"层。
> 定义：System Family / Morphotype / Mutation 的结构空间 + 判定规则。

---

## 1. Execution System Family

### 定义

一个 **Execution System Family** 是所有在 Kernel invariants 下保持结构不变性的系统集合。

```
F = {δ | Π(δ, δ_ref) ≥ τ ∧ D(δ, δ_ref) ≤ ε}
```

其中：
- τ = invariant preservation 阈值（默认 1.0 — 所有 9 个 invariants 必须保持）
- ε = 行为距离上限（默认 0.5 — 允许显著行为差异，只要仍属于同一结构类）
- δ_ref = 家族参考系统（首个被注册的该家族系统）

### 家族判定维度

| 维度 | 算子 | 含义 |
|------|------|------|
| Invariant Preservation | Π | 所有 9 个 Kernel invariants 是否保持 |
| State Topology | T_S | 系统状态的图拓扑结构（链式/树形/DAG） |
| Execution Semantics | E_S | δ 执行语义（transformation 的责任范围） |
| Capability Closure | C_S | 系统能做什么（同 domain 内的能力边界） |

### 已知家族

| 家族 | 参考系统 | Π | 状态 |
|------|---------|---|------|
| **KunlunCinematic** | 短剧工作台 (short-drama-v1) | 1.0 | 已注册 |
| **KunlunPresentation** | PPT 工作台 (ppt-studio-v1) | 1.0 | 已注册 |

### 家族注册条件

当一个新系统满足以下全部条件时，归入已有家族：

```
1. Π(δ_new, δ_ref) ≥ 0.78    (至少 7/9 invariants 保持)
2. 与家族内任意系统至少共有一个 domain 语义的 operator
3. execution topology 无结构突变（即 morphotype 未越界）
```

若 1 成立但 2 或 3 不成立，则创建一个新家族。

---

## 2. Execution Morphotype

### 定义

**Morphotype** 是同一家族内执行形态的变体分类。
同一 morphotype 内的系统在 operator 拓扑和行为距离上是"近邻"。

划分为三个等级：

| 等级 | D composite | 含义 |
|------|-----------|------|
| **SAME** | D ≤ 0.1 | 同一 morphotype — 结构等价 |
| **VARIANT** | 0.1 < D ≤ 0.4 | 形态变异 — 结构相似但局部差异 |
| **DIVERGENT** | D > 0.4 | 形态分化 — 但仍在同一家族内 |

### 形态判定维度

| 维度 | 测量 | 含义 |
|------|------|------|
| Operator Count | |δ|| 系统包含多少个 δ 实例 |
| Graph Topology | T_G | operator 序列是线性/DAG/分层 |
| Causal Pattern | C_P | 因果链深度 + 分支度 |
| State Evolution | S_E | state 变换的 step 数量/密度分布 |

### KunlunCinematic 家族的 Morphotype 分析

| 系统 | Morphotype | D | 特征 |
|------|-----------|--|------|
| short-drama-v1 | BASE_CINEMATIC | — | 5 domain ops, linear pipeline, causal depth 5 |
| ppt-studio-v1 | BASE_PRESENTATION | 0.228 | 5 domain ops, linear pipeline, causal depth 5 |

**结论：** 两个系统属于 VARIANT morphotype — operator 语义不同但拓扑同构。

---

## 3. Mutation

### 定义

**Mutation** 是导致 morphotype 变更或家族跨越的结构变化。

### 突变分类

| 类型 | Π 变化 | D 变化 | 含义 |
|------|--------|--------|------|
| **Conservative** | Π 不变 | D 小幅上升 (≤0.1) | 形态微调 — 如替换一个 operator |
| **Drift** | Π 下降 (0.5~0.78) | D 中等 (0.1~0.4) | 结构漂移 — 可能接近边界 |
| **Rupture** | Π → 0 | D → 大 | 结构破裂 — 跨越家族边界 |

### 突变检测规则

一个 system 发生 mutation 当：

```
ΔΠ(δ_t, δ_{t-1}) < 0    (invariant 退化)
或
ΔD(δ_t, δ_{t-1}) > 0.3  (行为突变)
```

---

## 4. Taxonomy Schema 形式化定义

```text
Taxonomy Σ = ⟨F, M, MUT⟩

F = family set
  F_i = {system ∈ Σ | Π(system, F_i.ref) ≥ τ_i}

M = morphotype set
  M_j = {system ∈ F_i | D(system, base) ∈ M_j.threshold}

MUT = mutation set
  MUT_k = {(from_morphotype, to_morphotype, cause)}
```

---

## 5. 当前 taxonomy 状态（v1.2 基线）

```
Σ = ⟨F={F1, F2}, M={M1a, M2a}, MUT={}⟩

F1 = KunlunCinematic
  ref = short-drama-v1
  τ   = 0.78
  M1a = BASE_CINEMATIC
    systems = {short-drama-v1}
    D range = [0, 0.1]

F2 = KunlunPresentation
  ref   = ppt-studio-v1
  τ     = 0.78
  M2a = BASE_PRESENTATION
    systems = {ppt-studio-v1}
    D range = [0, 0.1]

MUT = {}  (尚未观测到跨形态突变)
```

---

## 6. 新系统注册协议

1. 计算 Π(system, 所有已知 ref)
2. 若 ∃F_i | Π ≥ F_i.τ：
   - 归入 F_i
   - 计算 D(system, F_i 内各 morphotype base)
   - 分配最相近的 morphotype（或创建新 morphotype）
3. 若 ∀F_i | Π < F_i.τ：
   - 创建新家族 F_new
   - ref = system
   - τ = 1.0（初始）
4. 记录 mutation（如果有 morphotype 间距离突变）
