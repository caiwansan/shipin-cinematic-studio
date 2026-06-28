# SMES — Stability Manifold Embedding Space

## Phase 4.12 — 将 IDF / CII / Phase Portrait 统一为同一几何对象

> 本文档不是架构设计，不是工程规范，不是代码实现。
> 它是一个 formal specification：将系统现有的三个观测层（IDF / CII / Phase Portrait）
> 统一嵌入同一个可证明度量空间。

---

## 1. Abstract

系统 Phase 4 的完整观测层由三个独立算子构成：

- **IDF**：意图分布漂移（probability manifold）
- **CII**：因果图拓扑熵（graph topology manifold）
- **Phase Portrait**：相位轨迹吸引子（dynamical systems manifold）

当前状态：三个算子独立运行，各有自己的度量空间和输出域。

SMES 的目标是：

> 构造一个统一的 embedding：
> $$\Phi: \mathcal{S} \rightarrow \mathcal{M}$$
>
> 其中 $\mathcal{S}$ 是系统状态空间，$\mathcal{M} \subset \mathbb{R}^n$ 是隐式流形。
>
> 稳定性定义为：系统轨迹 $\{\Phi(s_t)\}_{t=0}^\infty$ 收敛到同一 invariant attractor region $\mathcal{A} \subset \mathcal{M}$。

**这不是一个新的观测层。这是对已有三个观测系统的坐标统一。**

---

## 2. System State Space

定义系统在时间 $t$ 的状态为：

$$s_t = (I_t, C_t, P_t)$$

其中：

| 符号 | 来源 | 描述 |
|------|------|------|
| $I_t$ | IDF | 意图类型分布 $P_t \in \mathcal{P}(\Omega)$ |
| $C_t$ | CII | 因果图 $G_t = (V_t, E_t)$ 及其拓扑熵 |
| $P_t$ | Phase Portrait | 相位坐标 $(stability, confidence, conflict) \in [0,1]^3$ |

**注意**：$s_t$ 不是系统原始状态，而是**观测层已聚合的中间表示**。SMES 不消费原始 trace 数据，只消费 IDF / CII / Portrait 的输出。

---

## 3. Embedding Layer

### 3.1 IDF Embedding

$$\Phi_I(s_t) = P_t \in \mathcal{P}(\Omega)$$

度量：

$$d_I(t, k) = D_{KL}(P_t \parallel P_{t-k})$$

其中 $P_t$ 是 IDF 在时间 $t$ 的离散意图分布，$\Omega$ 是意图类型空间。

**流形类型**：概率单纯形（probability simplex on $\Omega$）

### 3.2 CII Embedding

$$\Phi_C(s_t) = H^*(G_t) \in [0, 1]$$

其中：

$$H^*(G_t) = \frac{H(G_t)}{\log |V_t|}$$

$H(G_t)$ 是因果图 $G_t$ 的拓扑熵，$|V_t|$ 是图中节点数。除法归一化消除图大小的影响。

度量：

$$d_C(t) = |H^*_t - H^*_{ref}|$$

其中 $H^*_{ref}$ 是参考状态（系统中已记录的任意 baseline）。

**流形类型**：归一化熵空间（compact interval $[0,1]$）

### 3.3 Phase Portrait Embedding

$$\Phi_P(s_t) = A_t \in [0,1]^3$$

其中 $A_t = (x_t, y_t, z_t)$ 是相位坐标：
- $x_t$：DSB stability score（稳定性轴）
- $y_t$：DIE intent confidence（意图轴）
- $z_t$：DCVL divergence rate（冲突轴）

度量：

$$d_P(t, k) = \|A_t - A_{t-k}\|_2$$

**流形类型**：欧几里得子空间 $[0,1]^3 \subset \mathbb{R}^3$

### 3.4 统一 Embedding

完整的 SMES embedding 是三个子嵌入的直积：

$$\Phi(s_t) = (\Phi_I(s_t), \Phi_C(s_t), \Phi_P(s_t)) \in \mathcal{P}(\Omega) \times [0,1] \times [0,1]^3$$

定义流形 $\mathcal{M}$ 为上述直积空间的嵌入像。

---

## 4. Metric Layer

SMES 的统一度量定义为三个子度量的加权组合：

$$\mathbf{g}_{SMES}(t, k) = \begin{pmatrix}
\alpha \cdot d_I(t, k) \\
\beta \cdot d_C(t, k) \\
\gamma \cdot d_P(t, k)
\end{pmatrix}$$

权重 $\alpha, \beta, \gamma$ 的约束：
- $\alpha + \beta + \gamma = 1$
- 初始默认值：$\alpha = 0.3, \beta = 0.3, \gamma = 0.4$（Phase Portrait 观测时间最长，权重大）
- 权重是系统参数，不是不变量。它们定义的是 **metric geometry 的曲率偏好**，而不是真值。

**SMES 标量距离**（可选全局度量）：

$$D_{SMES}(t, k) = \sqrt{\alpha \cdot d_I(t, k)^2 + \beta \cdot d_C(t, k)^2 + \gamma \cdot d_P(t, k)^2}$$

### 4.1 Metric Compatibility Condition ⬅️ 新增：统一度量兼容条件

上述加权组合隐含一个假设：三个子度量在同一个 scale 上可比。

但现实是：
- $d_I = D_{KL}$ 的值域是 $[0, \infty)$（理论上无上界）
- $d_C \in [0, 1]$
- $d_P \in [0, \sqrt{3}]$（$[0,1]^3$ 的欧氏距离最大值）

如果直接加权，IDF 的 KL 散度会支配整个度量，CII 和 Portrait 的贡献被淹没。

**条件：三个子度量必须通过 bounded distortion constraint 转化为可比空间。**

$$\exists B > 0 : \forall t, k, \quad \tilde{d}_I(t, k) \in [0, B], \ \tilde{d}_C(t, k) \in [0, B], \ \tilde{d}_P(t, k) \in [0, B]$$

其中 $\tilde{d}$ 是归一化后的子度量：

$$\tilde{d}_I(t, k) = \min\left(1, \frac{d_I(t, k)}{\varepsilon_I}\right)$$
$$\tilde{d}_C(t, k) = d_C(t, k) \quad (\text{已在 } [0,1])$$
$$\tilde{d}_P(t, k) = \frac{d_P(t, k)}{\sqrt{3}} \quad (\text{归一化到 } [0,1])$$

$\varepsilon_I$ 是 IDF 的参考尺度（经验参数，由自然观测数据确定——例如 $P_t$ 分布相差一个意图类型时的典型 KL 值）。

修正后的 SMES 度量为：

$$D_{SMES}(t, k) = \sqrt{\alpha \cdot \tilde{d}_I(t, k)^2 + \beta \cdot d_C(t, k)^2 + \gamma \cdot \left(\frac{d_P(t, k)}{\sqrt{3}}\right)^2}$$

其中 $\alpha + \beta + \gamma = 1$，$\tilde{d}_I$ 使用 $\varepsilon_I$ 做 capped normalization。

**这一条件确保 SMES 是一个真正的 Riemannian product metric，而非弱耦合空间的拼合。**
三个子空间的尺度偏差被 bounded distortion constraint 消除，使得 $D_{SMES}$ 在各子空间上可比。

---

## 5. Invariant Definition Layer

### 5.1 轨道等价类

定义两条系统轨迹 $\{s_t\}$ 和 $\{s'_t\}$ 等价，当且仅当：

$$\lim_{T \to \infty} \frac{1}{T} \sum_{t=0}^T D_{SMES}(s_t, s'_t) = 0$$

这定义的是 **渐近轨道等价**，不是逐点等价。

### 5.2 Invariant Attractor Region

定义 attractor region $\mathcal{A} \subset \mathcal{M}$ 满足：

$$\forall \epsilon > 0, \ \exists T > 0 : \forall t > T, \ \inf_{a \in \mathcal{A}} \|\Phi(s_t) - a\|_{\mathcal{M}} < \epsilon$$

其中 $\|\cdot\|_{\mathcal{M}}$ 是由 $\mathbf{g}_{SMES}$ 诱导的流形距离。

**工程解释**：系统最终进入 $\mathcal{A}$ 并停留其中，不再离开。

### 5.3 稳定性定义

系统是稳定的当且仅当：

$$\exists \mathcal{A} \subset \mathcal{M} : \forall \delta > 0, \ \exists T > 0 : \forall t > T, \ D_{SMES}(t, t+k) < \delta \ \text{for all sufficiently large } k$$

也就是说：存在一个不变量 attractor region $\mathcal{A}$，系统进入后停留，所有后续状态间的 SMES 距离一致趋近于 0。

**这个定义不依赖 ε、θ、N、M 等阈值。它只依赖流形 $\mathcal{M}$ 上的拓扑。** 阈值是数据拟合阶段的产物，不是定义的一部分。

---

## 6. System Identification Protocol

在 SMES 框架下，系统当前的「自然观测阶段」应产生以下输出：

### 6.1 初始 Reference 状态

系统的第一个 attractor state $\Phi(s_0)$ 被记录为 reference embedding。这是当前 naturalistic observation 的目标。

### 6.2 轨迹投影

每次 IDF / CII / Phase Portrait 采样，系统输出：

$$\Phi(s_t) \in \mathcal{A}(\Omega) \times [0,1] \times [0,1]^3$$

并计算：

$$D_{SMES}(t, 0) = \text{distance from reference}$$

### 6.3 收敛判定

系统声称「稳定收敛」当且仅当：

连续 $M$ 个采样满足 $D_{SMES}(t, 0) < \delta$，且 $\Phi_P(s_t)$ 的方差小于 $\theta$。

**其中 $M, \delta, \theta$ 的值在系统积累足够多的自然观测后，由数据拟合得到。** 它们是流形的经验参数，不是不变量。

---

## 7. SMES 与 IPSL 的关系

```
IPSL  →  counterfactual observer over telemetry
SMES  →  geometric coordinate system for observed data

IPSL 回答：如果……会怎样？
SMES 回答：系统在哪里？它是否还是它自己？
```

两者不冲突，不重叠，不互相依赖。

- IPSL 定义「怎么扰动系统来测」
- SMES 定义「测出来的东西在什么几何空间中」

IPSL 已冻结为纯文档。
SMES 在当前阶段是纯数学规范。

---

## 8. 当前状态

- SMES 规范：✅ 完成（本文档）
- 嵌入函数：已有 IDF / CII / Phase Portrait 实现（无需修改）
- 未度量定义：$\mathbf{g}_{SMES}$ 已定义但权重未校准（$\alpha, \beta, \gamma$ 暂用默认值）
- 收敛参数：$M, \delta, \theta$ 待自然观测数据拟合
- 系统实现：**不变。** 不新增代码，不修改现有观测层

下一步：
```
自然观测继续 → 数据积累
  ↓
IDF / CII / Portrait 输出收集
  ↓
经验参数拟合（M, δ, θ, α, β, γ）
  ↓
SMES 从 formal spec 升级为 operational tool
```

---

*本文档不修改任何系统代码，不改变任何运行时代码的行为。*
*它将三个独立的观测系统统一为一个几何对象的形式定义。*
