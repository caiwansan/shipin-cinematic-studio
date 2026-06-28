/**
 * graph-weighting.ts — Phase AG-3.1: Graph Weighting Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 从 "结构图" → "加权信念图"
 *
 * 核心升级：
 *   1. Edge Weight Recalibration — 不再均匀 0.6，按 node type / cluster 计算
 *   2. Node Confidence Score — 每个节点的置信度（supports vs conflicts 比值）
 *   3. Soft Conflict Bootstrapping — 在缺乏真实冲突数据时弱引导
 *   4. Build Weighted Graph — 升级 pipeline 接入点
 *
 * 成功标志：
 *   - edge weight 不再均匀（0.4~0.9 分布）
 *   - node confidence 出现差异
 *   - product / enterprise graph 开始"分层"
 *
 * @phase decision-runtime / ag-3.1
 */

import { EvidenceNode, EvidenceEdge, EvidenceGraph, buildEvidenceGraph } from './evidence-graph.js'
import { EvidenceCluster } from './evidence-cluster.js'

// ============================================================
// 1. Edge Weight Recalibration
// ============================================================

function computeEdgeWeight(a: EvidenceNode, b: EvidenceNode, relation: string): number {
  let weight = 0.5 // 基础权重

  // 同类型节点 → +0.2（同类证据互相支撑）
  if (a.type === b.type) weight += 0.2

  // 同簇节点 → +0.3（同簇内相关性高）
  if (a.clusterId === b.clusterId) weight += 0.3

  // structured 类型 → +0.1（地址/电话等结构化信息的信任度天然高）
  if (a.type === 'structured' && b.type === 'structured') weight += 0.1

  // duplicates / supports → +0.15（正向关系增强）
  if (relation === 'duplicates') weight += 0.15
  if (relation === 'supports' && a.clusterId === b.clusterId) weight += 0.1

  // conflicts → -0.3（冲突关系天然弱化）
  if (relation === 'conflicts') weight -= 0.3

  return Math.max(0.1, Math.min(1.0, weight))
}

// ============================================================
// 2. Node Confidence Score
// ============================================================

function computeNodeConfidence(node: EvidenceNode, nodes: EvidenceNode[], edges: EvidenceEdge[]): number {
  const connected = edges.filter(e => e.from === node.id || e.to === node.id)
  const supports = connected.filter(e => e.relation === 'supports' || e.relation === 'duplicates').length
  const conflicts = connected.filter(e => e.relation === 'conflicts').length

  return supports / (supports + conflicts + 1)
}

// ============================================================
// 3. Soft Conflict Bootstrapping
// ============================================================

/**
 * 弱冲突推断
 * 在缺乏真实对立观点的数据中，通过正负极性词共现来"弱引导"冲突边
 *
 * 触发条件：
 *   - 同为 opinion 类型
 *   - 同簇内
 *   - 一方含正向词，另一方含负向词
 */
function inferSoftConflict(a: EvidenceNode, b: EvidenceNode): boolean {
  if (a.clusterId !== b.clusterId) return false
  if (a.type !== 'opinion' || b.type !== 'opinion') return false

  const posPattern = /(好|推荐|不错|满意|值得|好评|推荐|喜欢|推荐|赞|优秀|最佳|首选)/
  const negPattern = /(差|不好|不推荐|差评|吐槽|失望|不行|垃圾|糟糕|坑|后悔|避雷|踩坑)/

  const aHasPos = posPattern.test(a.snippet)
  const aHasNeg = negPattern.test(a.snippet)
  const bHasPos = posPattern.test(b.snippet)
  const bHasNeg = negPattern.test(b.snippet)

  return (aHasPos && bHasNeg) || (aHasNeg && bHasPos)
}

// ============================================================
// 4. Graph Upgrade Pipeline
// ============================================================

/**
 * 从 EvidenceCluster[] 构建完整加权图
 *
 * 流程：
 *   buildEvidenceGraph(clusters) → 结构图
 *     ↓
 *   Edge Weight Recalibration → 权重不再是均匀 0.6
 *     ↓
 *   Node Confidence Score → 每个节点有置信度
 *     ↓
 *   Soft Conflict 补入 → 即使无真实冲突数据也可能检测到
 *     ↓
 *   Weighted EvidenceGraph
 */
export function buildWeightedGraph(clusters: EvidenceCluster[]): EvidenceGraph {
  // Step 1: 构建基础结构图
  const graph = buildEvidenceGraph(clusters)

  // Step 2: Soft Conflict Bootstrapping（在建边前加入缺失的冲突边）
  const softConflicts: EvidenceEdge[] = []
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      if (inferSoftConflict(graph.nodes[i], graph.nodes[j])) {
        softConflicts.push({
          from: graph.nodes[i].id,
          to: graph.nodes[j].id,
          relation: 'conflicts',
          weight: 0.4, // soft conflict 权重较低
        })
      }
    }
  }

  // 合并 soft conflicts（覆盖已有的冲突边）
  const edgeMap = new Map<string, EvidenceEdge>()
  for (const edge of graph.edges) {
    const key = [edge.from, edge.to].sort().join('→')
    edgeMap.set(key, edge)
  }
  for (const edge of softConflicts) {
    const key = [edge.from, edge.to].sort().join('→')
    const existing = edgeMap.get(key)
    if (!existing || existing.relation === 'supports') {
      // conflicts 覆盖 supports（冲突比支持更重要）
      edgeMap.set(key, edge)
    }
  }

  const allEdges = Array.from(edgeMap.values())

  // Step 3: Edge Weight Recalibration
  const nodeMap = new Map<string, EvidenceNode>()
  for (const n of graph.nodes) nodeMap.set(n.id, n)

  const weightedEdges = allEdges.map(edge => ({
    ...edge,
    weight: computeEdgeWeight(
      nodeMap.get(edge.from)!,
      nodeMap.get(edge.to)!,
      edge.relation
    ),
  }))

  // Step 4: Node Confidence Score
  const scoredNodes = graph.nodes.map(node => ({
    ...node,
    confidence: computeNodeConfidence(node, graph.nodes, weightedEdges),
  }))

  // Step 5: 重新统计
  const stats = {
    nodeCount: scoredNodes.length,
    edgeCount: weightedEdges.length,
    factNodes: scoredNodes.filter(n => n.type === 'fact').length,
    opinionNodes: scoredNodes.filter(n => n.type === 'opinion').length,
    structuredNodes: scoredNodes.filter(n => n.type === 'structured').length,
    noiseNodes: scoredNodes.filter(n => n.type === 'noise').length,
    supportsEdges: weightedEdges.filter(e => e.relation === 'supports').length,
    conflictsEdges: weightedEdges.filter(e => e.relation === 'conflicts').length,
    duplicatesEdges: weightedEdges.filter(e => e.relation === 'duplicates').length,
    refinesEdges: weightedEdges.filter(e => e.relation === 'refines').length,
    avgConfidence: Number((scoredNodes.reduce((sum, n) => sum + n.confidence, 0) / scoredNodes.length).toFixed(3)),
    weightDistribution: computeWeightDistribution(weightedEdges),
  }

  return {
    nodes: scoredNodes,
    edges: weightedEdges,
    stats: stats as any,
  }
}

// ============================================================
// 辅助函数：权重分布统计
// ============================================================

function computeWeightDistribution(edges: EvidenceEdge[]): Record<string, number> {
  const buckets: Record<string, number> = {
    '0.1-0.2': 0,
    '0.2-0.4': 0,
    '0.4-0.6': 0,
    '0.6-0.8': 0,
    '0.8-1.0': 0,
  }
  for (const e of edges) {
    if (e.weight <= 0.2) buckets['0.1-0.2']++
    else if (e.weight <= 0.4) buckets['0.2-0.4']++
    else if (e.weight <= 0.6) buckets['0.4-0.6']++
    else if (e.weight <= 0.8) buckets['0.6-0.8']++
    else buckets['0.8-1.0']++
  }
  return buckets
}
