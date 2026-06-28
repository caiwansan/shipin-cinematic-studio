# Runtime Architecture（运行时架构）

**Runtime Version: 0.4** · 2026-05-15

> 本文档描述 AI Production Runtime OS 的完整系统架构，包括分层定义、数据流、组件职责和执行模型。它是一份 Runtime Spec，而非操作指南。

---

## 1. 系统分层架构

```
┌──────────────────────────────────────────────────────┐
│  UI Projection Layer（前端投影层）                     │
│  StudioPage → pipelineStore → 各 Stage 组件           │
│  stores/usePipelineStage → DB API + localStorage      │
├──────────────────────────────────────────────────────┤
│  Showrunner Cognition（导演认知层）                    │
│  ShowrunnerCore → DirectorCognitionLoop                │
│  → IntentState → 叙事理解 / 情绪 / 结构 / 策略 / 执行 │
├──────────────────────────────────────────────────────┤
│  Director Intelligence（导演智能层）                    │
│  CharacterDesign / SceneDesign / ShotDesign            │
│  → RhythmDesign → AtmosphereDesign → PromptCompiler    │
├──────────────────────────────────────────────────────┤
│  Simulation Layer（预演层）                             │
│  SceneSim → ShotSim → EmotionSim → ContinuityCheck     │
│  → Gatekeeper (GO / FIX / BLOCK)                       │
├──────────────────────────────────────────────────────┤
│  Scheduler + Graph Runtime（调度执行层）                │
│  Multi-Graph Scheduler → Never-Break Pipeline v2       │
├──────────────────────────────────────────────────────┤
│  Queue Runtime + Workers（任务队列执行层）               │
│  BullMQ Queue → Worker Runtime → Provider Chain        │
├──────────────────────────────────────────────────────┤
│  Persistence Layer（持久化层）                          │
│  PostgreSQL / Redis (BullMQ)                           │
└──────────────────────────────────────────────────────┘
```

## 2. 数据流总图

```
(用户动作)
    │
    ▼
┌──────────────────────────────┐
│  Vue Component (Stage X)     │
│  └─ submitAiTask(type)       │
│  └─ setStageOutput / status  │
└──────────┬───────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐ ┌──────────┐
│ Queue    │ │ Store    │
│ (Redis)  │ │ (memory) │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌──────────┐ ┌──────────┐
│ Worker   │ │ persist  │
│ Runtime  │ │ Pipeline │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌──────────┐ ┌──────────┐
│ Provider │ │ DB       │
│ (百炼/   │ │ (PG)     │
│ 火山等)  │ │          │
└────┬─────┘ └──────────┘
     │              │
     ▼              ▼
┌──────────┐   ┌──────────┐
│ 图片/    │   │ pipeline │
│ 音频/    │   │ _stages  │
│ 视频     │   │ _jobs    │
│ 上传     │   │ images   │
└──────────┘   └──────────┘
```

## 3. 组件职责

### 3.1 UI Projection Layer

| 组件 | 职责 |
|------|------|
| `pipelineStore.ts` | 前端状态投影 + 持久化协调 |
| `usePipelineStage.ts` | `completeAndExecuteNext` 驱动流水线 |
| `ai-task-util.ts` | `submitAiTask` → Queue |
| `CharacterCreation.vue` | 角色设计 UI |
| `SceneGeneration.vue` | 场景生成 UI |
| `StoryboardProduction.vue` | 分镜制作 UI |
| `FrameProduction.vue` | 首尾帧制作 UI |
| `DirectorStudio.vue` | AI 导演运镜 UI |

### 3.2 Showrunner Cognition

| 组件 | 职责 |
|------|------|
| `ShowrunnerCore` | 总导演大脑，5 层认知（叙事/情绪/结构/策略/执行） |
| `DirectorCognitionLoop` | 认知循环引擎，Showrunner → Intent → Simulation |
| `DirectorIntentState` | 语义锁定层，全局唯一真理 |

### 3.3 Director Intelligence

| 组件 | 职责 |
|------|------|
| `CharacterDesign` | 角色设计 Agent |
| `SceneDesign` | 场景设计 Agent |
| `ShotDesign` | 镜头设计 Agent |
| `RhythmDesign` | 节奏设计 Agent |
| `AtmosphereDesign` | 氛围设计 Agent |
| `PromptCompiler` | Prompt 编译管线 |

### 3.4 Simulation Layer

| 组件 | 职责 |
|------|------|
| `SceneSim` | 场景预演 |
| `ShotSim` | 镜头预演 |
| `EmotionSim` | 情绪预演 |
| `ContinuityCheck` | 连续性校验 |
| `Gatekeeper` | GO(>0.85) / FIX(0.6-0.85) / BLOCK(<0.6) |

### 3.5 Execution Layer

| 组件 | 职责 |
|------|------|
| `queue-manager.ts` | BullMQ Queue + Workers |
| `worker-runtime.ts` | Worker 执行环境 + Provider fallback |
| `api-router.service.ts` | Provider 优先级链（百炼/火山/openai/siliconflow） |
| `ai-tasks.ts` | HTTP → Queue 路由 |
| `dag-runtime.ts` | 多 provider 调度 |
| `aggregation-engine.ts` | 多图结果聚合 |

### 3.6 Persistence Layer

| 组件 | 职责 |
|------|------|
| `pipeline_stages` | 流水线 stage 状态（DB truth） |
| `pipeline_jobs` | 任务队列执行状态 |
| `character_images` | 角色图片 |
| `scene_images` | 场景图片 |
| `project` | 项目元数据 |
| BullMQ Redis | 任务队列临时状态 |

## 4. 用户创作完整流程

### Phase A: 叙事创建

```
User 输入剧本意图
  → POST /api/v1/showrunner/plan → BullMQ Queue
  → Showrunner Worker (async)
    ├─ Intent Classifier → 意图类型分类
    ├─ Intent Strength Analyzer → 用户意图强度
    ├─ Narrative Elasticity Engine → 叙事弹性
    ├─ LLM（豆包/DeepSeek fallback）→ 剧本生成
    ├─ Reflection Engine → 叙事反思重构
    ├─ World Memory Service → 世界记忆写入
    └─ 返回 narrativeData
  → UI 轮询 GET /api/v1/showrunner/status/:projectId
  → narrativeData → pipelineStore.stages.story.output
  → persistPipeline() → syncToBackend()
```

### Phase B: 流水线生产

每个 stage 遵循相同的执行模式：

```
enterStage(stage)
  → 用户在该 stage 中操作/配置
  → submitAiTask(type) → Queue → Worker → Provider
  → setStageOutput(output)
  → completeAndExecuteNext()
    ├─ setStageStatus('completed')
    ├─ syncToBackend() → DB upsert
    └─ 自动推进到下一 stage（如有）
```

Stage 顺序：`story → character → scene → storyboard → voice → frame → director → production`

### Phase C: 状态恢复

```
hydratePipeline(projectId)
  → GET /api/pipeline/stages/:projectId (DB first)
    ├─ 有数据 → 直接恢复 stages 状态
    └─ 无数据 → localStorage fallback
                └─ 恢复 → 不反向写 DB
```

## 5. 失败兜底

| 场景 | 策略 |
|------|------|
| Provider 调用失败（余额不足/403/超时） | Worker Runtime → fallback 到下一个 Provider |
| pipeline DB 无数据 | localStorage fallback（仅恢复） |
| Queue 崩溃 | Worker 重启后通过 DB pipeline_stages 恢复 |
| 前端崩溃/刷新 | hydratePipeline(pid) → DB 恢复所有已完成 status |
| 前端 submit 失败 | UI 显示错误，用户可重试 |

## 6. 关键文件索引

### 后端 (`/backend/src/`)

- `routes/pipeline.ts` — Pipeline stage GET/PUT API
- `routes/ai-tasks.ts` — AI 任务路由（submit/status/result）
- `routes/execution-images.ts` — 素材图片查询
- `queue/queue-manager.ts` — BullMQ 队列管理
- `queue/worker-runtime.ts` — Worker 执行引擎
- `services/api-router.service.ts` — Provider 路由选择
- `showrunner/showrunner-core.ts` — Showrunner 大脑
- `cognition-loop/` — 认知循环引擎
- `director/` — 导演智能层
- `director-simulation/` — 预演层
- `jobs/` — Job 系统（llm-pool, job-queue, showrunner-worker 等）

### 前端 (`/frontend/`)

- `stores/pipelineStore.ts` — 流水线状态 store
- `composables/studio/usePipelineStage.ts` — Stage 编排
- `composables/ai-task-util.ts` — AI 任务提交工具
- `components/studio/execution/` — 各 Stage 组件
- `services/production/bootstrapEngine.ts` — 项目启动引擎
