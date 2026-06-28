# Phase B-0: Semantic Invariance Definition Spec v1

> 决策编译器在扰动空间中的不变量公理体系
>
> 本 spec 定义 B-0 的"一致性公理系统"，而非测试方案。
> 扰动作用于「输入空间」≠「规则空间」。
>
> 创建: 2026-06-22 | 状态: DRAFT | 批准: 待陛下朱批

---

## ⚠️ 宪法（不可违反）

```
B-0 扰动铁律:
  扰动可以改变「系统看到了什么」，
  但不能改变「系统如何去看」。
```

即：
- ✔ 允许改：Signal 的来源/顺序/置信度/噪声
- ❌ 禁止改：A-3.0 Deterministic Core 的计算规则、Agent 逻辑、Pipeline 节点定义
- ❌ 禁止改：Trust Level 体系、Conflict Resolution 策略集、Grounding 调整公式(±25% cap)
- ❌ 禁止改：Evaluation Axis 注册表、Domain 分类规则

---

## 一、Invariance Axioms（不变量公理）

### Axiom 1: Frame Invariance（框架不变性）

框架不变性的核心是：**系统对"这是什么问题"的判断，不因观测条件的改变而改变。**

```
Frame Invariance = Structural Invariance ∩ Semantic Invariance
```

#### 1.1 Structural Invariance（结构不变）

| 不变量 | 定义 | 判定 |
|--------|------|------|
| domain | problem.domain 在所有扰动路径下值相同 | `===` 相等 |
| axes_set | frame.evaluation.axes 的 name 集合相同 | 集合相等（无序） |
| candidate_set | frame.candidates 的 identity 集合相同 | 集合相等（无序） |

#### 1.2 Semantic Invariance（语义不变）

| 不变量 | 定义 | 判定 |
|--------|------|------|
| axes_weight_ordering | 各评价轴的权重相对排序不变 | 所有路径的权重排序 Kendall Tau ≥ 0.9 |
| domain_confidence_ordering | 各候选 domain 的置信度排序不变 | 排序不变性检验 |
| dimension_topology | 评价维度之间的层次结构不变 | DAG 图同构 |

---

### Axiom 2: Evaluation Invariance（评估不变性）

评估不变性的核心是：**系统的比较判断，不因输入条件的改变而颠倒。**

```
Evaluation Invariance = Pairwise Ranking Invariant ∩ Monotonic Consistency
```

#### 2.1 Pairwise Ranking Invariant（两两排序不变）

对于任意两个候选方案 A、B：

```
∀ perturbation_path p, q:
  rank_p(A) < rank_p(B) → rank_q(A) < rank_q(B)

除非：
  - A 和 B 的评分差在 p 与 q 之间的位移超过预设阈值
  - 且该位移可以被扰动程度解释（有证明）
```

#### 2.2 Monotonic Consistency（单调一致性）

```
数值可以变，排序不能翻。
允许评分偏移，但偏移量必须与扰动强度呈单调关系。
```

```text
Numeric drift allowed, ordering preserved.
Drift magnitude ≤ f(perturbation_strength)
```

#### 2.3 Score Drift Bound（漂移界限）

不是硬阈值 ±5，而是：

```
Δscore = |score_p(A, axis_x) - score_q(A, axis_x)|
η = perturbation_intensity

Δscore ≤ α · η + β
```

其中 α、β 为实验确定的系数，不同层不同域允许不同。

---

### Axiom 3: Decision Invariance（决策不变性）

决策不变性的核心是：**系统的最终结论和它的因果路径，不因输入条件的改变而替换。**

```
Decision Invariance = Outcome Stability ∩ Rationale Topology Stability
```

#### 3.1 Outcome Stability（结果稳定）

| 不变量 | 定义 | 判定 |
|--------|------|------|
| top_k_identity | Top-K 推荐的 entity 实体不变 | K=1 强制不变；K>1 允许 K-1 以内替换 |
| recommendation_axis_set | 推荐理由使用的评价轴集合不变 | 集合相等 |
| rejection_decision | 拒绝/无推荐态不变 | `===` 相等 |

#### 3.2 Rationale Topology Stability（理由图结构稳定）

推荐理由不是"文字一致"，而是**因果路径结构一致**：

```
rationale_graph = (V, E) where:
  V = {axis_1, axis_2, ..., axis_n, candidate_1, ..., candidate_m}
  E = {cause(effect ← cause)}
```

##### 理由图不变量：

| 不变量 | 定义 |
|--------|------|
| graph_isomorphism | 所有扰动路径的理由图同构 |
| primary_factor_stability | 第一因子（权重最高轴）不变 |
| causal_direction_stability | 因果方向不变（A→B 不能变成 B→A） |
| factor_hierarchy | 因子层次结构不变（主要/次要/修正） |

#### 3.3 Explanation Axis Set Stability（解释轴稳定）

```
推荐报告使用的解释轴集合，在所有扰动路径中不变。
允许增减低权重辅助轴（权重 < 0.05），
但不允许增减核心解释轴（权重 ≥ 0.1）。
```

---

## 二、Perturbation Model（扰动模型）

扰动模型严格遵循宪法：**只改变"系统看到了什么"，不改变"系统如何去看"**。

### 2.1 Signal Layer Perturbation（A-4 / World Observation Surface）

作用于：WorldInterface.ingest() → WorldView 的原始信号

| 扰动类型 | 描述 | 允许注入 | 禁止注入 |
|---------|------|---------|---------|
| source_bias | 数据源类型偏移 | 切换同类源（如链家↔贝壳） | 改 entity schema |
| missing_entities | 实体缺失率 | 随机丢弃 n% 实体 | 改 entity type 定义 |
| duplicated_entities | 实体重复 | 复制实体产生副本 | 改 entity identifier 规则 |
| timestamp_jitter | 时间戳漂移 | ± random(days) | 改时间轴顺序逻辑 |
| confidence_noise | 置信度扰动 | ± random(0~0.2) | 改置信度计算模型 |
| value_noise | 数值噪声 | ± random(0~ε%) | 改数值归一化公式 |

**约束**：Signal 扰动不改变 A-3.3/3.2 的运行规则。

### 2.2 Orchestration Layer Perturbation（A-3.3 / Signal Orchestration Surface）

作用于：SignalOrchestrator 的编排过程

| 扰动类型 | 描述 | 允许注入 | 禁止注入 |
|---------|------|---------|---------|
| signal_ordering | 信号处理顺序 | 随机改变信号输入顺序 | 改 Trust Level 体系 |
| conflict_strategy_swap | 冲突策略切换 | WEIGHTED_AVERAGE ↔ MEDIAN 等 | 新增/删除策略类型 |
| priority_weight_jitter | 优先级系数微调 | ±ε 调整权重参数 | 改权重公式 |
| filter_threshold_shift | 过滤阈值偏移 | ±0.05 调整信任过滤阈值 | 改过滤逻辑结构 |

**约束**：Orchestration 扰动不改变 TrustWeightRegistry 的 8 级体系、冲突解决 5 策略的定义。

### 2.3 Grounding Layer Perturbation（A-3.2 / Grounding Adjustment Surface）

作用于：RealityAdjustmentEngine 的锚定调整过程

| 扰动类型 | 描述 | 允许注入 | 禁止注入 |
|---------|------|---------|---------|
| reliability_scaling | 可信度缩放 | 全局 ×0.5~×1.5 | 改可靠性计算模型 |
| volatility_injection | 波动性注入 | 添加随机波动噪声 | 改波动性定义 |
| drift_amplification | 偏差放大 | ×1.0~×2.0 | 改 ±25% cap |
| signal_aggregation | 信号聚合方式 | 改聚合策略（avg/max/min） | 改审计结构 |

**约束**：Grounding 扰动不改变 adjustment formula（±25% safety cap）、不改变 audit trail schema、不改变 drift levels（GREEN/YELLOW/ORANGE/RED）。

---

## 三、Stability Metrics（稳定性度量）

不是"准确率"，而是 **不变性程度的结构化度量**。

### 3.1 Structural Invariance Score（结构不变性评分）

```
S_frame = w_d · 1(domain = domain_ref) 
        + w_a · jaccard(axes_set, axes_set_ref) 
        + w_c · jaccard(candidate_set, candidate_set_ref)

其中:
  w_d + w_a + w_c = 1
  jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

输出: `[0, 1]`，1 = 完全结构不变

### 3.2 Ranking Stability Index（排序稳定性指数）

```
RSI = mean_over_all_pairs(
  kendall_tau(ranking_p, ranking_ref)
)

变体:
  top_1_RSI = top-1 候选保持率
  top_3_RSI = top-3 重叠率
  full_RSI = 全排序 Kendall Tau
```

输出: `[-1, 1]`，1 = 完全排序一致

### 3.3 Causal Topology Stability（因果拓扑稳定性）

```
CTS = graph_edit_distance(rationale_graph_p, rationale_graph_ref) normalized
      × primary_factor_identity_rate
      × causal_direction_conservation_rate
```

输出: `[0, 1]`，1 = 完全因果结构一致

### 3.4 Aggregate Score（综合评分 — 字典序评价）

**重要**：不是加权和。评分系统采用 **lexicographic ordering（字典序评价）**：

```
CTS（因果拓扑稳定性）       ← 最底层结构，优先判定
  ↓ 如果 CTS ≥ 0.90:
RSI（排序稳定性指数）       ← 中层结构，次之判定
  ↓ 如果 RSI ≥ 0.80:
S_frame（结构不变性评分）    ← 表层结构，最后判定
  ↓
overall_stability = f(CTS, RSI, S_frame)  // 字典序聚合
```

**理由**：因果拓扑如果变了，排序再稳也只是"错得一致"。结构不变性如果变了但因果拓扑稳，说明系统的深层判断力仍在。

**判定逻辑**：

```
if CTS < 0.50:
  overall = CTS * 0.5                         // 严重退化，总体评分被拉低
elif RSI < 0.60:
  overall = CTS * 0.6 + RSI * 0.4             // 排序退化但因果链尚存
elif S_frame < 0.70:
  overall = CTS * 0.5 + RSI * 0.35 + S_frame * 0.15
else:
  overall = CTS * 0.5 + RSI * 0.3 + S_frame * 0.2
```

---

## 四、输出格式

### Semantic Stability Report

每次 B-0 运行输出：

```json
{
  "reportId": "b0_<timestamp>_<suffix>",
  "input": "深圳300万买房",
  "domain": "residential_property",
  "runConfig": {
    "perturbationCount": 20,
    "perturbationTypes": ["signal_noise", "signal_reorder", "grounding_uncertainty"],
    "variations": [
      { "type": "source_bias", "strength": 0.3 },
      { "type": "signal_ordering", "seed": 42 },
      { "type": "reliability_scaling", "factor": 0.7 }
    ]
  },
  "metrics": {
    "structuralInvariance": 0.95,
    "rankingStability": {
      "top1": 1.0,
      "top3": 0.87,
      "fullRSI": 0.82
    },
    "causalTopologyStability": 0.91,
    "overallStability": 0.89
  },
  "perLayerDrift": {
    "signal": { "maxScoreDeviation": 0.08, "axisImpact": "medium" },
    "orchestration": { "maxScoreDeviation": 0.03, "axisImpact": "low" },
    "grounding": { "maxScoreDeviation": 0.12, "axisImpact": "high" }
  },
  "violations": [
    { "axiom": "evaluation_pairwise_ranking", "severity": "warning", "candidates": ["A", "B"] }
  ]
}
```

---

## 附录 A：术语表

| 术语 | 定义 |
|------|------|
| 扰动空间 | 所有允许的 perturbation 组合构成的笛卡尔积 |
| 扰动路径 | 一次具体扰动序列（signal → orchestration → grounding） |
| 参考路径 | 零扰动的基准执行路径（reference execution） |
| 语义同构 | 两个执行结果的 Frame/Evaluation/Decision 结构等价 |
| 不变性评分 | 扰动路径 vs 参考路径的结构化相似度 |
| 允许自由度 | 系统可在不违反公理的前提下变化的范围 |

## 附录 B：宪法约束核对表（B-0 启动前必须逐条检查）

- [ ] 扰动不修改 A-3.0 Deterministic Core 的代码
- [ ] 扰动不修改 Trust Level 的 8 级体系
- [ ] 扰动不修改 Conflict Resolution 的 5 策略定义
- [ ] 扰动不修改 Grounding 的 ±25% safety cap
- [ ] 扰动不修改 Evaluation Axis 注册表
- [ ] 扰动不修改 Domain 分类规则
- [ ] 扰动不修改 Pipeline 节点定义（10 步）
- [ ] 扰动不修改 Agent Contract 类型定义

---

> **编辑人**: 臣妾
> **审阅人**: 陛下
> **本 spec 为 B-0 阶段宪法级文档，修改需陛下朱批**
