/**
 * entailment.ts — Phase B-4.5 Internal Logic
 *
 * ============================================================
 * Entailment Engine (⊢)
 * ============================================================
 *
 * 蕴含不是"态射"。
 * 态射是 P1 → P2（结构映射）
 * 蕴含是 P ⊢ Q（逻辑推论）
 *
 * B-4 范畴里，态射存在不等于蕴含成立。
 * B-4.5 里，蕴含需要额外满足语义条件。
 *
 * 蕴含规则：
 *   1. P ⊢ Q iff (P 命题真 ∧ Q 命题真) ∨ (P 与 Q 同构)
 *   2. 如果 P 假，P ⊢ Q 永远真空真（ex falso）
 *   3. 如果 P 真且 Q 假，P ⊢ Q 不成立
 *
 * 宪法：
 *   1. 蕴含不是概率/置信度
 *   2. 蕴含是逻辑关系
 *   3. 不引入"程度性蕴含"
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import { propositionEvaluator, type TruthValue } from './proposition.js'
import { isomorphismDetector } from '../b4/isomorphism.js'

// ============================================================
// 1. Entailment
// ============================================================

export type EntailmentReason =
  | 'identity'       // P ⊢ P（自反）
  | 'isomorphism'    // P ≅ Q → P ⊢ Q
  | 'truth_transfer' // P true ∧ Q true → P ⊢ Q
  | 'ex_falso'       // false ⊢ anything
  | 'false'          // true ⊢ false = impossible
  | 'unknown'        // 无法判定

export interface Entailment {
  /** 前件 signature */
  from: string
  /** 后件 signature */
  to: string
  /** 蕴含是否成立 */
  holds: boolean
  /** 蕴含理由 */
  reason: EntailmentReason
  /** 表达式 */
  expression: string
}

// ============================================================
// 2. Entailment Engine
// ============================================================

export class EntailmentEngine {
  /**
   * P ⊢ Q: 判定 proof P 是否逻辑蕴含 proof Q
   */
  entails(P: ProofKernel, Q: ProofKernel): Entailment {
    // Rule 1: P ⊢ P（自反）
    if (P.frameInvariant.signature === Q.frameInvariant.signature) {
      return {
        from: P.frameInvariant.signature,
        to: Q.frameInvariant.signature,
        holds: true,
        reason: 'identity',
        expression: `${P.frameInvariant.signature} ⊢ ${Q.frameInvariant.signature} (自反)`,
      }
    }

    // Rule 2: P ≅ Q → P ⊢ Q（同构 → 蕴含）
    const iso = isomorphismDetector.isIsomorphic(P, Q)
    if (iso.isomorphic && iso.type !== 'none') {
      return {
        from: P.frameInvariant.signature,
        to: Q.frameInvariant.signature,
        holds: true,
        reason: 'isomorphism',
        expression: `${P.frameInvariant.signature} ⊢ ${Q.frameInvariant.signature} (同构: ${iso.type})`,
      }
    }

    // Rule 3: P true ∧ Q true → P ⊢ Q
    const pTruth = propositionEvaluator.evaluate(P)
    const qTruth = propositionEvaluator.evaluate(Q)

    if (pTruth.truth === 'true' && qTruth.truth === 'true') {
      return {
        from: P.frameInvariant.signature,
        to: Q.frameInvariant.signature,
        holds: true,
        reason: 'truth_transfer',
        expression: `${P.frameInvariant.signature} ⊢ ${Q.frameInvariant.signature} (真→真)`,
      }
    }

    // Rule 4: false ⊢ anything（ex falso）
    if (pTruth.truth === 'false') {
      return {
        from: P.frameInvariant.signature,
        to: Q.frameInvariant.signature,
        holds: true,
        reason: 'ex_falso',
        expression: `⊥ ⊢ ${Q.frameInvariant.signature} (ex falso)`,
      }
    }

    // Rule 5: true ⊢ false = impossible
    if (pTruth.truth === 'true' && qTruth.truth === 'false') {
      return {
        from: P.frameInvariant.signature,
        to: Q.frameInvariant.signature,
        holds: false,
        reason: 'false',
        expression: `${P.frameInvariant.signature} ⊬ ${Q.frameInvariant.signature} (假)`,
      }
    }

    // Default: 无法判定
    return {
      from: P.frameInvariant.signature,
      to: Q.frameInvariant.signature,
      holds: false,
      reason: 'unknown',
      expression: `${P.frameInvariant.signature} ⊬ ${Q.frameInvariant.signature} (未知)`,
    }
  }

  /**
   * 批量计算蕴含表
   */
  entailmentTable(proofs: ProofKernel[]): Entailment[][] {
    const table: Entailment[][] = []
    for (const P of proofs) {
      const row: Entailment[] = []
      for (const Q of proofs) {
        row.push(this.entails(P, Q))
      }
      table.push(row)
    }
    return table
  }

  /**
   * 描述蕴含
   */
  describe(entail: Entailment): string {
    return entail.expression
  }
}

/**
 * 单例 Engine
 */
export const entailmentEngine = new EntailmentEngine()
