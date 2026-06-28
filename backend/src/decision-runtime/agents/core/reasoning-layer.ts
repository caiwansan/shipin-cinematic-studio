/**
 * reasoning-layer.ts — Phase AG-4: Cross-cluster Evidence Aggregation Reasoning (Minimal)
 *
 * ═══════════════════════════════════════════════════════════════
 * 从 "加权图" → "压缩决策世界"
 *
 * 核心任务：
 *   1. Cluster Scoring — avgConfidence × sizeWeight 加权
 *   2. Cluster Ranking — 跨簇竞争排序
 *   3. Evidence Compression — Top-K 簇 → 代表性证据摘要
 *   4. Final Decision Synthesis — 输出压缩后的决策视图
 *
 * 不做（明确禁止）：
 *   ❌ full graph traversal
 *   ❌ multi-hop reasoning
 *   ❌ embedding similarity reasoning
 *   ❌ LLM-based judge
 *
 * 成功标志：
 *   - cluster score 出现明显差异（不再平均）
 *   - 结论从"平均"变成"主导"
 *   - 2~3 个 dominant clusters 自然浮现
 *
 * @phase decision-runtime / ag-4
 */

import { EvidenceCluster } from './evidence-cluster.js'
import { EvidenceGraph } from './evidence-graph.js'
import { EvidenceNode, EvidenceEdge } from './evidence-graph.js'

// ============================================================
// AG-4 输出结构
// ============================================================

export interface ScoredCluster extends EvidenceCluster {
  score: number             // 综合评分
  avgConfidence: number     // 平均节点置信度
  sizeWeight: number        // 规模权重
  dominance: number         // dominance score (0~1)
}

export interface CompressedEvidence {
  clusterId: string
  intent: string
  summary: string
  confidence: number
  evidenceCount: number
  avgConfidence: number
  representativeEvidence: Array<{
    title: string
    snippet: string
    type: string
    confidence: number
  }>
}

export interface ReasoningResult {
  intent: string
  totalEvidence: number
  reasoning: {
    topClusters: ScoredCluster[]        // 前 3 名簇
    compressedView: CompressedEvidence[] // 压缩后视图
    dominance: {
      primaryCluster: ScoredCluster | null
      secondaryCluster: ScoredCluster | null
      dominanceRatio: number            // 主簇 vs 次簇 的比分差距
    }
  }
}

// ============================================================
// 1. Cluster Scoring
// ============================================================

function scoreCluster(cluster: EvidenceCluster, graph: EvidenceGraph): ScoredCluster {
  // 找出该簇对应节点的置信度
  const clusterNodes = graph.nodes.filter(n => n.clusterId === cluster.clusterId)

  // 平均节点置信度
  const avgConfidence = clusterNodes.length > 0
    ? clusterNodes.reduce((sum, n) => sum + (n as any).confidence ?? 0.5, 0) / clusterNodes.length
    : 0.5

  // 规模权重（log 衰减，防止大簇无限支配）
  const sizeWeight = Math.log(cluster.evidences.length + 1) / Math.log(50)

  // dominance = 本簇证据占比
  const totalEvidence = graph.nodes.length
  const dominance = totalEvidence > 0 ? clusterNodes.length / totalEvidence : 0

  // 综合评分：avgConfidence(70%) + sizeWeight(30%)
  const score = avgConfidence * 0.7 + sizeWeight * 0.3

  return {
    ...cluster,
    score: Math.round(score * 1000) / 1000,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    sizeWeight: Math.round(sizeWeight * 1000) / 1000,
    dominance: Math.round(dominance * 1000) / 1000,
  }
}

// ============================================================
// 2. Evidence Compression
// ============================================================

function compressEvidence(topCluster: ScoredCluster, graph: EvidenceGraph): CompressedEvidence {
  // 找该簇的节点，取置信度最高的前 3 条
  const clusterNodes = graph.nodes
    .filter(n => n.clusterId === topCluster.clusterId)
    .sort((a, b) => ((b as any).confidence ?? 0) - ((a as any).confidence ?? 0))
    .slice(0, 3)

  return {
    clusterId: topCluster.clusterId,
    intent: topCluster.intent,
    summary: topCluster.centroid,
    confidence: topCluster.score,
    evidenceCount: topCluster.evidenceCount,
    avgConfidence: topCluster.avgConfidence,
    representativeEvidence: clusterNodes.map(n => ({
      title: n.title,
      snippet: n.snippet.substring(0, 120),
      type: n.type,
      confidence: (n as any).confidence ?? 0.5,
    })),
  }
}

// ============================================================
// 3. 主入口：Reasoning Pipeline
// ============================================================

export function reason(clusters: EvidenceCluster[], graph: EvidenceGraph): ReasoningResult {
  // Step 1: 评分所有簇
  const scored = clusters.map(c => scoreCluster(c, graph))

  // Step 2: 按分降序排列
  const ranked = scored.sort((a, b) => b.score - a.score)

  // Step 3: Top-3 簇
  const topClusters = ranked.slice(0, 3)

  // Step 4: 压缩视图
  const compressedView = topClusters.map(c => compressEvidence(c, graph))

  // Step 5: 主导分析
  const primary = topClusters[0] ?? null
  const secondary = topClusters[1] ?? null
  const dominanceRatio = primary && secondary
    ? (primary.score / (secondary.score || 0.001))
    : 1

  return {
    intent: primary?.intent || 'general',
    totalEvidence: graph.nodes.length,
    reasoning: {
      topClusters,
      compressedView,
      dominance: {
        primaryCluster: primary,
        secondaryCluster: secondary,
        dominanceRatio: Math.round(dominanceRatio * 100) / 100,
      },
    },
  }
}
