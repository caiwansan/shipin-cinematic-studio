# 前端代码审查报告

生成时间: 2026-06-02 15:49
项目路径: `/root/shipin-cinematic-studio/frontend/studio-v2`

---

## 1. 僵尸 Vue 组件

以下 .vue 文件未被任何其他文件 import/reference，属于死代码：

| 组件路径 | 状态 | 原因 |
|---------|------|------|
| `workspace/director/DirectorWorkspace.vue` | ❌ 僵尸 | 无外部引用，旧版 AI 导演工作区，已被 `VideoGenerationWorkspace` 替代 |
| `workspace/director/ImagePicker.vue` | ❌ 僵尸 | 无外部引用，旧版图片选择器 |
| `workspace/character-design/CharacterWardrobePanel.vue` | ❌ 僵尸 | 无外部引用，角色衣橱面板从未启用 |
| `workspace/specification/SpecificationWorkspace.vue` | ❌ 僵尸 | 无外部引用，`specification` stage 在 `PIPELINE_STAGES` 数组中无定义（仅存在于类型联合中），该页面永远不会被渲染 |
| `workspace/storyboard/StoryboardWorkspace.vue` | ❌ 僵尸 | 无外部引用，`storyboard` 不是合法的 `PipelineStageId`，WorkspaceRenderer 未渲染此页面 |

### WorkspaceRenderer 条件渲染检查

`workspace/WorkspaceRenderer.vue` 的条件渲染分支：

| 分支 | 对应组件 | 状态 |
|------|---------|------|
| `script-analysis` | `ScriptAnalysisWorkspace` | ✅ 正常 |
| `character-design` | `CharacterWorkspace` | ✅ 正常 |
| `scene-design` | `SceneWorkspace` | ✅ 正常 |
| `props-design` | `PropsWorkspace` | ✅ 正常 |
| `video-generation` | `VideoGenerationWorkspace` | ✅ 正常 |
| `storyboard` | 已删除分镜引用 | ✅ 已清理 |
| `else` 占位 | placeholder | ✅ |

**结论：所有条件渲染分支对应的组件都存在，无损坏。**

但 `specification` 和 `storyboard` 对应的页面组件（`SpecificationWorkspace.vue` / `StoryboardWorkspace.vue`）已从 WorkspaceRenderer 中移除，这两个组件属于僵尸代码。

---

## 2. 僵尸 Store 方法

文件: `stores/useStudioStore.ts` — 返回的每个方法/计算属性的外部调用情况：

### 已外部使用的方法 ✅

| 方法 | 外部引用数 | 状态 |
|------|-----------|------|
| `goToStage` | 19 | ✅ 正常 |
| `updateNarrative` | 12 | ✅ 正常 |
| `setNarrative` | 3 | ✅ 正常 |
| `setVideoStyle` | 2 | ✅ 正常 |
| `setAspectRatio` | 2 | ✅ 正常 |
| `setCharacters` | 4 | ✅ 正常 |
| `addCharacter` | 2 | ✅ 正常 |
| `updateCharacter` | 8 | ✅ 正常 |
| `setScenes` | 4 | ✅ 正常 |
| `addScene` | 2 | ✅ 正常 |
| `updateScene` | 12 | ✅ 正常 |
| `setActiveSegment` | 4 | ✅ 正常 |
| `setSegments` | 3 | ✅ 正常 |
| `updateSegment` | 8 | ✅ 正常 |
| `updateTimelineFrame` | 4 | ✅ 正常 |
| `addAsset` | 6 | ✅ 正常 |
| `removeAsset` | 2 | ✅ 正常 |
| `setAssetCategory` | 5 | ✅ 正常 |
| `toggleAssetSidebar` | 6 | ✅ 正常 |
| `setCompiledPromptSegments` | 2 | ✅ 正常 |
| `setProjectId` | 4 | ✅ 正常 |
| `saveToServer` | 7 | ✅ 正常 |
| `loadFromServer` | 12 | ✅ 正常 |
| `fetchProjectList` | 2 | ✅ 正常 |
| `deleteProject` | 2 | ✅ 正常 |
| `filteredAssets` (computed) | 2 | ✅ 正常 |
| `activeSegmentIndex` (computed) | 1 | ✅ 正常 |
| `compiledPromptSegments` (computed) | 1 | ✅ 正常 |
| `projectId` (computed) | 80 | ✅ 正常 |
| `videoStyle` (computed) | 10 | ✅ 正常 |
| `aspectRatio` (computed) | 8 | ✅ 正常 |
| `activeStage` (computed) | 1 | ✅ 正常 |

### 完全未外部使用的方法 ❌

| 方法 | 外部引用数 | 状态 | 说明 |
|------|-----------|------|------|
| `updateStageStatus` | 0 | ❌ 僵尸 | 用于更新 pipeline stage 状态并同步后端，但无组件调用 |
| `setAssets` | 0 | ❌ 僵尸 | 设置素材列表，但组件都是通过 `addAsset`/`removeAsset` 单独操作 |
| `addCompiledPrompt` | 0 | ❌ 僵尸 | 添加单条 compiled prompt |
| `saveImageToCos` | 0 | ❌ 僵尸 | 保存图片到 COS 的 API 封装，从未被调用 |
| `saveVideoToCos` | 0 | ❌ 僵尸 | 保存视频到 COS 的 API 封装，从未被调用 |
| `activeWorkspace` (computed) | 0 | ❌ 僵尸 | workspace 中直接使用 `state.workspace.activeWorkspaceId` |

---

## 3. 损坏的导航

### goToStage 残留调用

| 文件 | 行号 | 代码 | 问题 |
|------|------|------|------|
| `workspace/script-analysis/ScriptAnalysisWorkspace.vue` | 302 | `goToStage('specification')` | ❌ `specification` stage 在 `PIPELINE_STAGES` 中无定义，点击「深度分析」会导航到不存在的 stage |
| `workspace/script-analysis/ScriptAnalysisWorkspace.vue` | 475 | `goToStage('character-design')` | ✅ 正常 |
| `workspace/character-design/CharacterWorkspace.vue` | 161 | `goToStage('scene-design')` | ✅ 正常 |
| `workspace/scene-design/SceneWorkspace.vue` | 235 | `goToStage('props-design')` | ✅ 正常 |
| `workspace/video-generation/VideoGenerationWorkspace.vue` | 1425 | `goToStage('voice-generation')` | ✅ 正常 |
| `workspace/storyboard/StoryboardWorkspace.vue` | 772 | `goToStage('video-generation')` | ⚠️ 该组件为僵尸代码，不会执行 |
| `workspace/props-design/PropsWorkspace.vue` | 684 | `goToStage('video-generation')` | ✅ 正常 |
| `workspace/specification/SpecificationWorkspace.vue` | 37 | `goToStage('character-design')` | ⚠️ 该组件为僵尸代码，不会执行 |

### 关键问题: `goToStage('specification')` 损坏

- `shared/pipeline-definition.ts`: `specification` 存在于类型联合 `PipelineStageId` 中，但 **没有对应的 `PIPELINE_STAGES` 数组条目**
- 无 pipeline stage 定义意味着侧边栏不会显示「制作规格书」步骤
- 调用 `goToStage('specification')` 会设置 `activeStageId = 'specification'`，但：
  1. 侧边栏找不到此 stage（高亮失败）
  2. WorkspaceRenderer 中也没有对应的 `v-if` 分支（展示 placeholder）
  3. 用户看到空白页面

---

## 4. 无引用的 import（按文件）

### StudioWorkspaceLayout.vue
- 所有 import (PipelineSidebar, WorkspaceRenderer, AssetSidebar) 均在 template 中使用 ✅

### PipelineSidebar.vue
- `ModelSettingsModal` 在 template 中使用 ✅

### AssetSidebar.vue
- `VideoStylePanel` 在 template 中使用 ✅

### WorkspaceRenderer.vue
- 所有 5 个 import 均在 template 中使用 ✅

### DirectorWorkspace.vue
- `SegmentCardGrid`、`SegmentEditor`、`PromptPreviewPanel` 均在 template 中使用 ✅
- _注意：此组件本身是僵尸组件，但内部的 import 皆有使用_

### SegmentEditor.vue
- `TimelineHeader`、`TimelineTable`、`AIDirectorPanel` 均在 template 中使用 ✅

---

## 5. 汇总 & 建议

### 需立即修复
1. **`workspace/script-analysis/ScriptAnalysisWorkspace.vue:302`** — 删除或替换 `goToStage('specification')` 调用
2. **删除僵尸组件** (5 个文件): `DirectorWorkspace.vue`, `ImagePicker.vue`, `CharacterWardrobePanel.vue`, `SpecificationWorkspace.vue`, `StoryboardWorkspace.vue`
3. **删除僵尸 Store 方法** (6 个): `updateStageStatus`, `setAssets`, `addCompiledPrompt`, `saveImageToCos`, `saveVideoToCos`, `activeWorkspace`
4. **删除僵尸子组件** (4 个): `SegmentCardGrid.vue`, `SegmentEditor.vue`, `TimelineHeader.vue`, `TimelineTable.vue`, `AIDirectorPanel.vue`, `PromptPreviewPanel.vue` — 这些仅被僵尸组件 `DirectorWorkspace` 使用

### 建议清理
- `shared/pipeline-definition.ts` 中的 `specification` 类型成员 — 如果不再需要，从类型联合中移除
- `types/runtime/index.ts` 中 `WorkspaceId = PipelineStageId` — 如 `specification` 保留在类型中，建议将其从 `PipelineStageId` 中移除或添加对应的 stage 定义
