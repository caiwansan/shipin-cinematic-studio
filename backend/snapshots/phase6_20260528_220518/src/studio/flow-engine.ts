/**
 * AI Studio — Flow 执行引擎（V2 + Semantic Layer）
 *
 * 将 Node Graph 转换为实际的 Scheduler 任务提交。
 * 每个 Flow 提交 = 按拓扑顺序递推执行，每个节点绑定一个 Worker Slot。
 *
 * 核心流程（V2 增强）：
 *   submitFlow(pipeline)
 *     → topologicalSort(pipeline)
 *     → 逐层执行，每节点经过 Fallback State Machine
 *     → 条件边评估（condition routing）
 *     → 漂移传播（drift propagation）
 *     → 收集 timeline events
 *     → 绑定 replay session
 */

import { prisma } from '../utils/index.js'
import type {
  Pipeline,
  FlowExecutionRequest,
  TopologicalOrder,
  PipelineNode,
  TimelineEvent,
} from './graph.model.js'
import { topologicalSort, NodeType } from './graph.model.js'
import {
  type SemanticNodeStatus,
  type NodeExecutionResult,
  type SemanticEdge,
  type EdgeCondition,
  executeNodeWithSemantics,
  resolveActiveEdges,
  evaluateCondition,
  propagateDrift,
  resolveSemanticRoute,
} from './semantic-layer.js'

export interface ExecutionResult {
  executionId: string
  pipelineId: string
  status: 'running' | 'completed' | 'failed' | 'degraded'
  nodeResults: {
    nodeId: string
    status: SemanticNodeStatus
    taskId: string
    durationMs: number
    cost?: number
    driftScore?: number
    replaySessionId?: number
    error?: string
  }[]
  timeline: TimelineEvent[]
  totalDurationMs: number
  totalCost: number
}

const activeExecutions = new Map<string, AbortController>()

/**
 * 提交一条 Flow 到 Scheduler
 */
export async function submitFlow(
  pipeline: Pipeline,
  userId?: string
): Promise<ExecutionResult> {
  const executionId = `flow_${Date.now()}_${pipeline.id}`
  const abort = new AbortController()
  activeExecutions.set(executionId, abort)

  const timeline: TimelineEvent[] = []
  const nodeResults: ExecutionResult['nodeResults'] = []
  let totalCost = 0
  const startTime = Date.now()

  // 1. 拓扑排序
  const sorted = topologicalSort(pipeline)

  if (sorted.hasCycle) {
    throw new Error(`Pipeline ${pipeline.id} has cycle — cannot execute`)
  }

  // 2. 逐层执行（语义增强）
  let driftPropagation: { nodeId: string; propagatedScore: number; severity: string }[] = []

  for (let levelIdx = 0; levelIdx < sorted.levels.length; levelIdx++) {
    const level = sorted.levels[levelIdx]

    if (abort.signal.aborted) break

    // 当前层的节点并行执行 — 每个节点经过 Fallback State Machine
    const levelResults = await Promise.allSettled(
      level.map(node => {
        const fbConfig = {
          maxRetries: 2,
          retryDelayMs: 1000,
          fallbackModelId: node.slotBinding?.fallbackModelId,
          degradeOnThreshold: 0.7,
        }
        return executeNodeWithSemantics(
          node,
          fbConfig,
          (n) => executeNode(n, executionId, abort.signal),
          (nodeId, status, reason) => {
            timeline.push({
              nodeId,
              nodeLabel: node.label,
              nodeType: node.type,
              status: status as any, // SemanticNodeStatus is wider
              timestamp: new Date().toISOString(),
              durationMs: 0,
              position: Date.now() - startTime,
              error: reason,
            })
          }
        )
      })
    )

    for (let i = 0; i < level.length; i++) {
      const node = level[i]
      const result = levelResults[i]

      if (result.status === 'fulfilled') {
        const r = result.value
        nodeResults.push({
          nodeId: node.id,
          status: r.status,
          taskId: '',
          durationMs: Date.now() - startTime,
          cost: r.finalCost,
          driftScore: r.driftScore,
        })
        totalCost += r.finalCost

        // 漂移传播
        if (r.driftScore > 0.2) {
          const downstream = findDownstreamNodes(node.id, pipeline)
          const propagated = propagateDrift(
            {
              sourceNodeId: node.id,
              sourceType: node.type,
              driftScore: r.driftScore,
              propagatedAt: new Date().toISOString(),
              affectedTypes: getAffectedTypes(node.type),
            },
            downstream
          )
          driftPropagation.push(...propagated)
        }
      } else {
        const error = result.reason?.message ?? 'Unknown error'
        nodeResults.push({
          nodeId: node.id,
          status: 'failed',
          taskId: '',
          durationMs: 0,
          error,
        })
        timeline.push({
          nodeId: node.id,
          nodeLabel: node.label,
          nodeType: node.type,
          status: 'failed',
          timestamp: new Date().toISOString(),
          durationMs: 0,
          position: Date.now() - startTime,
          error,
        })
        break
      }
    }

    // 检查条件边：当前层的执行结果决定下层哪些节点跳过
    if (levelIdx + 1 < sorted.levels.length) {
      for (const candidate of sorted.levels[levelIdx + 1]) {
        // 检查所有入边
        const incomingEdges = pipeline.edges.filter(e => e.target === candidate.id)
        if (incomingEdges.length === 0) continue // entry node

        // 找所有上游节点的执行结果
        const upstreamResults = incomingEdges.map(e => {
          const edgeResult = nodeResults.find(nr => nr.nodeId === e.source)
          return { edge: e, result: edgeResult }
        })

        // 如果存在条件边且不满足，跳过该节点
        for (const { edge, result } of upstreamResults) {
          const semanticEdge = edge as SemanticEdge
          if (semanticEdge.condition && result) {
            const execResult: NodeExecutionResult = {
              success: result.status === 'succeeded',
              cost: result.cost,
              driftScore: result.driftScore,
              error: result.error,
            }
            if (!evaluateCondition(semanticEdge.condition, execResult)) {
              // 条件不满足 — 跳过该节点
              timeline.push({
                nodeId: candidate.id,
                nodeLabel: candidate.label,
                nodeType: candidate.type,
                status: 'skipped',
                timestamp: new Date().toISOString(),
                durationMs: 0,
                position: Date.now() - startTime,
                error: `Skipped: condition ${semanticEdge.condition.type} not met on edge ${edge.id}`,
              })
              nodeResults.push({
                nodeId: candidate.id,
                status: 'skipped',
                taskId: '',
                durationMs: 0,
              })
            }
          }
        }
      }
    }

    // 如果有层级全部失败，停止
    if (nodeResults.some(r => r.status === 'failed')) break
  }

  // 判断最终状态
  const hasFailed = nodeResults.some(r => r.status === 'failed')
  const hasDegraded = nodeResults.some(r => r.status === 'degraded')
  const hasSkipped = nodeResults.some(r => r.status === 'skipped')
  const totalDurationMs = Date.now() - startTime

  const execResult: ExecutionResult = {
    executionId,
    pipelineId: pipeline.id,
    status: hasFailed ? 'failed' : hasDegraded ? 'degraded' : 'completed',
    nodeResults,
    timeline,
    totalDurationMs,
    totalCost,
  }

  // 记录到数据库
  await persistExecution(execResult, userId)

  activeExecutions.delete(executionId)
  return execResult
}

/**
 * 中止正在执行的 Flow
 */
export function cancelFlow(executionId: string): boolean {
  const ctrl = activeExecutions.get(executionId)
  if (!ctrl) return false
  ctrl.abort()
  activeExecutions.delete(executionId)
  return true
}

/**
 * 执行单个 Node（供语义层调用）
 */
async function executeNode(
  node: PipelineNode,
  executionId: string,
  signal: AbortSignal
): Promise<NodeExecutionResult> {
  if (!node.slotBinding) {
    return { success: true }
  }

  const taskRequest = {
    nodeId: node.id,
    taskType: node.slotBinding.taskType,
    modelId: node.slotBinding.modelId,
    prompt: node.prompt?.positive ?? '',
    params: {
      ...node.prompt?.params,
      negativePrompt: node.prompt?.negative,
    },
    dependsOn: [] as string[],
    replayLabel: `${executionId}/${node.id}`,
  }

  try {
    const taskId = await submitToScheduler(taskRequest, signal)
    const result = await waitForTask(taskId, signal)

    // 模拟 driftScore（真实场景从 Drift Engine 获取）
    const driftScore = Math.random() * 0.4

    return {
      success: result.success,
      cost: node.slotBinding.costPerRun,
      driftScore,
      error: result.error,
      fallbackUsed: result.fallbackUsed,
      retryCount: 0,
    }
  } catch (err: any) {
    return {
      success: false,
      cost: node.slotBinding.costPerRun,
      error: err.message,
    }
  }
}

/**
 * 向 Scheduler 提交任务（适配器）
 */
async function submitToScheduler(
  task: any,
  signal: AbortSignal
): Promise<string> {
  // 暂时模拟返回 task ID
  // TODO: 对接真实 Scheduler API
  return `task_mock_${Date.now()}`
}

/**
 * 等待任务完成（适配器）
 */
async function waitForTask(
  taskId: string,
  signal: AbortSignal,
  timeoutMs = 60000
): Promise<{ success: boolean; replaySessionId?: number; error?: string; fallbackUsed?: boolean }> {
  // 模拟执行 2-5s
  const simDuration = 2000 + Math.random() * 3000
  await sleep(simDuration, signal)

  return { success: true, replaySessionId: undefined }
}

/**
 * 持久化 Flow 执行结果到数据库
 */
async function persistExecution(
  result: ExecutionResult,
  userId?: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO flow_executions (execution_id, pipeline_id, status, node_count, total_duration_ms, total_cost, user_id, timeline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (execution_id) DO UPDATE SET status = $3, timeline = $8::jsonb`,
      result.executionId,
      result.pipelineId,
      result.status,
      result.nodeResults.length,
      result.totalDurationMs,
      Math.round(result.totalCost * 100) / 100,
      userId ?? 'anonymous',
      JSON.stringify(result.timeline.slice(-50)) // 只存最近50条
    )
  } catch (err) {
    console.warn('[studio] persist execution failed (no migration yet):', err)
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Cancelled'))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Cancelled'))
    }, { once: true })
  })
}

/**
 * 查找下游节点（用于漂移传播）
 */
function findDownstreamNodes(nodeId: string, pipeline: Pipeline): PipelineNode[] {
  const targetIds = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    const nextEdges = pipeline.edges.filter(e => e.source === current)
    for (const e of nextEdges) {
      if (!targetIds.has(e.target)) {
        targetIds.add(e.target)
        queue.push(e.target)
      }
    }
  }

  return pipeline.nodes.filter(n => targetIds.has(n.id))
}

/**
 * 获取受漂移影响的节点类型（基于源类型传播）
 */
function getAffectedTypes(sourceType: NodeType): NodeType[] {
  const propagationMap: Partial<Record<NodeType, NodeType[]>> = {
    [NodeType.STORYBOARD]: [NodeType.SCENE_GEN, NodeType.VIDEO_GEN],
    [NodeType.CHARACTER_DEF]: [NodeType.SCENE_GEN, NodeType.VIDEO_GEN],
    [NodeType.SCENE_GEN]: [NodeType.VIDEO_GEN],
    [NodeType.VIDEO_GEN]: [NodeType.EFFECT, NodeType.RENDER],
    [NodeType.VOICE_GEN]: [NodeType.VIDEO_GEN],
  }
  return propagationMap[sourceType] ?? []
}
