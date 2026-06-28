# Runtime Checkpoint Design

**目标**: 刷新后完整恢复 runtime/execution 状态
**阶段**: Phase 2 — Recoverability

---

## 1. 当前问题

```text
Pinia Store (power)         DB (zero)
├─ project                  ❌ 无
├─ runtimeGraph             ❌ 无
├─ executionResults         ❌ 无
├─ pipelineStage            ❌ 无
├─ generatedAssets          ❌ 无
├─ timeline                 ❌ 无
└─ recoveryMetadata         ❌ 无
```

刷新 = 全部消失。

---

## 2. 检查点模型

### Project 表扩展

```prisma
model Project {
  // ... 现有字段

  // 新增：Runtime Checkpoint
  runtimeGraph       Json?     // 节点/边拓扑
  executionState     Json?     // 执行状态机 (pending/running/done/error)
  pipelineStages     Json?     // 各 stage 的完成状态
  stageSnapshots     Json?     // 每 stage 的快照（含输出引用）
  generatedAssets    Json?     // 生成的资产引用列表
  timeline           Json?     // 操作时间线
  checkpointVersion  Int       @default(0)  // 版本号，防 stale
  lastCheckpointAt   DateTime? // 最后检查点时间
}
```

### 检查点触发器

| 事件 | 触发 | 写入内容 |
|------|------|----------|
| Graph 编辑 | Studio 保存 | runtimeGraph |
| Stage 完成 | Pipeline 进度更新 | executionState + pipelineStages |
| AI 结果返回 | Worker callback | generatedAssets (URL 引用) |
| 用户主动 | Ctrl+S / 自动(30s) | 全量检查点 |

---

## 3. 恢复流程

```typescript
// runtime-resume.ts
async function resumeProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      runtimeGraph: true,
      executionState: true,
      pipelineStages: true,
      stageSnapshots: true,
      generatedAssets: true,
      checkpointVersion: true,
    }
  })

  if (!project?.runtimeGraph) {
    // 无检查点，从头开始
    return { status: 'fresh' }
  }

  // 恢复 Pinia store
  pipelineStore.$patch({
    runtimeGraph: project.runtimeGraph,
    executionState: project.executionState,
    stages: project.pipelineStages,
    generatedAssets: project.generatedAssets,
    _version: project.checkpointVersion,
  })

  return { 
    status: 'resumed',
    checkpointVersion: project.checkpointVersion,
    lastCheckpointAt: project.lastCheckpointAt,
  }
}
```

---

## 4. AI 结果恢复策略

### Asset 引用方案

不把文件存 DB（太大），而是存**引用路径**：

```typescript
interface GeneratedAsset {
  id: string
  projectId: string
  stageId: string    // scene/voice/video...
  assetType: 'image' | 'voice' | 'video' | 'subtitle'
  url: string        // 文件 URL 或本地路径
  metadata: {
    prompt?: string
    seed?: number
    duration?: number  // TTS/Video
    characterName?: string
    timestamp: number
  }
}
```

### 检查点结构示例

```json
{
  "checkpointVersion": 5,
  "executionState": {
    "currentStage": "voice",
    "completedStages": ["script", "character"],
    "failureCount": 0
  },
  "pipelineStages": {
    "script": { "status": "done", "output": { /* ... */ } },
    "character": { "status": "done", "output": { /* ... */ } },
    "voice": { "status": "in_progress", "progress": 0.3 },
    "video": { "status": "pending" }
  },
  "generatedAssets": [
    {
      "id": "asset-001",
      "type": "image",
      "url": "/uploads/project/abc/character_1.png",
      "metadata": { "characterName": "西王母", "timestamp": 1779278000000 }
    },
    {
      "id": "asset-002", 
      "type": "voice",
      "url": "/uploads/project/abc/voice_1.mp3",
      "metadata": { "duration": 3.2, "timestamp": 1779278100000 }
    }
  ]
}
```

---

## 5. 检查点 API

```typescript
// POST /api/project/:id/checkpoint — 保存检查点
async function saveCheckpoint(req, reply) {
  const { runtimeGraph, executionState, pipelineStages, generatedAssets } = req.body
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      runtimeGraph,
      executionState,
      pipelineStages,
      generatedAssets,
      checkpointVersion: { increment: 1 },
      lastCheckpointAt: new Date(),
    }
  })
  return { success: true, version: project.checkpointVersion }
}

// GET /api/project/:id/resume — 恢复
async function resumeProject(req, reply) {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!project?.runtimeGraph) {
    return { status: 'fresh', data: null }
  }
  return { 
    status: 'resumed', 
    data: {
      runtimeGraph: project.runtimeGraph,
      executionState: project.executionState,
      pipelineStages: project.pipelineStages,
      generatedAssets: project.generatedAssets,
      version: project.checkpointVersion,
      lastCheckpointAt: project.lastCheckpointAt,
    }
  }
}
```

---

## 6. 自动检查点策略

| 策略 | 触发 | 开销 |
|------|------|------|
| 关键变更即时保存 | Graph 编辑 / Stage 完成 | 低（增量） |
| 定时检查点 | 每 30s | 中（JSON 全量） |
| 页面离开前保存 | beforeunload | 低 |
| 任务完成后保存 | Worker callback | 低 |

---

## 7. 与前端的集成

```typescript
// composables/useCheckpoint.ts
export function useCheckpoint(projectId: string) {
  const pipelineStore = usePipelineStore()
  const saveTimer = ref<number | null>(null)

  // 自动保存
  watch(
    () => pipelineStore.runtimeGraph,
    () => scheduleSave(),
    { deep: true }
  )

  function scheduleSave() {
    if (saveTimer.value) clearTimeout(saveTimer.value)
    saveTimer.value = window.setTimeout(() => save(), 30000)
  }

  async function save() {
    const payload = {
      runtimeGraph: pipelineStore.runtimeGraph,
      executionState: pipelineStore.executionState,
      pipelineStages: pipelineStore.pipelineStages,
      generatedAssets: pipelineStore.generatedAssets,
    }
    const res = await fetch(`/api/project/${projectId}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error('[Checkpoint] Save failed')
  }

  // 页面离开时保存
  onUnmounted(() => {
    if (saveTimer.value) clearTimeout(saveTimer.value)
    save() // 最后再存一次
  })

  return { save, scheduleSave }
}
```
