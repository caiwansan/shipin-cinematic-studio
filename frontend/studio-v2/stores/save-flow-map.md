# P1-B Save Flow Audit

## 保存链路

### 1. 基础保存：saveToServer()

```
用户点击"保存" / 自动保存
        ↓
useStudioStore.saveToServer()
        ↓
PUT /api/v2/workbench/project/:id
  body: { projectName, projectDesc, script }
        ↓
routes/workbench-project.ts (PUT)
        ↓
prisma.project.update()
  data: { name, description, script }
        ↓
Project 表
  ✅ name
  ✅ description
  ✅ script
  ❌ 其他所有字段不更新
```

### 2. 剧本分析保存

```
"提交拆解" 按钮
        ↓
POST /api/script/regenerate 或 PUT execution-results
        ↓
executionResults 被写入 Project.executionResults (JSON字段)
aiCharacterSpecs / aiSceneSpecs / aiVideoSegment 等关联表被创建
        ↓
✅ executionResults (JSON)
✅ AiCharacterSpec 表
✅ AiSceneSpec 表
✅ AiVideoSegment 表
✅ AiFrameDesign 表
✅ AiVoiceConfig 表
```

### 3. 角色定妆图保存

```
生成角色定妆图
        ↓
POST /api/tasks/ai-generate → Worker → 生成成功
        ↓
worker-runtime.ts → prisma.characterImage.create/upsert
        ↓
✅ CharacterImage 表
```

### 4. 场景图片保存

```
生成场景图片
        ↓
POST /api/tasks/ai-generate → Worker
        ↓
worker-runtime.ts → prisma.sceneImage.create/upsert
        ↓
✅ SceneImage 表
```

### 5. 分镜图保存

```
StoryboardWorkspace.generateSingleImage()
        ↓
POST /api/tasks/ai-generate → Worker
        ↓
worker-runtime.ts → prisma.storyboardImage.upsert
        ↓
✅ StoryboardImage 表
```

### 6. 视频生成保存

```
POST /api/tasks/ai-generate (source: video)
        ↓
Worker → 生成视频
        ↓
prisma.aiVideoSegment.updateMany (videoUrl)
        ↓
✅ AiVideoSegment.videoUrl
```

## Save 覆盖度审计

| 状态字段 | saveToServer? | auto-save? | 其他保存路径 |
|-----------|--------------|------------|----------------|
| projectName | ✅ | ❌ | 手动保存 |
| script | ✅ | ❌ | 手动保存 |
| executionResults | ❌ | ❌ | 仅 script/regenerate 写入 |
| aiCharacterSpecs | ❌ | ❌ | 仅剧本分析创建 |
| aiSceneSpecs | ❌ | ❌ | 仅剧本分析创建 |
| aiVideoSegment | ❌ | ❌ | 仅剧本分析创建 |
| characterImages | ❌ | ❌ | 仅 AI 任务回写 |
| sceneImages | ❌ | ❌ | 仅 AI 任务回写 |
| storyboardImages | ❌ | ❌ | 仅 StoryboardWorkspace 生成 |
| videoStyle/aspectRatio | ❌ | ❌ | **永不保存** |
| segments (分镜段) | ❌ | ❌ | **永不保存** |
| pipeline.stage status | ❌ | ❌ | **永不保存** |

## 关键发现

### 🔴 发现1: videoStyle/aspectRatio 永不落库
用户在界面上选择的视频风格（写实/动漫/3D/卡通等）和画面比例（16:9/9:16/1:1）只在内存中。刷新浏览器 = 恢复默认值。

### 🔴 发现2: segments（分镜段编辑）永不落库
`workspace.segments[]` 是 Director 运行时数据（SegmentRuntime），但在目前的 saveToServer 路径中不被持久化。StoryboardWorkspace 和 SegmentEditor 对 segments 的编辑会随浏览器关闭而丢失。

### 🟡 发现3: 无自动保存
所有保存都是手动触发的（提交拆解 / 生成图片 / 点击保存）。关闭标签页时未保存的编辑会丢失。
