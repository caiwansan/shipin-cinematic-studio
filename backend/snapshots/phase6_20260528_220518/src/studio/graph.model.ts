/**
 * AI Studio — Node Graph 数据模型
 *
 * 三屏结构的核心数据层：
 *   Node Flow → 基于 DAG 的 AI 生产流水线编排
 *   Timeline  → Node 执行历史渲染
 *   Director  → 基于 Graph 状态的分析入口
 *
 * 关键设计：
 *   - 每个 Node 绑定一个 Worker Slot（通过 taskType + modelId）
 *   - Edge 定义数据流（上一个节点的输出是下一个节点的输入依赖）
 *   - 整个 Graph 提交 = 一个 Scheduler 任务链
 *   - 每个 Node 可独立回放（绑定 replaySessionId）
 */

// ============================================================
// 节点类型
// ============================================================

export enum NodeType {
  SCRIPT_INPUT = 'script_input',
  STORYBOARD = 'storyboard',
  CHARACTER_DEF = 'character_def',
  SCENE_GEN = 'scene_gen',
  VOICE_GEN = 'voice_gen',
  VIDEO_GEN = 'video_gen',
  EFFECT = 'effect',
  RENDER = 'render',
  OUTPUT = 'output',

  // LLM Executor 节点类型
  PROMPT_BUILDER = 'prompt_builder',
  SCRIPT_WRITER = 'script_writer',
  SHOT_SPLIT = 'shot_split',
  IMAGE_PROMPT = 'image_prompt',
  IMAGE_GEN = 'image_gen',

  // 控制类型
  CONDITIONAL = 'conditional',
  PARALLEL = 'parallel',
  MERGE = 'merge',
  LOOP = 'loop',
}

// ============================================================
// 节点模型
// ============================================================

export interface NodePosition {
  x: number
  y: number
}

export interface NodeSlotBinding {
  taskType: string        // 对应 Worker 的任务类型: 'text_to_video' | 'text_to_image' | 'text_to_audio'
  modelId: string         // 对应 AI Router 的 provider+model: 'volcengine/sdxl' | 'kling/v1.5'
  modelLabel: string      // 显示名
  costPerRun: number      // 单次预估成本
  costUnit: 'yuan' | 'points'
  fallbackModelId?: string
}

export interface NodeIO {
  name: string
  type: 'text' | 'image' | 'video' | 'audio' | 'json' | 'script'
  description?: string
}

export interface NodeMetric {
  queueLength: number
  pidPressure: number
  ses: number
  avgDurationMs: number
  successRate: number
}

export interface PipelineNode {
  id: string
  type: NodeType
  label: string
  position: NodePosition
  inputs: NodeIO[]
  outputs: NodeIO[]

  // Slot 绑定（核心）
  slotBinding?: NodeSlotBinding

  // Prompt 结构
  prompt?: {
    positive: string
    negative?: string
    params?: Record<string, any>
  }

  // 执行状态
  status?: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  executionId?: string      // Scheduler task ID
  replaySessionId?: number  // 可回放的 Stability Session ID
  metrics?: NodeMetric

  // 运行时
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  error?: string

  // 成本
  costBreakdown?: {
    model: string
    cost: number
    durationMs: number
  }[]
  totalCost?: number
}

// ============================================================
// 边（数据流）
// ============================================================

export interface PipelineEdge {
  id: string
  source: string       // Node ID
  sourceHandle: string // 输出端口名
  target: string
  targetHandle: string
  label?: string
  type?: 'default' | 'step' | 'smoothstep'
  animated?: boolean
  style?: Record<string, string>
}

// ============================================================
// Pipeline（完整工作流）
// ============================================================

export type PipelineStatus = 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed'

export interface Pipeline {
  id: string
  name: string
  description?: string

  // 版本控制
  version: number
  createdAt: string
  updatedAt: string

  // 图结构
  nodes: PipelineNode[]
  edges: PipelineEdge[]
  entryNodeIds: string[]   // DAG 入口（无入边的节点）
  exitNodeIds: string[]    // DAG 出口（无出边的节点）

  // 全局配置
  globalPrompt?: string
  globalParams?: Record<string, any>

  // 状态
  status: PipelineStatus
  currentExecutionId?: string
  lastExecutionId?: string

  // Tag 系统
  tags?: string[]
  projectId?: string
  userId?: string
}

// ============================================================
// DAG 排序与校验
// ============================================================

export interface TopologicalOrder {
  ordered: PipelineNode[]
  levels: PipelineNode[][]   // 分层（同一层可并行执行）
  hasCycle: boolean
  entryNodes: PipelineNode[]
  exitNodes: PipelineNode[]
}

/**
 * DAG 拓扑排序 + 层级划分
 * 用于决定 Scheduler 任务提交顺序和并行度
 */
export function topologicalSort(pipeline: Pipeline): TopologicalOrder {
  const nodeMap = new Map<string, PipelineNode>()
  for (const n of pipeline.nodes) nodeMap.set(n.id, n)

  // 构建邻接表
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const n of pipeline.nodes) {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  }

  for (const e of pipeline.edges) {
    const targets = adjacency.get(e.source) ?? []
    targets.push(e.target)
    adjacency.set(e.source, targets)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Kahn 算法分层
  const levels: PipelineNode[][] = []
  let queue: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const visited = new Set<string>()
  const ordered: PipelineNode[] = []

  while (queue.length > 0) {
    const currentLevel: PipelineNode[] = []

    for (const nodeId of queue) {
      const node = nodeMap.get(nodeId)
      if (node) {
        currentLevel.push(node)
        ordered.push(node)
        visited.add(nodeId)
      }
    }

    if (currentLevel.length > 0) levels.push(currentLevel)

    const nextQueue: string[] = []
    for (const nodeId of queue) {
      for (const neighbor of (adjacency.get(nodeId) ?? [])) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) nextQueue.push(neighbor)
      }
    }

    queue = nextQueue
  }

  const hasCycle = visited.size !== pipeline.nodes.length

  return {
    ordered,
    levels,
    hasCycle,
    entryNodes: ordered.filter(n => (inDegree.get(n.id) ?? 0) === 0 || pipeline.entryNodeIds.includes(n.id)),
    exitNodes: ordered.filter(n => !pipeline.edges.some(e => e.source === n.id) || pipeline.exitNodeIds.includes(n.id)),
  }
}

// ============================================================
// Flow 执行请求（提交给 Scheduler）
// ============================================================

export interface FlowExecutionRequest {
  pipelineId: string
  executionId: string
  nodeOrders: TopologicalOrder

  // 每个节点 = 一个 Scheduler 任务
  tasks: {
    nodeId: string
    taskType: string
    modelId: string
    prompt: string
    params: Record<string, any>
    dependsOn: string[]      // Edge 定义的依赖节点
    priority?: number
    replayLabel?: string
  }[]
}

// ============================================================
// Timeline 事件
// ============================================================

export interface TimelineEvent {
  nodeId: string
  nodeLabel: string
  nodeType: NodeType
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'fallback' | 'retry' | 'degraded' | 'canceled'

  // 时间
  timestamp: string
  durationMs?: number
  position: number  // 在 Timeline 上的位置 (ms)

  // 元数据
  modelId?: string
  slotBinding?: NodeSlotBinding

  // 关联 Replay
  replaySessionId?: number
  replayFrameId?: number

  // 成本
  cost?: number
  costUnit?: string

  // 异常
  error?: string
  fallbackUsed?: boolean
  driftDetected?: boolean
}
