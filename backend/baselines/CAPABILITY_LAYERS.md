# Capability Layers — 能力分层文档

## 概述

Benchmark 能力按演进阶段分层。每层解决不同的电影制作质量维度。

```
Layer 0: Infrastructure          Registry → Validation → Coverage → Analytics → Asset Factory
Layer 1: World Consistency       Wave 1: 时空一致性基线
Layer 2: Cinematic Language      Wave 2: 电影语言表达
Layer 3: Physical Realism        (Wave 3)
Layer 4: Narrative Intelligence  (Wave 4)
```

---

## Layer 0 — Infrastructure（基础设施）

| 组件 | 目的 | 状态 |
|------|------|------|
| Capability Registry | 31 项电影能力的 SSOT | ✅ v1.0 |
| Capability Validation | Schema + 命名 + 依赖校验 | ✅ 277 tests |
| Coverage Index | 覆盖率矩阵 + Gap 分析 | ✅ 12/13 passing |
| Analytics | Capability Health + Summary | ✅ 基础版 |
| Asset Factory | Dataset 资产读取/验证/规范化 | ✅ 完整 |

---

## Layer 1 — World Consistency（世界一致性）

Wave 1 基础时空能力。验证视频世界在空间和时间上的内在一致性。

| 能力 | Dataset | 类型 |
|------|---------|------|
| CAMERA_PATH | L2-CAMERA_PATH | primary |
| CAMERA_MOTION | L2-CAMERA_MOTION | primary |
| OBJECT_PERSISTENCE | L2-OBJECT_PERSISTENCE | primary |
| SPATIAL_RELATIONSHIP | L2-SPATIAL_RELATION | primary |
| TEMPORAL_CONSISTENCY | L2-TEMPORAL_CONTINUITY | primary |

一致性三角：身份保持 → 空间关系 → 时间连续性

---

## Layer 2 — Cinematic Language（电影语言）

Wave 2 电影语言层。验证镜头是否正确地表达了导演意图。

| 能力 | Dataset | 类型 |
|------|---------|------|
| LIGHT_CONTINUITY | L2-LIGHTING_CONTINUITY | primary |
| CAMERA_COMPOSITION | L2-CAMERA_COMPOSITION | primary |
| SHOT_TRANSITION | L2-SHOT_SCALE | secondary |
| SHOT_TRANSITION | L2-SHOT_ANGLE | secondary |
| CAMERA_FOCUS | L2-FOCUS_CONTROL | primary |

Wave 2 关键升级：
- `cinematicIntent` / `lightingIntent` / `visualIntent`
- `storyIntent` 与 `cinematicIntent` 分离
- `narrativePurpose`
- `intentType` 参与 Evaluation 评分
- Director Plan Schema 定型

---

## Director Plan Schema（导演输出结构）

```yaml
DirectorPlan:
  lighting:
  composition:
  shotScale:
  shotAngle:
  focus:
  storyIntent:
  cinematicIntent:
```

这一结构是 Wave 1 + Wave 2 能力集的自然映射。
短剧工作台的 Director Agent 应以此结构输出镜头计划。
