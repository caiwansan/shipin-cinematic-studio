/**
 * evidence-graph.ts — Phase AG-3: Evidence Graph Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 从 Evidence Cluster[] → EvidenceNode[] + EvidenceEdge[]
 *
 * 设计原则：
 *   1. 不上 embedding / transformer / reranker
 *   2. 不上完整语义 KG
 *   3. 只做：结构关系显式化（supports / conflicts / duplicates / refines）
 *   4. scorer 输入从 flat list 升级为 graph-aware structure
 *
 * 成功标志：
 *   1. ~30 nodes + edges（视证据量浮动）
 *   2. 冲突证据自动浮现（如正负评价对立）
 *   3. 同簇匹配 → supports / duplicates
 *
 * @phase decision-runtime / ag-3
 */

import { UniversalEvidence } from './universal-evidence.js'
import { EvidenceCluster } from './evidence-cluster.js'

// ============================================================
// 图模型
// ============================================================

export type EvidenceNodeType = 'fact' | 'opinion' | 'structured' | 'noise'

export type EvidenceEdgeRelation = 'supports' | 'duplicates' | 'conflicts' | 'refines'

export interface EvidenceNode {
  id: string
  clusterId: string
  title: string
  snippet: string
  type: EvidenceNodeType
}

export interface EvidenceEdge {
  from: string
  to: string
  relation: EvidenceEdgeRelation
  weight: number
}

export interface EvidenceGraph {
  nodes: EvidenceNode[]
  edges: EvidenceEdge[]
  stats: {
    nodeCount: number
    edgeCount: number
    factNodes: number
    opinionNodes: number
    structuredNodes: number
    noiseNodes: number
    supportsEdges: number
    conflictsEdges: number
    duplicatesEdges: number
    refinesEdges: number
  }
}

// ============================================================
// 证据类型分类（极简关键词规则）
// ============================================================

function classifyEvidence(e: UniversalEvidence): EvidenceNodeType {
  const text = `${e.title} ${e.snippet}`.toLowerCase()

  if (/(地址|电话|营业时间|联系方式|在哪|怎么去|地铁|公交|位置|门店|路线|官网|邮箱|邮编)/.test(text)) {
    return 'structured'
  }
  if (/(推荐|评价|不错|不好|差|好|值得|对比|优缺点|好评|差评|五星|体验|感受|觉得|性价比|好用|满意|吐槽)/.test(text)) {
    return 'opinion'
  }
  if (/(公司|企业|法人|注册|资质|工商|税务|背景|信用|成立|股份|有限|集团|注册号|统一社会信用)/.test(text)) {
    return 'fact'
  }
  return 'noise'
}

// ============================================================
// Node ID 生成（基于内容哈希，去重用）
// ============================================================

function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0 // Convert to 32bit integer
  }
  return `n_${Math.abs(hash).toString(36)}`
}

// ============================================================
// 文本相似度（简易 Jaccard，判断 duplicate / conflict）
// ============================================================

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/))
  const setB = new Set(b.toLowerCase().split(/\s+/))
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return union.size > 0 ? intersection.size / union.size : 0
}

// ============================================================
// 定性判断关系
// ============================================================

function inferEdgeRelation(a: EvidenceNode, b: EvidenceNode): EvidenceEdgeRelation {
  const sim = jaccardSimilarity(a.snippet, b.snippet)

  // 高度相似 → duplicates
  if (sim >= 0.7) return 'duplicates'

  // 同 cluster → supports（默认）
  if (a.clusterId === b.clusterId) return 'supports'

  // 意见冲突检测：opinion 类中正负对撞
  if (a.type === 'opinion' && b.type === 'opinion') {
    const posA = /(好|推荐|不错|满意|值得)/.test(a.snippet)
    const negA = /(不好|差|不推荐|差评|吐槽)/.test(a.snippet)
    const posB = /(好|推荐|不错|满意|值得)/.test(b.snippet)
    const negB = /(不好|差|不推荐|差评|吐槽)/.test(b.snippet)

    if ((posA && negB) || (negA && posB)) return 'conflicts'
  }

  // 中度相似但不同簇 → refines
  if (sim >= 0.3) return 'refines'

  return 'supports'
}

// ============================================================
// Cluster → Graph 转换
// ============================================================

export function buildEvidenceGraph(clusters: EvidenceCluster[]): EvidenceGraph {
  const nodesMap = new Map<string, EvidenceNode>()
  const edgesList: EvidenceEdge[] = []

  // Step 1: 所有 evidence → nodes（去重）
  for (const cluster of clusters) {
    for (const ev of cluster.evidences) {
      const id = hashContent(ev.snippet || ev.title)
      if (nodesMap.has(id)) continue

      nodesMap.set(id, {
        id,
        clusterId: cluster.clusterId,
        title: ev.title,
        snippet: ev.snippet,
        type: classifyEvidence(ev),
      })
    }
  }

  const nodes = Array.from(nodesMap.values())

  // Step 2: 建边（O(n²)，但当前证据量 ≤ 50，可接受）
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const relation = inferEdgeRelation(a, b)
      let weight = 0.5

      switch (relation) {
        case 'supports':
          weight = 0.6
          break
        case 'duplicates':
          weight = 0.9
          break
        case 'conflicts':
          weight = jaccardSimilarity(a.snippet, b.snippet) // 冲突越聚焦权重越高
          break
        case 'refines':
          weight = 0.4
          break
      }

      edgesList.push({ from: a.id, to: b.id, relation, weight })
    }
  }

  // Edge 去重保守：只保留每个 pair 中最高权重的 edge
  const edgeMap = new Map<string, EvidenceEdge>()
  for (const edge of edgesList) {
    const key = [edge.from, edge.to].sort().join('→')
    const existing = edgeMap.get(key)
    if (!existing || edge.weight > existing.weight) {
      edgeMap.set(key, edge)
    }
  }
  const edges = Array.from(edgeMap.values())

  // Step 3: 统计
  const stats = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    factNodes: nodes.filter(n => n.type === 'fact').length,
    opinionNodes: nodes.filter(n => n.type === 'opinion').length,
    structuredNodes: nodes.filter(n => n.type === 'structured').length,
    noiseNodes: nodes.filter(n => n.type === 'noise').length,
    supportsEdges: edges.filter(e => e.relation === 'supports').length,
    conflictsEdges: edges.filter(e => e.relation === 'conflicts').length,
    duplicatesEdges: edges.filter(e => e.relation === 'duplicates').length,
    refinesEdges: edges.filter(e => e.relation === 'refines').length,
  }

  return { nodes, edges, stats }
}
