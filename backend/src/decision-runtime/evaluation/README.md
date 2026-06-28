# P1.3 Evaluation Geometry

## 核心思想

**让 Evaluation 不再是简单加权平均。**

传统的推荐系统用加权打分 → 排序 → Top-1 输出。
P1.3 引入**几何评价框架**：

```
Candidate
  ↓
EvaluationAxes (7个正交轴)
  ↓
Candidate Vector (7维向量)
  ↓
Dominance Analysis (Pareto支配)
  ↓
Pareto Frontier (前沿面)
  ↓
Geometry Metrics (前沿分析)
  ↓
Recommendation Layer (三层输出)
```

## 7 个评估轴

| 轴 | 含义 | 范围 |
|----|------|------|
| relevance | 查询相关性 | [0,1] |
| authority | 信息来源权威度 | [0,1] |
| recency | 信息时效性 | [0,1] |
| completeness | 信息完整度 | [0,1] |
| consensus | 多方一致度 | [0,1] |
| diversity | 视角多样性 | [0,1] |
| risk | 风险/不确定性 | [0,1] |

## 输出结构

```json
{
  "recommended": { "candidate": "...", "vector": [...] },
  "alternative": { "candidate": "...", "vector": [...] },
  "contrarian": { "candidate": "...", "vector": [...] }
}
```

## 冻结声明

- Universe: frozen
- SeedMatcher: frozen
- QueryExpansion: frozen
- SearchPipeline: frozen
- **仅允许修改**: evaluation/* 和 recommendation/*
