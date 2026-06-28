/**
 * reuse-engine.ts — Phase B-2 Counterfactual Stability
 *
 * ============================================================
 * Proof Reuse Engine
 * ============================================================
 *
 * 职责：基于 Delta 检测结果，计算 proof 的结构重复利用率。
 *
 * 规则：
 *   - 未被 impactScope 覆盖的因果边 → 可复用
 *   - 被 impactScope 覆盖的因果边 → 需重算
 *   - reuse_ratio = 可复用边数 / 总边数
 *
 * 宪法约束：
 *   1. 不重新执行证明
 *   2. 不调用任何 Agent
 *   3. 只做结构分析
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import type { DeltaResult } from './delta-detector.js'

// ============================================================
// 1. Reuse Result
// ============================================================

export interface ReuseResult {
  /** 可复用的 ProofStep 列表 */
  reusedSteps: Array<{
    index: number
    rule: string
    from: string
    to: string
  }>
  /** 需要重算的 ProofStep */
  recomputedSteps: Array<{
    index: number
    rule: string
    from: string
    to: string
  }>
  /** 复用率 ≥ 0.6 时 stable = true */
  reuseRatio: number
  /** 是否稳定（reuseRatio >= 0.6） */
  stable: boolean
  /** 未受影响的子图——可证明的因果边索引 */
  unaffectedSubgraph: number[]
  /** 受影响的因果边索引 */
  affectedEdges: number[]
}

// ============================================================
// 2. Reuse Engine
// ============================================================

export class ReuseEngine {
  /**
   * 分析 baseProof 在 delta 影响下的复用率
   */
  analyze(baseProof: ProofKernel, delta: DeltaResult): ReuseResult {
    const totalSteps = baseProof.proofSteps.length

    // 标记被 impactScope 覆盖的边
    const affectedEdges: number[] = []
    const unaffectedSubgraph: number[] = []

    for (let i = 0; i < totalSteps; i++) {
      const step = baseProof.proofSteps[i]
      const isAffected = delta.impactScope.has(step.from) || delta.impactScope.has(step.to)
      if (isAffected) {
        affectedEdges.push(i)
      } else {
        unaffectedSubgraph.push(i)
      }
    }

    // 复用率
    const reusedCount = unaffectedSubgraph.length
    const reuseRatio = totalSteps > 0 ? reusedCount / totalSteps : 0

    // 构造可复用和需重算的步骤
    const reusedSteps = unaffectedSubgraph.map(i => ({
      index: baseProof.proofSteps[i].index,
      rule: baseProof.proofSteps[i].rule,
      from: baseProof.proofSteps[i].from,
      to: baseProof.proofSteps[i].to,
    }))

    const recomputedSteps = affectedEdges.map(i => ({
      index: baseProof.proofSteps[i].index,
      rule: baseProof.proofSteps[i].rule,
      from: baseProof.proofSteps[i].from,
      to: baseProof.proofSteps[i].to,
    }))

    return {
      reusedSteps,
      recomputedSteps,
      reuseRatio,
      stable: reuseRatio >= 0.6,
      unaffectedSubgraph,
      affectedEdges,
    }
  }

  /**
   * 生成修复计划
   */
  plan(baseProof: ProofKernel, delta: DeltaResult): {
    reused: number
    recomputed: number
    reuseRatio: number
    stable: boolean
    description: string
  } {
    const result = this.analyze(baseProof, delta)
    const total = result.reusedSteps.length + result.recomputedSteps.length

    return {
      reused: result.reusedSteps.length,
      recomputed: result.recomputedSteps.length,
      reuseRatio: result.reuseRatio,
      stable: result.stable,
      description: result.stable
        ? `✅ 稳定——${result.reusedSteps.length}/${total} 条边可复用 (${(result.reuseRatio * 100).toFixed(0)}%)`
        : `❌ 不稳定——仅 ${result.reusedSteps.length}/${total} 条边可复用 (${(result.reuseRatio * 100).toFixed(0)}%)，低于 60% 阈值`,
    }
  }
}

/**
 * 单例 Engine
 */
export const reuseEngine = new ReuseEngine()
