# Sprint-ShortDrama-02 Task 02.1 — Asset Quality Observation Reality

**Date:** 2026-07-31 16:29 CST
**Status:** COMPLETE ✅

---

## 目标

建立「AI导演质量观察层」。

```
Asset
 ↓
Quality Observer
 ↓
Quality Report
 ↓
Director Decision Input
```

---

## 文件改动

| 文件 | 类型 | 行数 | 说明 |
|------|------|------|------|
| `services/director/asset-quality-observer.service.ts` | **新增** | ~280 | 核心观察器 |
| `routes/director-asset-quality.route.ts` | **新增** | ~95 | API 端点 |
| `src/index.ts` | 修改 | +3 | 注册路由 |

**无 DB schema 变更** ✅ — 观察结果存储在 `TaskLog.metadata` 字段

---

## 数据流

```
GET /api/director/assets/:assetId/quality
  ↓
observeAsset(assetId)
  ↓
prisma.videoTask.findUnique({ where: { id: assetId } })
  ↓
parse error field → input.prompt + output.url
  ↓
prisma.aiSceneSpec.findFirst({ where: { projectId, sceneId/name } })
prisma.aiCharacterSpec.findFirst({ where: { projectId, characterName } })
  ↓
analyzePromptAlignment(prompt, sceneSpec, charSpec)
analyzeSceneCompleteness(prompt, sceneSpec)
analyzeCharacterConsistency(prompt, charSpec)
analyzeVisualConsistency(prompt, hasOutput)
  ↓
computeOverallScore(dimensions)
  ↓
prisma.taskLog.create({ metadata: { qualityObservation: { score, dimensions, issues } } })
  ↓
return AssetQualityReport
```

## AssetQualityReport 结构

```typescript
interface AssetQualityReport {
  assetId: string
  assetType: 'image' | 'video' | 'audio'
  score: number        // 0-100
  dimensions: {
    visualConsistency?: number   // 画面完整性、prompt结构
    promptAlignment?: number     // 视觉要素关键词覆盖
    characterConsistency?: number  // 角色特征描述覆盖
    sceneCompleteness?: number     // 场景要素覆盖
  }
  issues: string[]
  recommendations: string[]
  analyzedAt: Date
  source: {
    projectId: string
    taskType: string
    status: string
    hasOutput: boolean
    specType: 'scene' | 'character' | 'scene+character' | null
  }
}
```

---

## API

### 单资产查询

```
GET /api/director/assets/:assetId/quality
```

返回示例（Case A — 高质量已完成图片）：

```json
{
  "success": true,
  "report": {
    "assetType": "image",
    "score": 80,
    "dimensions": {
      "visualConsistency": 90,
      "promptAlignment": 81,
      "characterConsistency": 60,
      "sceneCompleteness": 83
    },
    "issues": [],
    "recommendations": [],
    "source": {
      "specType": "scene+character",
      "status": "completed"
    }
  }
}
```

### 批量查询

```
GET /api/director/projects/:projectId/assets/quality
```

返回项目中所有已完成资产的观察报告（最多 10 个）。

---

## Reality Tests

### Case A — 已有图片资产 ✅

| 输入 | 输出 |
|------|------|
| `assetId=442e2b88...` (completed, rich prompt) | score=80, 0 issues, 0 recommendations |

验证：已完成、有输出的资产 → 合理打分，无假报告。

### Case B — 不存在 asset ✅

| 输入 | 输出 |
|------|------|
| `assetId=nonexistent-bad-uuid` | `404 ASSET_NOT_FOUND` |

验证：不存在的 asset → 明确 404，**不生成假报告**。

### Case C — 低质量资产 ✅

| 输入 | 输出 |
|------|------|
| `assetId=2f56d788...` (failed, no output) | score=0, 4 issues, recommendations 不含自动重生成 |

验证：失败的、无输出的资产 → 低分 + 引导性建议，**不自动修复**。

---

## Reality Gates

| Gate | 标准 | 状态 |
|------|------|------|
| **Q1** | Observer 不调用 AI Provider | ✅ 纯 Prisma 查询 + 文本分析 |
| **Q2** | Observer 不修改 Asset | ✅ 只读 TaskLog 追加 |
| **Q3** | 报告来源可追踪 | ✅ `TaskLog.metadata.qualityObservation` + `source` 字段 |
| **Q4** | 不存在假评分 | ✅ 404 拒绝不存在 asset；无数据 → score=0 |
| **Q5** | 未来可接入视觉模型 | ✅ `analyzeVisualConsistency()` 可替换为 CV 模型 |

---

## 架构原则验证

| 原则 | 遵守 | 说明 |
|------|------|------|
| 不调用 Provider | ✅ | 纯 Prisma + 文本分析 |
| 不修改 Asset | ✅ | 只读不写 Asset 数据 |
| 不自动重生成 | ✅ | recommendation 引导但不下执行命令 |
| 不新增 DB 表 | ✅ | 使用 TaskLog.metadata |
| 不使用 UOA | ✅ | 普通 service |
| 不绕过 Task Runtime | ✅ | 不生成任务 |

---

## 代码统计

| 指标 | 值 |
|------|-----|
| 新增文件 | 2 |
| 修改文件 | 1 |
| 新增代码行 | ~375 |
| 删除代码行 | 0 |

---

## 下一步建议

### Task 02.2 — Director Decision Contract

当前 `QualityReport` 已经有：

- `issues`：质量问题描述
- `recommendations`：改进建议
- `source.specType`：匹配的场景/角色

下一步可以定义统一决策契约：

```typescript
DirectorDecision {
  action: 'REGENERATE_IMAGE' | 'MODIFY_PROMPT' | 'AUDIO_RETRY'
  targetAsset: string
  reason: string
  fromObservation: AssetQualityReport
}
```

### 什么时候可以启动 02.2

建议试跑 1-2 个真实短剧项目后，确认：
1. Observer 的评分与真人判断一致
2. 用户是否接受「AI 建议重新生成」这个交互模式
3. 决策契约是否覆盖了最常见的情况

---

**Task 02.1 — Asset Quality Observation Reality ✅**

报告：`docs/reality/SHORTDRAMA-02-TASK02.1-ASSET-QUALITY-OBSERVER.md`
