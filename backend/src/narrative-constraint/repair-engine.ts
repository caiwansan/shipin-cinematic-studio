/**
 * Repair Engine
 * 修复引擎 — 当叙事约束被违反时，不直接回滚，而是尝试最小修复
 *
 * 核心哲学：
 *   "回滚是懦夫的选择"
 *   找到最小的违规子图
 *   实施最小的修复操作
 *   保留未受影响的全部结构
 *
 * 修复策略（按优先级）：
 *   1. soften_tension — 平滑张力曲线
 *   2. shift_peak — 移动峰值位置
 *   3. reassign_transition — 重分配转换类型
 *   4. insert_transition — 插入过渡
 *   5. remove_node — 最后的选择
 */

import {
  DirectorCausalGraph,
  CausalNode,
  CausalPatch,
} from '../causal-graph/causal-graph-types.js'
import { propagateChange, cleanDirtyFlags } from '../causal-graph/causal-propagation-engine.js'
import {
  NarrativeConstraint,
  ConstraintViolation,
  RepairStrategy,
  RepairStrategyKind,
} from './narrative-constraint-types.js'

export interface RepairResult {
  success: boolean
  patches: CausalPatch[]
  appliedStrategies: RepairStrategy[]
  repairedNodeIds: string[]
  message: string
}

const STRATEGY_PRIORITY: RepairStrategyKind[] = [
  'soften_tension',
  'shift_peak',
  'reassign_transition',
  'insert_transition',
  'remove_node',
  'do_nothing',
]

/**
 * 尝试修复违反叙事约束的图
 *
 * @param graph 当前因果图
 * @param violations 检测到的违规
 * @param constraint 叙事约束
 * @returns 修复结果
 */
export function repairGraph(
  graph: DirectorCausalGraph,
  violations: ConstraintViolation[],
  constraint: NarrativeConstraint,
): RepairResult {
  const patches: CausalPatch[] = []
  const appliedStrategies: RepairStrategy[] = []
  const repairedNodeIds: string[] = []
  let success = true

  // 按违规类型分组
  const grouped = groupViolations(violations, graph)

  // 逐个处理违规
  // 1. 张力跳变 → soften_tension
  for (const violation of grouped.tensionBreaks) {
    const strategy = buildSoftenStrategy(violation, graph, constraint)
    if (strategy && applyStrategy(graph, strategy, patches)) {
      appliedStrategies.push(strategy)
      repairedNodeIds.push(violation.nodeId ?? `shot_${violation.shotIndex}`)
    } else {
      success = false
    }
  }

  // 2. 峰值违规 → shift_peak
  for (const violation of grouped.peakViolations) {
    const strategy = buildShiftPeakStrategy(violation, graph, constraint)
    if (strategy && applyStrategy(graph, strategy, patches)) {
      appliedStrategies.push(strategy)
      repairedNodeIds.push(violation.nodeId ?? `shot_${violation.shotIndex}`)
    }
  }

  // 3. 非法转换 → reassign_transition
  for (const violation of grouped.transitionViolations) {
    const strategy = buildReassignStrategy(violation, graph, constraint)
    if (strategy && applyStrategy(graph, strategy, patches)) {
      appliedStrategies.push(strategy)
      repairedNodeIds.push(violation.nodeId ?? '')
    }
  }

  // 4. 缺少必要阶段 → insert_transition
  for (const violation of grouped.missingStageViolations) {
    // 缺少阶段最好由用户手动插，这里只报告
    patches.push({
      type: 'UPDATE_NODE' as any,
      nodeId: 'repair_note',
      oldState: {},
      newState: { repairNote: violation.message, repairSuggestion: violation.suggestion },
    })
  }

  success = success && appliedStrategies.length > 0

  return {
    success,
    patches,
    appliedStrategies,
    repairedNodeIds,
    message: success
      ? `修复成功：应用了 ${appliedStrategies.length} 个修复策略（${repairedNodeIds.length} 个节点）`
      : '部分修复失败，建议手动干预',
  }
}

function groupViolations(violations: ConstraintViolation[], graph: DirectorCausalGraph): {
  tensionBreaks: ConstraintViolation[]
  peakViolations: ConstraintViolation[]
  transitionViolations: ConstraintViolation[]
  missingStageViolations: ConstraintViolation[]
} {
  const grouped = {
    tensionBreaks: [] as ConstraintViolation[],
    peakViolations: [] as ConstraintViolation[],
    transitionViolations: [] as ConstraintViolation[],
    missingStageViolations: [] as ConstraintViolation[],
  }

  for (const v of violations) {
    switch (v.reason) {
      case 'tension_break':
        grouped.tensionBreaks.push(v)
        break
      case 'arc_violation':
      case 'peak_count_violation':
        grouped.peakViolations.push(v)
        break
      case 'forbidden_transition':
        grouped.transitionViolations.push(v)
        break
      case 'missing_required_stage':
        grouped.missingStageViolations.push(v)
        break
    }
  }

  return grouped
}

function buildSoftenStrategy(
  violation: ConstraintViolation,
  graph: DirectorCausalGraph,
  constraint: NarrativeConstraint,
): RepairStrategy | null {
  if (violation.shotIndex === undefined) return null

  const emotionNode = findEmotionNode(graph, violation.shotIndex)
  if (!emotionNode) return null

  const currentTension = emotionNode.state?.tension ?? 0.5
  const tolerance = 0.3

  // 向前看有一个跳变，则稍微平滑
  const nextNode = findEmotionNode(graph, violation.shotIndex + 1)
  if (!nextNode) return null

  const nextTension = nextNode.state?.tension ?? 0.5
  const newCurrent = currentTension + (nextTension - currentTension) * 0.3

  return {
    kind: 'soften_tension',
    description: `平滑第 ${violation.shotIndex} 镜张力：${currentTension.toFixed(2)} → ${newCurrent.toFixed(2)}`,
    confidence: 0.7,
    nodeId: emotionNode.id,
    targetValue: newCurrent,
  }
}

function buildShiftPeakStrategy(
  violation: ConstraintViolation,
  graph: DirectorCausalGraph,
  constraint: NarrativeConstraint,
): RepairStrategy | null {
  if (constraint.arcType === 'flat_arc') return null

  // 找到当前曲线最高点
  const emotionNodes = findAllEmotionNodes(graph)
  if (emotionNodes.length === 0) return null

  const maxNode = emotionNodes.reduce((a, b) =>
    (a.state?.tension ?? 0) > (b.state?.tension ?? 0) ? a : b
  )

  const targetIndex = Math.floor(emotionNodes.length * 0.65)
  const targetNode = emotionNodes[targetIndex]
  if (!targetNode) return null

  const maxTension = maxNode.state?.tension ?? 0.5
  const targetTension = targetNode.state?.tension ?? 0.5

  return {
    kind: 'shift_peak',
    description: `将峰值从第 ${maxNode.shotIndex} 镜移至第 ${targetNode.shotIndex} 镜`,
    confidence: 0.5,
    nodeId: targetNode.id,
    targetValue: { tension: Math.max(targetTension, maxTension * 0.8) },
  }
}

function buildReassignStrategy(
  violation: ConstraintViolation,
  graph: DirectorCausalGraph,
  constraint: NarrativeConstraint,
): RepairStrategy | null {
  if (!violation.nodeId) return null
  const node = graph.nodes.get(violation.nodeId)
  if (!node) return null

  return {
    kind: 'reassign_transition',
    description: `重分配节点 ${violation.nodeId} 的转换类型`,
    confidence: 0.4,
    nodeId: violation.nodeId,
    targetValue: { grammarType: 'build_up' },
  }
}

function applyStrategy(
  graph: DirectorCausalGraph,
  strategy: RepairStrategy,
  patches: CausalPatch[],
): boolean {
  if (!strategy.nodeId) return false

  const node = graph.nodes.get(strategy.nodeId)
  if (!node) return false

  const oldState = { ...node.state }
  const newState = typeof strategy.targetValue === 'object' && strategy.targetValue !== null
    ? { ...node.state, ...strategy.targetValue }
    : { ...node.state, tension: strategy.targetValue }

  node.state = newState
  node.meta.dirty = true
  graph.version++

  patches.push({
    type: 'UPDATE_NODE',
    nodeId: strategy.nodeId,
    oldState,
    newState,
  })

  return true
}

function findEmotionNode(graph: DirectorCausalGraph, shotIndex: number): CausalNode | undefined {
  const nodeIds = graph.shotIndex.get(shotIndex) ?? []
  for (const nid of nodeIds) {
    const node = graph.nodes.get(nid)
    if (node?.layer === 'emotion') return node
  }
  return undefined
}

function findAllEmotionNodes(graph: DirectorCausalGraph): CausalNode[] {
  const nodes: CausalNode[] = []
  for (const [, node] of graph.nodes) {
    if (node.layer === 'emotion') nodes.push(node)
  }
  return nodes.sort((a, b) => a.shotIndex - b.shotIndex)
}
