# P1-C Reload Flow Audit

## 加载链路

```
打开已有项目
        ↓
loadFromServer(projectId)
        ↓
GET /api/v2/workbench/project/:id
        ↓
routes/workbench-project.ts (GET)
        ↓
prisma.project.findUnique({
  include: {
    aiCharacterSpecs: true,    ← ✅
    aiSceneSpecs: true,        ← ✅
    aiVideoSegments: true,     ← ✅
    characterImages: true,     ← ✅
    sceneImages: true,         ← ✅
    storyboardImages: true,    ← ✅
    propImages: true,          ← ✅
    executionResults: true     ← ✅ (JSON字段)
  }
})
        ↓
数据 → useStudioStore → 回填 state.workspace.narrative
```

## 恢复覆盖度审计

### 完全恢复（✅）

| 字段 | DB 源 | 恢复方式 |
|-------|-----------|-------------|
| `script` | `Project.script` | 直接映射 |
| `projectName` | `Project.name` | 直接映射 |
| `projectDesc` | `Project.description` | 直接映射 |
| `narrative.characters[]` | `AiCharacterSpec` 表 + `executionResults.analyzeV2Data` | 双源合并 |
| `narrative.scenes[]` | `AiSceneSpec` 表 | ✅ 单源 |
| `narrative.beats[]` | `AiVideoSegment` 表 (fallback: executionResults) | 主源+fallback |
| `narrative.props[]` | `PropImage` 表 + `executionResults.propSpecs` | 双源合并 |
| `narrative.voices[]` | `executionResults.voiceConfigs` | JSON 字段 |
| `narrative.emotionCurve[]` | `executionResults.*` | 多源 fallback |
| `storyboardImages[]` | `StoryboardImage` 表 | ✅ 单源 |
| `videoSegments[]` | `executionResults.videoSegments` | JSON 字段 |
| `dialogues[]` | `executionResults.videoSegments[].dialogue` | JSON 子字段 |
| `effects[]` | `executionResults.effectsDesign / effectSpecs` | JSON 字段 |
| `emotionSpecs[]` | `executionResults.emotionSpecs` | JSON 字段 |

### 部分恢复（⚠️）

| 字段 | 恢复行为 |
|-------|-------------|
| `narrative.characters[].imageUrl` | 从 CharacterImage 表加载，但部分角色可能只有 specs 没有 images |
| `narrative.scenes[].imageUrl` | 从 SceneImage 表加载，同上 |
| `narrative.props[].imageUrl` | 从 PropImage 表加载（有图片），或从 executionResults.propSpecs 加载（无图片） |
| `videoSegments[].videoUrl` | 从 `AiVideoSegment.videoUrl` 更新，但需要手动匹配 segmentId |

### 不恢复（❌）

| 字段 | 丢失原因 |
|-------|-------------|
| `segments[]` (SegmentRuntime) | **只存在于前端内存**。没有对应的 DB 表或 API 端点来持久化 Director 的 segments 数据 |
| `narrative.videoStyle` | 保存时不写入 DB，每次都恢复为默认值 `'realistic'` |
| `narrative.aspectRatio` | 保存时不写入 DB，每次都恢复为默认值 `'9:16'` |
| `narrative.styleLocked` | 保存时不写入 DB |
| `pipeline.*` (阶段状态) | 每次打开项目时重新从 `createPipelineRuntime()` 创建 |
| `execution.compiledPrompts[]` | 编译结果只在运行时存在 |
| `assets.assets[]` | 按需重新加载 |

## 恢复流程图

```
GET /api/v2/workbench/project/:id
        ↓
Project 表           → script, name, description
AiCharacterSpec      → characters[].name, appearance, clothing, gender, age
AiSceneSpec          → scenes[].name, description, environment, lighting
AiVideoSegment       → beats[].title, duration, emotionArc, narrativePurpose
PropImage            → props[].imageUrl, category
CharacterImage       → characters[].imageUrl
SceneImage           → scenes[].imageUrl
StoryboardImage      → storyboardImages[].imageUrl
executionResults     → videoSegments[], voices[], effects[], propSpecs, etc.
        ↓
回填 state.workspace.narrative.{...}
        ↓
✅ 剧本内容、角色、场景、段落、道具、图片 全部恢复
❌ segments（分镜段）、videoStyle、pipeline 阶段状态 不恢复
```

## 风险总结

### P0: segments（分镜段编辑数据）丢失
最严重的丢失。用户花时间调整的每个分镜段（timeline, camera, emotion 等）在刷新后消失。

### P1: videoStyle/aspectRatio 丢失  
视频风格和画面比例的偏好仅在单次会话内有效。刷新后回到默认值，可能导致用户发现生成结果"风格不对"。

### P2: pipeline 阶段状态不持久化
用户完成了"角色设定"后关闭页面，下次再打开时流水线状态重置为全"未开始"。
