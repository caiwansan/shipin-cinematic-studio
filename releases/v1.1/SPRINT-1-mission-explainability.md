# Sprint 1 — Explainability Platform v1.0

**Status:** ✅ FROZEN (Architecture locked, no further changes to Explain layer)
**里程碑:** GEO Explainability Platform v1.0

**Release:** v1.1
**Duration:** 2 weeks
**Goal:** 把 Mission 从 "AI 建议" 变成 "可解释的决策结果"

---

## 📌 架构变更说明

> **重要：** 根据 `ADR-001-explain-platform.md`，本 Sprint 已完成架构重构。
> Explain 现在是 GEO 的横向平台能力，Mission/Verification/Knowledge/Discovery 都是其消费者。
>
> **核心变更：**
> - ❌ 不再使用 `MissionDecision` 独立接口
> - ✅ 替换为统一 `ExplainDocument` 格式
> - ❌ 不再使用 `GET /api/geo/missions/{id}/explain` 路由
> - ✅ 替换为 `GET /api/geo/explain?type=mission&id=xxx` 单一 endpoint
> - ❌ MissionDecisionBuilder 不再计算 confidence/expectedScore/delta
> - ✅ 使用 `ExplainDocumentBuilder`（纯组装器，不计算）
>
> 详细架构决策请参考 `ADR-001-explain-platform.md`

---

## 1. 数据模型 — ExplainDocument

### 统一 ExplainDocument Schema

```typescript
// ─── SSOT: backend/src/services/geo/explain/explain-document.ts ───

export interface ExplainDocument {
  id: string                    // Explain ID (unique per generation)
  title: string                 // 简短标题，如 "识别到 Visibility 提升机会"
  summary: string               // 摘要，1-3 句话说明核心结论
  sections: ExplainSection[]    // 数据驱动的 Section 列表
  confidence: number | null     // 0-1，决定引擎提供
  metadata: ExplainMetadata
}

export type ExplainSectionType = 
  | 'evidence'      // 证据概览
  | 'threshold'     // 阈值触发详情
  | 'impact'        // 影响预测
  | 'rule'          // 规则匹配
  | 'reasoning'     // 推理链
  | 'recommendation' // 建议/行动项
  | 'metric'        // 指标展示
  | 'timeline'      // 时间线

export interface ExplainSection {
  type: ExplainSectionType
  title: string
  order: number
  items: ExplainItem[]
}

export interface ExplainItem {
  id: string
  label: string
  value: string | number | boolean | null
  detail?: string
  source?: string           // 必须指向真实数据 ID
  confidence?: number
  status?: 'positive' | 'negative' | 'neutral' | 'action_required'
}

export interface ExplainMetadata {
  type: 'mission' | 'verification' | 'knowledge' | 'discovery'
  sourceId: string
  sourceType: string
  generatedAt: string
  provider: string
  version: string
}
```

### Mission 的 ExplainDocument 输出示例

```json
{
  "id": "mission-explain-uuid-xxx",
  "title": "补充 FAQ 页面 Schema",
  "summary": "您的品牌在 AI 搜索结果中缺乏 FAQ Schema 标记",
  "sections": [
    {
      "type": "evidence",
      "title": "证据概览",
      "order": 0,
      "items": [
        {
          "id": "evidence-impact-AI引用率",
          "label": "AI引用率",
          "value": "+18%",
          "detail": "执行后可预期提升",
          "status": "positive"
        }
      ]
    },
    {
      "type": "reasoning",
      "title": "决策推理",
      "order": 1,
      "items": [
        {
          "id": "reasoning-main",
          "label": "推理说明",
          "value": "基于最近一次扫描结果，检测到 FAQ Schema 缺失"
        }
      ]
    },
    {
      "type": "metric",
      "title": "评分指标",
      "order": 2,
      "items": [
        {
          "id": "metric-score",
          "label": "优先级评分",
          "value": 72,
          "detail": "Mission 优先级评分 (0-100)"
        }
      ]
    }
  ],
  "confidence": null,
  "metadata": {
    "type": "mission",
    "sourceId": "mission-uuid-xxx",
    "sourceType": "mission",
    "generatedAt": "2026-01-16T10:30:00.000Z",
    "provider": "MissionExplainProvider",
    "version": "1.0"
  }
}
```

**设计依据**: 统一 ExplainDocument 格式确保所有 Explain 类型（Mission/Verification/Knowledge/Discovery）共享同一响应结构。前端不关心 `metadata.type`，只按 `sections[].type` 渲染。

---

## 2. API — 统一 Explain API

### 请求

```
GET /api/geo/explain?type=mission&id=xxx
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `type` | query | string | 是 | Explain 类型：`mission` / `verification` / `knowledge` / `discovery` |
| `id` | query | string | 是 | 源数据 ID（Mission ID / Verification ID 等） |

### 响应（统一格式）

```json
{
  "success": true,
  "data": {
    "id": "mission-explain-uuid-xxx",
    "title": "补充 FAQ 页面 Schema",
    "summary": "您的品牌在 AI 搜索结果中缺乏 FAQ Schema 标记",
    "sections": [
      { "type": "evidence", "title": "证据概览", "order": 0, "items": [...] },
      { "type": "reasoning", "title": "决策推理", "order": 1, "items": [...] },
      { "type": "metric", "title": "评分指标", "order": 2, "items": [...] }
    ],
    "confidence": null,
    "metadata": {
      "type": "mission",
      "sourceId": "mission-uuid-xxx",
      "sourceType": "mission",
      "generatedAt": "2026-01-16T10:30:00.000Z",
      "provider": "MissionExplainProvider",
      "version": "1.0"
    }
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Mission not found: xxx",
  "code": "NOT_FOUND"
}
```

---

## 3. Explain Drawer 组件设计

### 架构变更

根据 ADR-001，`GeoExplainDrawer` 改为：
- 只接收 `ExplainDocument` 作为输入
- 按 `sections[]` 数据驱动渲染
- 不关心 `metadata.type`
- 每个 `ExplainSectionType` 由通用渲染器处理

### 组件结构

```
GeoExplainDrawer/
├── index.vue                         ← 主入口，接收 ExplainDocument
├── renderers/
│   ├── EvidenceRenderer.vue          ← type: 'evidence'
│   ├── ThresholdRenderer.vue         ← type: 'threshold'
│   ├── ImpactRenderer.vue            ← type: 'impact'
│   ├── RuleRenderer.vue              ← type: 'rule'
│   ├── ReasoningRenderer.vue         ← type: 'reasoning'
│   ├── RecommendationRenderer.vue    ← type: 'recommendation'
│   ├── MetricRenderer.vue            ← type: 'metric'
│   └── TimelineRenderer.vue          ← type: 'timeline'
```

**关键设计决策**: `GeoExplainDrawer/index.vue` 只做两件事：
1. 遍历 `ExplainDocument.sections`，根据 `section.type` 选择对应的 Renderer
2. 组装 Header（title + summary + confidence）+ Footer（metadata）

```vue
<template>
  <div v-if="explainDoc" class="geo-explain-drawer">
    <div class="geo-explain-drawer__header">
      <h2>{{ explainDoc.title }}</h2>
      <p class="summary">{{ explainDoc.summary }}</p>
      <div v-if="explainDoc.confidence !== null" class="confidence">
        置信度: {{ (explainDoc.confidence * 100).toFixed(0) }}%
      </div>
    </div>
    <div class="geo-explain-drawer__sections">
      <template v-for="section in sortedSections" :key="section.order">
        <component :is="rendererFor(section.type)" :section="section" />
      </template>
    </div>
    <div class="geo-explain-drawer__footer">
      <span>{{ explainDoc.metadata.provider }}</span>
      <span>{{ explainDoc.metadata.generatedAt }}</span>
    </div>
  </div>
</template>
```

---

## 4. Mission Card 升级

### 变更点

1. **新增 "Explain" 按钮** — 复用 `GeoExplainButton.vue`，放在卡片右下角
2. **点击 Explain → 调用统一 Explain API**
3. **打开 GeoExplainDrawer 展示 ExplainDocument**

```typescript
// 新增 emits
interface MissionCardEmits {
  action: [mission: Mission]
  skip: [missionId: string]
  explain: [missionId: string]       // 新增: 调用统一 Explain API
}
```

---

## 5. 后端变更清单

### 新增文件

| # | 文件路径 | 说明 |
|---|---------|------|
| 1 | `backend/src/services/geo/explain/explain-document.ts` | `ExplainDocument` 统一 Schema 定义 |
| 2 | `backend/src/services/geo/explain/builder.ts` | `ExplainDocumentBuilder` 纯组装器 |
| 3 | `backend/src/services/geo/explain/providers/mission-explain-provider.ts` | `MissionExplainProvider`: 实现 `ExplainProvider`，使用 `ExplainDocumentBuilder` |

### 修改文件

| # | 文件路径 | 变更 |
|---|---------|------|
| 1 | `backend/src/services/geo/routes/geo-explain.route.ts` | 重写为统一 endpoint `GET /api/geo/explain?type=xxx&id=xxx` |
| 2 | `backend/src/services/geo/explain/engine.ts` | 返回类型改为 `ExplainDocument` |
| 3 | `backend/src/services/geo/explain/index.ts` | 导出新模块 |

### 废弃文件（Sprint 1B 迁移）

| # | 文件路径 | 替代 |
|---|---------|------|
| 1 | `backend/src/services/geo/routes/geo-explain-engine.route.ts` | 已由 `geo-explain.route.ts` 替代 |
| 2 | `backend/src/services/geo/mission-engine/routes.ts` 中 `GET /api/geo/missions/:id/explain` 路由 | 已由统一 endpoint 替代 |

---

## 6. 数据流图

```
[前端 MissionCard]                     [后端 geo-explain.route.ts]
       |                                          |
       | click explain                             |
       | GET /api/geo/explain?type=mission&id=xxx  |
       |──────────────────────────────────────────>| 
       |                                           |-- ExplainEngine.explain('mission', id)
       |                                           |      |
       |                                           |      v
       |                                           |-- registry.getProvider('mission')
       |                                           |      |
       |                                           |      v
       |                                           |-- MissionExplainProvider.getExplain()
       |                                           |      |
       |                                           |      v
       |                                           |-- ExplainDocumentBuilder.build()
       |                                           |      |
       |                                           |      v
       |                                           |      ExplainDocument
       |    { success, data: ExplainDocument }       |
       |<──────────────────────────────────────────|
       |
       |-- GeoExplainDrawer (接收 ExplainDocument)
       |    |-- 遍历 sections[]
       |    |-- 按 section.type 选择 Renderer
       |    |-- EvidenceRenderer / ReasoningRenderer / MetricRenderer ...
```

---

## 7. 与现有系统的兼容性

| 现有系统 | 兼容措施 |
|---------|---------|
| `ExplainResult` (通用) | 保留在 types.ts 中，逐步迁移。现有 providers 尚使用 ExplainResult |
| `GeoExplainDrawer` v1.0 | 保留，但建议逐步替换为基于 ExplainDocument 的新版本 |
| `GeoExplainCard` | 保留不变，v1.1 新增组件基于 ExplainDocument 渲染 |
| `MissionGenerator.generate()` | 不变。只在其输出上增加 Explain 层，不改 Mission 生成逻辑 |
| 现有 Dashboard/Discovery/Knowledge/Verification 页面 | 统一 Explain API 调用方式，逐步替换原有调用 |

### 迁移步骤

1. ✅ Sprint 1A: 创建 ExplainDocument Schema + Builder + MissionExplainProvider + 统一路由
2. 🔄 Sprint 1B: 迁移现有 4 个 Provider（Discovery/Recommendation/Verification/Presence）到 ExplainDocument
3. 🔄 Sprint 1B: 迁移所有前端调用到统一 Explain API + ExplainDocument
4. 🔄 Sprint 1B: 删除旧的 ExplainResult 接口和按资源拆分路由
