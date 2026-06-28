/**
 * proof-calculus.ts — Phase B-3 Proof Calculus
 *
 * ============================================================
 * ProofCalculus — 代数运算的统一入口
 * ============================================================
 *
 * 三种运算：
 *   + (merge):        P1 + P2  = Pmerge（并行合成）
 *   Δ (diff):         Δ(P1,P2) = delta（结构差异）
 *   ∘ (compose):      P1 ∘ P2  = Pchain（串行组合）
 *
 * 宪法：
 *   1. 所有运算不执行 Runtime
 *   2. 所有运算不调用 Agent
 *   3. 结果不保证通过 validate()——调用方自行验证
 *   4. Proof 从"运行时对象"变成了"代数表达式"
 */

import { diffEngine, type ProofDelta } from './diff-engine.js'
import { mergeEngine, type MergeResult } from './merge-engine.js'
import { composeEngine, type ComposeResult } from './compose-engine.js'
import type { ProofKernel } from '../b1/proof-kernel.js'

// ============================================================
// 1. ProofCalculus — 统一运算入口
// ============================================================

export class ProofCalculus {
  /**
   * P1 + P2: Merge（并行合成）
   */
  static add(P1: ProofKernel, P2: ProofKernel): MergeResult {
    return mergeEngine.merge(P1, P2)
  }

  /**
   * Δ(P1, P2): Diff（结构差异）
   */
  static diff(P1: ProofKernel, P2: ProofKernel): ProofDelta {
    return diffEngine.diff(P1, P2)
  }

  /**
   * P1 ∘ P2: Compose（串行组合）
   */
  static compose(P1: ProofKernel, P2: ProofKernel): ComposeResult {
    return composeEngine.compose(P1, P2)
  }

  /**
   * 验证代数结果的有效性
   */
  static validate(result: MergeResult | ComposeResult | ProofDelta): boolean {
    if ('proof' in result && 'compatible' in result) {
      // ComposeResult
      return result.compatible
    }
    if ('proof' in result && 'conflict' in result) {
      // MergeResult
      return !result.conflict || result.strategy.frameInvariant === 'identical'
    }
    if ('isZero' in result) {
      // ProofDelta
      return result.isZero || result.magnitude <= 0.5
    }
    return false
  }
}
