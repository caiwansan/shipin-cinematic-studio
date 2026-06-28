/**
 * p0-gateway-route.ts — P-0 Gateway API Route
 *
 * ⚡ Phase AG-1: 接入 Agent Pipeline（确定性决策链路）
 *
 * 调用链路：
 *   Client → P-0 Gateway → Agent Pipeline (6 agents)
 *     → LLM (可选，只做 report narrative 增强)
 *
 *   Agent Pipeline:
 *     requirement.agent → search.agent (Bing)
 *     → evidence.agent → scoring.agent
 *     → recommendation.agent → report.agent
 *
 * 铁律：
 *   1. 决策路径完全确定性（可审计、可回放）
 *   2. LLM 仅用于 Report Narrative（可选），不参与决策
 *   3. U-2 / L0 / seed 系统不受影响
 */

import { FastifyInstance } from 'fastify'
import { P0Runtime } from '../decision-runtime/p0/p0-runtime.js'
import type { P0Request, P0Response } from '../decision-runtime/p0/p0-runtime.js'
import { DEFAULT_SEEDS } from '../decision-runtime/p0/u0-seed-schema.js'
import { UniverseSeeder, universeSeeder } from '../decision-runtime/p0/universe-seeder.js'
import { createHash } from 'node:crypto'
import { executeLLM } from '../decision-runtime/p0/p0-llm-executor.js'
import { agentPipeline } from '../decision-runtime/p0/agent-pipeline.js'

let runtime: P0Runtime | null = null

async function getRuntime(): Promise<P0Runtime> {
  if (runtime) return runtime

  const { ScopeRegistry } = await import('../decision-runtime/invocation/e0-boundary-audit.js')
  const seeded = universeSeeder.seed(DEFAULT_SEEDS)

  const seedProofMap = new Map<string, any>()
  for (const seed of DEFAULT_SEEDS) {
    const proof = seeded.universe.getProofs().find(p =>
      p.frameInvariant.signature === `SEED-${Math.abs(hashId(seed.id)).toString(16).padStart(8, '0')}`
    )
    if (proof) {
      seedProofMap.set(seed.id, proof)
    }
  }

  const scopeDef = {
    systemName: 'Kunlun Mirror — Life Assistant',
    systemVersion: '1.0.0-u1',
    createdAt: Date.now(),
    systemIdentity: 'Life assistant powered by deterministic agent pipeline + U-1 seed matching',
    allowedDomains: [
      { id: 'daily-life', name: '日常生活', description: '日常问题咨询', allowedPatterns: ['生活', '建议', '推荐', '评价', '怎么样', '如何', '好不', '值得', 'help', 'advice', 'recommend', 'how', 'what', 'should', '手机', '电脑', '华为', '苹果', '健身', '运动', '跑步', '健身', '减肥', '电影', '书', '读', '吃', '饮食', '耳机', '笔记本', '什么', '哪个', '有哪些', '对比', '区别', '值得买', '靠谱', '好用'], exampleQueries: ['这个手机怎么样？', '推荐一本书', '如何选择？'] },
      { id: 'business-intel', name: '企业信息', description: '企业查询', allowedPatterns: ['公司', '企业', '企业信息', '业务', 'company', 'business', 'enterprise', '靠谱吗', '背景', '品牌'], exampleQueries: ['这家公司靠谱吗？'] },
    ],
    forbiddenDomains: [
      { id: 'personal-privacy', name: '隐私', description: '个人信息', reason: '系统不处理个人隐私数据', allowedPatterns: ['隐私', '密码', '银行卡', '身份证', '我的密码', '我的账号'], exampleQueries: ['我的密码是什么？'] },
      { id: 'medical', name: '医疗', description: '医疗诊断', reason: '系统不是医疗设备', allowedPatterns: ['诊断', '症状', '治疗', '药物', '疾病', '医生', '医院', '手术', '药'], exampleQueries: ['这个症状是什么病？'] },
      { id: 'illegal', name: '非法', description: '非法活动', reason: '系统不参与非法活动', allowedPatterns: ['黑客', '入侵', '破解', '盗取', '作弊', '翻墙'], exampleQueries: ['如何入侵一个系统？'] },
    ],
    unspecifiedBehavior: 'best_effort' as const,
    scopeSignature: 'SCOPE-P0-U1-001',
  }

  const scopeRegistry = new ScopeRegistry(scopeDef as any)
  runtime = new P0Runtime({
    scopeRegistry,
    universe: seeded.universe,
    anchor: seeded.anchors[0],
    proofs: seeded.universe.getProofs() as any[],
  })
  runtime.shadow.setSeedProofMap(seedProofMap)

  return runtime
}

function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// ============================================================
// L0 Cache
// ============================================================

interface L0CacheEntry {
  response: Record<string, any>
  ts: number
}

const l0Cache = new Map<string, L0CacheEntry>()
const L0_MAX_ENTRIES = 500
let l0CacheHits = 0
let l0CacheTotal = 0

function makeCacheKey(seedId: string): string {
  return seedId || 'none'
}

function getCacheHitRate(): { hits: number; total: number; rate: number } {
  const total = l0CacheTotal
  return {
    hits: l0CacheHits,
    total,
    rate: total > 0 ? Math.round(l0CacheHits / total * 10000) / 100 : 0,
  }
}

// ============================================================
// LLM Narrative — 只负责将 agent pipeline 结果写成自然语言
// 不参与决策，不修改评分/排序
// ============================================================

async function llmNarrative(query: string, pipelineResult: any, seedInfo: any): Promise<{
  content: string
  provider: string | null
}> {
  const { decisionPath, metrics } = pipelineResult
  const { problem, evidences, clusters, candidates, recommendation, scoreCards } = decisionPath

  // 构建 LLM prompt，只要求它"把事实写成自然语言"
  const narrativePrompt = `
请将以下决策分析结果改写成流畅自然的中文回答。

## 用户提问
${query}

## 系统分析结果

### 需求解析
- 领域: ${problem.domain}
- 意图: ${problem.intent}
- 约束: ${problem.constraints.join(', ') || '无'}
- 目标: ${problem.objectives.join(', ') || '无'}

### 搜索结果（${evidences.length} 条来源，${clusters.length} 个语义簇）
${clusters.map((c: any, i: number) => `簇${i + 1} [${c.clusterId}] ${c.evidenceCount} 条 — 例如: ${c.centroid?.substring(0, 60)}`).join('\n')}

### 详细搜索结果
${evidences.slice(0, 12).map((e: any, i: number) => `${i + 1}. [${e.url || e.source}] ${e.snippet.substring(0, 150)}`).join('\n')}

### 评分排名
${recommendation.rankedCandidateIds.slice(0, 10).map((id: string, idx: number) => {
  const c = candidates.find((c: any) => c.id === id)
  if (!c || !c.scoreCard) return `${idx + 1}. ${id}`
  const card = c.scoreCard
  return `${idx + 1}. **${c.name}** — 总分: ${card.total}/100\n${card.axes.map((ax: any) => `  - ${ax.axisName}: ${ax.score}/100`).join('\n')}`
}).join('\n\n')}

### 证据聚类总结
${pipelineResult.reasoning.reasoning.compressedView.map((cv: any, i: number) => {
  return `簇${i + 1} [${cv.clusterId}] ${cv.evidenceCount} 条 | 置信度 ${(cv.confidence * 100).toFixed(0)}% | 代表: ${cv.summary.substring(0, 60)}`
}).join('\n')}

### 信息覆盖度
- 结构化信息覆盖: ${pipelineResult.coverage.structuredRatio > 0.3 ? '充足' : '不足'}
${pipelineResult.coverage.hasGap ? '- 已触发补偿查询, 追加搜索了补充信息' : ''}
${pipelineResult.coverage.hasGap ? '- 置信度已根据覆盖度降级调整' : ''}
${pipelineResult.metrics.coverageConfidence > 0.2 ? '- 覆盖置信度判断: **真实信息缺口(True Gap)**' : pipelineResult.coverage.hasGap ? '- 覆盖置信度判断: 低置信但已足够, 补偿可能过度' : ''}
${pipelineResult.metrics.coverageConfidence <= 0.2 && pipelineResult.coverage.hasGap ? '- 建议: 放宽Coverage Gap判定阈值' : ''}

### 跨簇交互
- ${pipelineResult.interaction.edges.length} 条簇间关系
${pipelineResult.interaction.edges.filter(e => e.relation === 'diverge').length > 0 ? `- ${pipelineResult.interaction.edges.filter(e => e.relation === 'diverge').length} 对互为分歧（互相压制）` : ''}
${pipelineResult.interaction.edges.filter(e => e.relation === 'reinforce').length > 0 ? `- ${pipelineResult.interaction.edges.filter(e => e.relation === 'reinforce').length} 对互为强化（互相提升）` : ''}
- Gini 集中度: ${pipelineResult.interaction.stability.giniCoefficient}

### 决策解释
${pipelineResult.explanation.decisionChain.slice(0, 3).map((dc: any, i: number) =>
  `第${i + 1}候选 (${dc.clusterId}): ${dc.reason.substring(0, 80)}`
).join('\n')}

### 风险提示
${recommendation.riskWarnings.map((w: any) => `- ${w}`).join('\n')}

### 建议
${recommendation.suggestedActions.map((a: any) => `- ${a}`).join('\n')}

## 要求
1. 用自然、流畅的中文回答用户问题
2. 优先给出前 3-5 名推荐
3. 如果搜索结果不足，如实告知"目前搜索到的信息有限"
4. 用简短段落 + 要点列表，不要用 markdown 表格
5. **不要编造搜索结果中没有的信息**
6. **不要修改评分排名顺序**
`.trim()

  try {
    const llmResult = await executeLLM(narrativePrompt, seedInfo)
    return { content: llmResult.content, provider: llmResult.provider }
  } catch {
    // LLM 失败时 fallback 到确定性报告
    const report = pipelineResult.report
    return {
      content: report ? report.content : '抱歉，系统暂时无法生成回答。',
      provider: null,
    }
  }
}

// ============================================================
// Routes
// ============================================================

export default async function p0GatewayRoutes(fastify: FastifyInstance) {
  // POST /api/p0/gateway — P-0 决策入口
  fastify.post('/api/p0/gateway', async (request, reply) => {
    const { query } = request.body as { query?: string }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        decision: '请输入有效问题',
        traceId: 'none',
        metrics: { stability: 0, fidelity: 0, consistency: 0, trustRate: 0 },
        error: 'EMPTY_QUERY',
      })
    }

    const p0 = await getRuntime()
    const p0req: P0Request = {
      tenantId: 'p0-life',
      query: query.trim(),
      source: 'life-assistant',
    }

    // Step 1: U-1 Seed Matching（原始的 shadow execution，不干扰 agent pipeline）
    const result: P0Response = p0.handleRequest(p0req)

    // Step 2: Agent Pipeline — 确定性决策链路（P0.10: seed bias injection）
    let pipelineResult
    try {
      pipelineResult = await agentPipeline.execute({
        query: query.trim(),
        seed: result.matchedSeed,
        domain: DEFAULT_SEEDS.find(s => s.id === result.matchedSeed)?.domain || null,
      })
    } catch (err: any) {
      console.error(`[P0] Agent pipeline 失败: ${err.message}`)
      // 如果 agent pipeline 失败，降级到原来的 LLM 直通
      try {
        const llmResult = await executeLLM(query.trim(), null)
        return {
          decision: llmResult.content,
          explanation: llmResult.content,
          confidence: 0.6,
          traceId: result.traceId,
          success: true,
          degraded: true,
          error: 'AGENT_PIPELINE_FAILED',
          matchedSeed: result.matchedSeed,
          matchScore: result.matchScore,
          matchLevel: result.matchLevel,
          metrics: result.metrics,
          llmProvider: llmResult.provider,
        }
      } catch {
        return {
          decision: '系统分析暂时不可用，请稍后重试。',
          explanation: '系统分析暂时不可用，请稍后重试。',
          confidence: 0,
          traceId: result.traceId,
          success: false,
          degraded: true,
          error: 'ALL_FAILED',
          matchedSeed: result.matchedSeed,
          matchScore: result.matchScore,
          matchLevel: result.matchLevel,
          metrics: result.metrics,
          llmProvider: null,
        }
      }
    }

    // Step 3: LLM Narrative（可选 — 只做语言表达，不做决策）
    const seedInfo = result.matchedSeed
      ? {
          matchedSeed: result.matchedSeed,
          matchLevel: result.matchLevel,
          domain: DEFAULT_SEEDS.find(s => s.id === result.matchedSeed)?.domain || '日常生活',
        }
      : null

    const narrativeResult = await llmNarrative(query.trim(), pipelineResult, seedInfo)

    // Step 4: 构造响应
    const responseBody = {
      decision: narrativeResult.content,
      explanation: narrativeResult.content,
      confidence: 0.85,
      traceId: result.traceId,
      success: true,
      degraded: narrativeResult.provider === null, // LLM narrative 失败 = 降级
      matchedSeed: result.matchedSeed,
      matchScore: result.matchScore,
      matchLevel: result.matchLevel,
      matchCandidates: result.matchCandidates ?? [],
      topSeedComponents: result.topSeedComponents ?? null,
      metrics: result.metrics,
      llmProvider: narrativeResult.provider,
      // 调试信息（可选 — 后续前端可展开）
      _pipeline: {
        searchQueries: pipelineResult.metrics.searchCount,
        evidenceCount: pipelineResult.metrics.evidenceCount,
        clusterCount: pipelineResult.metrics.clusterCount,
        candidateCount: pipelineResult.metrics.candidateCount,
        evaluationAxes: pipelineResult.metrics.evaluationAxes,
        durationMs: pipelineResult.metrics.durationMs,
        dominanceRatio: pipelineResult.metrics.dominanceRatio,
        coverageGap: pipelineResult.metrics.coverageGap,
        coverageCompensations: pipelineResult.metrics.coverageCompensations,
        coverageConfidence: pipelineResult.metrics.coverageConfidence ?? 0.5,
        adjustedConfidence: pipelineResult.metrics.adjustedConfidence,
        stabilityCompensationDepth: pipelineResult.metrics.stabilityCompensationDepth,
        stabilityExhausted: pipelineResult.metrics.stabilityExhausted,
        // P1.3 Geometry Metrics
        frontierSize: pipelineResult.metrics.frontierSize,
        frontierRatio: pipelineResult.metrics.frontierRatio,
        frontierDensity: pipelineResult.metrics.frontierDensity,
        dominanceRatioGeometry: pipelineResult.metrics.dominanceRatioGeometry,
        scoreEntropy: pipelineResult.metrics.scoreEntropy,
      },
      _geometry: pipelineResult.geometry ? {
        frontierSize: pipelineResult.geometry.metrics.frontierSize,
        frontierRatio: pipelineResult.geometry.metrics.frontierRatio,
        frontierDensity: pipelineResult.geometry.metrics.frontierDensity,
        dominanceRatio: pipelineResult.geometry.metrics.dominanceRatio,
        scoreEntropy: pipelineResult.geometry.metrics.scoreEntropy,
        recommended: pipelineResult.geometry.recommended ? {
          id: pipelineResult.geometry.recommended.candidateId,
          label: pipelineResult.geometry.recommended.label,
          vector: pipelineResult.geometry.recommended.values,
        } : null,
        alternative: pipelineResult.geometry.alternative ? {
          id: pipelineResult.geometry.alternative.candidateId,
          label: pipelineResult.geometry.alternative.label,
          vector: pipelineResult.geometry.alternative.values,
        } : null,
        frontier: pipelineResult.geometry.frontier.frontier.map(v => ({
          id: v.candidateId,
          label: v.label,
          vector: v.values,
        })),
        axisAverages: pipelineResult.geometry.metrics.axisAverages,
        axisStdDevs: pipelineResult.geometry.metrics.axisStdDevs,
      } : null,
      _graph: {
        nodeCount: pipelineResult.graph.stats.nodeCount,
        edgeCount: pipelineResult.graph.stats.edgeCount,
        avgConfidence: (pipelineResult.graph.stats as any).avgConfidence,
        conflicts: pipelineResult.graph.stats.conflictsEdges,
        duplicates: pipelineResult.graph.stats.duplicatesEdges,
      },
      _reasoning: {
        primaryCluster: pipelineResult.reasoning.reasoning.dominance.primaryCluster?.clusterId,
        primaryScore: pipelineResult.reasoning.reasoning.dominance.primaryCluster?.score,
        dominanceRatio: pipelineResult.reasoning.reasoning.dominance.dominanceRatio,
        compressedClusters: pipelineResult.reasoning.reasoning.compressedView.map((cv: any) => ({
          clusterId: cv.clusterId,
          summary: cv.summary?.substring(0, 40),
          confidence: cv.confidence,
          evidenceCount: cv.evidenceCount,
        })),
      },
      _explanation: {
        confidenceLabel: pipelineResult.explanation.confidenceLabel,
        conclusion: pipelineResult.explanation.conclusion,
        decisionChain: pipelineResult.explanation.decisionChain.map((dc: any) => ({
          clusterId: dc.clusterId,
          rank: dc.rank,
          score: dc.score,
          reason: dc.reason.substring(0, 80),
          topEvidence: dc.representativeEvidence.slice(0, 2).map((ev: any) => ev.snippet.substring(0, 60)),
        })),
      },
      _interaction: {
        edgeCount: pipelineResult.interaction.edges.length,
        reinforceEdges: pipelineResult.interaction.edges.filter((e: any) => e.relation === 'reinforce').length,
        divergeEdges: pipelineResult.interaction.edges.filter((e: any) => e.relation === 'diverge').length,
        giniCoefficient: pipelineResult.interaction.stability.giniCoefficient,
        topHeaviness: pipelineResult.interaction.stability.topHeaviness,
        entropy: pipelineResult.interaction.stability.entropy,
        interactionSummary: pipelineResult.interaction.interactionSummary,
      },
      _recommendation: {
        rankedCandidates: pipelineResult.decisionPath.recommendation.rankedCandidateIds,
        reasoning: pipelineResult.decisionPath.recommendation.reasoning,
        riskWarnings: pipelineResult.decisionPath.recommendation.riskWarnings,
        geometry: pipelineResult.decisionPath.recommendation.geometry ?? null,
      },
    }

    // L0 Cache
    const matchedSeedId = result.matchedSeed ?? null
    const cacheKey = matchedSeedId ? makeCacheKey(matchedSeedId) : null
    l0CacheTotal++
    if (cacheKey) {
      const cached = l0Cache.get(cacheKey)
      if (cached) {
        l0CacheHits++
        return { ...cached.response }
      }
      l0Cache.set(cacheKey, { response: responseBody, ts: Date.now() })
      if (l0Cache.size > L0_MAX_ENTRIES) {
        const oldest = [...l0Cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
        if (oldest) l0Cache.delete(oldest[0])
      }
    }

    return responseBody
  })

  // GET /api/p0/status
  fastify.get('/api/p0/status', async () => {
    const p0 = await getRuntime()
    const stats = (await import('../decision-runtime/p0/u0-seed-schema.js')).getSeedStats()
    return {
      status: 'running',
      systemIdentity: 'U-1 Seeded Universe + Agent Pipeline — Life Assistant',
      version: '1.0.0-ag1',
      totalSeeds: stats.total,
      seedDomains: stats.byDomain,
      totalQueries: p0.sink.getTraceCount(),
      trustRate: p0.sink.getSummary().trustRate ?? 0,
    }
  })

  // GET /api/p0/cache-status — L0 Cache 状态
  fastify.get('/api/p0/cache-status', async () => {
    const { hits, total, rate } = getCacheHitRate()
    return {
      cacheSize: l0Cache.size,
      cacheHits: hits,
      cacheTotal: total,
      cacheHitRate: rate,
      maxEntries: L0_MAX_ENTRIES,
      timestamp: Date.now(),
    }
  })

  // GET /api/p0/coverage — U-2 覆盖率仪表盘
  fastify.get('/api/p0/coverage', async () => {
    const { coverageTracker } = await import('../decision-runtime/p0/u2-coverage-tracker.js')
    const { DEFAULT_SEEDS } = await import('../decision-runtime/p0/u0-seed-schema.js')
    ;(coverageTracker as any).loadSeedSchema = () => DEFAULT_SEEDS.map(s => ({ id: s.id, domain: s.domain, state: 'ACTIVE' }))
    const metrics = coverageTracker.getMetrics()
    return {
      metrics: {
        totalQueries: metrics.totalQueries,
        matchedQueries: metrics.matchedQueries,
        fallbackQueries: metrics.fallbackQueries,
        coverageRate: Math.round(metrics.coverageRate * 100),
        fallbackRate: Math.round(metrics.fallbackRate * 100),
        strongMatchRate: Math.round(metrics.strongMatchRate * 100),
      },
      seedCoverage: metrics.seedCoverage.map(s => ({
        seedId: s.seedId, hitCount: s.hitCount, strongCount: s.strongCount, acceptableCount: s.acceptableCount, weakCount: s.weakCount,
        strongRate: `${(s.strongRate * 100).toFixed(0)}%`, acceptableRate: `${(s.acceptableRate * 100).toFixed(0)}%`,
        avgScore: s.avgScore, nearMissCount: s.nearMissCount, state: s.state ?? 'ACTIVE', domain: s.domain ?? '',
        shareOfMatched: `${(s.shareOfMatched * 100).toFixed(1)}%`, shareOfTotal: `${(s.shareOfTotal * 100).toFixed(1)}%`,
        firstHitAt: s.firstHitAt, lastHitAt: s.lastHitAt,
      })),
      topSeeds: metrics.topSeeds,
      timestamp: Date.now(),
    }
  })

  // GET /api/p0/seed-stats
  fastify.get('/api/p0/seed-stats', async () => {
    const { coverageTracker } = await import('../decision-runtime/p0/u2-coverage-tracker.js')
    const { DEFAULT_SEEDS } = await import('../decision-runtime/p0/u0-seed-schema.js')
    ;(coverageTracker as any).loadSeedSchema = () => DEFAULT_SEEDS.map(s => ({ id: s.id, domain: s.domain, state: (s as any).state ?? 'ACTIVE' }))
    const metrics = coverageTracker.getMetrics()
    return {
      seeds: metrics.seedCoverage.map(s => ({ ...s, strongRate: Math.round(s.strongRate * 100), acceptableRate: Math.round(s.acceptableRate * 100), shareOfMatched: `${(s.shareOfMatched * 100).toFixed(1)}%`, shareOfTotal: `${(s.shareOfTotal * 100).toFixed(1)}%` })),
      totalSeeds: DEFAULT_SEEDS.length,
      timestamp: Date.now(),
    }
  })

  // GET /api/p0/near-misses
  fastify.get('/api/p0/near-misses', async () => {
    const { coverageTracker } = await import('../decision-runtime/p0/u2-coverage-tracker.js')
    const nearMisses = coverageTracker.getAllNearMissQueries(0.3)
    return { count: nearMisses.length, queries: nearMisses.slice(0, 50), timestamp: Date.now() }
  })

  // GET /api/p0/fallback-pool
  fastify.get('/api/p0/fallback-pool', async () => {
    const { coverageTracker } = await import('../decision-runtime/p0/u2-coverage-tracker.js')
    const metrics = coverageTracker.getMetrics()
    return {
      total: metrics.fallbackQueries,
      clusters: metrics.fallbackClusters.slice(0, 30).map((c: any) => ({ clusterKey: c.clusterKey, count: c.count, examples: c.examples.slice(0, 5), candidateSeed: c.candidateSeedId })),
      topFallbackQueries: metrics.topFallbackQueries,
      details: metrics.topFallbackQueries.map((fb: any) => ({ query: fb.query, count: fb.count, replayUrl: `/api/p0/gateway` })),
      timestamp: Date.now(),
    }
  })
}
