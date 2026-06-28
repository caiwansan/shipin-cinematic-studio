# 影剧厂 AI 短剧制作 — 前端流程逻辑文档

> 这是给 UI 专家的**纯流程文档**：数据流、API 调用、状态转换、事件响应。
> 不含任何 UI 代码（组件结构、样式、布局），只描述 UI 应该做什么。

---

## 1. 系统架构概览

```
用户操作 → Vue Store (directorStore.ts) → API Client (api.ts / graph-client.ts)
                                        ↓
                                   后端 API
                                        ↓
                              ExecutionGraph Runtime
                                        ↓
                              PostgreSQL (ExecutionNode)
                                        ↓
                          Graph Query Layer (REST API)
                                        ↓
                             前端 Composable (useGraphNode)
                                        ↓
                              VUE 组件（直接从 Graph 拉数据）
```

**核心原则：** ExecutionGraph Runtime 是唯一真相源。前端 UI 不再依赖 `directorStore` 作为数据中间层，而是通过 `useGraphNode` 或 `graphClient` 直接从 Graph Runtime 查询数据。

---

## 2. 数据源：两套 API

### 2.1 旧 API Client — `core/api.ts`

**用途：** 传统 REST 端点（showrunner、director pipeline、image generation 等）

```typescript
const BASE_URL = 'https://aigc.fushtn.com'

// 关键方法：
api.planScript(script, totalEpisodes, projectId)          // → NarrativePlan
api.generateCharacterBible(projectId, script)              // → Character[]
api.directorFullPipeline(script, projectId, style)         // → DirectorPackage
api.generateImage(prompt, { size?, style?, count? })       // → MediaResult[]
api.shotRender(prompt, size?, character?, style?)          // → { imageUrl, seed, actualPrompt }
api.generateTts(text, voice, speed)                        // → MediaResult
api.getJobStatus(jobId)                                    // → JobState
api.executeShowrunner(script, episodes, projectId)         // → async job
```

### 2.2 新 API Client — `runtime/graph-client.ts`

**用途：** ExecutionGraph Runtime 的专用客户端（Single Source of Truth）

```typescript
const BASE_URL = 'https://aigc.fushtn.com'

graphClient.createScriptAnalysis(script, projectName?, userId?, style?)
  // → { graphId: string; status: string; nodes: GraphNodeDTO[] }
  // 说明：提交剧本 → 后端创建 Graph + 自动调度 character 节点
  // 注意：这是异步的，返回后 graph.status 通常是 'pending'

graphClient.queryGraph(graphId)
  // → ExecutionGraphDTO (包含所有 nodes 的完整状态)

graphClient.waitForCompletion(graphId, { pollIntervalMs?, timeoutMs? })
  // → ExecutionGraphDTO (轮询直至 completed/failed)
  // 默认 polling 1s, 超时 30s

graphClient.appendNode(graphId, nodeType, agentId, label, dependencies?, input?)
  // → { id: string; nodeType: string; status: string }
  // 说明：在已有 Graph 上追加节点（如「生成形象」→ 追加 portrait_prompt + image 节点）

graphClient.replayGraph(graphId)
  // → void (重放整个 Graph)

graphClient.subscribeToEvents(graphId, { onEvent?, onError? })
  // → EventSource (SSE：NODE_RUNNING / NODE_COMPLETED / NODE_FAILED / GRAPH_COMPLETED / GRAPH_FAILED)
```

### 2.3 Graph Query Layer — `composables/useGraphNode.ts`

**用途：** Vue 3 composable，直接从 Graph Runtime 查询语义化生产数据

```typescript
function useGraphNode(
  projectId: string | Ref<string>,
  nodeType: string,       // 'scene' | 'shot' | 'character' | 'tts' | 'keyframe' | 'video' | 'export'
  autoFetch = true
): {
  data: Ref<any | null>        // 节点 output 内容（已完成的）
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void> // 手动刷新
  hasData: Ref<boolean>        // data !== null
}

// 内部请求：GET /api/v1/execution-graph/runtime/:projectId/nodes?type=:nodeType&status=completed
// 返回：projectId 下该 type 的最新 completed 节点的 output
```

---

## 3. 页面流 — 7 个步骤 + 生命周期

### 3.1 步骤定义

页面有 7 个步骤（步骤 0 = 首页/剧本输入），用户必须按顺序执行或直接跳到某一步。UI 渲染逻辑：

```
步骤 0: 剧本输入 (ScriptInput.vue)
步骤 1: 角色列表 / 形象 (CharacterPanel.vue)
步骤 2: 场景分析 (ScenePanel.vue)
步骤 3: 分镜头 (StoryboardPanel.vue)
步骤 4: TTS 语音 (TTSPanel.vue)
步骤 5: 关键帧 (KeyframePanel.vue)
步骤 6: 视频合成 (VideoPanel.vue)
步骤 7: 导出 (ExportPanel.vue)
```

### 3.2 步骤切换

```typescript
// Store 中：
const _currentStep = ref(0)
const setStep = (s: number) => { _currentStep.value = s }

// 步骤切换直接影响 UI 渲染：
const currentPanel = computed(() => {
  switch (_currentStep.value) {
    case 0: return ScriptInput
    case 1: return CharacterPanel
    case 2: return ScenePanel
    case 3: return StoryboardPanel
    case 4: return TTSPanel
    case 5: return KeyframePanel
    case 6: return VideoPanel
    case 7: return ExportPanel
    default: return ScriptInput
  }
})
```

**注意：** 任何步骤都可以点击并跳转，UI 不应做"灰色禁用"逻辑。步骤切换后，对应面板通过 `useGraphNode` 自动拉取数据。

---

## 4. 每个步骤的流程逻辑

### 步骤 0: 剧本输入

**输入：**
- `ui.script: string` — 用户输入的剧本文本
- `ui.artStyle: string` — 画面风格（concept-art / realistic / anime / stylized）
- `ui.aspectRatio: string` — 画面比例（square / landscape / portrait / 16:9 / 9:16）

**提交操作：** 点击「开始创作」按钮

```typescript
async function submitScriptGraphRuntime() {
  // 1. 验证
  if (!ui.script.trim()) { ui.lastError = '请输入剧本内容'; return }

  // 2. 清空旧状态
  ui.isGenerating = true
  _characters.value = []
  _analysis.value = null
  _graph.value = null

  // 3. 创建 Graph（后端异步执行 character 节点）
  const { graphId } = await graphClient.createScriptAnalysis(
    ui.script.trim(),
    ui.projectId || `proj_${Date.now()}`
  )
  _currentGraphId.value = graphId

  // 4. 轮询等待 completion
  const graph = await graphClient.waitForCompletion(graphId, {
    pollIntervalMs: 1000,
    timeoutMs: 30000,
  })

  if (graph.status === 'failed') {
    ui.lastError = graph.nodes.filter(n => n.errorMessage).join('; ') || '剧本分析失败'
    return
  }

  // 5. 提取角色数据
  const charNode = graph.nodes.find(n => n.nodeType === 'character')
  const rawOutput = charNode?.output
  const characters = rawOutput?.characters || rawOutput?.data?.characters || []
  _characters.value = characters.map(c => ({
    id: c.characterId || c.name,
    name: c.name || '未知角色',
    role: c.role || 'supporting',
    traits: c.identityLock?.visualAnchorTokens || c.personality || [],
    description: c.identityLock?.faceSignature || '',
    appearance: c.appearance || {},
    portraitUrl: '',
    relationships: [],
  }))

  // 6. 设置 job 完成状态，自动跳转步骤 1
  _currentStep.value = 1
}
```

### 步骤 1: 角色列表 + 形象生成

**数据来源：** `_characters.value`（从步骤 0 的 Graph 结果中填充）

**UI 展示：** 角色列表，每个角色显示：
- 头像图片（有 URL 就展示）
- 名字、角色类型
- 外貌描述标签
- 关系链

**形象生成操作：** 点击角色旁的「生成形象」按钮

```typescript
async function generatePortrait(char) {
  // 1. 追加 portrait_prompt 节点
  const ppNode = await graphClient.appendNode(
    currentGraphId,
    'portrait_prompt',
    'agent_portrait_prompt',
    `${char.name}形象提示词`,
    [],  // 不依赖其他节点
    {
      character: {
        name: char.name,
        role: char.role,
        traits: char.traits,
        description: char.description,
        appearance: char.appearance,
        identityLock: char.identityLock
      }
    }
  )

  // 2. 追加 image 节点（依赖上一步）
  const imageNode = await graphClient.appendNode(
    currentGraphId,
    'image',
    'agent_image',
    `${char.name}形象图`,
    [ppNode.id],  // 依赖 portrait_prompt 完成
    { style: ui.artStyle || 'concept-art' }
  )

  // 3. 等待整个 Graph 完成
  const completed = await graphClient.waitForCompletion(currentGraphId, {
    pollIntervalMs: 1000,
    timeoutMs: 60000,
  })

  // 4. 从 image 节点提取图片 URL — 支持多级 output 格式
  const imgNode = completed.nodes.find(n => n.id === imageNode.id)
  const imgOut = imgNode?.output
  if (imgOut?.imageUrl) char.portraitUrl = imgOut.imageUrl
  else if (imgOut?.url) char.portraitUrl = imgOut.url
  else if (imgOut?.data?.imageUrl) char.portraitUrl = imgOut.data.imageUrl
  else if (imgOut?.data?.url) char.portraitUrl = imgOut.data.url

  // 5. 保存 actual prompt（可选）
  const ppResult = completed.nodes.find(n => n.nodeType === 'portrait_prompt')
  if (ppResult?.output?.prompt) char._actualPrompt = ppResult.output.prompt
  else if (ppResult?.output?.data?.prompt) char._actualPrompt = ppResult.output.data.prompt
}
```

**重新生成：** 同上（追加同一过程，Graph 会作为新节点加入）

### 步骤 2: 场景分析 (ScenePanel)

**数据来源：** `useGraphNode(projectId, 'scene')`

```typescript
// 前端 composable 使用：
const { data, loading, error, refresh } = useGraphNode(projectId, 'scene')

// data 结构示例（node.output 内容）：
{
  scenes: [
    {
      id: "scene-1",
      title: "陈塘关市集",
      description: "哪吒在集市中...",
      atmosphere: { lighting: "日光", colorPalette: ["红", "金"], mood: "热闹" },
      duration: 30
    }
  ]
}
```

**UI 需要处理的状态：**
- `loading === true` → 显示骨架屏/加载中
- `data === null && loading === false` → 显示「暂无场景数据」
- `data !== null` → 渲染场景卡片列表

### 步骤 3: 分镜头 (StoryboardPanel)

**数据来源：** `useGraphNode(projectId, 'shot')`

```typescript
const { data, loading, error, refresh } = useGraphNode(projectId, 'shot')

// data 结构：
{
  scenes: [
    {
      id: "shot-1",
      sceneId: "scene-1",
      shotNumber: 1,
      type: "wide",
      composition: "全景镜头，哪吒站在集市中央",
      cameraAngle: "平视",
      movement: "固定",
      duration: 3,
      prompt: "电影级镜头描述...",
      thumbnail: ""  // 图片生成后填充
    }
  ]
}
```

### 步骤 4: TTS 语音 (TTSPanel)

**数据来源：** `useGraphNode(projectId, 'tts')`

```typescript
const { data, loading, error, refresh } = useGraphNode(projectId, 'tts')

// data 结构：
{
  dialogues: [
    {
      sceneId: "scene-1",
      character: "哪吒",
      text: "我是哪吒，快把龙宫交出来！",
      voice: "zh-CN-YunxiNeural",
      audioUrl: "https://..."   // TTS 生成后的音频 URL
    }
  ]
}

// 在 TTS 未生成时，data === null。
// 用户点击「生成 TTS」，通过 graphClient.appendNode 追加 tts 节点。
```

### 步骤 5: 关键帧 (KeyframePanel)

**数据来源：** `useGraphNode(projectId, 'keyframe')`

```typescript
const { data, loading, error, refresh } = useGraphNode(projectId, 'keyframe')

// data 结构：
{
  keyframes: [
    {
      sceneId: "scene-1",
      shotId: "shot-1",
      frameNumber: 1,
      imageUrl: "https://...",  // 图片 URL
      prompt: "关键帧描述..."
    }
  ]
}
```

### 步骤 6: 视频合成 (VideoPanel)

**数据来源：** `useGraphNode(projectId, 'video')`

```typescript
const { data, loading, error, refresh } = useGraphNode(projectId, 'video')

// data 结构：
{
  videos: [
    {
      sceneId: "scene-1",
      url: "https://...",       // 视频文件 URL
      status: "ready" | "generating" | "failed",
      duration: 5,
      thumbnailUrl: "https://..."
    }
  ]
}
```

### 步骤 7: 导出 (ExportPanel)

**数据来源：** `useGraphNode(projectId, 'export')`

```typescript
const { data, loading, error, refresh } = useGraphNode(projectId, 'export')

// data 结构：
{
  status: "pending" | "ready" | "failed",
  exportUrl: "https://...",    // 导出文件 URL
  scenes: [
    {
      sceneId: "scene-1",
      videoUrl: "https://...",
      ttsUrl: "https://...",
      images: ["https://...", "https://..."]
    }
  ],
  totalDuration: 180,           // 总时长（秒）
}
```

---

## 5. 状态管理（Store 详解）

### 5.1 UI 状态

```typescript
const ui = reactive({
  script: '',                      // 用户输入的剧本
  projectId: '',                   // 项目 ID（自动生成或用户自定义）
  artStyle: 'concept-art',         // 画面风格
  aspectRatio: 'square',           // 画面比例
  isGenerating: false,             // 正在生成中
  lastError: null as string,       // 最后一次错误消息
  toastMsg: '',                    // Toast 短暂通知
  systemMode: 'safe',              // 系统模式
  mediaResults: [],                // 媒体结果列表
  eventLog: [],                    // SSE 事件日志
})
```

### 5.2 核心数据

```typescript
const _characters = ref<Character[]>([])     // 角色列表
const _analysis = ref<Analysis | null>(null) // 剧本分析结果
const _graph = ref<CanonicalShotGraph | null>(null)    // 镜头图谱
const _currentGraphId = ref<string | null>(null)       // 当前 Graph ID
const _currentStep = ref(0)                  // 当前步骤索引
```

### 5.3 操作（Actions）

所有异步操作位于 `export const actions = { ... }`：

| Action | 触发时机 | 说明 |
|--------|----------|------|
| `init()` | 页面加载 | 初始化 SSE 连接，查询系统健康状态 |
| `submitScriptGraphRuntime()` | 用户点击"开始创作" | 主路径：创建 Graph → 等待 character 完成 → 跳步骤 1 |
| `submitScript()` | 备用路径 | 旧的 director full pipeline 路径（保留兼容） |
| `executeAsync()` | 用户点击"深度分析" | 异步作业提交（后台队列） |
| `pollJob(jobId)` | 定时器 | 轮询异步作业状态 |
| `generateImage(prompt)` | 图片生成 | 传统单张图生成（保留兼容） |
| `updateShotParams(shotId, params)` | 用户编辑分镜参数 | 更新内容池 |
| `reset()` | 用户点击重置 | 清空所有状态 |

### 5.4 错误处理

```typescript
// 所有异步操作都按此模式处理：
try {
  // 操作
} catch (err) {
  ui.lastError = err instanceof Error ? err.message : '未知错误'
  // 同时保留上一个有效数据不变
} finally {
  ui.isGenerating = false
}
```

**三套 retry/超时机制：**
1. API Client 层：`AbortController` + 60s 超时
2. Graph Client 层：`waitForCompletion` 带 `timeoutMs` 参数（默认 30-60s）
3. 无需前端重试逻辑 — 后端 Error Recovery 自动处理失败节点

---

## 6. 后端 Graph 节点类型与对应前端渲染

| nodeType | agentId | 后端执行 | 前端消费方式 | UI 面板 |
|----------|---------|----------|-------------|---------|
| `character` | `agent_character` | LLM 角色提取 | `_characters.value`（store 直接填充） | CharacterPanel |
| `portrait_prompt` | `agent_portrait_prompt` | LLM 生成形象提示词 | 作为 image 节点的依赖，不需要单独渲染 | CharacterPanel |
| `image` | `agent_image` | 图片生成 API | 从 node.output 提取 imageUrl | CharacterPanel |
| `scene` | `agent_scene` | LLM 场景分析 | `useGraphNode(projectId, 'scene')` | ScenePanel |
| `shot` | `agent_shot` | LLM 分镜头设计 | `useGraphNode(projectId, 'shot')` | StoryboardPanel |
| `tts` | `agent_tts` | TTS API 调用 | `useGraphNode(projectId, 'tts')` | TTSPanel |
| `keyframe` | `agent_keyframe` | 关键帧图像生成 | `useGraphNode(projectId, 'keyframe')` | KeyframePanel |
| `video` | `agent_video` | 视频合成 | `useGraphNode(projectId, 'video')` | VideoPanel |
| `export` | `agent_export` | 导出合片 | `useGraphNode(projectId, 'export')` | ExportPanel |

---

## 7. 关键设计决策

### 7.1 为什么不用 Pinia？

`directorStore.ts` 直接使用 Vue 3 `reactive/ref/computed` 而不是 Pinia。原因是：
- 避免包体积膨胀（Pinia ~1KB 但额外依赖）
- 直接导出变量从根组件引用更方便
- 整个应用只有一个 store

### 7.2 为什么 useGraphNode 替代 directorStore？

**Graph Query Layer 取代了 directorStore 作为数据源**，因为：
- Graph Runtime 是唯一真相源
- 旧的 directorStore 缓存的可能是旧数据
- 每次步骤切换都从 Graph 实时拉取，确保 "UI 看到的 = 后端生产的"

### 7.3 SSE vs Polling

当前使用轮询（`waitForCompletion` + `setInterval`），未来应升级为 SSE：
- **Phase 1（当前）：** Query Layer + `useGraphNode`
- **Phase 2（计划）：** Polling-based refresh（自动刷新已完成节点）
- **Phase 3（未来）：** Graph event stream（node.completed → SSE push UI）

SSE API 已实现：
```
GET /api/v1/execution-graph/:graphId/events
```
事件类型：`NODE_RUNNING` / `NODE_COMPLETED` / `NODE_FAILED` / `GRAPH_COMPLETED` / `GRAPH_FAILED`

### 7.4 output 数据格式兼容

不同后端 Agent 可能返回不同深度的 output 结构。前端读取时统一处理：

```typescript
function readOutput(output: any, ...keys: string[]): any {
  // output.imageUrl → output.data.imageUrl → output.data?.images?.[0]?.url
  if (!output) return undefined
  for (const key of keys) {
    const parts = key.split('.')
    let val = output
    for (const p of parts) {
      if (val === null || val === undefined) return undefined
      if (typeof val !== 'object') return undefined
      val = (val as Record<string, any>)[p]
    }
    if (val !== undefined && val !== null) return val
  }
  return undefined
}
```

---

## 8. 后端 API 端点一览

| 方法 | 端点 | 用途 |
|------|------|------|
| POST | `/api/v1/execution-graph/script-analysis` | 提交剧本分析 |
| GET | `/api/v1/execution-graph/:graphId` | 查询 Graph 完整状态 |
| POST | `/api/v1/execution-graph/:graphId/nodes` | 追加节点 |
| POST | `/api/v1/execution-graph/:graphId/replay` | 重放 Graph |
| GET | `/api/v1/execution-graph/:graphId/events` | SSE 事件流 |
| GET | `/api/v1/execution-graph/runtime/:projectId/nodes?type=xxx&status=completed` | Graph Query Layer |

---

## 9. 当前已知限制

1. **Scheduler Stub：** 当前后端的 scheduler 是简化版，`agent_image` 返回空 URL。正式版需要对接到真实 LLM + 图像生成 API
2. **useGraphNode 去重：** 多个组件用同一个 `projectId` + `nodeType` 时会重复请求。应加一个全局请求缓存层
3. **步骤依赖：** 步骤 2-7 的数据需要各自的 agent 执行完成后才可用。当前 UI 需要处理"数据不存在"的空状态
4. **Graph Inspector：** 已有 debug 工具 `GraphInspector.vue`（显示 Graph DAG、节点状态、执行耗时），默认不显示，可通过 URL 参数或 debug 面板开启
