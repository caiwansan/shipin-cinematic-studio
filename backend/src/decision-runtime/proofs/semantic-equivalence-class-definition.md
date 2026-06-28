# Phase B-0: Semantic Equivalence Class Definition（语义等价类定义）

> 决策编译器语义等价公理的核心补丁
>
> 定义什么是"两个执行是同一个语义结果"。
> 没有这个，B-0 只能判断"稳不稳"，不能判断"对不对"。
>
> 本文件与 semantic-invariance-definition-spec.md 互为宪法级文档，
> 后者定义公理，前者定义等价类。
>
> 创建: 2026-06-22 | 状态: DRAFT | 批准: 待陛下朱批

---

## ⚠️ 宪法原则

语义等价类定义遵守三条不可违反原则：

```
1. 等价 ≠ 相同
   ── 结构不同但语义角色相同仍可等价

2. 等价 ≠ 相似
   ── 相似是连续量（cosine 0.9），等价是离散关系（同 / 非同）

3. 等价类必须可判定
   ── 给定任意两个执行结果，算法能判定是否属于同一等价类
```

---

## 一、Frame Equivalence Relation（框架等价关系）

### 1.1 语义角色等价（Semantic Role Equivalence）

"地段"和"location"是同一个语义角色，"价格"和"cost"也是。

```
Frame_Equiv(A, B) =
  domain(A) === domain(B)                                            // 领域不变
  ∧ ∃ bijection f: axes_set(A) → axes_set(B)                       // 评价轴双射
    such that ∀ axial ∈ axes_set(A):
      semantic_role(axial) ≡ semantic_role(f(axial))                 // 轴名等价
      ∧ weight_diff |weight(axial) - weight(f(axial))| ≤ ε_w        // 权重容差
      ∧ rank(axial, axes_weight_ordering(A)) === rank(f(axial), axes_weight_ordering(B))
  ∧ ∃ bijection g: candidates(A) → candidates(B)                     // 候选实体双射
    such that ∀ c ∈ candidates(A):
      entity_identity(c) ≡ entity_identity(g(c))                     // 实体等价
```

#### 语义角色标注

预定义的语义角色等价组（可扩展）：

| 组 | 等价词 |
|----|--------|
| 价格成本 | price, cost, 价格, 单价, unit_price |
| 地理位置 | location, location_score, 地段, 区位 |
| 交通可达 | transportation, accessibility, 交通, 通勤 |
| 教育配套 | education, school, 学区, 学校 |
| 医疗配套 | healthcare, hospital, 医疗, 医院 |
| 质量品质 | quality, 品质, 质量, grade |
| 安全风险 | safety, risk, 安全, 风险 |
| 时间周期 | duration, timeline, 时间, 周期 |

**同一等价组内的轴名视为等价，跨组视为不等价。**

### 1.2 框架等价类的判定算法

```
function frameEquivalenceClass(execution):
  // 1. 提取框架签名
  domain_key = execution.frame.problem.domain
  axis_signature = canonical_form(execution.frame.evaluation.axes)
    // canonical_form = 轴按语义角色组重命名后排序
    // {"price": 0.35, "location": 0.30, "safety": 0.15}
  candidate_keys = execution.frame.candidates.map(c => entityKey(c))
    // entityKey = domain + type + primary attribute (如 "sz_房产_HouseA")
  
  // 2. 生成等价类哈希
  return hash(domain_key + "|" + axis_signature + "|" + sorted(candidate_keys))
```

**等价判定**：`frameEquivalenceClass(A) === frameEquivalenceClass(B)`

---

## 二、Evaluation Partial Order Preservation（评估偏序保持）

### 2.1 偏序保持（核心原则）

不是"数值不能变"，而是"偏序关系不能翻"。

```
Evaluation_Equiv(A, B) =
  ∀ a, b ∈ candidates:
    score(A, a) > score(A, b) → score(B, a) ≥ score(B, b)
    score(A, a) === score(A, b) → score(B, a) — score(B, b) 任意
```

即：
- **严格大于** 在扰动后可以退化为 **大于等于**（允许 tie）
- **等于** 不受约束
- **严格小于** 不能变成 **大于** 或 **大于等于**

### 2.2 偏序违反阈值

允许的违反：随机 tie 反转（原 A > B → A = B）不计为违反。
不允许的违反：严格偏序反转（原 A > B → B > A）。

```
violation(A, B, p, q) = 1 if:
  score_p(A) > score_p(B) AND score_q(B) > score_q(A)
  AND |score_p(A) - score_p(B)| > δ_min   // 排除浮点噪声

其中 δ_min = 0.01（默认），可调
```

### 2.3 等价类判定

```
function evaluationEquivalenceClass(execution):
  // 1. 生成整个候选集的偏序关系矩阵
  matrix = []
  for each (a, b) in pairs(execution.frame.candidates):
    matrix.push(sign(score(a) - score(b)))
      // sign: -1 (a<b), 0 (a=b), 1 (a>b)
  
  // 2. 偏序关系标准化（去除浮点噪声）
  matrix = denoise(matrix, δ_min)
  
  // 3. 等价类判定：偏序矩阵逐元素相等
  return hash(matrix)
```

**等价判定**：`evaluationEquivalenceClass(A) === evaluationEquivalenceClass(B)`

---

## 三、Decision Causal Graph Isomorphism（决策因果图同构）

### 3.1 因果图定义

```
G = (V, E, L) where:
  V = decision_variables ∪ intermediate_nodes
  E ⊆ V × V: 因果边 (cause → effect)
  L: V → label: 节点标签函数
```

标准标签语言（可扩展）：

| 层级 | 标签 | 含义 |
|------|------|------|
| 根因子 | primary_factor | 权重最高的评价轴 |
| 次要因子 | secondary_factor | 权重 2~3 位的轴 |
| 修正因子 | correction_factor | 权重 < 0.05 的微调轴 |
| 异常因子 | anomaly_factor | 与主流方向相反的轴 |
| 结论 | decision_node | 最终推荐结论 |
| 干预 | intervention | 外部约束（预算/时间/距离） |

### 3.2 图同构判定

```
Decision_Equiv(A, B) =
  ∃ isomorphism φ: V_A → V_B such that:
    1. ∀ v ∈ V_A: label(v) ≡ label(φ(v))             // 标签等价
    2. ∀ (u, v) ∈ E_A: (φ(u), φ(v)) ∈ E_B             // 因果边保持
    3. causal_direction(u → v) === causal_direction(φ(u) → φ(v))
    4. primary_factor(V_A) → φ(primary_factor(V_A)) = primary_factor(V_B)
    5. 允许以下自由度:
       - 增减 correction_factor 节点
       - 增减权重 < 0.05 的辅助边
    6. 禁止以下变化:
       - 增删 primary_factor 或 secondary_factor 节点
       - 反转 primary_factor 的入边/出边方向
       - 主结论节点 mismatch
```

### 3.3 模糊同构（允许的自由度）

不是"严格同构"，而是"语义同构"——允许在自由度量内变化：

```
ε_label_similarity = cos(label_embedding(u), label_embedding(φ(v))) ≥ 0.85
ε_graph_distance = normalized_graph_edit_distance(G_A, G_B) ≤ 0.15
```

### 3.4 等价类判定

```
function decisionEquivalenceClass(execution):
  graph = extractCausalGraph(execution.report)
  
  // 1. 标准化（按标签排序）
  canonical_graph = normalizeGraph(graph)
    // 移除 correction_factor 节点和权重<0.05的边
    // 对 primary, secondary, anomaly 节点按 label 排序
  
  // 2. 生成图签名
  adjacency_signature = canonical_graph.adjacencyList()
  node_label_signature = canonical_graph.nodes.map(l => l.type)
  primary_node = canonical_graph.findNode("primary_factor")
  
  return hash(adjacency_signature + "|" + node_label_signature + "|" + primary_node.id)
```

**等价判定**：`decisionEquivalenceClass(A) === decisionEquivalenceClass(B)`

---

## 四、综合语义等价类

### 4.1 三层联合判定

```
Semantic_Equiv(A, B) =
  frameEquivalenceClass(A) === frameEquivalenceClass(B)        // 框架等价
  ∧ evaluationEquivalenceClass(A) === evaluationEquivalenceClass(B)  // 偏序等价
  ∧ decisionEquivalenceClass(A) === decisionEquivalenceClass(B)       // 因果图等价
```

### 4.2 字典序降级（允许部分匹配）

如果三层不能全部等价，按字典序判定：

```
lexicographic(decision, evaluation, frame):
  if decisionEquiv(A, B):
    status = "EQUIVALENT"
  elif evaluationEquiv(A, B):
    status = "EVALUATION_STABLE"  // 框架等价丢失
  elif frameEquiv(A, B):
    status = "FRAME_STABLE"       // 框架完整但后续退化
  else:
    status = "NOT_EQUIVALENT"
```

### 4.3 等价类报告

```json
{
  "equivalenceId": "b0_eq_<tag>",
  "executionA": "trace_xxxx",
  "executionB": "trace_yyyy",
  "equivalenceLevel": "EQUIVALENT",
  "details": {
    "frameEquiv": true,
    "evaluationEquiv": true,
    "decisionEquiv": true,
    "primaryFactor": {
      "a": "price",
      "b": "cost",
      "verdict": "same_semantic_role"
    }
  },
  "violations": [],
  "drift": {
    "maxScoreDelta": 3.2,
    "perturbation": "signal_noise_0.3"
  }
}
```

---

## 五、宪法约束（等价类定义不可违反）

```
1. 等价类不可退化到"专家抽样"
   ── 判定必须全自动，不需要人工标注

2. 等价类必须可计算
   ── 时间复杂度 O(n²) 以内，n = 候选方案数

3. 等价类定义不是配置
   ── 语义角色等价组和因果图标签由本 spec 定义，非运行时配置

4. 等价类不承诺"正确"
   ── 只承诺"同一等价类"。
   "这个决策是否正确"属于 Phase B-1 的范畴
```

---

## 附录 A：完整的等价判定流程

```
Execution A ──→ Frame Sig A ──+
                               ├── Frame 等价？─────→ 否 ──→ NOT_EQUIVALENT
Execution B ──→ Frame Sig B ──+                        │
                                                      是
                                                       ↓
                               ┌── Evaluation 偏序矩阵 A ──+
                               │                          ├── 偏序保持？───→ 否 ──→ FRAME_STABLE
                               └── Evaluation 偏序矩阵 B ──+                       │
                                                                                   是
                                                                                    ↓
                               ┌── Causal Graph A ──+
                               │                     ├── 图同构？───→ 否 ──→ EVALUATION_STABLE
                               └── Causal Graph B ──+                          │
                                                                               是
                                                                                ↓
                                                                          EQUIVALENT
```

## 附录 B：与 Stability Metrics 的关系

```
Equivalence Class Status    对应的 Stability Metrics 阈值范围
─────────────────────────────────────────────────────────
EQUIVALENT                  S_frame ≥ 0.95 ∧ RSI ≥ 0.90 ∧ CTS ≥ 0.90
EVALUATION_STABLE           S_frame ≥ 0.80 ∧ RSI ≥ 0.80
FRAME_STABLE                S_frame ≥ 0.60
NOT_EQUIVALENT              S_frame < 0.60
```

> **注意**：Metrics 是连续量（指示程度），Equivalence 是离散关系（指示身份）。
> Metrics 用于监控和预警，Equivalence 用于证明和断言。
> **两者共存，互不替代。**

---

> **编辑人**: 臣妾
> **审阅人**: 陛下
> **本文件为 B-0 阶段宪法级文档，修改需陛下朱批**
