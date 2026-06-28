# 全流程数据流审查报告

**审查时间**: 2026-05-20 22:40  
**审查范围**: 剧本输入 → 角色设定 → 场景设定 → 音色设定 → 分镜制作 → 首尾帧制作 → 视频制作  
**审查方式**: 代码静态审计 + 数据库实盘验证  

---

## 总体结论

**大部分流程数据链路通，但存在三个关键断层和多个局部问题。** 角色和场景数据基本能正确渲染到前端，但音色、分镜首尾帧的降级数据生成前后端不一致，且所有独立表（`ai_character_specs` 等）为空。

---

## 一、全链路数据流图

```
ScriptInput(提交剧本)
  │ POST /api/v1/script/parse  ← 后端 7 Agent 并发拆解
  │ return { plotBlueprint, voiceConfigs?, videoSegments?, ... }
  ▼
onScriptParsed(production.vue)
  │ POST /api/projects → 创建项目(写入 project.description + execution_results)
  │ buildDesignSpec() → 转换 plotBlueprint 为 designSpec
  │ hydrationStore.designSpec = designSpec (内存中)
  │ PUT /api/projects/:id → 同步 designSpec 到 description (JSON字符串)
  ▼
┌─────────────────────────────────────────────────────────┐
│         每个阶段组件独立从 hydrationStore 加载             │
├─────────────────────────────────────────────────────────┤
│  CharacterCreation      ← hydrationStore.characterSpecs  │
│  SceneGeneration        ← hydrationStore.sceneSpecs      │
│  VoiceGeneration        ← hydrationStore.voiceConfigs    │
│  StoryboardProduction   ← hydrationStore.videoSegments   │
│  FrameProduction        ← hydrationStore.videoSegments   │
│                         + hydrationStore.frameDesign     │
│  DirectorStudio(video)  ← hydrationStore.videoProduction │
└─────────────────────────────────────────────────────────┘
  ↑ 刷新/重新打开: hydrationStore.hydrateProject()
    → GET /api/projects/:id/hydrate
    → 独立表空则从 project.description JSON 降级
```

---

## 二、数据库状态验证

| 表 | 记录数 | 说明 |
|---|---|---|
| `Project` (latest) | 1 | `c533862e`, `description` 含完整 `designSpec`, `execution_results` 含 `plotBlueprint` |
| `ai_character_specs` | **0** | 独立表全空 |
| `ai_scene_specs` | **0** | |
| `ai_video_segments` | **0** | |
| `ai_voice_configs` | **0** | |
| `ai_frame_designs` | **0** | |
| `ai_video_productions` | **0** | |
| `storyboard_images` | **0** | |

**结论**: 所有数据都存在 `Project.description` JSON 和 `execution_results` 字段中。独立写入路径（`/api/projects/full-create`）从未被使用。

---

## 三、逐个流程阶段审查

### 1. 剧本输入 → AI 拆解 (ScriptInput)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `POST /api/v1/script/parse` 调用正确 | ✅ | 带 `visualStyle`/`aspectRatio` |
| `emit('parsed', { data, config })` | ✅ | |
| 后端 7 Agent 并行拆解 | ✅ | plotSupervisor, character-designer, scene-designer, frame-designer, voice-designer, video-prompt-optimizer, plot-supervisor |
| `localStorage.setItem('current_story_text')` | ✅ | 供后续 Agent 补全用 |
| `hydrationStore.visualStyle/aspectRatio` 写入 | ✅ | |

**发现的问题**: 
- visualStyle/aspectRatio 虽然传到后端，但只作为 `styleSuffix` 追加到 userPrompt 尾部，各 Agent **system prompt 未强制要求 AI 遵循这些参数**（仅 scene-designer 的 JSON schema 含 `aspectRatio` 但写死 "16:9"）
- 新项目 `POST /api/projects` 后不写独立表（`full-create` 路径未使用）

### 2. 角色设定 (CharacterCreation)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `onMounted` 读 `hydrationStore.characterSpecs` | ✅ | 主路径 |
| `hydrateProject()` 兜底 | ✅ | Store 无数据时从后端拉 |
| `loadFromHydrateDirect()` 二次兜底 | ✅ | |
| `loadFromBackend()` 加载已生成图片 | ✅ | 从 `execution_images` 表 |
| `loadFromWorldMemory()` 兜底 | ✅ | |
| 页面切换后 `watch(isHydrated)` 重新加载 | ✅ | |
| 模型列表数据源 | ❌ | `loadAvailableModels` 硬编码查 `model-providers.aliyun.image` → DB 中 aliyun 无 `image` 模型 → 列表永远为空 |

### 3. 场景设定 (SceneGeneration)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `onMounted` 读 `hydrationStore.sceneSpecs` | ✅ | |
| `hydrateProject()` 兜底 | ✅ | |
| `loadFromHydrateDirect()` 二次兜底 | ❌ **缺失** | 仅在 character 和 storyboard 有，scene 没有 `loadFromHydrateDirect` 兜底 |
| `watch(isHydrated)` 监听 | ✅ | |
| **场景为空时无最终兜底** | ❌ | 如果 hydrationStore 和 hydrate API 都返回空场景, 页面永久显示 "暂无场景数据" |

### 4. 音色设定 (VoiceGeneration)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `onMounted` 读 `hydrationStore.voiceConfigs` | ✅ | |
| `hydrateProject()` 兜底 | ✅ | |
| `loadFromHydrateDirect()` 兜底 | ❌ **缺失** | 无该兜底 |
| `loadExecutionResults()` 从 DB 恢复 | ✅ | 含 voiceConfigs 恢复 |
| **voiceConfigs 数据来源** | ⚠️ | AI 拆解后 `fullResult?.voiceConfigs` 通常为空, `buildDesignSpec` 会为 `[]` |
| **生成语音后持久化** | ⚠️ 刚修复(22:30) | `saveToBackend` 改为合并模式, 生成后自动调用 |
| **DB 已有 tts 数据被覆盖** | ❌ **已修复** | 之前整体覆盖, 现在先读后合并 |

### 5. 分镜制作 (StoryboardProduction)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `onMounted` 读 `hydrationStore.videoSegments` | ✅ | |
| `hydrateProject()` 兜底 | ✅ | |
| 后端 hydrate 直接请求兜底 | ✅ | 二次兜底 |
| `loadFromBackend()` 已生成图片 | ✅ | |
| **模型列表数据源** | ⚠️ 刚修复(22:40) | 改为从 `modelCardProviderMap` 读用户选择的 provider |
| **分镜生成后持久化到 executionResults** | ❌ **缺失** | generateStoryboard 只存 localStorage, 不调 saveToBackend |
| **分镜持久化整体覆盖** | ❌ **缺失** | 后端的 storyboard images 表独立, 但 `executionResults` 中无 storyboard 数据 |

### 6. 首尾帧制作 (FrameProduction)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `onMounted` 读 `hydrationStore.videoSegments + frameDesign` | ✅ | |
| `hydrateProject()` 兜底 | ✅ | |
| 后端 hydrate 直接请求兜底 | ❌ **缺失** | 无该兜底 |
| **frameDesign 始终为空** | ❌ | AI 拆解不产生 frameDesign, buildDesignSpec 中 `fullResult?.frameDesign` 也是空的 (Agent 不生成) |
| **首尾帧全靠用户手工写描述** | ⚠️ | UI 提示"当前暂无首尾帧设计方案，你需要手动填写" |

### 7. 视频制作 (DirectorStudio)

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `designSpec.videoProduction` 读 | ✅ | 但 `buildDesignSpec` 返回 null |
| **videoProduction 始终为 null** | ❌ | AI 拆解不产生, 页面只展示一堆"未指定" |
| 视频生成调用 `submitAiTask` | ✅ | |

---

## 四、关键断层（按严重性排序）

### 🔴 P0 — 模型列表全流程空数据
- **涉及**: CharacterCreation, StoryboardProduction, (以后 FrameProduction 也通用)
- **根因**: `ModelProvider` 表中 `aliyun` 的 `modelType = 'llm'`, `defaultParams.models.image` 不存在
- **当前状态**: CharacterCreation 和 StoryboardProduction 各自 `loadAvailableModels` 硬编码查 `aliyun.image` 永远返回空
- **建议**: 
  1. 要么在 `ModelProvider` 表中为所有类型创建记录（llm, image, video, tts 各一条）
  2. 要么全部统一从 `/api/public/global-models` 读并按 type 过滤（CharacterCreation 还没改）

### 🔴 P0 — 独立表从未写入
- **根因**: `onScriptParsed` 用 `POST /api/projects` 而不是 `/api/projects/full-create`
- **影响**: `hydrate` 永远走 JSON 降级路径, 视频分段等只能靠 `buildDesignSpec` 的降级逻辑
- **建议**: 如果不想改写入路径, 确保降级逻辑完备

### 🔴 P1 — SceneGeneration 缺少 hydrate 直接请求兜底
- 其他 5 个组件都至少有 2 层兜底, SceneGeneration 只有 1 层
- 如果 hydrationStore 因时机问题没同步, 场景页面会永久空白

### 🔴 P1 — StoryboardProduction 生成后不持久化到 DB
- `generateStoryboard` 只写 `localStorage` (saveToLocal), 不加 `saveToBackend`
- 刷新后会丢失分镜图片列表

### 🟡 P2 — videoProduction/frameDesign 始终为 null
- 前端使用的新工作流（production.vue 9 阶段）中, AI 拆解只产生 plotBlueprint
- `frameDesign`, `videoProduction` 从不在拆解阶段生成
- 首尾帧和视频制作阶段只能展示为空或手工填写

### 🟡 P2 — voiceConfigs 始终为 0
- `buildDesignSpec` 从 `fullResult?.voiceConfigs || fullResult?.voiceSpecs || ...` 读
- AI 拆解的 `fullResult` 中 voiceConfigs 字段为空

---

## 五、"角色能渲染场景不能"的问题分析

| 可能的根因 | 可能性 | 解释 |
|-----------|--------|------|
| SceneGeneration 无 `loadFromHydrateDirect` 兜底 | 🔴 **高** | 其他组件都有, 唯独场景没有。如果 hydrationStore 尚未同步就直接显示空 |
| hydrationStore 先写 charSpecs 后写 sceneSpecs | 🟡 中 | `buildDesignSpec` 一次写入完整的, 时序上不应分裂 |
| 渲染时机问题: 角色页面先加载（页面提前打开） | 🟡 中 | 用户可能在 AI 拆解完成前就点进了场景页面 |
| AI 拆解不稳定: 某次 sceneSpecs 返回空 | 🟡 低 | 7 Agent 同时执行, 场景 Agent 个别失败 |

**最可能的根因**: SceneGeneration 的 **唯一加载路径** 是 `hydrationStore.sceneSpecs`。如果用户从 ScriptInput 提交后快速点击"角色设定"再转到"场景设定", hydrationStore 可能已同步（角色有数据）。但如果用户提交后直接刷新页面, `onMounted` 先拉 `hydrate` → `hydrateProject()` 成功写入 → 读到 sceneSpecs 这是应该正常的。

但如果 **hydrationStore 初次同步时 sceneSpecs 为 `undefined`** 而不是 `[]`? 查看 `buildDesignSpec`:
```js
sceneSpecs: buildSceneSpecs(plotBP?.scenes || []),
```
这正常返回数组。但如果 `plotBP` 本身 `scenes` 为空 —— 那 role 和 scene 都为空。

**更可能的情况**: 用户看到的"场景数据没渲染"是间歇性问题，跟异步时序有关。

---

## 六、建议的修复清单

### 立即修复
1. CharacterCreation 改用 `/api/public/global-models` 获取模型列表（参考 StoryboardProduction 的最新改法）
2. SceneGeneration 添加 `loadFromHydrateDirect()` 兜底
3. StoryboardProduction 的 `generateStoryboard` 添加 `saveToBackend()` 持久化

### 短期（下次部署）
4. 统一模型列表获取逻辑到 composable 避免各组件各自实现
5. 拆分 `executionResults` 持久化模式：各阶段独立写入 key（不整体覆盖）
6. 为 FrameProduction 添加 sceneSpecs → frameDesign 的自动降级生成

### 长期
7. 迁移到独立表路径（`full-create`），使 hydrate 走独立表
8. 完善 AI Agent 输出 schema，让 plotBlueprint 含 voiceConfigs/frameDesign/videoProduction

---

## 七、专家会诊补充：Execution Reality Map v1

以下内容基于独立专家审计结果，重构了系统的真实运行模型。

### 7.1 系统真实三层结构

```
L1 - Generation Reality（AI 产物层）
  plotBlueprint → characterSpecs / sceneSpecs / voiceConfigs / videoSegments
  ↓（一次性构建 / 易丢 / 不持久）

L2 - Persistence Reality（唯一可信层）
  Project.description (JSON.stringify(Everything))
  execution_results (partial JSON)
  ↓（hydrate 降级）

L3 - UI Perception Reality（前端感知层）
  hydrationStore → 各组件 local state → localStorage fallback
```

### 7.2 核心事实

**✅ 系统已经"能生成一切"**
- plotBlueprint ✔ | scene / character ✔ | voice ✔ | video segments ✔
- → 生成能力是完整的

**❌ 但系统"不会记住结构"**
所有 AI 结构是"瞬时存在"，不是"结构化资产"：
- `ai_character_specs` → 0 | `ai_scene_specs` → 0
- `ai_voice_configs` → 0 | `ai_frame_designs` → 0
- storyboard → 不持久化 | videoProduction → null

→ **系统没有"资产层"，只有"结果层"**

### 7.3 三条时间线冲突

| 时钟 | 内容 | 问题 |
|------|------|------|
| Clock A - AI Execution Time | Agent 并发生成 | 无 schema contract |
| Clock B - Persistence Time | Project.description JSON（唯一写入点） | 所有结构坍缩为字符串 |
| Clock C - UI Reconstruction Time | hydrationStore + localStorage + fallback chain | 各组件各自组恢复路径 |

**本质：Clock A 和 Clock B 之间没有 Schema Contract**

### 7.4 系统真实运行模式

**"Append-only AI result system + JSON snapshot persistence"**
而不是 "Structured multi-stage production pipeline"

### 7.5 四个隐藏的系统性问题

| # | 问题 | 描述 |
|---|------|------|
| 1 | **Schema Collapse** | 所有结构被压成 `Project.description = JSON.stringify(Everything)`，scene/voice/frame/video 失去独立生命周期 |
| 2 | **Dual Representation Drift** | localStorage（UI态）与 DB（truth态）不统一：modelCardProviderMap ❌ execution_results ❌ storyboard ❌ |
| 3 | **Silent Null Propagation** | videoProduction=null / frameDesign=null / voiceConfigs=[] → 系统不报错、不fallback、直接显示空 UI |
| 4 | **Stage Isolation Failure** | 各 stage 孤立：CharacterCreation ✔ → SceneGeneration ✔ → VoiceGeneration ✔ → Storyboard ❌ (persistence break) → FrameProduction ❌ (no upstream data) → VideoProduction ❌ (null pipeline) |

### 7.6 为什么角色稳定但场景不稳定

| | 角色 | 场景 |
|---|------|------|
| hydrationStore early write | ✔ | ✔ |
| localStorage fallback | ✔ | ❌ 缺失 |
| loadFromBackend fallback | ✔ | ❌ 缺失 |
| hydrate direct fallback | ✔ | ❌ 缺失 |
| → 恢复路径数 | **3+** | **1** |

### 7.7 系统真正优势（被低估）

- ✅ Execution Engine: 7-Agent 并发拆解 / context injection / provider routing
- ✅ Runtime Observability: observer / failure event / globalClock
- ✅ Stability Layer: checkpoint / cancellation / version sync

### 7.8 系统真实缺的不是"稳定性"

而是 **"Execution Artifact Model（执行资产模型）"**：

```
Script → Execution → Artifact Registry ← ❌ 缺失
```

### 7.9 最终定性

| 维度 | 状态 |
|------|------|
| 🟢 Execution Engine | **STABLE** |
| 🔴 Artifact System | **INCOMPLETE** |
| 🟡 UI Reconstruction | **FRAGILE BUT FUNCTIONAL** |
| 🟢 Observability | **STRONG** |

**一句话总结：系统已经会生成世界，但还不会稳定地保存世界的结构。**

### 7.10 战略级建议

**不要再修：** scene fallback / voice fallback / UI null handling

**真正应该做：** 建立 Execution Artifact Registry（可延后）

当前阶段：系统已进入 **"用真实数据决定系统进化方向"** 阶段，建议保持观察期 + 收集真实 traces。
