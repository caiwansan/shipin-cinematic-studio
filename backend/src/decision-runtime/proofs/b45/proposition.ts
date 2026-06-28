/**
 * proposition.ts — Phase B-4.5 Internal Logic
 *
 * ============================================================
 * Proposition System
 * ============================================================
 *
 * 命题是 proof 的逻辑表达。
 * 不是"proof 是结构"，而是"proof 表达命题"。
 *
 * proposition(proof) → boolean
 *   一个 proof 是否表达了"逻辑真"。
 *
 * 真值判定规则：
 *   1. FrameInvariant 签名稳定（stable = true）→ 真
 *   2. 因果闭包完整（所有节点 provable）→ 真
 *   3. 签名一致性检查通过 → 真
 *
 * 宪法：
 *   1. 真值不是"评分"，是"逻辑判定"
 *   2. 不引入概率/置信度进 truth
 *   3. true ≠ "好的决策"，是"结构合法的证明"
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import { validateProofKernel, type ProofValidatorResult } from '../b1/proof-kernel.js'

// ============================================================
// 1. Truth Value
// ============================================================

export type TruthValue = 'true' | 'false' | 'unknown'

export interface Proposition {
  /** Proof 签名 */
  signature: string
  /** 真值 */
  truth: TruthValue
  /** 命题表达式：P ⊢ truth */
  expression: string
  /** 真值证据 */
  evidence: {
    /** Validator 结果 */
    validation: ProofValidatorResult
    /** FrameInvariant 是否稳定 */
    stable: boolean
    /** 签名是否自洽 */
    consistent: boolean
  }
}

// ============================================================
// 2. Proposition Evaluator
// ============================================================

export class PropositionEvaluator {
  /**
   * evaluate(proof): 计算 proof 的命题真值
   *
   * true iff:
   *   - validateProofKernel(proof).valid = true
   *   - frameInvariant.stable = true
   *   - all provable
   */
  evaluate(proof: ProofKernel): Proposition {
    const validation = validateProofKernel(proof)
    const stable = proof.frameInvariant.stable
    const consistent = validation.valid && validation.allProvable

    let truth: TruthValue
    if (consistent && stable) {
      truth = 'true'
    } else if (!validation.valid) {
      truth = 'false'
    } else {
      truth = 'unknown'
    }

    return {
      signature: proof.frameInvariant.signature,
      truth,
      expression: `P(${proof.frameInvariant.signature}) ⊢ ${truth}`,
      evidence: {
        validation,
        stable,
        consistent,
      },
    }
  }

  /**
   * 批量评估
   */
  evaluateAll(proofs: ProofKernel[]): Proposition[] {
    return proofs.map(p => this.evaluate(p))
  }

  /**
   * 描述命题
   */
  describe(proposition: Proposition): string {
    const labels: Record<TruthValue, string> = {
      true: '⊤',
      false: '⊥',
      unknown: '?',
    }
    return `${proposition.expression}  ${labels[proposition.truth]}`
  }
}

/**
 * 单例 Evaluator
 */
export const propositionEvaluator = new PropositionEvaluator()
