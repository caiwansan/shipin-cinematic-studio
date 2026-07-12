# LLM Visibility Signal Model

> 领域模型定义：非 metric 的 observational signal layer。
> 不属于 Scoring / KPI 体系，而是 LLM 认知分布的观测器。

## 领域分层

```
System Layer
├── Deterministic Runtime (可证明系统)
│   ├── Simulation Gate
│   ├── Replay System
│   ├── Trace Graph
│   └── Verification (Truth Score ← 不属本模型)
│
└── Observational Layer (LLM Visibility Signal Model) ← 本模型
    ├── Signal Capture — provider probe results
    ├── Signal Interpretation — recall consistency, model divergence
    └── Signal Presentation — Awareness, Trend, Disagreement
```

## 核心概念

| 术语 | 定义 | 说明 |
|------|------|------|
| **Awareness** | 品牌在 LLM 训练语料/语义空间中被识别的状态 | Known / Unknown / Weak |
| **Recall** | 单个模型/Adapter 对品牌的语义回忆结果 | FOUND / NOT_FOUND / UNKNOWN / ERROR |
| **Consistency** | 各模型间 Recall 结果的一致程度 | 高 / 部分 / 低 |
| **Divergence** | 模型间认知分歧度，基于 confidence 分布的标准差 | 低 / 中 / 高 |
| **Trend** | 随时间的变化方向 | increasing / stable / declining / baseline |

## Legacy 术语映射

| 旧术语 | 新术语 | 迁移策略 |
|--------|--------|---------|
| ADI (AI Presence Index) | Awareness | UI 替换，API 字段保持 `currentADI` |
| ADI Score | — | 移除 score 语义，改为 Awareness 状态 |
| AI Presence | LLM Awareness / LLM Recall | UI 替换 |
| Provider Statistics | Recall Consistency | UI 替换 |
| truthScore | Truth Score | 保持不动（属 Verification Domain） |

## 边界说明

### 属于本模型
- Presence 扫描结果（provider probes）
- LLM recall consistency
- 模型间 divergence
- Awareness 趋势

### 不属于本模型
- Truth Score — Verification Domain
- Knowledge Score — Knowledge Domain
- Identity Score — Identity Domain
- Entity/Claim counts — Entity Domain
- Optimization / Action Plan — Optimization Domain（仅 UI 层中的 ADI 引用替换）

## 呈现原则

1. 不使用数值 score（0-100, avg 等）
2. 不使用进度条
3. 不使用排名
4. 使用定性标签：Known / Unknown / High / Partial / Low
5. 模型详情为可展开的辅助信息，非主呈现

## API 兼容性

- 所有后端 DTO/API 字段当前保持 `currentADI` / `estimatedADI` / `adiDelta` 等旧名
- 未来 API v2 可升级为 `currentAwareness` / `expectedAwareness` / `awarenessDelta`
- UI 层映射到新术语即可
