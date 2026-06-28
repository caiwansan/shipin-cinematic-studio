/**
 * explanation-binding.ts — Phase AG-4.1: Explanation Binding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 把 "决策结果" 绑定回 "证据路径"，实现可解释推理链
 *
 * 核心升级：
 *   1. ClusterDecisionTrace — 每条决策的来源可追溯
 *   2. Explainable Reasoning Output — 附加 "选择理由"
 *   3. Evidence Path Binding — 主导簇 → 代表性证据 → 原始来源 URL
 *
 * 不做：
 *   ❌ multi-hop reasoning
 *   ❌ contradiction resolution
 *   ❌ embedding reasoning
 *   ❌ LLM judge
 *
 * 成功标志：
 *   - 每个结果可追溯 cluster score
 *   - 每个 cluster 可追溯 evidence
 *   - 可以回答 "为什么选这个"
 *
 * @phase decision-runtime / ag-4.1
 */

import { EvidenceCluster } from './evidence-cluster.js'
import { EvidenceGraph } from './evidence-graph.js'
import { ScoredCluster, CompressedEvidence, ReasoningResult } from './reasoning-layer.js'
import { UniversalEvidence } from './universal-evidence.js'

// ============================================================
// 1. Cluster Decision Trace
// ============================================================

export interface ClusterContribution {
  confidence: number      // 置信度贡献
  sizeWeight: number      // 规模贡献
  dominance: number       // 占比贡献
}

export interface EvidenceTrace {
  title: string
  snippet: string
  url: string
  type: string
  confidence: number
  sourceClusterId: string
}

export interface ClusterDecisionTrace {
  clusterId: string
  intent: string
  score: number
  rank: number
  contribution: ClusterContribution
  reason: string              // 自然语言解释：为何得分如此
  representativeEvidence: EvidenceTrace[]
}

// ============================================================
// 2. Explainable Reasoning Output
// ============================================================

export interface ExplainableReasoning {
  query: string
  intent: string
  totalEvidence: number
  totalClusters: number
  
  /** 主导决策追踪 */
  dominantCluster: ClusterDecisionTrace | null
  
  /** 完整决策链（所有簇的排序 + 解释） */
  decisionChain: ClusterDecisionTrace[]
  
  /** 最终结论摘要 */
  conclusion: string
  
  /** 置信度标签 */
  confidenceLabel: 'high' | 'medium' | 'low'
}

// ============================================================
// 辅助函数
// ============================================================

function buildReason(cluster: ScoredCluster): string {
  const parts: string[] = []
  parts.push(`置信度贡献 ${(cluster.avgConfidence * 100).toFixed(0)}%`)
  parts.push(`规模权重 ${(cluster.sizeWeight * 100).toFixed(0)}%`)
  parts.push(`证据占比 ${(cluster.dominance * 100).toFixed(0)}%`)
  
  let reason = `簇 "${cluster.clusterId}" (${cluster.intent}) 综合评分 ${(cluster.score * 100).toFixed(1)}分，`
  reason += `含 ${cluster.evidenceCount} 条证据。`
  reason += `\n  - ${parts.join('\n  - ')}`
  
  return reason
}

function buildConclusion(topClusters: ScoredCluster[]): string {
  if (topClusters.length === 0) return '无有效证据簇'
  const top = topClusters[0]
  return `基于 ${top.clusterId} 簇（${top.evidenceCount} 条证据，置信度 ${(top.score * 100).toFixed(0)}%）` +
    `主导决策，辅以其他 ${topClusters.length - 1} 簇交叉验证。`
}

function computeConfidenceLabel(topScore: number): 'high' | 'medium' | 'low' {
  if (topScore >= 0.8) return 'high'
  if (topScore >= 0.6) return 'medium'
  return 'low'
}

function buildEvidenceTraces(
  cluster: ScoredCluster,
  allEvidences: UniversalEvidence[],
  graphNodes: any[]
): EvidenceTrace[] {
  // 从 cluster 中取前 3 条证据
  return cluster.evidences.slice(0, 3).map(ev => ({
    title: ev.title,
    snippet: ev.snippet.substring(0, 120),
    url: ev.url || '(无 URL)',
    type: graphNodes.find((n: any) => n.title === ev.title)?.type || 'unknown',
    confidence: graphNodes.find((n: any) => n.title === ev.title)?.confidence ?? 0.5,
    sourceClusterId: cluster.clusterId,
  }))
}

// ============================================================
// 3. 主入口：Explainable Reasoning Pipeline
// ============================================================

export function explain(
  query: string,
  clusters: EvidenceCluster[],
  graph: EvidenceGraph,
  reasoning: ReasoningResult,
  allEvidences: UniversalEvidence[]
): ExplainableReasoning {
  const topClusters = reasoning.reasoning.topClusters
  
  // 构建决策链
  const decisionChain: ClusterDecisionTrace[] = topClusters.map((c, i) => ({
    clusterId: c.clusterId,
    intent: c.intent,
    score: c.score,
    rank: i + 1,
    contribution: {
      confidence: c.avgConfidence,
      sizeWeight: c.sizeWeight,
      dominance: c.dominance,
    },
    reason: buildReason(c),
    representativeEvidence: buildEvidenceTraces(c, allEvidences, graph.nodes),
  }))

  return {
    query,
    intent: reasoning.intent,
    totalEvidence: reasoning.totalEvidence,
    totalClusters: clusters.length,
    dominantCluster: decisionChain[0] || null,
    decisionChain,
    conclusion: buildConclusion(topClusters),
    confidenceLabel: computeConfidenceLabel(topClusters[0]?.score ?? 0),
  }
}
