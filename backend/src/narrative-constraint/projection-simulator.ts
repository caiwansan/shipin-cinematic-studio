/**
 * Projection Simulator
 * 投影模拟器 — 在提交修改前模拟编辑后的未来状态
 *
 * 核心思想：先算后做
 *   - 在真实因果图上模拟编辑
 *   - 在副本上运行 propagation
 *   - 在副本上运行 narrative validation
 *   - 返回"如果做了这个修改，故事会变成什么样"
 *
 * 用户永远不需要看到中间状态
 * 只有：wouldPass / predictedViolations / score
 */

import {
  DirectorCausalGraph,
  CausalNode,
  CausalPatch,
  createEmptyGraph,
} from '../causal-graph/causal-graph-types.js'
import { propagateChange, cleanDirtyFlags } from '../causal-graph/causal-propagation-engine.js'
import { recompileSubgraph } from '../causal-graph/shot-recompiler.js'
import { validateArc } from './story-arc-governor.js'
import {
  NarrativeConstraint,
  SimulationResult,
  ConstraintViolation,
} from './narrative-constraint-types.js'

export interface SimulateOptions {
  /** 是否返回详细 violations */
  detailed: boolean
  /** 是否在模拟后清理副本 */
  cleanupAfter: boolean
}

const DEFAULT_OPTIONS: SimulateOptions = {
  detailed: true,
  cleanupAfter: true,
}

/**
 * 模拟编辑效果 → 返回能否通过叙事约束
 *
 * 这是"预览"操作：
 *   不修改原图
 *   在深度拷贝上跑 propagation + validation
 *   原图不受影响
 */
export function simulateEdit(
  originalGraph: DirectorCausalGraph,
  edit: { nodeId: string; newState: Record<string, any> },
  constraint: NarrativeConstraint,
  options: SimulateOptions = DEFAULT_OPTIONS,
): SimulationResult {
  // 1. 深度拷贝原图
  const tempGraph = cloneGraph(originalGraph)

  // 2. 在副本上执行编辑 + 传播
  const propagation = propagateChange(tempGraph, edit.nodeId, edit.newState)

  // 3. 在副本上执行局部重编译
  const recompile = recompileSubgraph(tempGraph, propagation, {
    preserveUnaffected: true,
    useCache: false,
  })

  // 4. 在副本上执行叙事约束验证
  const validation = validateArc(tempGraph, constraint)

  // 5. 清理
  if (options.cleanupAfter) {
    cleanDirtyFlags(tempGraph)
  }

  return {
    wouldPass: validation.valid,
    predictedViolations: options.detailed ? validation.violations : [],
    score: validation.score,
  }
}

/**
 * 批量模拟多个编辑（用于对比不同编辑方案）
 */
export function simulateBatch(
  originalGraph: DirectorCausalGraph,
  edits: Array<{ nodeId: string; newState: Record<string, any> }>,
  constraint: NarrativeConstraint,
): SimulationResult[] {
  return edits.map(edit => simulateEdit(originalGraph, edit, constraint))
}

/**
 * 自动搜索最佳编辑方案
 * 给定多个候选编辑方案，返回最符合叙事约束的一个
 */
export function findBestEdit(
  originalGraph: DirectorCausalGraph,
  candidateEdits: Array<{ nodeId: string; newState: Record<string, any> }>,
  constraint: NarrativeConstraint,
): { edit: { nodeId: string; newState: Record<string, any> } } | null {
  if (candidateEdits.length === 0) return null

  let bestScore = -1
  let bestEdit: { nodeId: string; newState: Record<string, any> } | null = null

  for (const edit of candidateEdits) {
    const result = simulateEdit(originalGraph, edit, constraint, { detailed: false, cleanupAfter: true })
    if (result.score > bestScore) {
      bestScore = result.score
      bestEdit = edit
    }
  }

  return bestEdit ? { edit: bestEdit } : null
}

/**
 * 深度拷贝因果图
 */
function cloneGraph(graph: DirectorCausalGraph): DirectorCausalGraph {
  const cloned = createEmptyGraph()

  // 深拷贝 nodes
  for (const [id, node] of graph.nodes) {
    cloned.nodes.set(id, {
      ...node,
      state: { ...node.state },
      meta: { ...node.meta },
    })
  }

  // 深拷贝 edges
  cloned.edges = graph.edges.map(e => ({ ...e }))

  // 深拷贝 shotIndex
  for (const [idx, nodeIds] of graph.shotIndex) {
    cloned.shotIndex.set(idx, [...nodeIds])
  }

  cloned.createdAt = graph.createdAt
  cloned.version = graph.version

  return cloned
}
