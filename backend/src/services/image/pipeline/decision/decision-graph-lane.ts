// ============================================================
// decision/decision-graph-lane.ts
//
// 职责：D2 Graph Lane — 基于 DEIP 决策图的路径推理
// 从 d2InputGraph 中找到最优 action 路径
//
// 核心逻辑：
//   1. 从 gate:composite 出发，遍历所有出边
//   2. 按边权重排序，选权重最高的可用 action
//   3. 考虑 locked 节点（硬约束阻断）
//   4. 输出 graph-based decision
//
// 设计原则：
//   - 不修改原 D2 scorer（独立 lane）
//   - 纯图结构推理，不涉及评分阈值
//   - locked 节点不可逆
// ============================================================

import type { DecisionAction } from './decision-engine.js'

// ─── Graph Lane 输出 ──────────────────────────────────

export interface GraphLaneDecision {
  action: DecisionAction
  /** 图中选中的路径 */
  chosenPath: Array<{ from: string; to: string; weight: number; label: string }>
  /** 图自信度（基于路径权重聚合） */
  confidence: number
  /** 是否有 graph-level 的阻断 */
  blocked: boolean
  /** 阻断原因 */
  blockReason?: string
  /** 锁定的节点信息 */
  lockedNodes: string[]
}

// ─── 图路径推理 ────────────────────────────────────────

export interface D2InputGraph {
  nodes: Array<{
    id: string
    type: string
    label: string
    locked: boolean
  }>
  edges: Array<{
    from: string
    to: string
    weight: number
    label: string
    active: boolean
  }>
  integritySeal?: string
}

/**
 * 从 DEIP 决策图中推理出最优 action
 *
 * 推理算法：
 *   1. 从 gate:composite 节点出发
 *   2. 找出所有 active = true 的出边（通向 action 节点）
 *   3. 按权重降序排列
 *   4. 检查 action 节点是否 locked
 *   5. 选第一个未被 blocked 的 action
 *
 * 安全机制：
 *   - 如果 gate 节点 locked → escalate high
 *   - 如果所有 action 路径被 block → escalate
 *   - 如果没有 graph → 返回 null（caller 做 fallback）
 */
export function computeGraphLaneDecision(graph: D2InputGraph): GraphLaneDecision | null {
  const lockedNodes = graph.nodes
    .filter(n => n.locked)
    .map(n => n.label)

  // 找 gate:composite
  const gateNode = graph.nodes.find(n => n.id === 'gate:composite')
  if (!gateNode) return null

  // gate 本身 locked = 系统级阻断
  if (gateNode.locked) {
    return {
      action: { type: 'escalate', reason: '决策图 gate 节点被锁定，系统级阻断', severity: 'high' },
      chosenPath: [],
      confidence: 0.9,
      blocked: true,
      blockReason: 'gate:composite locked',
      lockedNodes,
    }
  }

  // 从 gate 出发，找通 action 的边
  const outgoingEdges = graph.edges
    .filter(e => e.from === 'gate:composite' && e.active)
    .sort((a, b) => b.weight - a.weight)

  if (outgoingEdges.length === 0) {
    return {
      action: { type: 'escalate', reason: '决策图 gate 无可用出边，无法决策', severity: 'mid' },
      chosenPath: [],
      confidence: 0.7,
      blocked: true,
      blockReason: 'no active outgoing edges from gate',
      lockedNodes,
    }
  }

  // 按权重顺序检查 action 节点
  for (const edge of outgoingEdges) {
    const targetNode = graph.nodes.find(n => n.id === edge.to)
    if (!targetNode) continue

    // 如果 action 节点 locked = 不可选
    if (!targetNode.locked) {
      const confidence = Math.min(1, edge.weight + 0.2) // 边权重 + base boost

      const action = actionTypeFromNodeId(targetNode.id, edge.weight)

      return {
        action,
        chosenPath: [{
          from: edge.from,
          to: edge.to,
          weight: edge.weight,
          label: edge.label,
        }],
        confidence: Math.round(confidence * 100) / 100,
        blocked: false,
        lockedNodes,
      }
    }
  }

  // 所有 action 都被 lock → escalate
  return {
    action: { type: 'escalate', reason: '所有决策路径均被锁定，无法自动决策', severity: 'high' },
    chosenPath: outgoingEdges.map(e => ({
      from: e.from,
      to: e.to,
      weight: e.weight,
      label: e.label,
    })),
    confidence: 0.8,
    blocked: true,
    blockReason: 'all action nodes locked',
    lockedNodes,
  }
}

/**
 * 根据 action 节点 ID 和边权重生成决策动作
 */
function actionTypeFromNodeId(nodeId: string, _weight: number): DecisionAction {
  switch (nodeId) {
    case 'action:accept':
      return { type: 'accept', reason: '图推理最优路径：accept' }
    case 'action:retry':
      return { type: 'retry', reason: '图推理：retry 路径权重最高', attemptRemaining: 2 }
    case 'action:regenerate':
      return { type: 'regenerate', reason: '图推理：结构约束导致需要重新生成', promptHint: '图推理自动生成' }
    case 'action:escalate':
      return { type: 'escalate', reason: '图推理：系统建议升级人工', severity: 'mid' }
    default:
      return { type: 'escalate', reason: `未知 action 节点: ${nodeId}`, severity: 'mid' }
  }
}
