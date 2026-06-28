# Constraint Field v3 — Director Intelligence Layer 升级设计

> 将约束从"全等权 hard"升级为"加权力场模型"。
> 这是 Conflict Resolver 和 Creative Slack 的前置结构。

---

## 当前问题

现在的 `constraintTokens` 是：

```json
{
  "maxSceneDuration": 120,
  "maxShotDuration": 8,
  "allowedColorPaletteBias": "neutral",
  "cameraMovementDensity": "medium"
}
```

所有约束同一层级、同等权重。后果：
- **冲突无法计算** — Character 要求稳定 + Shot 要求动态 = 只能报错或平均化
- **约束无弹性** — 要么 full on，要么 full off
- **Creative Slack 无法预留** — 没有"低优先级约束"的概念

---

## 升级结构

### Director Brain 输出新增 `constraintField`

```json
{
  "worldConstitution": { ... },
  "constraintTokens": {
    "maxSceneDuration": 120,
    "maxShotDuration": 8,
    "allowedColorPaletteBias": "neutral",
    "cameraMovementDensity": "medium"
  },
  "constraintField": {
    "visualConsistency": {
      "weight": 0.9,
      "mode": "soft_hard",
      "description": "跨镜头视觉风格一致性"
    },
    "characterIdentity": {
      "weight": 1.0,
      "mode": "hard",
      "description": "角色身份锁（必须严格保持）"
    },
    "cameraFreedom": {
      "weight": 0.6,
      "mode": "soft",
      "description": "允许运镜自由度"
    },
    "temporalFlexibility": {
      "weight": 0.7,
      "mode": "soft",
      "description": "允许节奏微调以适配不同长度"
    },
    "colorPaletteFidelity": {
      "weight": 0.8,
      "mode": "soft_hard",
      "description": "色彩体系忠实度"
    }
  },
  "keyNarrativeBeats": [ ... ],
  "futureLearningSignals": { ... }
}
```

### 字段说明

| 字段 | 类型 | 含义 |
|------|------|------|
| `weight` | 0.0-1.0 | 约束强度。1.0=必须遵守，0.5=参考，0.0=忽略 |
| `mode` | `hard \| soft_hard \| soft` | 约束模式 |
| `description` | string | 给 LLM 和下游系统的人类可读说明 |

### mode 定义

| mode | weight 范围 | 行为 |
|------|------------|------|
| `hard` | 0.9-1.0 | 必须满足。违反 → 重生成标记 |
| `soft_hard` | 0.7-0.9 | 优先满足。允许局部偏差但需在 review 中记录 |
| `soft` | 0.0-0.7 | 仅引导。偏差不扣分 |

### Creative Slack 计算（预留）

```
total_constraint_weight = sum(weights where mode != 'hard') / count
creative_slack = 1.0 - total_constraint_weight
```

- slack = 0.0 → 刚性流水线（当前状态）
- slack >= 0.2 → 有 20% 非约束生成空间

---

## 变更计划

### 涉及文件

| 文件 | 变更 | 大小 |
|------|------|------|
| `director/director-brain.agent.ts` | 新增 `ConstrainField` 类型 + constraintField 输出 | ~30 行 |
| `director/director-brain.agent.ts` | system prompt 增加 constraintField schema | ~20 行 |
| `director/director-brain.agent.ts` | degrade 路径加入 constraintField 默认值 | ~15 行 |
| `director/share.types.ts` | 新增 `ConstrainField`、`ConstrainFieldEntry`、`ConstraintMode` 类型 | ~25 行 |
| `director/index.ts` | 导出新增类型 | ~5 行 |

### 不做

- 不修改下游 Agent（仅 Director Brain 输出新增字段）
- 不修改 review engine（留到 Conflict Resolver 阶段）
- 不修改 workers/production-loop（不涉及决策路径）
