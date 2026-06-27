/**
 * Worker Runtime Bridge — Execution DAG → Worker Tasks
 *
 * ═══════════════════════════════════════════════════════════════
 * S4: Worker Runtime Bridge
 *
 *   Execution DAG（声明式）
 *   │
 *   └── bridgeDAG() ── Adapter 模式
 *       │
 *       ▼
 *   ExecutionTrace[] + Worker Task[] → Existing worker-runtime
 *
 * 核心原则：
 *   - Bridge Never Changes the DAG
 *   - Bridge is a Translator, not a Planner
 *   - Bridge 不重写 worker-runtime
 *   - Bridge 不调度、不重试、不超时
 *
 *   双运行模式：
 *     Legacy: V3 → worker-runtime（现有，不改）
 *     New:    V3 → Compiler → ... → DAG → Bridge → worker-runtime
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { ExecutionDAG, DAGNode, DAGEdge } from './execution-planner.js'

// ─── 类型定义 ──────────────────────────────────────────

/**
 * Worker Task — Bridge 输出的 Worker 可消费任务
 *
 * 注意：这里复用了 `TaskPayload` 的结构约束，
 * 但 Bridge 不直接导入 TaskPayload（避免耦合 queue-manager）。
 * 实际调用时由调用方做类型适配。
 */
export interface WorkerTask {
  taskId: string
  dagNodeId: string
  type: 'image' | 'video' | 'tts' | 'llm' | 'export' | 'frame'
  priority: number           // 执行优先级
  payload: Record<string, any>  // 最终传给 worker-runtime 的参数
}

/**
 * Execution Trace — DAG Node 到 Worker Task 的映射记录
 *
 * 用于 Production Replay：
 *   - 每个 DAG Node 可追踪到对应的 Worker Task
 *   - 执行顺序可还原
 *   - 支持按 Trace 重放整个 Pipeline 而不调用 Provider
 */
export interface ExecutionTrace {
  traceId: string
  dagId: string
  entries: ExecutionTraceEntry[]
  metadata: {
    bridgedAt: string
    totalDagNodes: number
    totalWorkerTasks: number
    dagNodesUnmapped: string[]    // 未被 Bridge 映射的 DAG 节点
  }
}

export interface ExecutionTraceEntry {
  executionOrder: number
  dagNodeId: string
  dagNodeType: string
  dagNodeLabel: string
  workerTaskId: string
  workerTaskType: WorkerTask['type']
  requiredCapabilities: string[]
  fallbackStrategy: string | null
  isOptional: boolean
}

/**
 * Bridge Diagnostics — 桥接过程的诊断信息
 */
export interface BridgeDiagnostics {
  success: boolean
  dagNodeCount: number
  taskGenerated: number
  unmappedNodes: Array<{ id: string; type: string; reason: string }>
  warnings: string[]
}

// ─── 主桥接函数 ────────────────────────────────────────

/**
 * 将 Execution DAG 桥接为 Worker Task 列表 + Execution Trace。
 *
 * @param dag - Execution Planner 输出的声明式 DAG
 * @param projectId - 项目 ID（传入 Task payload）
 * @param userId - 用户 ID（传入 Task payload）
 * @returns WorkerTask[] + ExecutionTrace + Diagnostics
 */
export function bridgeDAG(
  dag: ExecutionDAG,
  projectId: string,
  userId: string,
): {
  tasks: WorkerTask[]
  trace: ExecutionTrace
  diagnostics: BridgeDiagnostics
} {
  const entries: ExecutionTraceEntry[] = []
  const tasks: WorkerTask[] = []
  const unmappedNodes: BridgeDiagnostics['unmappedNodes'] = []
  const warnings: string[] = []

  // 拓扑排序 DAG 节点
  const sortedNodes = topologicalSort(dag)
  const dagNodeMap = new Map(dag.nodes.map(n => [n.id, n]))

  let executionOrder = 0

  for (const nodeId of sortedNodes) {
    const node = dagNodeMap.get(nodeId)
    if (!node) continue

    const mapping = mapNodeToTask(node)
    if (mapping === null) {
      unmappedNodes.push({ id: node.id, type: node.type, reason: '无法映射到任何 Worker Task 类型' })
      continue
    }

    executionOrder++

    const taskId = `task_${Date.now().toString(36)}_${executionOrder}_${Math.random().toString(36).slice(2, 6)}`

    const task: WorkerTask = {
      taskId,
      dagNodeId: node.id,
      type: mapping.type,
      priority: executionOrder,  // 按执行顺序递增
      payload: {
        // 项目/用户信息
        projectId,
        userId,
        // 来源追踪
        sourceDagId: dag.id,
        sourceDagNodeId: node.id,
        // Capability 信息
        requiredCapabilities: node.requiredCapabilities,
        fallbackStrategy: node.metadata.fallbackStrategy,
        isOptional: node.metadata.isOptional,
        // 原 Prompt 数据（由调用方补充）
        promptData: null,
        // 执行顺序
        executionOrder,
      },
    }

    tasks.push(task)

    entries.push({
      executionOrder,
      dagNodeId: node.id,
      dagNodeType: node.type,
      dagNodeLabel: node.label,
      workerTaskId: taskId,
      workerTaskType: mapping.type,
      requiredCapabilities: node.requiredCapabilities,
      fallbackStrategy: node.metadata.fallbackStrategy,
      isOptional: node.metadata.isOptional,
    })
  }

  if (unmappedNodes.length > 0) {
    warnings.push(`${unmappedNodes.length} 个 DAG 节点未映射到 Worker Task 类型`)
  }

  const diagnostics: BridgeDiagnostics = {
    success: unmappedNodes.length === 0,
    dagNodeCount: dag.nodes.length,
    taskGenerated: tasks.length,
    unmappedNodes,
    warnings,
  }

  const trace: ExecutionTrace = {
    traceId: `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dagId: dag.id,
    entries,
    metadata: {
      bridgedAt: new Date().toISOString(),
      totalDagNodes: dag.nodes.length,
      totalWorkerTasks: tasks.length,
      dagNodesUnmapped: unmappedNodes.map(n => n.id),
    },
  }

  return { tasks, trace, diagnostics }
}

/**
 * Bridge Non-bridge Check：验证 Bridge 是否修改了 DAG。
 *
 * 如果 Bridge 正确（不修改 DAG），调用方应调用此函数确认。
 */
export function verifyBridgeIntegrity(
  originalDAG: ExecutionDAG,
  diagnostics: BridgeDiagnostics,
): { intact: boolean; reason?: string } {
  if (diagnostics.dagNodeCount !== originalDAG.nodes.length) {
    return { intact: false, reason: 'Bridge 报告了与 DAG 不同的节点数' }
  }
  if (diagnostics.success === false) {
    return { intact: false, reason: 'Bridge 未 100% 映射所有 DAG 节点' }
  }
  return { intact: true }
}

// ─── 内部映射函数 ──────────────────────────────────────

/**
 * DAG 节点类型 → Worker Task 类型映射表
 *
 * 原则：
 *   只做映射，不做推理
 *   如果遇到未知类型 → 返回 null（不 panic，由调用方决定如何处理）
 */
const CAPABILITY_TO_TASK_TYPE: Record<string, WorkerTask['type']> = {
  'film.character.reference': 'image',
  'film.keyframe': 'image',
  'film.camera.path': 'video',
  'film.render.shot': 'video',
  'film.physics.constraint': 'video',
  'film.lip.sync': 'video',
  'film.temporal.consistency': 'video',
  'film.lighting.control': 'video',
  'film.style.transfer': 'image',
  'film.spatial.layout': 'image',
}

function mapNodeToTask(node: DAGNode): { type: WorkerTask['type'] } | null {
  // 取第一个 Capability 来决定 Task 类型
  // Bridge 不做推理，所以即使有多个 Capability 也只取第一个
  if (node.requiredCapabilities.length === 0) return null

  const primaryCapability = node.requiredCapabilities[0]
  const taskType = CAPABILITY_TO_TASK_TYPE[primaryCapability]

  if (!taskType) return null

  return { type: taskType }
}

// ─── 拓扑排序（纯函数） ────────────────────────────────

function topologicalSort(dag: ExecutionDAG): string[] {
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const node of dag.nodes) {
    inDegree.set(node.id, 0)
    adjList.set(node.id, [])
  }

  for (const edge of dag.edges) {
    adjList.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)
    for (const next of adjList.get(current) || []) {
      const newDegree = (inDegree.get(next) || 1) - 1
      inDegree.set(next, newDegree)
      if (newDegree === 0) queue.push(next)
    }
  }

  return result
}
