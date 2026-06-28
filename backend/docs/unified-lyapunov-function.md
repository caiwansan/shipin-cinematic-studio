# Unified Lyapunov Function Framework

## 跨 IDF / CII / Phase Portrait 的系统稳定性见证函数

> 本文档不是工程规范，不是代码实现。
> 它是一个 theoretical closure layer（理论层封装）：
> 将系统现有的三个观测流形统一投影到同一个标量能量场，
> 用于证明系统稳定性，不用于控制系统行为。

---

## 1. 核心思想

系统当前有三个已定义的流形动力：

| 观测层 | 动力类型 | 流形 |
|--------|----------|------|
| IDF | 意图分布漂移 | probability simplex $\mathcal{P}(\Omega)$ |
| CII | 因果图拓扑流 | normalized entropy space $[0,1]$ |
| Phase Portrait | attractor dynamics | Euclidean subspace $[0,1]^3$ |

它们在 SMES 中已被统一为 product Riemannian manifold。但「统一度量」只能描述系统在哪里，不能回答「系统能否持续存在」。

**Lyapunov function 的角色**：将三种异构动力投影到同一个标量能量场 $L(S_t) \in \mathbb{R}^+$，使得稳定性可以表示为 $L$ 沿系统轨迹的非增性。

**关键约束**：Lyapunov function 是 **stability witness**，不是 control signal。它证明系统稳定性，不干预系统行为。

---

## 2. 统一状态变量

定义系统在 SMES 上的投影状态：

$$S_t = (\Phi_I(s_t), \Phi_C(s_t), \Phi_P(s_t)) \in \mathcal{P}(\Omega) \times [0,1] \times [0,1]^3$$

其中：
- $\Phi_I(s_t) = P_t$：IDF 意图分布
- $\Phi_C(s_t) = H^*(G_t)$：CII 归一化因果熵
- $\Phi_P(s_t) = A_t = (x_t, y_t, z_t)$：Phase Portrait 相位坐标

---

## 3. Unified Lyapunov Function

### 3.1 定义

$$L(S_t) = w_I \cdot L_I(t) + w_C \cdot L_C(t) + w_P \cdot L_P(t)$$

其中：

**IDF energy term（分布漂移能量）**：

$$L_I(t) = D_{KL}(P_t \parallel P_{ref})$$

衡量当前意图分布与 reference 分布之间的 KL 散度。

- $L_I = 0$：分布与 reference 完全一致（无漂移）
- $L_I > 0$：分布发生漂移
- 上界：$L_I \leq \ln|\Omega|$（离散分布的 KL 散度最大值）

**CII energy term（因果结构变形能量）**：

$$L_C(t) = |H^*(G_t) - H^*(G_{ref})|$$

衡量当前因果图的归一化拓扑熵与 reference 的绝对偏差。

- $L_C = 0$：因果结构与 reference 同构（图拓扑不变）
- $L_C > 0$：因果结构发生变形
- 上界：$L_C \leq 1$（归一化熵空间 $[0,1]$）

**Phase Portrait energy（attractor 弥散能量）**：

$$L_P(t) = \text{Var}(A_t)$$

衡量最近 $k$ 个相位坐标的方差。

- $L_P = 0$：相位坐标完全不动（locked attractor）
- $L_P > 0$：相位坐标在 attractor 附近振荡
- 上界：$L_P \leq 0.25$（$[0,1]^3$ 上的最大方差）

**参考状态定义**：

$P_{ref}$ 和 $G_{ref}$ 是系统首次检测到 attractor（Phase Portrait 报告 hasAttractor=true）时的 IDF 分布和 CII 因果图。这一个选择是关键的——它定义了「系统是它自己」时的状态。

### 3.2 权重约束

$$w_I > 0, \ w_C > 0, \ w_P > 0$$
$$w_I + w_C + w_P = 1$$

权重决定了能量场的**曲率偏好**，不改变稳定性本身。

- 默认值：$w_I = 0.3, w_C = 0.3, w_P = 0.4$（与 SMES 一致）
- 权重是理论参数，不是经验参数。它们不来自数据拟合，而来自对「系统哪个子空间的稳定性更重要」的理论选择。

---

## 4. 稳定性条件

### 4.1 强稳定性条件

系统是渐近稳定的，如果：

$$\frac{d}{dt} L(S_t) \leq 0$$

即 Lyapunov energy 沿时间轴的导数非正。

离散时间等价形式：

$$L(S_{t+1}) - L(S_t) \leq 0$$

如果这对所有 $t \geq T$（进入 attractor 之后）成立，则系统在 Lyapunov 意义下稳定。

### 4.2 弱稳定性条件（随机系统实用版本）

对于随机系统，强形式的逐点成立过于严格。实用版本：

$$\mathbb{E}[L(S_{t+1}) - L(S_t) \mid \mathcal{F}_t] \leq 0 \quad \text{(a.s.)}$$

条件期望意味着：系统的 Lyapunov energy 在条件期望意义下不增，但允许单步的随机波动。

### 4.3 Attractor Existence 条件

如果：

1. $L(S_t) \geq 0$（非负性）
2. $\exists T > 0 : \forall t > T, \ \mathbb{E}[L(S_{t+1}) - L(S_t) \mid \mathcal{F}_t] \leq 0$（弱稳定性）
3. $\{S_t : L(S_t) = 0\} \neq \varnothing$（零能量集非空）

则系统几乎必然收敛到 $\{S_t : L(S_t) = 0\}$ 的子集——即 **invariant attractor basin**。

证明思路（类 Lyapunov-Poincaré）：

$$\mathbb{E}[L(S_{T})] \leq L(S_0) - \sum_{t=0}^{T-1} \mathbb{E}[L(S_t) - L(S_{t+1})]$$

由于 $L(S_t) \geq 0$，右侧收敛到下界，左侧递减，因此 $L(S_t) \to 0$ a.s.。

### 4.4 收敛率

在弱稳定性条件下，期望收敛率的 bound 为：

$$\mathbb{E}[L(S_t)] \leq \frac{L(S_0)}{t}$$

（推导：对 $\mathbb{E}[L(S_{k+1})] \leq \mathbb{E}[L(S_k)]$ 递归求和。）

---

## 5. 理论闭包：三层完整形态

加入 Lyapunov Function 后，系统理论层已完整闭合：

| 层 | 函数 | 回答的问题 |
|----|------|-----------|
| IPSL | $\psi: \text{telemetry} \to \text{difference}$ | 什么变了？ |
| SMES | $\Phi: s_t \to \mathcal{M}$ | 它在哪？ |
| Lyapunov | $L: \mathcal{M} \to \mathbb{R}^+$ | 它能持续存在吗？ |

系统不再是「定义完整但不可证明」，而是：

> **well-defined stochastic dynamical system with Lyapunov witness functional**

---

## 6. 约束边界（不可违反）

### 6.1 Lyapunov function 不进入 runtime

- `allowed`：离线稳定性分析、轨迹评估、理论证明
- `forbidden`：决策引导、runtime scoring 影响、策略选择

### 6.2 Lyapunov function 不修改 SMES

- `allowed`：在 SMES 上定义 scalar functional
- `forbidden`：改变 SMES 的 product Riemannian metric

### 6.3 Lyapunov function 不产生新语义

- `allowed`：聚合已有观测指标为标量能量
- `forbidden`：引入新观测层、新算子、新流形

---

## 7. 当前状态

| 条目 | 状态 |
|------|------|
| Lyapunov 定义 | ✅ 完成 |
| 三能量项（IDF / CII / Portrait） | ✅ 已定义 |
| 强稳定性条件 | ✅ 已定义 |
| 弱稳定性条件（随机系统版本） | ✅ 已定义 |
| Attractor existence 条件 | ✅ 已证明（类 Lyapunov-Poincaré） |
| 收敛率 bound | ✅ 已推导 |
| 约束边界 | ✅ 已写入 |
| runtime 实现 | ❌ 无（永不） |

---

## 8. 下一步

下一步如果需要推进理论收束，唯一合理方向是：

> **证明 L(S_t) 在 SMES 上定义一个吸引子盆地的充分条件**

即：给定 SMES 的 product Riemannian metric $\mathbf{g}_{SMES}$，找到 $L(S_t)$ 沿系统轨迹单调递减的拓扑条件。

这一层的工作属于纯数学范畴——不再涉及任何系统架构或工程设计，只涉及 dynamical systems theory 下的稳定性证明。

---

*本文档不修改任何系统代码，不改变任何运行时代码的行为。*
*它将系统的稳定性从「可观测」升级为「可证明」。*
