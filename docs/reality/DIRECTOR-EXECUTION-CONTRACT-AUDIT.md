# Director Execution Contract Audit

**Date:** 2026-07-31
**Sprint:** ShortDrama-02 Task 01.1
**Status:** COMPLETE

---

## 1. 昆仑镜当前输出存在哪里？

### 输出路径

```
User Input
  ↓
DirectorRuntime.analyze()     → DirectorPlan (纯叙事, 存内存)
  ↓
compileBlueprint()            → VideoBlueprint (媒体层, 存内存)
  ↓
POST /api/workbench/render    → RenderJob (mockJobs Map)
  ↓
RealTaskRenderer.render()     → BullMQ Tasks (持久化)
```

### 当前持久化的数据

| 数据 | 存储位置 | 用途 | 状态 |
|------|---------|------|------|
| `DirectorPlan` | 内存 (SSE 流向前端) | 导演分析结果展示 | ❌ 非持久化 |
| `VideoBlueprint` | 内存 (API 响应) | 编译后的媒材结构 | ❌ 非持久化 |
| `StoryConstitution` | `story_constitution` 表 | 故事宪法（不可变约束） | ✅ 持久化 |
| `DirectorMemory` | `director_memory` 表 | continuity/情感/视觉锚点 | ✅ 持久化 |
| `ScriptBreakdown` | `ScriptBreakdown` 表 | 剧本分析结果 | ✅ 持久化 |
| RenderJob | `mockJobs` (内存 Map) | 渲染任务状态 | ❌ 非持久化 |
| Render Result | BullMQ Task + Asset | 实际生成 URL | ✅ 持久化 |

### 关键发现

**昆仑镜输出（DirectorPlan）从未被完整持久化到 DB。**

- 前端通过 SSE 流实时消费 `DirectorPlan` 的分析结果
- 场景/角色在火麒麟工作流中写入 `ai_scene_specs`/`ai_character_specs`，但这是**火麒麟**的数据，不是昆仑镜的输出
- `compileBlueprint()` 产生 `VideoBlueprint` 后只通过 API 返回前端，未持久化
- 已有的 `ScriptBreakdown` 表存储的是**旧版剧本分析**，不是当前昆仑镜的 `DirectorPlan`

---

## 2. 是否已经存在完整生产计划？

**否。**

当前工作流中不存在 `ExecutionPlan` 概念。

### 现有相关结构对比

| 结构 | 包含 | 是否完整生产计划 |
|------|------|:---:|
| `DirectorPlan` | 叙事意图、场景段、情绪弧、因果图 | ❌ 纯叙事，无媒体参数 |
| `VideoBlueprint` | compiledPrompt、shotGraph、promptSpec、effectSpecs | ⚠️ 接近但缺执行任务映射 |
| `ScriptBreakdown` | characters/scenes/dialogues/actions 结构化数据 | ⚠️ 旧版格式 |
| `AiSceneSpec` | sceneName/description/imagePrompt | ❌ 单场景资料 |
| `Storyboard` | shotIndex/duration/shotType/action/camera | ⚠️ 镜头级数据，但缺任务关联 |

### 缺口分析

```
DirectorPlan → VideoBlueprint → [缺失] → TaskQueue/VideoTask
                                  ⬆
                          ExecutionPlan
                          需要建立
```

`VideoBlueprint` 已经包含：
- `compiledPrompt` → 可生成 image/video 任务
- `shotGraph.shots[].intent` + camera/subject/action → 镜头级数据
- `effectSpecs` → 特效要求

但缺少：
- 哪些场景需要哪些 Task（image/video/TTS）的显式映射
- Task 间的依赖关系（image → video → audio）
- 场景→角色→Asset 的关联
- 可执行的 plan 结构（非 DB 大改，DTO 即可）

---

## 3. 哪些字段可以直接转换为 Task？

### 可直接映射的字段

| 来源字段 | 目标 Task 字段 | 类型 |
|---------|---------------|------|
| `VideoBlueprint.compiledPrompt` | `TaskQueue.payload.prompt` | Text→Prompt |
| `ShotGraph.shots[].intent` | 分时段 prompt 描述 | Text→Prompt |
| `ShotGraph.shots[].camera` | 镜头运动 / 构图参数 | 结构→Prompt tag |
| `ShotGraph.shots[].subject` | 主体描述 | 角色引用 |
| `ShotGraph.shots[].action` | 动作描述 | Prompt enrichment |
| `AiSceneSpec.imagePrompt` | Image Task 直接 prompt | ✅ 现成 |
| `AiCharacterSpec.imagePrompt` | Character Image Task | ✅ 现成 |
| `AiCharacterSpec.voiceType/voiceId` | TTS Task 配置 | ✅ 现成 |
| `SceneProfile / AiSceneSpec` | 场景基础信息 | ✅ 现成 |

### 现有 Task 入队入口（复用）

```typescript
// POST /api/tasks/ai-generate
{
  taskType: 'image' | 'video' | 'tts' | 'frame',
  projectId: string,
  input: {
    prompt: string,
    characterRefs?: string[],
    style?: string,
    // ...
  }
}
```

### Asset 写入路径

```
生成完成 → POST /api/v2/workbench/project/:id/save-image → CharacterImage/SceneImage
         → POST /api/v2/workbench/project/:id/save-video → AiVideoSegment
         → Asset 表（通过 taskId 关联）
```

---

## 4. 哪些字段缺失，需要补充？

### 缺失清单

| 缺失项 | 原因 | 补充方式 |
|--------|------|---------|
| 场景→任务的显式映射 | 现有 pipeline 需要知道"这个场景 produce 哪些 Task" | `DirectorExecutionPlan.scenes[].imageTasks/videoTasks/audioTasks` |
| 任务间依赖 | Image 必须在 Video 之前完成 | `DirectorExecutionPlan.scenes[].dependencies[]` |
| 角色与场景的关联 | 角色 design 后需要在场景中被引用 | `DirectorExecutionPlan.scenes[].imageTasks[].characterRefs[]` |
| 执行元数据 | traceId, 版本, 来源标记 | `DirectorExecutionPlan.metadata.*` |
| 音画同步配置 | TTS 文本需要与镜头时长匹配 | `DirectorExecutionPlan.scenes[].audioTasks[].duration/alignment` |

### 不缺失（已有）

| 领域 | 已有字段 | 位置 |
|------|---------|------|
| 场景 Prompt | `AiSceneSpec.imagePrompt` | DB |
| 角色 Prompt | `AiCharacterSpec.imagePrompt` | DB |
| 镜头设计 | `Storyboard.*` (shotType/camera/action) | DB |
| 视频分段 | `AiVideoSegment.*` | DB |
| 帧设计 | `AiFrameDesign.*` | DB |
| 特效 | `AiEffectSpec.*` | DB |
| 动作 | `AiActionSpec.*` | DB |
| 摄像机 | `AiCameraSpec.*` | DB |
| 情绪 | `AiEmotionSpec.*` | DB |
| 道具 | `AiPropSpec.*` | DB |
| TTS 配置 | `AiVoiceConfig.*`, `TTSRecord.*` | DB |
| 全局制作参数 | `AiVideoProduction.*` | DB |

---

## 5. 结论

### 可取消的操作

- ❌ **不大规模改 Schema** — 所有基础数据已有现成字段
- ❌ **不创建新表** — Contract 用 DTO/JSON
- ❌ **不写新的数据模型** — 已有 `AiSceneSpec`, `AiCharacterSpec`, `AiVideoSegment` 等

### 需要做的

| 工作 | 类型 |
|------|------|
| 定义 `DirectorExecutionPlan` DTO | Task 01.2 |
| 创建 `director-execution-adapter.ts` | Task 01.3 (将 Plan → Task Runtime) |
| 打通单场景链路 | Task 01.4 |
| 前端加按钮 | Task 01.5 |

### 数据流（目标）

```
昆仑镜分析完成
  ↓
DirectorPlan (叙事) → compileBlueprint → VideoBlueprint (媒材)
  ↓
DirectorExecutionPlan ← 新 DTO (场景→任务映射)
  ↓
director-execution-adapter
  ↓
/api/tasks/ai-generate (逐个场景提交 image/video/TTS 任务)
  ↓
BullMQ ai-runtime → Worker → Provider → Asset
  ↓
回调: save-image / save-video → DB 持久化
```

---

**Audit 完成。下一步：Task 01.2 — 设计 DirectorExecutionPlan DTO。**
