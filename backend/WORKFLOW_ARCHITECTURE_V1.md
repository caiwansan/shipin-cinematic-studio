# WORKFLOW_ARCHITECTURE_V1.md — 短剧工作台全链路架构基线

**创建时间:** 2026-06-27  
**状态:** ✅ FROZEN (Architecture Freeze)  
**签署者:** 本阶段架构收敛已冻结，修改需审批。  
**配套文档:** `AIGC_SPEC_OUTPUT_V1.md` (Schema Contract), `EXECUTION_RESULTS_CONTRACT.md` (存储规范)

---

## 1. 全链路 Agent 架构

### 1.1 入口

```
[用户输入剧本]
     ↓  POST /api/script/submit
[ScriptAnalysisWorkspace.vue] → 前端的脚本分析工作台
     ↓
[aigcOrchestrator] → agents/aigc-orchestrator.ts
```

### 1.2 Agent DAG

```
Phase 0 (串行 — 总指挥先行):
  ┌─────────────────────────────┐
  │ 剧情总指挥 (PlotSupervisor)  │  → plotBlueprint
  │   promptFile: plot-supervisor.txt
  │   timeout: 60s, maxTokens: 8192
  └─────────────────────────────┘
               ↓
Phase 1 (并行 — Promise.allSettled):
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ 角色设计师  │  │ 场景设计师  │  │ 角色定妆师  │
  │ character- │  │ scene-     │  │ makeup-    │
  │ designer   │  │ designer   │  │ designer   │
  │ .txt       │  │ .txt       │  │ .txt       │
  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        ↓               ↓               ↓
  characterSpecs   sceneSpecs      characterMakeupSpecs
               ↓
Phase 2 (并行 — Promise.allSettled, 带 Phase 1 context):
  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐
  │ 声音设计师  │  │ 画面设计师  │  │ 道具设计师  │  │ 镜头/特效师  │
  │ sound-     │  │ frame-     │  │ props-     │  │ director-   │
  │ designer   │  │ designer   │  │ designer   │  │ of-         │
  │ .txt       │  │ .txt       │  │ .txt       │  │ photography │
  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬───────┘
         │               │               │               │
         ↓               ↓               ↓               ↓
   voiceConfigs    videoSegments     propSpecs      effectSpecs
                   frameDesign
                   videoProduction
```

### 1.3 Agent 调用协议

每个 Agent 通过 `NarrativeGateway.execute()` → `RuntimeCredential` → `ModelAdapterRegistry` 调用 LLM。

```typescript
interface AgentDef {
  name: string           // 路由名称
  promptFile: string     // 对应 PromptTemplate 表 name
  outputKey: string      // 合并到 AigcSpecOutput 时的 key
}
```

### 1.4 合并输出

```typescript
interface AigcSpecOutput {
  plotBlueprint: any              // Phase 0
  characterSpecs: any[]           // Phase 1
  characterMakeupSpecs: any[]     // Phase 1
  sceneSpecs: any[]               // Phase 1
  voiceConfigs: any[]             // Phase 2
  videoSegments: any[]            // Phase 2 — 最核心输出
  frameDesign: any[]              // Phase 2
  videoProduction: any            // Phase 2
  propSpecs: any[]                // Phase 2
  effectSpecs: any[]              // Phase 2
  actionSpecs: any[]              // Phase 2 (来自 effectSpecs || plotBlueprint)
  cameraSpecs: any[]              // Phase 2 (同上)
  emotionSpecs: any[]             // Phase 2 (来自 effectSpecs)
  storyboardSpecs: any[]          // 预留

  // V3 向后兼容别名
  characters?: any[]
  scenes?: any[]
  voices?: any[]
  props?: any[]
  effects?: any[]
  emotionCurve?: any[]
  segments?: any[]
  storyArc?: any
}
```

---

## 2. 数据流与消费关系

### 2.1 数据流水线

```
Agent 输出
     ↓
写入 DB Project.executionResults (JSON Blob)
     ↓
前端 loadFromServer() → useStudioStore
     ↓
各工作台从 store 消费
```

### 2.2 Ownership & Consumer 矩阵

| 数据 | Owner 字段 | 来源 Agent | Consumer (工作台) | 消费方式 |
|------|-----------|-----------|-------------------|----------|
| `plotBlueprint` | ✅ | 剧情总指挥 | 全体 Agent (仅作为 context) | Agent 间传递，前端不直接消费 |
| `characterSpecs` | ✅ | 角色设计师 | 角色工作台 | `store.characters` |
| `characterMakeupSpecs` | ✅ | 角色定妆师 | 角色工作台 (定妆面板) | `store.characters` (合并) |
| `sceneSpecs` | ✅ | 场景设计师 | 场景工作台 | `store.scenes` |
| `voiceConfigs` | ✅ | 声音设计师 | ⚠️ **无人消费** (Dubbing 未实现) | N/A |
| `videoSegments` | ✅ | 画面设计师 | 故事板工作台、视频生成工作台 | `store.segments` |
| `frameDesign` | ✅ | 画面设计师 | 故事板工作台 | — |
| `videoProduction` | ✅ | 画面设计师 | 视频生成工作台 | — |
| `propSpecs` | ✅ | 道具设计师 | 场景工作台 | `store.assets` |
| `effectSpecs` | ✅ | 镜头/特效师 | 视频生成工作台 | — |
| `actionSpecs` | — | effectSpecs 或 plotBlueprint | 画面设计师 (context) | — |
| `cameraSpecs` | — | effectSpecs 或 plotBlueprint | 画面设计师 (context) | — |

### 2.3 数据依赖图

```
plotBlueprint
  ├──→ 角色设计师 (context)
  ├──→ 场景设计师 (context)
  ├──→ 角色定妆师 (context)
  └──→ Phase 2 全部 Agent (context)

characterSpecs + sceneSpecs (Phase 1 输出)
  └──→ Phase 2 全部 Agent (context)

videoSegments + characterRefs + sceneRefs
  └──→ 故事板工作台
        └──→ POST /api/tasks/ai-generate (taskType=image)
              └──→ 生成图片 → execution-images/storyboards

storyboard images + voice + music + effects
  └──→ 视频生成工作台
        └──→ POST /api/tasks/ai-generate (taskType=video)
              └──→ 合成最终视频
```

---

## 3. Failure Point 分析

### 🔴 CRITICAL — 画面设计师 (Visual Agent)

**问题:** `videoSegments` 是整个 Studio 的最核心数据（故事板、视频合成都依赖它），但它由**单个 Agent** 一次 LLM 调用生成。如果 LLM 输出非法 JSON 或格式异常，**无 fallback，无重试，无校验**。

**建议:** P4-2 第一优先级保护:
1. `agent/retry` — 解析失败自动重试（已有 1 次重试，但重试时 payload 没变）
2. `schema/validate` — 输出必须通过 schema 校验才能写入 executionResults
3. `agent/fallback` — 如果画面设计师失败，是否有降级方案

### 🟡 HIGH — executionResults 无 schema

**问题:** `Project.executionResults` 是一个自由的 JSON blob (Prisma Json 字段)，没有 version 字段，没有 schema validation，Agent 可以随意增减字段。

**后果:** 前端 `loadFromServer()` 有 400+ 行解析逻辑，每个字段都要 `?` 防 null。Agent 字段名一改，前端静默丢数据。

### 🟡 HIGH — 配音工作台未实现

**问题:** `voiceConfigs` 数据已生成并入库，但 DubbingRender 工作台是空占位（"即将上线"）。配音是视频合成的前提，但目前数据流程断在这里。

### 🟢 MEDIUM — 故事板串行生成

**问题:** `generateAllImages()` 按 segment 顺序串行调 `POST /api/tasks/ai-generate`（`await generateSingleImage(i)`），N 段 × 3s/段 = 用户等 N×3s。

**建议:** 可并行 `Promise.allSettled`（注意并发数限制）。

---

## 4. 前端数据流详解

### 4.1 项目加载

```
PUT /api/v2/workbench/project/:id
  → 写入 executionResults (merged)

GET /api/v2/workbench/project/:id
  → 读取 executionResults
  → 前端 loadFromServer() 解析出:
    - narrative (projects/剧本元数据)
    - characters → store.workspace.characters
    - scenes → store.workspace.scenes
    - segments (来自 videoSegments) → store.workspace.segments
    - assets (prop/道具/音效) → store.assets
```

### 4.2 AI 生成流程

```
各工作台
  ↓
POST /api/tasks/ai-generate
  ↓
ai-tasks.ts:
  1. 配额检查
  2. resolveProviderFromUserConfig → (provider, apiKey, model)
  3. enqueueTask({ runtime: RuntimePayload })
  ↓
queue-manager → Worker Runtime
  ↓
ModelAdapterRegistry.execute(runtime, input)
  ↓
Adapter (image / tts / video)
  ↓
Provider API
```

---

## 5. 当前状态总结

| 层级 | 组件 | 状态 | 备注 |
|------|------|------|------|
| 剧本分析入口 | ScriptAnalysisWorkspace.vue | ✅ 可用 | |
| Agent 编排 | aigcOrchestrator.ts | ✅ 可用 | 2-Phase DAG, 8 Agents |
| Agent LLM 调用 | NarrativeGateway → RuntimeCredential | ✅ 可用 | Architecture Convergence v1 链路 |
| 数据存储 | executionResults (JSON Blob) | ⚠️ 无 Schema | 最大技术债 |
| 角色工作台 | CharacterWorkspace.vue | ✅ 可用 | |
| 场景工作台 | SceneWorkspace.vue | ✅ 可用 | |
| 故事板工作台 | StoryboardWorkspace.vue | ✅ 可用 | 串行生成需优化 |
| 配音工作台 | DubbingRenderWorkspace.vue | ❌ 占位 | 数据已就绪，UI 未实现 |
| 音乐创作 | MusicGenerationWorkspace.vue | ✅ 可用 | 独立 pipeline |
| 视频合成 | VideoGenerationWorkspace.vue | ✅ 可用 | |
| 数据加载 | loadFromServer() | ⚠️ 脆弱 | 400+ 行解析，无版本校验 |

---

## 6. 冻结规则

1. **新增 Agent**: 必须在 `AGENTS` 数组注册，遵循现有 DAG 协议
2. **修改字段**: 先确认 Consumer 矩阵中所有消费者已兼容
3. **Schema 变更**: 必须在 `AIGC_SPEC_OUTPUT_V1.md` 中定义新 version，不得静默增减字段
4. **ExecutionResults 变更**: 须遵循 `EXECUTION_RESULTS_CONTRACT.md` 的迁移策略

---

**本文件是 Architecture Freeze 的一部分。修改需审批。**
