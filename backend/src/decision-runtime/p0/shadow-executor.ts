/**
 * shadow-executor.ts — Phase P-0 Shadow Execution Layer
 *
 * ============================================================
 * 影子执行层——只读执行 D-1 / D-2 / D-3
 *
 * 修正（2026-06-22）：
 *   主路径：U-0 seed-aware → D-1 → D-2 → D-3
 *   主路径在调用 D-1 之前，先用 U-0 seeds 筛选 universe，
 *   确保 D-1 只看到匹配的 proof。
 *   如果 U-0 匹配失败，则 D-1 在空 universe 中运行 → fallback
 *
 * 铁律：
 *   ❌ NO B-layer mutation
 *   ❌ NO freeze modification
 *   ❌ NO bridge rewrite
 *   ❌ NO corpus write
 *   ✅ 只读调用 D 系列 + U-0 seed 匹配
 * ============================================================
 */

import { D1Invocation, FrozenUniverseRef, InvocationOutput } from '../invocation/d1-invocation-engine.js'
import { TrustLayer, trustLayer } from '../invocation/d2-trust-layer.js'
import { ExecutionTrace } from '../invocation/d3-observatory.js'
import { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import { findBestSeed, convertAllU0Seeds, THRESHOLDS, MatchResult } from './u1-seed-matcher.js'
import { DEFAULT_SEEDS } from './u0-seed-schema.js'
import { CoverageTracker, coverageTracker } from './u2-coverage-tracker.js'
import type { DecisionArtifact } from '../bridge/bridge-protocol.js'
import type { ProofKernel } from '../proofs/b1/proof-kernel.js'

export interface ShadowResult {
  decision: DecisionArtifact
  trace: ExecutionTrace
  trusted: boolean
  hasValidDecision: boolean
  /** 命中的 seed ID（若有） */
  matchedSeedId: string | null
  /** U-1 匹配详情 */
  matchResult: MatchResult | null
}

export class ShadowExecutor {
  private d1: D1Invocation
  private trust: TrustLayer
  private anchor: SemanticAnchor
  private proofs: ProofKernel[]
  /** seed 到 proof 的映射：seed.id → proof */
  private seedProofMap: Map<string, ProofKernel>
  /** U-1 SemanticSeed 列表（编译一次，多次用） */
  private semanticSeeds: ReturnType<typeof convertAllU0Seeds>

  constructor(universe: FrozenUniverseRef, anchor: SemanticAnchor, proofs: ProofKernel[]) {
    this.d1 = new D1Invocation(universe)
    this.trust = trustLayer
    this.anchor = anchor
    this.proofs = proofs
    this.seedProofMap = new Map()
    this.semanticSeeds = convertAllU0Seeds(DEFAULT_SEEDS)
  }

  /**
   * setSeedProofMap: 注入 seed→proof 映射
   * 在 universe seed 后调用，让主路径能按 seed 匹配
   */
  setSeedProofMap(map: Map<string, ProofKernel>): void {
    this.seedProofMap = map
  }

  /**
   * execute(query): 主路径执行（U-1 多维语义匹配）
   *
   * 链路：
   *   1. U-1 seed 匹配（六维确定性评分）
   *   2. 命中且≥阈值 → 子 universe → D-1 → D-2 → D-3
   *   3. 未命中 → 空 universe → D-1 → 空决策 → fallback
   *   4. 命中时从 seed 的 decisionTemplate 提取人类可读输出
   */
  execute(query: string): ShadowResult {
    // Step 0: U-1 多维语义匹配（带 forbidden 检查）
    const forbiddenMap: Record<string, string[]> = {}
    for (const s of DEFAULT_SEEDS) {
      if (s.forbiddenPatterns && s.forbiddenPatterns.length > 0) {
        forbiddenMap[s.id] = s.forbiddenPatterns
      }
    }
    const matchResult = findBestSeed(query, this.semanticSeeds, forbiddenMap)
    const bestMatchId = matchResult.bestSeed
    const bestScore = matchResult.bestScore
    const matchLevel = matchResult.matchLevel

    // Step 1: 构建子 universe（只包含匹配的 proof）
    let effectiveProofs: ProofKernel[]
    let matchedSeedId: string | null = null

    if (bestMatchId) {
      if (this.seedProofMap.has(bestMatchId)) {
        const matchedProof = this.seedProofMap.get(bestMatchId)!
        effectiveProofs = [matchedProof]
        matchedSeedId = bestMatchId
      } else {
        // Fallback: 如果 U-1 匹配到 seed 但没有对应的 proof（如新增 seed），
        // 仍然记录 match 结果，使用全局 proof 作为兜底
        matchedSeedId = bestMatchId
        effectiveProofs = [...this.proofs]
      }
    } else {
      effectiveProofs = []
    }

    // 构建只包含匹配 proof 的临时 universe
    const effectiveUniverse = new FrozenUniverseRef(this.anchor, effectiveProofs)
    const effectiveD1 = new D1Invocation(effectiveUniverse)

    // D-1: 执行
    const output = effectiveD1.invoke(query)

    // D-2: 校验
    const validation = this.trust.validate(output.decision, this.anchor, this.proofs)

    // 判断主路径是否有效
    const emptyDecision = !output.decision.value
      || output.decision.value === 'NO_DECISION'
      || output.decision.truth === 'unknown'
    const pathValid = !emptyDecision && matchedSeedId !== null && matchLevel !== 'none'

    // 如果命中了 seed，用 decisionTemplate 覆盖决策值
    let decisionValue = output.decision.value
    if (matchedSeedId && !emptyDecision) {
      const seed = DEFAULT_SEEDS.find(s => s.id === matchedSeedId)
      if (seed) {
        decisionValue = seed.decisionTemplate
      }
    }

    // 置信度：根据 U-1 分数映射
    let confidence = output.decision.confidence
    if (matchLevel === 'strong') {
      confidence = 0.85  // ≥0.80 强匹配
    } else if (matchLevel === 'acceptable') {
      confidence = 0.70  // ≥0.62 可接受
    } else if (matchLevel === 'weak') {
      confidence = 0.40  // ≥0.40 弱匹配
    }

    // 构建最终决策
    const decision: DecisionArtifact = {
      ...output.decision,
      value: decisionValue,
      confidence: pathValid ? confidence : output.decision.confidence,
      truth: emptyDecision ? 'unknown' : (pathValid ? 'true' : output.decision.truth),
    }

    // D-3: trace
    const trace: ExecutionTrace = {
      queryId: output.query.queryId,
      input: output.query.naturalInput,
      embeddingType: emptyDecision ? 'empty' : output.query.embedding.type,
      embeddingValue: output.query.embedding.value,
      matchedProofSignatures: effectiveProofs.map(p => p.frameInvariant.signature),
      decisionValue: decision.value,
      truth: decision.truth,
      entailmentChain: decision.explainability.entailmentChain,
      timestamp: Date.now(),
      trusted: validation.trusted,
    }

    return {
      decision,
      trace,
      trusted: validation.trusted,
      hasValidDecision: pathValid,
      matchedSeedId,
      matchResult,
    }
  }

  /**
   * executeWithCoverage: 执行并记录覆盖数据
   */
  executeWithCoverage(query: string, tracker?: CoverageTracker): ShadowResult {
    const result = this.execute(query)
    const t = tracker ?? coverageTracker

    // U-2.2a: 提取竞争空间候选（精简：seedId + score）
    const mr = result.matchResult
    const candidates = (mr?.candidates ?? [])
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5)
      .map((c: any) => ({ seedId: c.seedId, score: c.score }))

    t.record(
      query,
      result.matchedSeedId,
      result.matchResult?.bestScore ?? 0,
      result.matchResult?.matchLevel ?? 'none',
      !result.hasValidDecision,
      candidates,
    )
    return result
  }
}
