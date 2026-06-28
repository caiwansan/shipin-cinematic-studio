/**
 * Runtime Semantic Layer V2 — Node Flow 执行语义补丁
 *
 * 补齐三郎 Spec 中的三个关键语义缺口：
 *   ① Condition Edge —— 条件分支执行
 *   ② Fallback State Machine —— 系统韧性状态
 *   ③ Drift Hook —— 质量感知传播
 */

import type { PipelineNode, PipelineEdge } from './graph.model.js'
import { NodeType } from './graph.model.js'

// ============================================================
// ① Condition Edge — 条件执行分支
// ============================================================

export type EdgeCondition =
  | { type: 'success' }                         // 执行成功后触发
  | { type: 'failed' }                           // 执行失败后触发
  | { type: 'cost'; max: number }                // 成本低于阈值触发
  | { type: 'drift'; maxThreshold: number }      // 漂移低于阈值触发
  | { type: 'threshold'; metric: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number }

export interface SemanticEdge extends PipelineEdge {
  condition?: EdgeCondition
  fallback?: boolean   // 是否为 fallback 路径
}

// ============================================================
// ② 扩展状态机
// ============================================================

export type SemanticNodeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'fallback'
  | 'retry'
  | 'degraded'
  | 'skipped'
  | 'canceled'

/**
 * 传统状态 → 语义状态映射
 * 当 Node 非简单失败时，检查是否存在 Fallback 路径
 */
export type NodeExecutionResult = {
  success: boolean
  cost?: number
  driftScore?: number
  error?: string
  fallbackUsed?: boolean
  retryCount?: number
}

// ============================================================
// ③ Condition Routing Engine
// ============================================================

/**
 * 判断 Edge 条件是否满足，决定该 Edge 是否激活
 */
export function evaluateCondition(
  condition: EdgeCondition,
  result: NodeExecutionResult
): boolean {
  switch (condition.type) {
    case 'success':
      return result.success

    case 'failed':
      return !result.success

    case 'cost':
      return (result.cost ?? Infinity) <= condition.max

    case 'drift':
      return (result.driftScore ?? 0) <= condition.maxThreshold

    case 'threshold': {
      const val = result[condition.metric as keyof NodeExecutionResult]
      if (typeof val !== 'number') return false
      switch (condition.operator) {
        case 'gt':  return val > condition.value
        case 'lt':  return val < condition.value
        case 'gte': return val >= condition.value
        case 'lte': return val <= condition.value
      }
    }
  }
}

/**
 * 从一组出边中找到激活的 Edge
 */
export function resolveActiveEdges(
  edges: SemanticEdge[],
  result: NodeExecutionResult
): SemanticEdge[] {
  const activated: SemanticEdge[] = []

  // 先找 exact match 的条件边
  let matchedCondition = false
  for (const edge of edges) {
    if (edge.condition) {
      if (evaluateCondition(edge.condition, result)) {
        activated.push(edge)
        matchedCondition = true
      }
    }
  }

  // 没匹配到条件边，走无条件边
  if (!matchedCondition) {
    for (const edge of edges) {
      if (!edge.condition) {
        activated.push(edge)
      }
    }
  }

  return activated
}

// ============================================================
// ④ Fallback State Machine
// ============================================================

export interface FallbackConfig {
  maxRetries: number
  retryDelayMs: number
  fallbackModelId?: string
  degradeOnThreshold?: number  // drift 阈值
}

/**
 * 语义节点执行 —— 带 Fallback/Rerty/质量感知的状态机
 */
export async function executeNodeWithSemantics(
  node: PipelineNode,
  fallbackConfig: FallbackConfig,
  executor: (node: PipelineNode) => Promise<NodeExecutionResult>,
  onStateChange?: (nodeId: string, status: SemanticNodeStatus, reason?: string) => void
): Promise<{
  status: SemanticNodeStatus
  result: NodeExecutionResult
  finalCost: number
  driftScore: number
}> {
  let finalStatus: SemanticNodeStatus = 'idle'
  let finalCost = 0
  let finalDrift = 0
  let result: NodeExecutionResult = { success: false }

  // === Phase 1: 初始执行 ===
  onStateChange?.(node.id, 'running')
  result = await executor(node)

  // 成功执行
  if (result.success) {
    finalCost = result.cost ?? 0
    finalDrift = result.driftScore ?? 0

    // 检测漂移
    if (fallbackConfig.degradeOnThreshold != null && finalDrift > fallbackConfig.degradeOnThreshold) {
      finalStatus = 'degraded'
      onStateChange?.(node.id, 'degraded', `Drift ${finalDrift} exceeds threshold ${fallbackConfig.degradeOnThreshold}`)
    } else {
      finalStatus = 'succeeded'
      onStateChange?.(node.id, 'succeeded')
    }
    return { status: finalStatus, result, finalCost, driftScore: finalDrift }
  }

  // === Phase 2: Fallback 路径 ===
  if (fallbackConfig.fallbackModelId) {
    finalStatus = 'fallback'
    onStateChange?.(node.id, 'fallback', `Primary failed, fallback to ${fallbackConfig.fallbackModelId}`)

    // 重新配置节点使用 Fallback 模型
    const fallbackNode = {
      ...node,
      slotBinding: node.slotBinding ? {
        ...node.slotBinding,
        modelId: fallbackConfig.fallbackModelId,
        modelLabel: fallbackConfig.fallbackModelId,
      } : undefined,
    }

    const fbResult = await executor(fallbackNode)
    if (fbResult.success) {
      finalCost = fbResult.cost ?? 0
      finalDrift = fbResult.driftScore ?? 0
      finalStatus = 'succeeded'
      onStateChange?.(node.id, 'succeeded', 'Fallback succeeded')
      return { status: finalStatus, result: fbResult, finalCost, driftScore: finalDrift }
    }
  }

  // === Phase 3: Retry 循环 ===
  for (let tryCount = 1; tryCount <= fallbackConfig.maxRetries; tryCount++) {
    finalStatus = 'retry'
    onStateChange?.(node.id, 'retry', `Retry ${tryCount}/${fallbackConfig.maxRetries}`)

    await sleep(fallbackConfig.retryDelayMs)

    const retryResult = await executor(node)
    if (retryResult.success) {
      finalCost = retryResult.cost ?? 0
      finalDrift = retryResult.driftScore ?? 0
      finalStatus = 'succeeded'
      onStateChange?.(node.id, 'succeeded', `Recovered on retry ${tryCount}`)
      return { status: finalStatus, result: retryResult, finalCost, driftScore: finalDrift }
    }
  }

  // === Phase 4: 最终失败 ===
  finalStatus = 'failed'
  onStateChange?.(node.id, 'failed', result.error ?? 'All retries exhausted')
  return { status: finalStatus, result, finalCost, driftScore: finalDrift }
}

// ============================================================
// ⑤ Drift Propagation — 质量感知传播系统
// ============================================================

export interface DriftSignal {
  sourceNodeId: string
  sourceType: NodeType
  driftScore: number
  propagatedAt: string
  affectedTypes: NodeType[]
}

/**
 * 漂移传播：
 *   - 上游节点的质量下降会传播到下游同类节点
 *   - 例如 "故事板的漂移" → 下游 scene gen 的关联场景退化
 */
export function propagateDrift(
  driftSignal: DriftSignal,
  downstreamNodes: PipelineNode[]
): { nodeId: string; propagatedScore: number; severity: 'none' | 'minor' | 'moderate' | 'critical' }[] {
  const results: { nodeId: string; propagatedScore: number; severity: 'none' | 'minor' | 'moderate' | 'critical' }[] = []

  for (const dn of downstreamNodes) {
    if (!driftSignal.affectedTypes.includes(dn.type)) continue

    // 衰减传播：继承 60% 的上游漂移
    const propagatedScore = driftSignal.driftScore * 0.6

    const severity =
      propagatedScore > 0.8 ? 'critical' :
      propagatedScore > 0.5 ? 'moderate' :
      propagatedScore > 0.2 ? 'minor' :
      'none'

    results.push({ nodeId: dn.id, propagatedScore, severity })
  }

  return results
}

// ============================================================
// ⑥ Scheduling Semantic Upgrade
// ============================================================

export interface SemanticTaskRoute {
  nodeId: string
  taskType: string
  modelId: string
  priority: number
  queue: string
  conditionMatched: string | null
  fallbackChain: string[]
}

/**
 * 语义调度路由 —— 将 Node + Edge 执行结果翻译为 Scheduler 目标
 */
export function resolveSemanticRoute(
  node: PipelineNode,
  executionResult: NodeExecutionResult,
  allEdges: SemanticEdge[],
  targetNodeIds: string[]
): SemanticTaskRoute[] {
  // 找当前节点的所有出边
  const outEdges = allEdges.filter(e => e.source === node.id)

  // 根据执行结果判断有哪些出边激活
  const activeEdges = resolveActiveEdges(outEdges, executionResult)

  const routes: SemanticTaskRoute[] = []

  for (const edge of activeEdges) {
    if (!targetNodeIds.includes(edge.target)) continue

    // 目标节点的调度决策
    const targetNode = node // 实际应查找目标节点
    routes.push({
      nodeId: edge.target,
      taskType: 'default',
      modelId: node.slotBinding?.modelId ?? 'unknown',
      priority: edge.fallback ? 1 : 0, // fallback 路径低优先级
      queue: edge.fallback ? 'P2' : 'P1',
      conditionMatched: edge.condition?.type ?? null,
      fallbackChain: edge.fallback ? [node.id] : [],
    })
  }

  return routes
}

// ============================================================
// Replay Semantic Tagging — 给 Replay 帧打上语义标签
// ============================================================

export interface ReplaySemanticTag {
  frameId: number
  sessionId: number
  nodeId: string
  status: SemanticNodeStatus
  tags: string[]
  driftAtExecution?: number
  costAtExecution?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
