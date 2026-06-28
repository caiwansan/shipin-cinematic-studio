# 昆仑镜叙事导演工作台 — 产品级架构文档

## 核心哲学

> **系统必须隐身，能力必须显性。**
> 用户感觉自己在"导演一部片"，不是在"调用 AI"。

---

## 一、产品结构总览（5 层 UI）

```
┌──────────────────────────────────────────────┐
│ 1. Story Input（故事输入层）                   │
│    文本框 + 生成按钮                           │
├──────────────────────────────────────────────┤
│ 2. Director View（叙事编辑层 — 核心）          │
│    左：NarrativeGraph 可视化                   │
│    右：DirectorPlan 面板（情绪/节奏/意图）      │
├──────────────────────────────────────────────┤
│ 3. Blueprint View（分镜预览层）                │
│    Scene → Shot 时间线                        │
│    Camera / Lighting 标签                      │
├──────────────────────────────────────────────┤
│ 4. Style Studio（风格选择层）                  │
│    预设卡片 + DSL 输入                        │
│    实时 preview                               │
├──────────────────────────────────────────────┤
│ 5. Render Panel（执行控制层）                  │
│    预渲染帧 / 队列状态 / 重试                  │
└──────────────────────────────────────────────┘
```

---

## 二、用户工作流（一条线）

```
输入故事
  ↓  1. StoryInputPage
AI 生成导演结构（DirectorPlan + NarrativeGraph）
  ↓
用户调整叙事节点（拖拽/改情绪/调节奏）
  ↓  2. DirectorViewPage
自动编译为 Blueprint（Scene → Shot）
  ↓
选择风格（预设 / DSL 输入 / 实时预览）
  ↓  3. StyleStudioPage
确认 → 加入渲染队列
  ↓
预览 / 下载 / 修改
    4. RenderPanelPage
```

---

## 三、前端组件树（Vue 3 + Nuxt 3）

### Page: `/director-workbench`

```
DirectorWorkbenchPage
├── StoryInputSection
│   ├── StoryTextArea
│   └── GenerateDirectorButton
│
├── DirectorViewSection
│   ├── NarrativeGraphCanvas        ← 核心组件
│   │   ├── GraphNode
│   │   ├── GraphEdge
│   │   └── NodeControlPanel
│   ├── DirectorPlanPanel
│   │   ├── EmotionalArcChart
│   │   ├── PacingSlider
│   │   └── IntentSummary
│   └── ActionBar
│       ├── RegenerateButton
│       └── ContinueButton → Blueprint
│
├── BlueprintViewSection
│   ├── Timeline
│   │   ├── SceneBlock
│   │   └── ShotChip
│   ├── ShotDetailPanel
│   │   ├── CameraTag
│   │   ├── LightingTag
│   │   └── MotionTag
│   └── ActionBar
│       └── ContinueButton → Style
│
├── StyleStudioSection
│   ├── StylePresetGrid
│   │   └── StyleCard (×6: noir/cinematic/anime/...)
│   ├── DSLInput
│   │   ├── DSLTextInput
│   │   └── DSLValidationBadge
│   ├── StylePreview
│   │   ├── ColorPalettePreview
│   │   └── LightingSimulation
│   └── ActionBar
│       └── GenerateButton → Render
│
└── RenderPanelSection
    ├── PreviewFrame
    ├── JobQueue
    │   ├── JobItem (pending/running/done/failed)
    │   └── RetryButton
    └── ActionBar
        ├── DownloadButton
        └── BackToEditButton
```

### 状态数（Pinia Store）

```ts
interface DirectorWorkbenchState {
  // 故事
  storyInput: string
  storyInputLoading: boolean

  // Director
  directorPlan: DirectorPlan | null
  narrativeGraph: NarrativeGraph | null
  directorLoading: boolean

  // Blueprint
  blueprint: VideoBlueprint | null
  blueprintLoading: boolean

  // Style
  selectedStyle: string
  styleDSLInput: string
  styleDSLValidation: DSLValidationResult | null
  stylePreview: StyleProfile | null

  // Render
  renderJobs: RenderJob[]
  renderQueue: RenderJob[]
}

// Nurx3 Action
actions: {
  async generateDirector(story: string)
  async updateDirectorPlan(plan: Partial<DirectorPlan>)
  async compileBlueprint()
  async applyStyle(dsl: string)
  async generateVideo()
  async retryJob(jobId: string)
}
```

---

## 四、API 设计（从产品到 OS 的桥梁）

### `POST /api/workbench/generate-director`

```
请求: { story: string }
响应: { directorPlan, narrativeGraph }
OS 链路: Gateway → Director Runtime → Convergence → validate
```

### `POST /api/workbench/compile-blueprint`

```
请求: { directorPlan, narrativeGraph }
响应: { blueprint }
OS 链路: compileWithStyle(默认风格)
```

### `POST /api/workbench/apply-style`

```
请求: { blueprint, styleDSL }
响应: { styledBlueprint, styleProfile, dslValidation }
OS 链路: DSL Parser → StyleRouter → compileWithStyle
```

### `POST /api/workbench/render`

```
请求: { styledBlueprint }
响应: { jobId, queuePosition }
OS 链路: Execution Spine → Provider Pipeline
```

### `GET /api/workbench/jobs/:id`

```
响应: { status, progress, output?, error? }
OS 链路: Job Queue → Worker Status
```

---

## 五、OS → UI 映射（翻译对照表）

| Phase 7 系统层 | 产品 UI | 用户感知 |
|---------------|---------|---------|
| Director Runtime | DirectorView → NarrativeGraphCanvas | "故事结构" |
| Convergence Engine | 自动选中（无 UI） | — |
| Blueprint Compiler | BlueprintView → Timeline | "分镜表" |
| Style Layer | StyleStudio → StyleCard + DSL | "风格选择" |
| Execution Spine | RenderPanel → JobQueue | "渲染中" |
| Director Registry | —（系统内部） | — |
| Plugin Sandbox | —（扩展阶段开放） | — |
| Incentive Engine | —（内部排序用） | — |
| Safety Guard | —（系统自动运行） | — |

**隐藏层（用户不可见）：** 5 层
**用户可见层：** 4 层

---

## 六、设计原则（决定产品成败）

### ❌ 不要做
- ❌ 不展示 Phase / Layer / Runtime 等工程术语
- ❌ 不让用户看到 Blueprint JSON / DirectorPlan JSON
- ❌ 不要让用户选择"使用哪个 Director"
- ❌ 不要暴露 Convergence / Variants / 评分细节

### ✅ 要做
- ✅ "输入故事 → 看结构 → 调整 → 生成"
- ✅ 错误时只说"生成失败，请调整故事描述"
- ✅ 加载中显示"导演正在分析你的故事..."
- ✅ 风格切换即时预览

---

## 七、无样式的 Vue 页面骨架

```vue
<!-- DirectorWorkbenchPage.vue — 无样式骨架 -->
<template>
  <div class="director-workbench">
    <!-- Step 1: Story Input -->
    <StoryInputSection
      v-if="step === 'input'"
      v-model="storyInput"
      @generate="onGenerateDirector"
    />

    <!-- Step 2: Director View -->
    <DirectorViewSection
      v-if="step === 'director'"
      :plan="directorPlan"
      :graph="narrativeGraph"
      @back="step = 'input'"
      @continue="onCompileBlueprint"
    />

    <!-- Step 3: Blueprint View -->
    <BlueprintViewSection
      v-if="step === 'blueprint'"
      :blueprint="blueprint"
      @back="step = 'director'"
      @continue="step = 'style'"
    />

    <!-- Step 4: Style Studio -->
    <StyleStudioSection
      v-if="step === 'style'"
      v-model:dsl="styleDSLInput"
      @apply="onApplyStyle"
      @generate="onRender"
    />

    <!-- Step 5: Render Panel -->
    <RenderPanelSection
      v-if="step === 'render'"
      :jobs="renderJobs"
      @back="step = 'style'"
      @retry="onRetryJob"
    />
  </div>
</template>
```

---

## 八、工程落地分级

| 级别 | 内容 | 预估 |
|------|------|------|
| P0 | StoryInput → DirectorView → BlueprintView | 1-2 天 |
| P1 | Style Studio（预设卡片 + DSL 输入） | 1 天 |
| P2 | Render Panel + Job Queue | 1 天 |
| P3 | NarrativeGraph 拖拽编辑 | 2 天 |
| P4 | Style Preview + Lighting Simulation | 2-3 天 |

**MVP（P0+P1）可上线时间：2-3 天。**

---

## 九、最关键的一句话

> 用户打开的每一个页面，都是在"导演一部电影"。
> 不是在"配置 AI 参数"。
>
> 这就是昆仑镜 SaaS 的全部。
