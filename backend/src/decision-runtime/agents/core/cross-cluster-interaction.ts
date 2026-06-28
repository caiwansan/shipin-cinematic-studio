/**
 * cross-cluster-interaction.ts — Phase AG-5: Cross-Cluster Interaction Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 簇与簇之间的"博弈"层：让证据簇互相影响后再做选择
 *
 * 核心升级：
 *   1. Cross-Cluster Edge Construction — 计算簇间相似度/关系
 *   2. Conflict Propagation — 分歧簇互相压低，强化簇互相增强
 *   3. Dominance Recalibration — 归一化后重新排序
 *
 * 不做：
 *   ❌ embedding similarity graphs
 *   ❌ LLM judge
 *   ❌ multi-hop chain reasoning
 *   ❌ full semantic KG
 *
 * 成功标志：
 *   - 传统排序的强势簇因与其他簇分歧而被削弱
 *   - 独立但高质量的簇因强化而提升
 *   - dominance distribution 有明显变化
 *
 * @phase decision-runtime / ag-5
 */

import { ScoredCluster } from './reasoning-layer.js'

// ============================================================
// 1. 跨簇边类型
// ============================================================

export type ClusterRelation = 'reinforce' | 'diverge' | 'neutral'

export interface ClusterEdge {
  from: string
  to: string
  relation: ClusterRelation
  weight: number
}

export interface ClusteredEvidence extends ScoredCluster {
  evidences: EvidenceItem[]
}

interface EvidenceItem {
  title: string
  snippet: string
  url?: string
  source?: string
}

// ============================================================
// 2. Cluster Similarity（基于标题关键词的简单 Jaccard）
// ============================================================

function computeSimilarity(c1: ScoredCluster, c2: ScoredCluster): number {
  // 提取每个 cluster 中所有证据的标题关键字
  const terms1 = new Set<string>()
  const terms2 = new Set<string>()

  const texts1 = [c1.centroid || '', ...(c1 as any).evidences?.map((e: any) => e.title + ' ' + e.snippet) || []]
  const texts2 = [c2.centroid || '', ...(c2 as any).evidences?.map((e: any) => e.title + ' ' + e.snippet) || []]

  // 提取 2 字及以上中文词
  for (const t of texts1) {
    const chars = t.replace(/[\s\d\W_]/g, '').split('')
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars[i] + chars[i + 1]
      if (/[\u4e00-\u9fff]{2}/.test(bigram)) terms1.add(bigram)
    }
  }
  for (const t of texts2) {
    const chars = t.replace(/[\s\d\W_]/g, '').split('')
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars[i] + chars[i + 1]
      if (/[\u4e00-\u9fff]{2}/.test(bigram)) terms2.add(bigram)
    }
  }

  // Jaccard
  const intersect = new Set([...terms1].filter(x => terms2.has(x)))
  const union = new Set([...terms1, ...terms2])

  return union.size > 0 ? intersect.size / union.size : 0
}

function getCluster(clusters: ScoredCluster[], id: string): ScoredCluster {
  const c = clusters.find(c => c.clusterId === id)
  if (!c) throw new Error(`Cluster ${id} not found`)
  return c
}

// ============================================================
// 3. Cross-Cluster Edge Construction
// ============================================================

export function buildClusterEdges(clusters: ScoredCluster[]): ClusterEdge[] {
  const edges: ClusterEdge[] = []

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const c1 = clusters[i]
      const c2 = clusters[j]
      const similarity = computeSimilarity(c1, c2)

      const relation: ClusterRelation =
        similarity > 0.5 ? 'reinforce' :
        similarity < 0.15 ? 'diverge' :
        'neutral'

      edges.push({
        from: c1.clusterId,
        to: c2.clusterId,
        relation,
        weight: Math.round(similarity * 1000) / 1000,
      })
    }
  }

  console.log(`[AG-5] 簇边: ${edges.length} 条` +
    ` | reinforce=${edges.filter(e => e.relation === 'reinforce').length}` +
    ` | diverge=${edges.filter(e => e.relation === 'diverge').length}` +
    ` | neutral=${edges.filter(e => e.relation === 'neutral').length}`)

  return edges
}

// ============================================================
// 4. Conflict Propagation
// ============================================================

export function propagateConflict(clusters: ScoredCluster[], edges: ClusterEdge[]): ScoredCluster[] {
  // 深拷贝
  const updated = clusters.map(c => ({ ...c }))

  for (const edge of edges) {
    const c1 = getCluster(updated, edge.from)
    const c2 = getCluster(updated, edge.to)

    if (edge.relation === 'diverge') {
      // 分歧 → 互相压制 5%
      c1.score = Math.round(c1.score * 0.95 * 1000) / 1000
      c2.score = Math.round(c2.score * 0.95 * 1000) / 1000
    }

    if (edge.relation === 'reinforce') {
      // 强化 → 互相提升 3%（节制一点，避免放大）
      c1.score = Math.round(c1.score * 1.03 * 1000) / 1000
      c2.score = Math.round(c2.score * 1.03 * 1000) / 1000
    }
  }

  console.log(`[AG-5] 传播后簇分: ${updated.map(c => `${c.clusterId}=${c.score}`).join(', ')}`)

  return updated
}

// ============================================================
// 5. Dominance Recalibration
// ============================================================

export function recalibrateDominance(clusters: ScoredCluster[]): ScoredCluster[] {
  const total = clusters.reduce((s, c) => s + c.score, 0)

  if (total === 0) return clusters

  return clusters.map(c => ({
    ...c,
    score: Math.round(c.score * 1000) / 1000,
    dominance: Math.round((c.score / total) * 1000) / 1000,
  })).sort((a, b) => b.score - a.score)
}

// ============================================================
// 6. Stability Computation
// ============================================================

export interface ClusterStability {
  giniCoefficient: number  // Gini 系数（1=极端集中, 0=完全平均）
  topHeaviness: number     // 第一名占总分的比例
  entropy: number           // 归一化熵
}

function computeStability(clusters: ScoredCluster[]): ClusterStability {
  if (clusters.length === 0) return { giniCoefficient: 0, topHeaviness: 0, entropy: 0 }

  const scores = clusters.map(c => c.score).sort((a, b) => a - b)
  const total = scores.reduce((s, v) => s + v, 0)
  const n = scores.length

  // Gini
  let giniSum = 0
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * scores[i]
  }
  const giniCoefficient = n > 1 ? giniSum / (n * total || 1) : 0

  // Top heavyness
  const topHeaviness = total > 0 ? scores[scores.length - 1] / total : 0

  // Entropy
  const probs = scores.filter(s => s > 0).map(s => s / total)
  const entropy = probs.length > 1
    ? -(probs.reduce((sum, p) => sum + p * Math.log(p), 0)) / Math.log(probs.length)
    : 0

  return {
    giniCoefficient: Math.round(giniCoefficient * 1000) / 1000,
    topHeaviness: Math.round(topHeaviness * 1000) / 1000,
    entropy: Math.round(entropy * 1000) / 1000,
  }
}

// ============================================================
// 7. 主入口：AG-5 Pipeline
// ============================================================

export interface AG5Output {
  edges: ClusterEdge[]
  recalibratedClusters: ScoredCluster[]
  stability: ClusterStability
  interactionSummary: string
}

export function runCrossClusterInteraction(clusters: ScoredCluster[]): AG5Output {
  if (clusters.length <= 1) {
    const single: ScoredCluster[] = clusters.length === 1
      ? [{ ...clusters[0], dominance: 1 }]
      : []

    return {
      edges: [],
      recalibratedClusters: single,
      stability: single.length > 0
        ? { giniCoefficient: 1, topHeaviness: 1, entropy: 0 }
        : { giniCoefficient: 0, topHeaviness: 0, entropy: 0 },
      interactionSummary: single.length > 0
        ? `单簇模式 — 簇 '${clusters[0].clusterId}' 独自决策，无跨簇交互`
        : '无可交互的簇',
    }
  }

  // Step 1: Build edges
  const edges = buildClusterEdges(clusters)

  // Step 2: Propagate
  const propagated = propagateConflict(clusters, edges)

  // Step 3: Recalibrate
  const recalibrated = recalibrateDominance(propagated)

  // Step 4: Stability
  const stability = computeStability(recalibrated)

  // Summary
  const divergeCount = edges.filter(e => e.relation === 'diverge').length
  const reinforceCount = edges.filter(e => e.relation === 'reinforce').length
  const top = recalibrated[0]
  const interactionSummary =
    `${recalibrated.length} 个簇交互完毕` +
    (divergeCount > 0 ? ` | ${divergeCount} 对分歧互相压制` : '') +
    (reinforceCount > 0 ? ` | ${reinforceCount} 对强化互相提升` : '') +
    ` | 主导簇 '${top?.clusterId}' (dominance=${((top?.dominance ?? 0) * 100).toFixed(0)}%)` +
    ` | Gini=${stability.giniCoefficient}`

  console.log(`[AG-5] ${interactionSummary}`)

  return {
    edges,
    recalibratedClusters: recalibrated,
    stability,
    interactionSummary,
  }
}
