# Sprint 1 — 前端设计 (Mission Explainability Foundation)

**目标:** Mission Card 升级 + Explain Drawer 改为 ExplainDocument 数据驱动渲染
**框架:** Vue 3 (Composition API) + TypeScript

---

## 📌 架构变更说明

> **重要：** 根据 `ADR-001-explain-platform.md`，前端架构已重构。
>
> **核心变更:**
> - ❌ 不再使用 `mode: 'generic' | 'mission'` 双模式
> - ✅ `GeoExplainDrawer` 改为只接收 `ExplainDocument`，按 `sections[]` 数据驱动渲染
> - ❌ 不再为每个 mode 创建独立组件树
> - ✅ 使用通用 Section Renderers，按 `ExplainSectionType` 渲染
> - ❌ 不再调用 `GET /api/geo/missions/{id}/explain`
> - ✅ 改为调用 `GET /api/geo/explain?type=mission&id=xxx`

---

## 1. Explain Drawer 组件结构

### 1.1 架构图

```
GeoExplainDrawer/                    ← 目录
├── index.vue                        ← 主入口
│   - props: explainDoc (ExplainDocument), loading, error
│   - emits: close
│   - 遍历 explainDoc.sections[]
│   - 按 section.type 选择对应的 Renderer
│
├── renderers/                       ← 通用 Section Renderers（数据驱动）
│   ├── EvidenceRenderer.vue         ← type: 'evidence'
│   ├── ThresholdRenderer.vue        ← type: 'threshold'
│   ├── ImpactRenderer.vue           ← type: 'impact'
│   ├── RuleRenderer.vue             ← type: 'rule'
│   ├── ReasoningRenderer.vue        ← type: 'reasoning'
│   ├── RecommendationRenderer.vue   ← type: 'recommendation'
│   ├── MetricRenderer.vue           ← type: 'metric'
│   └── TimelineRenderer.vue         ← type: 'timeline'
```

### 1.2 关键设计原则

**数据驱动渲染，不按 type 分支：**
- `GeoExplainDrawer/index.vue` 不关心 `metadata.type`
- 使用 `section.type` 映射到 Renderer 组件
- 新增 Explain type 不需要新增前端 Drawer 组件
- 只需要新增对应的 Section Renderer（如果新 type 引入了新 section）

```typescript
// ===== Props =====
interface GeoExplainDrawerProps {
  visible: boolean
  loading: boolean
  error: string | null

  // 统一输入: ExplainDocument（所有 Explain 类型通用）
  explainDoc?: ExplainDocument | null
}

// ===== Emits =====
interface GeoExplainDrawerEmits {
  close: []
}
```

**模板渲染逻辑（核心设计）：**

```vue
<template>
  <Teleport to="body">
    <Transition name="geo-drawer-fade">
      <div v-if="visible" class="geo-drawer-overlay" @click.self="handleClose">
        <Transition name="geo-drawer-slide">
          <div v-if="visible" class="geo-drawer-panel">
            
            <!-- Header: title + summary + confidence -->
            <div v-if="explainDoc" class="geo-drawer__header">
              <h2 class="geo-drawer__title">{{ explainDoc.title }}</h2>
              <p class="geo-drawer__summary">{{ explainDoc.summary }}</p>
              <div v-if="explainDoc.confidence !== null" class="geo-drawer__confidence">
                <span class="confidence-label">置信度</span>
                <span class="confidence-value">{{ (explainDoc.confidence * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <!-- Sections: 数据驱动渲染 -->
            <div v-if="explainDoc" class="geo-drawer__sections">
              <template v-for="section in sortedSections" :key="`${section.type}-${section.order}`">
                <div class="geo-drawer__section">
                  <component :is="rendererFor(section.type)" :section="section" />
                </div>
              </template>
            </div>

            <!-- Loading / Error states -->
            <div v-if="loading" class="geo-drawer__loading"><!-- skeleton --></div>
            <div v-if="error" class="geo-drawer__error"><!-- error card --></div>

            <!-- Footer: metadata -->
            <div v-if="explainDoc" class="geo-drawer__footer">
              <span class="footer-provider">{{ explainDoc.metadata.provider }}</span>
              <span class="footer-time">{{ formatTime(explainDoc.metadata.generatedAt) }}</span>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExplainDocument, ExplainSectionType } from '../types/explain-document'

// Section Renderers 映射
const sectionRenderers: Record<ExplainSectionType, any> = {
  evidence: defineAsyncComponent(() => import('./renderers/EvidenceRenderer.vue')),
  threshold: defineAsyncComponent(() => import('./renderers/ThresholdRenderer.vue')),
  impact: defineAsyncComponent(() => import('./renderers/ImpactRenderer.vue')),
  rule: defineAsyncComponent(() => import('./renderers/RuleRenderer.vue')),
  reasoning: defineAsyncComponent(() => import('./renderers/ReasoningRenderer.vue')),
  recommendation: defineAsyncComponent(() => import('./renderers/RecommendationRenderer.vue')),
  metric: defineAsyncComponent(() => import('./renderers/MetricRenderer.vue')),
  timeline: defineAsyncComponent(() => import('./renderers/TimelineRenderer.vue')),
}

function rendererFor(type: ExplainSectionType) {
  return sectionRenderers[type] || null
}

const sortedSections = computed(() => {
  if (!props.explainDoc) return []
  return [...props.explainDoc.sections].sort((a, b) => a.order - b.order)
})
</script>
```

### 1.3 Section Renderer 通用接口

```typescript
// 所有 Renderer 共享的 Props 接口
interface ExplainRendererProps {
  section: ExplainSection
}

// 所有 Renderer 的职责：
// 1. 渲染 section.title 作为区块标题
// 2. 遍历 section.items，根据 item.status 做颜色/图标映射
// 3. 不依赖 metadata.type，完全数据驱动
```

**每个 Renderer 的特点：**

| Renderer | 渲染风格 |
|----------|---------|
| `EvidenceRenderer` | 卡片列表，按 status 着色（positive=green, negative=red） |
| `ThresholdRenderer` | 进度条/仪表盘样式，实际值 vs 阈值对比 |
| `ImpactRenderer` | 数值卡片，绿色箭头箭头表示正向影响 |
| `RuleRenderer` | 规则卡片，satisfied=green checkmark / not satisfied=gray |
| `ReasoningRenderer` | 文本块，支持 markdown 渲染 |
| `RecommendationRenderer` | 行动卡片列表，action_required 高亮 |
| `MetricRenderer` | 数字/进度展示 |
| `TimelineRenderer` | 时间线组件 |

---

## 2. Mission Card 升级方案

### 2.1 变更内容

1. **新增 "Explain" 按钮** — 复用 `GeoExplainButton.vue`
2. **点击 Explain → 调用统一 Explain API** `GET /api/geo/explain?type=mission&id=xxx`
3. **打开 GeoExplainDrawer 展示 ExplainDocument**

### 2.2 组件变更

```typescript
// ===== Props（扩展现有）=====
interface MissionCardProps {
  mission: Mission                     // 现有
  compact?: boolean                    // 现有
}

// ===== Emits（扩展现有）=====
interface MissionCardEmits {
  action: [mission: Mission]           // 现有
  skip: [missionId: string]            // 现有
  explain: [mission: Mission]          // 新增: 请求打开 Explain Drawer
}
```

### 2.3 服务方法

```typescript
// missionService.ts 新增

import type { ExplainDocument } from '../types/explain-document'

/**
 * 获取统一 Explain 数据
 * @param type - explain 类型（'mission' / 'verification' / 'knowledge' / 'discovery'）
 * @param id - 源数据 ID
 */
export async function fetchExplain(type: string, id: string): Promise<ExplainDocument> {
  return apiFetch<ExplainDocument>(
    `${API_BASE}/explain?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`
  )
}
```

---

## 3. 渲染器组件规范

### 3.1 通用 Props

```typescript
// 所有 Section Renderer 共享的 props 类型
export interface ExplainRendererProps {
  section: {
    type: ExplainSectionType
    title: string
    order: number
    items: Array<{
      id: string
      label: string
      value: string | number | boolean | null
      detail?: string
      source?: string
      confidence?: number
      status?: 'positive' | 'negative' | 'neutral' | 'action_required'
    }>
  }
}
```

### 3.2 状态颜色映射

```typescript
const statusColors: Record<string, string> = {
  'positive': '#16a34a',       // green
  'negative': '#ef4444',       // red
  'neutral': '#6b7280',        // gray
  'action_required': '#f59e0b', // orange
}
```

### 3.3 渲染器职责

| 状态 | 视觉表示 | 使用场景 |
|------|---------|---------|
| `positive` | 绿色背景/图标 | 正向影响、已满足、评分良好 |
| `negative` | 红色背景/图标 | 缺失、未达标、风险 |
| `neutral` | 灰色背景/图标 | 信息性内容、中性数据 |
| `action_required` | 橙色背景/图标+强调 | 需要用户操作的建议 |

---

## 4. 前端类型定义

```typescript
// frontend/workspaces/geo/types/explain-document.ts
// 与后端 SSOT 同步

export interface ExplainDocument {
  id: string
  title: string
  summary: string
  sections: ExplainSection[]
  confidence: number | null
  metadata: ExplainMetadata
}

export type ExplainSectionType = 
  | 'evidence'
  | 'threshold'
  | 'impact'
  | 'rule'
  | 'reasoning'
  | 'recommendation'
  | 'metric'
  | 'timeline'

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
  source?: string
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

---

## 5. 与现有系统的兼容性

| 现有系统 | 兼容措施 |
|---------|---------|
| `GeoExplainDrawer` v1.0（ExplainResult + mode） | 保留，提供过渡期。新组件独立开发，不影响现有功能 |
| `GeoExplainCard` | 保留不变 |
| `GeoExplainButton` | 保留不变，复用 |
| 现有 `ExplainResult` 类型 | 保留在 types/explain-result.ts 中，逐步迁移 |
| Dashboard/Discovery/Knowledge/Verification 页面 | 逐步替换为统一 Explain API + ExplainDocument |

### 迁移步骤

1. ✅ Sprint 1A: 创建 ExplainDocument 前端类型 + GeoExplainDrawer 新版本设计
2. 🔄 Sprint 1B: 开发 GeoExplainDrawer 新版本（Section Renderers）
3. 🔄 Sprint 1B: 迁移各页面调用到统一 Explain API
4. 🔄 Sprint 1B: 删除旧的 ExplainResult + mode 分支逻辑
