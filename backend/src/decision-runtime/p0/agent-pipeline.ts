/**
 * agent-pipeline.ts — Phase AG-3: Agent Pipeline + Evidence Graph
 *
 * ═══════════════════════════════════════════════════════════════
 * 编排 6 个 Agent 的确定性执行流 + EG (Evidence Graph)
 *
 * AG-2.1 改动:
 *   - evidence 类型改为 UniversalEvidence（极简）
 *   - evidence.agent 为 pass-through
 *   - scoring 只读 title + snippet
 *
 * AG-3 改动:
 *   - evidence graph 构建（仅在 metrics 侧暴露，不阻塞 pipeline）
 *
 * 铁律:
 *   1. decision 路径必须确定性（可复现）
 *   2. LLM 只参与 report 叙事层（可选）
 *   3. U-2 / L0 / seed 系统不受影响
 *
 * @phase decision-runtime / ag-3
 */

import { requirementAgent } from '../agents/core/requirement.agent.js'
import { searchAgent } from '../agents/core/search.agent.js'
import { evidenceAgent } from '../agents/core/evidence.agent.js'
import { scoringAgent } from '../agents/core/scoring.agent.js'
import { recommendationAgent } from '../agents/core/recommendation.agent.js'
import { reportAgent } from '../agents/core/report.agent.js'
import type { UniversalEvidence } from '../agents/core/universal-evidence.js'
import type { EvidenceCluster } from '../agents/core/evidence-cluster.js'
import { refineEvidence } from '../agents/core/evidence-refinement.js'
import { clusterEvidence } from '../agents/core/evidence-cluster.js'
import { seedRerank } from '../agents/core/seed-rerank.js'
import { DEFAULT_SEEDS } from './u0-seed-schema.js'
import { filterEvidence } from '../agents/core/relevance-filter.js'
import type { RelevanceFilterResult } from '../agents/core/relevance-filter.js'
import { coverageCompensate } from '../agents/core/coverage-compensation.js'
import type { CoverageCompensationResult } from '../agents/core/coverage-compensation.js'
import { createCompensationState, shouldCompensate, computeAllowedQueries, advanceCompensation, computeStabilitySignal } from '../agents/core/budget-controller.js'
import type { CompensationState, StabilitySignal } from '../agents/core/budget-controller.js'
import type { EvidenceGraph } from '../agents/core/evidence-graph.js'
import { buildEvidenceGraph } from '../agents/core/evidence-graph.js'
import { buildWeightedGraph } from '../agents/core/graph-weighting.js'
import { reason } from '../agents/core/reasoning-layer.js'
import type { ReasoningResult } from '../agents/core/reasoning-layer.js'
import { explain } from '../agents/core/explanation-binding.js'
import type { ExplainableReasoning } from '../agents/core/explanation-binding.js'
import { runCrossClusterInteraction } from '../agents/core/cross-cluster-interaction.js'
import type { AG5Output } from '../agents/core/cross-cluster-interaction.js'
import { evaluateGeometry } from '../evaluation/geometry-engine.js'
import type {
  DecisionProblem,
  ReasoningFrame,
  ContractCandidate,
  EvaluationScoreCard,
  ContractRecommendation,
  ContractDecisionReport,
} from '../cognition/agent-contract.js'

// ============================================================
// Pipeline 输出
// ============================================================

export interface AgentPipelineResult {
  decisionPath: {
    problem: DecisionProblem
    queries: string[]
    evidences: UniversalEvidence[]
    clusters: EvidenceCluster[]   // AG-2.3
    candidates: ContractCandidate[]
    scoreCards: EvaluationScoreCard[]
    recommendation: ContractRecommendation
  }
  report?: ContractDecisionReport | null
  metrics: {
    searchCount: number
    evidenceCount: number
    clusterCount: number           // AG-2.3
    candidateCount: number
    evaluationAxes: number
    durationMs: number
    dominanceRatio: number            // AG-4 主导比分
    coverageGap: boolean              // AG-2.5
    coverageCompensations: number     // AG-2.5
    adjustedConfidence: number        // AG-2.5
    stabilityCompensationDepth: number // AG-2.6
    stabilityExhausted: boolean        // AG-2.6
    // P1.3 Geometry Metrics
    frontierSize: number
    frontierRatio: number
    frontierDensity: number
    dominanceRatioGeometry: number
    scoreEntropy: number
    axisAverages: number[]
    axisStdDevs: number[]
  }
  graph: EvidenceGraph                // AG-3
  reasoning: ReasoningResult           // AG-4
  explanation: ExplainableReasoning    // AG-4.1
  coverage: CoverageCompensationResult // AG-2.5
  interaction: AG5Output               // AG-5
  geometry: import('../evaluation/geometry-engine.js').GeometryResult  // P1.3
}

// ============================================================
// QueryContext — 外部注入层（P0.10: Evidence Propagation）
// seed 从"装饰层"升级为"Query Bias Layer"
// ============================================================

export interface QueryContext {
  query: string
  seed?: string | null
  domain?: string | null
}

// ============================================================
// Pipeline 编排器
// ============================================================

export class AgentPipeline {
  async execute(ctx: QueryContext): Promise<AgentPipelineResult> {
    const query = ctx.query
    const startTime = Date.now()

    // Step 1: 需求分析（带 seed bias）
    const problem: DecisionProblem = requirementAgent.analyze(query)
    const queries: string[] = requirementAgent.generateSearchQueries(problem, {
      seed: ctx.seed ?? undefined,
      domain: ctx.domain ?? undefined,
    })

    // ===== P1.2: Seed Re-ranking Injection =====
    // seed 不生成/替换 query，只对 candidates 做 ranking bias
    const matchedSeed = ctx.seed ? DEFAULT_SEEDS.find(s => s.id === ctx.seed) : null
    const rankedQueries = seedRerank(queries, matchedSeed)
    console.log(`[P1.2] seedId=${ctx.seed || 'none'} queries=${queries.length}→${rankedQueries.length} order=${rankedQueries.slice(0,3).join('|')}`)

    // Step 2: 搜索（Bing multi-variant）
    const searchRequirement = {
      problem,
      frame: null as any,
      searchQueries: rankedQueries,
      targetTypes: [problem.domain],
    }
    const evidences: UniversalEvidence[] = await searchAgent.search(searchRequirement)

    // Step 3: 证据处理（AG-2.1: pass-through）
    const frame: ReasoningFrame = this.buildFrame(problem)
    const filteredEvidences = evidenceAgent.evaluate(evidences, frame)

    // Step 3.5: Evidence Relevance Filter（AG-2.4 — 在 clustering 之前净化输入）
    const { kept: relevantEvidences, stats: filterStats } = filterEvidence(query, filteredEvidences)
    console.log(`[AgentPipeline] 过滤: ${filterStats.kept}/${filterStats.total} 条保留 (阈值>0.2, avgRel=${filterStats.avgRelevance})`)

    // Step 3.75: Coverage Compensation（AG-2.5 + AG-2.6 预算控制）
    const coverageResult = coverageCompensate(query, 0.5, relevantEvidences, problem)
    let finalEvidences = [...relevantEvidences]
    let coverageApplied = false
    const compensationState = createCompensationState()

    if (coverageResult.hasGap && shouldCompensate(compensationState)) {
      const candidateQueries = coverageResult.compensations.map(c => c.query)
      const budgetAdvice = advanceCompensation(compensationState, candidateQueries)

      if (budgetAdvice.allowed && budgetAdvice.queries.length > 0) {
        console.log(`[AgentPipeline] 补偿轮${compensationState.round}: ${budgetAdvice.queries.length} 条查询 (预算内)`)

        const extraSearchReq: SearchRequirement = {
          problem: { ...problem, intent: problem.intent },
          frame: null as any,
          searchQueries: budgetAdvice.queries,
          targetTypes: [problem.domain],
        }
        const extraEvidences: UniversalEvidence[] = await searchAgent.search(extraSearchReq)
        const { kept: extraFiltered } = filterEvidence(query, extraEvidences)
        finalEvidences = [...relevantEvidences, ...extraFiltered]
        coverageApplied = true
        console.log(`[AgentPipeline] 补偿后合计: ${finalEvidences.length} 条 (稳定信号: 深度=${compensationState.round}, 耗尽=${compensationState.exhausted})`)
      }
    }

    const stabilitySignal = computeStabilitySignal(compensationState, coverageApplied ? finalEvidences.length - relevantEvidences.length : 0, finalEvidences.length)

    // Step 3.9: Evidence Refinement（AG-6.0 — 在聚类前精炼证据）
    const refinedEvidences = refineEvidence(query, finalEvidences.map(ev => ({
      title: ev.title || '',
      snippet: ev.snippet || '',
      url: ev.url,
      source: ev.source,
    })), problem.domain)

    // AG-6.0 覆盖原始 evidences——标记被丢弃的证据
    // 使用 snippet + title 的近似匹配
    const refinementScore = new Map<string, number>()  // snippet → score
    for (const ref of refinedEvidences) {
      refinementScore.set(ref.snippet, ref.relevanceScore)
    }
    let keptCount = 0
    for (const ev of finalEvidences) {
      // 直接匹配
      let score = refinementScore.get(ev.snippet)
      if (score === undefined) {
        // 近似匹配
        const match = refinedEvidences.find(ref =>
          ev.snippet.includes(ref.snippet) || ref.snippet.includes(ev.snippet) ||
          ev.title.includes(ref.title)
        )
        score = match ? match.relevanceScore : 0.3  // 默认低分但不为0
      }
      (ev as any).relevanceScore = score
      if (score > 0.25) keptCount++
    }

    // 安全网：如果 AG-6.0 过滤后证据为 0，使用全部证据
    const clusterableEvidences = keptCount > 0
      ? finalEvidences.filter(ev => (ev as any).relevanceScore > 0.25)
      : finalEvidences

    console.log(`[AgentPipeline] AG-6.0 精炼: ${finalEvidences.length} 条 → ${clusterableEvidences.length} 条保留` +
      (keptCount === 0 ? ' (安全网激活，使用全部证据)' : ''))

    // Step 4: Evidence Clustering（AG-2.3）
    const clusters = clusterEvidence(clusterableEvidences)

    // Step 4: 候选提取 + 评分
    const candidates: ContractCandidate[] = this.extractCandidates(problem, finalEvidences)
    const scoredCandidates: ContractCandidate[] = []
    for (const candidate of candidates) {
      const scoreCard = scoringAgent.score(candidate, finalEvidences, frame)
      scoredCandidates.push({ ...candidate, scoreCard })
    }

    // ========== P1.3: Evaluation Geometry ==========
    // 将 scoredCandidates 转为 CandidateInfo[]
    const candidateInfos = scoredCandidates.map(c => ({
      id: c.id,
      label: c.name,
      score: c.scoreCard
        ? c.scoreCard.axes.reduce((sum, ax) => sum + (ax.score ?? 0) * ((ax as any).weight ?? 1), 0) / (c.scoreCard.axes.length || 1)
        : (c.confidence ?? 0),
      evidenceCount: c.evidenceIds?.length || 0,
      evidences: c.evidenceIds?.map(eid => ({
        id: eid,
        text: eid,
        source: eid,
        score: 0.5,
        domain: problem.domain,
        intent: problem.intent,
      })) || [],
      domain: problem.domain,
      intent: problem.intent,
      clusterCount: clusters.length,
      clusterSize: clusters.length > 0 ? Math.max(1, Math.floor(clusters.length / Math.max(1, scoredCandidates.length))) : 1,
    }))

    const geometryResult = evaluateGeometry(candidateInfos)
    console.log(`[P1.3] Geometry: frontier=${geometryResult.metrics.frontierSize}/${geometryResult.metrics.totalCandidates} ` +
      `density=${geometryResult.metrics.frontierDensity.toFixed(3)} entropy=${geometryResult.metrics.scoreEntropy.toFixed(3)} ` +
      `rec=${geometryResult.recommended?.label || 'none'} alt=${geometryResult.alternative?.label || 'none'}`)

    // Step 5: 推荐（Geometry-aware）
    const recommendation: ContractRecommendation = recommendationAgent.geometryRecommend(scoredCandidates, problem, geometryResult)

    // Step 6: 报告（确定性模板）
    const report: ContractDecisionReport = reportAgent.generate({
      problem,
      frame,
      candidates: scoredCandidates,
      recommendation,
    })

    // Step 7: Evidence Graph（AG-3 + AG-3.1 加权）
    const graph = buildWeightedGraph(clusters)
    console.log(`[AgentPipeline] 图构建: ${graph.nodes.length} nodes, ${graph.edges.length} edges` +
      ` (supports=${graph.stats.supportsEdges}, conflicts=${graph.stats.conflictsEdges}, softConflicts=..., duplicates=${graph.stats.duplicatesEdges})` +
      ` | avgConf=${(graph.stats as any).avgConfidence}`)

    // Step 8: Reasoning Layer（AG-4 轻量版）
    const reasoning = reason(clusters, graph)
    console.log(`[AgentPipeline] 推理: ${reasoning.reasoning.topClusters.length} 主导簇` +
      ` | primary=${reasoning.reasoning.dominance.primaryCluster?.clusterId}' (score=${reasoning.reasoning.dominance.primaryCluster?.score})` +
      ` | dominanceRatio=${reasoning.reasoning.dominance.dominanceRatio}`)

    // Step 9: Explanation Binding（AG-4.1）
    const explanation = explain(query, clusters, graph, reasoning, filteredEvidences)
    console.log(`[AgentPipeline] 解释: confidenceLabel=${explanation.confidenceLabel}` +
      ` | dominant=${explanation.dominantCluster?.clusterId}(${(explanation.dominantCluster?.score ?? 0) * 100}分)`)

    // Step 10: Cross-Cluster Interaction（AG-5）
    const scoredClusters = reasoning.reasoning.topClusters
    const interaction = runCrossClusterInteraction(scoredClusters)
    console.log(`[AgentPipeline] AG-5: ${interaction.interactionSummary}`)

    const durationMs = Date.now() - startTime

    return {
      decisionPath: {
        problem,
        queries,
        evidences: finalEvidences,
        clusters,
        candidates: scoredCandidates,
        scoreCards: scoredCandidates.map(c => c.scoreCard!).filter(Boolean),
        recommendation,
      },
      report,
      metrics: {
        searchCount: queries.length,
        evidenceCount: finalEvidences.length,
        clusterCount: clusters.length,
        candidateCount: scoredCandidates.length,
        evaluationAxes: frame.evaluationAxes.length,
        durationMs,
        dominanceRatio: reasoning.reasoning.dominance.dominanceRatio,
        coverageGap: coverageResult.hasGap,
        coverageCompensations: coverageResult.compensations.length,
        adjustedConfidence: coverageResult.adjustedConfidence,
        coverageConfidence: coverageResult.coverageConfidence,
        stabilityCompensationDepth: stabilitySignal.compensationDepth,
        stabilityExhausted: stabilitySignal.exhausted,
        // P1.3 Geometry Metrics
        frontierSize: geometryResult.metrics.frontierSize,
        frontierRatio: geometryResult.metrics.frontierRatio,
        frontierDensity: geometryResult.metrics.frontierDensity,
        dominanceRatioGeometry: geometryResult.metrics.dominanceRatio,
        scoreEntropy: geometryResult.metrics.scoreEntropy,
        axisAverages: geometryResult.metrics.axisAverages,
        axisStdDevs: geometryResult.metrics.axisStdDevs,
      },
      graph,
      reasoning,
      explanation,
      coverage: coverageResult,
      interaction,
      // P1.3: Geometry result passed to gateway for telemetry
      geometry: geometryResult,
    }
  }

  private buildFrame(problem: DecisionProblem): ReasoningFrame {
    const { getDefaultAxisWeights } = require('../cognition/reasoning-frame.js')
    const axes = getDefaultAxisWeights(problem.domain as any)
    return {
      facts: [],
      assumptions: [],
      uncertainties: [],
      evaluationAxes: axes,
    }
  }

  private extractCandidates(problem: DecisionProblem, evidences: UniversalEvidence[]): ContractCandidate[] {
    const candidateMap = new Map<string, { name: string; evidenceIds: string[] }>()

    for (const ev of evidences) {
      if (!ev.url) continue
      try {
        const urlObj = new URL(ev.url)
        const domain = urlObj.hostname.replace('www.', '')

        if (!candidateMap.has(domain)) {
          candidateMap.set(domain, { name: domain, evidenceIds: [] })
        }
        candidateMap.get(domain)!.evidenceIds.push(ev.url!)
      } catch {
        // 跳过无法解析 URL 的证据
      }
    }

    return Array.from(candidateMap.entries()).map(([domain, info]) => ({
      id: `cand-${domain.replace(/[^a-z0-9]/g, '-')}`,
      name: domain,
      type: problem.domain,
      description: `${domain} — ${info.evidenceIds.length} 条相关证据`,
      evidenceIds: info.evidenceIds,
    }))
  }
}

export const agentPipeline = new AgentPipeline()
