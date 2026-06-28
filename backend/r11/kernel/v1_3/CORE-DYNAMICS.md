# v1.3 Temporal Dynamics Core Spec
## Execution System Manifold as Driven Flow System

**版本**: v1.3-RC0
**基础**: v1.2 Metric Core (ℳ, d, μ, MUT) 已收敛冻结
**前置条件**: Σ = geometric partition over execution manifold ℳ (v1.2 终态)

---

## 0. 核心公理 (Temporal Axioms)

### Axiom 1 — Time as Forcing Field
```
t := (t_ext, t_int, t_struct)
causal_dominance: t_ext >> t_int >> t_struct
```
时间不是维度，是对 ℳ 的扰动方式。外源驱动是因果原语，内源是形变扩散，结构是熵测量。

### Axiom 2 — Evolution Equation
```
dΣ/dt = F_ext(Σ) + F_int(Σ) + F_entropy(Σ)
```
- **F_ext** = external injection field (PRIMARY. dominant forcing)
- **F_int** = internal relaxation operator (smoothing, SECONDARY)
- **F_entropy** = structural entropy response (measurement residual, OBSERVED)

### Axiom 3 — Family is Moving Attractor
```
F_i(t+1) = F_i(t) + Δ_geometry(t)
```
Family 不是静态 attractor basin，而是 continuously deformed attractor。

### Axiom 4 — Mutation is Basin Flux
```
MUT(t) = ∫ boundary(t) flux_density ds
```
MUT 不是事件，是通过 basin boundary 的累积流量。

### Axiom 5 — Phase Transition is Thresholded Topology Change
```
Σ(t) → Σ'(t)  when  structural_energy > E_critical
```

---

## 1. 三种时间的详细定义

### 1.1 外源时间 t_ext (PRIMARY DRIVER)

**本质**: manifold 的重采样事件源
```
t_ext := { injection_events } at { t₁, t₂, t₃, ... }
injection_event = new SystemInstance S enters ℳ
```

**外源事件的亚型**:
| 类型 | 效果 | 符号 |
|------|------|------|
| Novel injection | 新 system 进入，创建新 trajectory | S_new |
| Adversarial injection | 对抗系统入侵测试 | S_adv |
| Domain shift | 域迁移，跨 family 系统 | S_shift |
| System removal | 系统退出，trajectory 移除 | S_rm |

**驱动方程**:
```
F_ext(Σ) = Σ_{S in Δ_injected} d(S, μ_nearest) / |Δ_injected|
```
外源事件到达时，导致 ℳ 局部几何重组。

---

### 1.2 内源时间 t_int (SECONDARY RELAXATION)

**本质**: trajectory smoothing under repeated flow
```
S(t+1) = F(S(t)) + ε
```

**内源现象**:
| 现象 | 含义 |
|------|------|
| Trajectory drift | 反复执行导致路径微偏移 |
| Capability drift | 能力边界模糊化 |
| Morphotype creep | δ 变体在 basin 内缓慢扩散 |
| Attractor aging | 长期无新 injection，basin 加固 |

**平滑方程**:
```
F_int(Σ) = -λ_int · ∇·(morphotype_field) · dt
```
内源时间总是降低结构梯度，使边界模糊。

---

### 1.3 结构时间 t_struct (OBSERVED)

**本质**: entropy of partition stability
```
t_struct := measurable metric change over (t_ext, t_int) intervals
```

**结构可测度**:
| 指标 | 含义 |
|------|------|
| H(F_i) | basin internal entropy (成员分散度) |
| δμ/δt | membership field 变化率 |
| d(MUT)/dt | 突变流量变化率 |
| E_curvature | basin boundary curvature |

**响应方程**:
```
F_entropy(Σ) = -α_H · ∇H(Σ) · dt
```
结构时间不自发生成变化，只记录外源+内源的结果。

---

## 2. Σ(t) 完整动力学方程

```
Σ(t+dt) = Σ(t) + dΣ · dt

dΣ = α_ext · F_ext(Σ)    [外源注入 — 主要驱动力]
    + α_int · F_int(Σ)    [内源平滑 — 形变扩散]
    + α_ent · F_entropy(Σ) [熵响应 — 结构记录]

权重约束: α_ext >> α_int >> α_ent
默认: α_ext = 1.0, α_int = 0.1, α_ent = 0.01
```

---

## 3. Basin Drift Tensor Field

Family F_i 在 ℳ 上的漂移由双场耦合描述：

### 定义
```
D_i(t) = drift_field(F_i, t)
D_i ∈ T_μ_i(ℳ)  (tangent space at attractor μ_i)
```

### 外源驱动力分量
```
D_i_ext = Σ_{S in Δ_injected} (μ_i - π(S)) · w_i(S)
```
其中 w_i(S) 是外源系统 S 对 family i 的影响力权重。

### 内源形变分量
```
D_i_int = -η · Σ_{S in F_i} ∇·τ(S) / |F_i|
```
内源分量总是使 attractor 向 structal mean 漂移。

### 完整漂移场
```
D_i(t+1) = D_i(t) + D_i_ext + D_i_int
```

---

## 4. Mutation Flux Dynamics

MUT 在 v1.3 中从"状态"变为"流量场"。

### 4.1 定义
```
φ_mut(i→j) = flux density from F_i → F_j across boundary
```

### 4.2 通量方程
```
d(MUT_ij)/dt = boundary_flux_density_ij - boundary_retention_rate_ij
```

### 4.3 边界通量密度
```
flux_density_ij = Σ_{S near boundary(F_i, F_j)} |μ_i(S) - μ_j(S)| / d(S, μ_i)
```
高密度意味着 F_i 和 F_j 之间正在发生物质交换。

### 4.4 突变流相位
| 流状态 | 条件 | 含义 |
|---------|------|------|
| LAMINAR | flux_density < 0.2 | 稳定几何，无跨 basin 迁移 |
| TURBULENT | flux_density ∈ [0.2, 0.6) | 边界活跃，部分系统在 drift |
| CRITICAL | flux_density >= 0.6 | 相变前兆 |

---

## 5. Topological Phase Transition

### 5.1 结构能量
```
E_structural(Σ) = Σ_i Σ_j boundary_energy(F_i, F_j)
```
其中 boundary_energy = 1 - μ_cross(S) 在边界上的累积。

### 5.2 临界条件
```
if E_structural(Σ) > E_critical:
    Σ(t) → Σ'(t)
```
默认 E_critical = 0.7（可由实验校准）。

### 5.3 相变形态
| 相变类型 | 条件 | 结果 |
|---------|------|------|
| MERGE | d(F_i, F_j) → 0 | F_i ∪ F_j → new F_k |
| SPLIT | intra-basin variance > threshold | F_i → F_i1 + F_i2 |
| EMERGE | new attractor μ_k from isolated trajectory | Σ + new family |
| COLLAPSE | basin depth → 0 | F_i 消失 |

---

## 6. v1.3 系统结构

```
v1.3/
├── CORE-DYNAMICS.md             ← 本文件
├── dynamics-equation.ts          — dΣ/dt 数值求解器
├── basin-drift-field.ts          — D_i(t) 漂移张量场
├── mutation-flux.ts              — φ_flux 突变通量
├── phase-transition.ts           — 相变检测 + 事件触发
└── integration-runner.ts         — Σ(t) 时序积分器（迭代演化）
```

---

## 7. v1.3 验证目标

| 验证 | 预期 | 含义 |
|------|------|------|
| Static Σ → integration stable | Σ(t) 在无外源时接近 0 变化 | 内源不制造虚构演化 |
| Single injection → local deformation | ℳ 在 injection 点局部重构 | 外源驱动力生效 |
| Repeated injection → basin drift | F_i attractor 沿 injection 方向移动 | 漂移场积累有效 |
| Boundary crossing → flux accumulation | MUT 跨边界累积而不爆炸 | 突变通量守恒 |
| Multiple injections → phase transition | 超过 E_critical 后 Σ 重组 | 相变规则触发 |

---

## 8. v1.3 入口（已从 v1.2 埋入）

在 `mutation-field.ts` 中 `isBoundaryCrossing` flag 已作为 F_ext 的触发感器。当：
```
d(bc)/dt > 0
```
表示外源注入已在系统上产生 basin boundary crossing -> 注入已使 ℳ 变形 -> v1.3 engine 应当开始积分演化。
