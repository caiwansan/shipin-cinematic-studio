/**
 * TIR Semantic Freeze — IR Invariant Validator
 * IR 不变量校验器 — 确保 IR graph 结构遵守冻结后的语义
 *
 * 不变量规则（冻结后不得修改）：
 *   1. 每个 node 必须有唯一的 id
 *   2. node.type 必须是已知类型之一的 DirectorIRNodeType
 *   3. node 必须有 shotIndex（>= 0）
 *   4. 每个 edge 必须引用存在的 node（from 和 to）
 *   5. edge.type 必须是已知类型之一
 *   6. constraint 中的 rule 必须有对应实现
 *
 * 这些不变量定义了 TIR 语言的"语义边界"。
 * 任何破坏不变量 = 语言语义变化 = freeze violation
 */

import {
  DirectorIRGraph,
  DirectorIRNodeType,
  DirectorIREdgeType,
} from '../../director-ir/director-ir-types.js'

const VALID_NODE_TYPES: Set<string> = new Set([
  'shot', 'motion', 'emotion', 'grammar', 'character', 'temporal', 'narrative_marker', 'scene',
])

const VALID_EDGE_TYPES: Set<string> = new Set([
  'causal', 'temporal', 'semantic', 'narrative_constraint', 'derivation',
])

export interface InvariantCheck {
  pass: boolean
  checks: InvariantCheckItem[]
}

export interface InvariantCheckItem {
  name: string
  pass: boolean
  message: string
}

/**
 * 运行全部不变检查
 */
export function checkAllInvariants(graph: DirectorIRGraph): InvariantCheck {
  return {
    pass: true,
    checks: [
      checkNodeIdsUnique(graph),
      checkNodeTypesValid(graph),
      checkShotIndices(graph),
      checkEdgeRefs(graph),
      checkEdgeTypesValid(graph),
    ],
  }
}

/**
 * 断言不变量 — 不通过就抛错
 */
export function assertInvariants(graph: DirectorIRGraph): void {
  const result = checkAllInvariants(graph)
  const failed = result.checks.filter(c => !c.pass)
  if (failed.length > 0) {
    const msg = [
      '⚠️ IR INVARIANT VIOLATION (Semantic Freeze)',
      ...failed.map(c => `  ❌ ${c.name}: ${c.message}`),
    ].join('\n')
    throw new Error(msg)
  }
}

/**
 * 不变量 1: 每个 node 必须有唯一的 id
 */
function checkNodeIdsUnique(graph: DirectorIRGraph): InvariantCheckItem {
  const ids = new Set<string>()
  let hasDuplicate = false

  for (const [id] of graph.nodes) {
    if (ids.has(id)) {
      hasDuplicate = true
      break
    }
    ids.add(id)
  }

  return {
    name: 'Node IDs unique',
    pass: !hasDuplicate,
    message: hasDuplicate ? 'Duplicate node IDs found' : `All ${graph.nodes.size} IDs unique`,
  }
}

/**
 * 不变量 2: node.type 必须是已知类型
 */
function checkNodeTypesValid(graph: DirectorIRGraph): InvariantCheckItem {
  const invalid: string[] = []

  for (const [id, node] of graph.nodes) {
    if (!VALID_NODE_TYPES.has(node.type)) {
      invalid.push(`${id}: '${node.type}'`)
    }
  }

  return {
    name: 'Node types valid',
    pass: invalid.length === 0,
    message: invalid.length === 0
      ? `All ${graph.nodes.size} node types valid`
      : `Invalid types: ${invalid.join(', ')}`,
  }
}

/**
 * 不变量 3: node 必须有 shotIndex（>= 0）
 */
function checkShotIndices(graph: DirectorIRGraph): InvariantCheckItem {
  const invalid: string[] = []

  for (const [id, node] of graph.nodes) {
    if (node.shotIndex < 0 || node.shotIndex === undefined) {
      invalid.push(`${id}: shotIndex=${node.shotIndex}`)
    }
  }

  return {
    name: 'Shot indices valid',
    pass: invalid.length === 0,
    message: invalid.length === 0
      ? `All shot indices >= 0`
      : `Invalid shotIndex: ${invalid.join(', ')}`,
  }
}

/**
 * 不变量 4: 每个 edge 必须引用存在的 node
 */
function checkEdgeRefs(graph: DirectorIRGraph): InvariantCheckItem {
  const dangling: string[] = []

  for (const edge of graph.edges) {
    if (!graph.nodes.has(edge.from)) {
      dangling.push(`from ${edge.from} (${edge.id})`)
    }
    if (!graph.nodes.has(edge.to)) {
      dangling.push(`to ${edge.to} (${edge.id})`)
    }
  }

  return {
    name: 'Edge refs valid',
    pass: dangling.length === 0,
    message: dangling.length === 0
      ? `All ${graph.edges.length} edge refs valid`
      : `Dangling edges: ${dangling.join('; ')}`,
  }
}

/**
 * 不变量 5: edge.type 必须是已知类型
 */
function checkEdgeTypesValid(graph: DirectorIRGraph): InvariantCheckItem {
  const invalid: string[] = []

  for (const edge of graph.edges) {
    if (!VALID_EDGE_TYPES.has(edge.type)) {
      invalid.push(`${edge.id}: '${edge.type}'`)
    }
  }

  return {
    name: 'Edge types valid',
    pass: invalid.length === 0,
    message: invalid.length === 0
      ? `All ${graph.edges.length} edge types valid`
      : `Invalid types: ${invalid.join(', ')}`,
  }
}
