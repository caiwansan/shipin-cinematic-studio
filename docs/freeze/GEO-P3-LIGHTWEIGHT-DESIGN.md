# P3 — GEO User Loop System（轻量设计方案）

**Status**: Design Document (Pre-Implementation)
**Based On**: P2.3 System Closure + Hybrid Controlled Autonomy Model
**Constraint**: ❌ 不改后端 orchestration engine / ❌ 不改 ExecutionStateManager / ❌ 不改 API
**User Model**: VIP Enterprise Execution Workbench (Not Public / Not SaaS)

---

## 0. 核心设计原则

P3 不做：
- ❌ 后端编排引擎
- ❌ Workflow DAG runtime
- ❌ 新的 API route

P3 只做：
- ✅ 前端 Execution Recipe DSL（轻量 config）
- ✅ UI Wizard（Project + Goal + Execution Mode）
- ✅ Control Policy Layer（auto / step / pause）
- ✅ Output Asset（结构化结果展示）

---

## 1. Execution Recipe DSL（新增 `types/`，不改 backend）

```typescript
// frontend/utils/executionRecipe.ts  — 纯 config，不是 engine

type ExecutionMode = 'auto' | 'step' | 'debug'

interface ExecutionStep {
  capabilityId: CapabilityId
  label: string
  description: string
  requiredTier: SubscriberTier
  pauseAfter?: boolean   // VIP_1+ 可设断点
}

interface ExecutionRecipe {
  id: string
  name: string
  description: string
  goal: GoalType
  steps: ExecutionStep[]
  defaultMode: ExecutionMode
  outputType: OutputAssetType
  estimatedDuration: string  // display only
}

type GoalType =
  | 'knowledge_graph'        // GEO 知识图谱构建
  | 'entity_research'        // 实体调研
  | 'brand_intelligence'     // 品牌情报
  | 'content_generation'     // 内容生成
  | 'seo_optimization'       // SEO 优化

type OutputAssetType =
  | 'knowledge_graph_asset'
  | 'entity_report'
  | 'brand_report'
  | 'content_draft'
  | 'seo_report'
```

### 模板 Recipe（内置，不可修改）
```typescript
const BUILTIN_RECIPES: Record<GoalType, ExecutionRecipe> = {
  knowledge_graph: {
    id: 'geo-knowledge',
    name: 'GEO 知识图谱构建',
    description: '发现实体 → 构建图谱 → 质量评估 → 生成图谱资产',
    goal: 'knowledge_graph',
    defaultMode: 'auto',
    outputType: 'knowledge_graph_asset',
    estimatedDuration: '~3-8min',
    steps: [
      { capabilityId: 'geo.execution.discover', label: '🔍 实体发现', description: '从目标网站/文档发现关键实体', requiredTier: 'FREE', pauseAfter: true },
      { capabilityId: 'geo.execution.graph.build', label: '🔗 知识图谱', description: '构建实体关系图谱', requiredTier: 'VIP_1', pauseAfter: true },
      { capabilityId: 'geo.execution.kq', label: '✅ 质量评估', description: '评估知识质量一致性', requiredTier: 'VIP_2' },
    ],
  },
  // entity_research, brand_intelligence, etc — 后续扩展
}
```

---

## 2. UI Wizard — Project Creation v2

### 当前 ProjectCreatePage
```
Name + Type = 简单创建
```

### P3.1 ProjectCreatePage v2
```
Step 1: 项目信息
├── 项目名称
├── 选择目标 (GoalType)
└── 租户信息（自动）

Step 2: Recipe 选择（根据 goal 自动匹配）
├── 显示 Recipe 步骤预览
├── 执行模式: Auto / Step-by-Step
└── (VIP_1+) 可选断点配置

Step 3: 确认创建
├── 项目摘要
├── Recipe 摘要
└── 立即执行 / 保存草稿
```

### 数据流
```
创建项目 → POST /api/geo/projects (已有)
保存 recipe config → 项目 executionResults 字段 (已有)
开始执行 → emit execute(discover) — 复用 ExecutionStudio 逻辑
```

---

## 3. Control Policy Layer（新增 composable）

```typescript
// composables/useExecutionControl.ts — 轻量策略层

interface ExecutionControl {
  mode: ExecutionMode
  currentStepIndex: number
  breakpoints: Set<CapabilityId>
  
  // Auto mode: runNext() → auto chain
  // Step mode: runNext() → wait for confirm
  runNext(): Promise<void>
  
  // Resume from breakpoint
  resumeFrom(stepIndex: number): Promise<void>
  
  // Tier 决定可用模式
  getAvailableModes(): ExecutionMode[]
}
```

### 行为逻辑
```
auto mode:  click "Run Recipe" → discover → graph → kq → output  (全自动)
step mode:  click "Run Recipe" → discover → [pause] → confirm → graph → [pause] → confirm → kq → output
debug mode: click "Run Recipe" → discover → [pause] → inspect → resume → graph → [pause] → inspect → resume → kq → output
```

---

## 4. Output Asset（纯展示层）

```typescript
interface OutputAsset {
  projectId: string
  type: OutputAssetType
  data: {
    nodes?: number
    edges?: number
    entities?: any[]
    report?: string
    confidence?: number
  }
  generatedAt: number
  version: number
}
```

展示在 ExecutionStudioPage 右下角——"📦 Output Asset" 面板，内容全部从 `projectInfo` hydrate 数据派生。不改 API。

---

## 5. 实施路线图

```
P3.1 — Recipe DSL + Wizard
├── frontend/utils/executionRecipe.ts    ← Recipe 类型 + 内置模板
├── ProjectCreatePage.v2                  ← Wizard 改造（Goal + Recipe + Mode）
└── 不新增 API，不新增 store

P3.2 — Control Policy Layer
├── composables/useExecutionControl.ts   ← auto/step/debug 策略
├── WorkflowTimeline 适配                 ← 添加断点 + pause/resume UI
└── 不新增 API，不变 ExecutionStateManager

P3.3 — Output Asset 展示
├── OutputAssetPanel.vue                 ← 轻量展示组件
├── ExecutionStudioPage 集成              ← 右下方嵌入
└── 数据来自 hydrate，不新增 API
```

---

## 6. 冻结约束

- ❌ 不新增后端 API route
- ❌ 不改 Prisma schema
- ❌ 不改 DualWrite 逻辑
- ❌ 不改 ExecutionStateManager
- ❌ 不改 PermissionService
- ❌ 不改 useGeoHydrate
- ✅ 只改前端文件

---

## 7. 与 P2.3 的关系

P2.3 = 系统收口（Execution/Lens/Control/Metadata 四层冻结）
P3.x = 基于冻结系统的上层编排（不改下层）

```
P2.3 (Frozen Foundation)
  └── P3.1 Recipe DSL (轻量 config)
  └── P3.2 Control Policy (编排策略)
  └── P3.3 Output Asset (结果产品化)
```

---

## 8. 一句话总结

P3 不是新系统，是：
> **在已冻结的 P2.3 系统上，加一层 Execution Recipe DSL + 前端编排策略，让 VIP 用户可以用更少操作完成更多事情。**
