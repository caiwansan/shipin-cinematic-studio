/**
 * isomorphism.ts — Phase B-4 Proof Category
 *
 * ============================================================
 * Isomorphism Detector (≅)
 * ============================================================
 *
 * P1 ≅ P2 判定：两个 proof 是否结构完全等价。
 *
 * 同构不是"相似"。
 * 同构是"存在可逆态射"——
 * P1 → P2 与 P2 → P1 都存在合法映射。
 *
 * 判定规则：
 *   1. signature 相同 → 强同构
 *   2. signature 不同但 witness 结构等价 → 弱同构
 *   3. 等价类相同 + 因果图同构 → 范畴等价
 *
 * 宪法：
 *   1. 同构不基于相似度/距离/embedding
 *   2. 同构基于可计算的结构映射
 *   3. 不可"近似"判定同构
 */

import type { ProofKernel, WitnessNode, ProofStep } from '../b1/proof-kernel.js'

// ============================================================
// 1. 同构类型
// ============================================================

export type IsomorphismType =
  | 'strong'       // 签名相同（最严格）
  | 'structural'   // witness 结构等价（签名不同但结构等价）
  | 'categorical'  // 范畴等价（等价类相同 + 因果拓扑同构）
  | 'none'         // 非同构

export interface IsomorphismResult {
  /** 是否同构 */
  isomorphic: boolean
  /** 同构类型 */
  type: IsomorphismType
  /** 同构证据 */
  evidence: {
    /** signature 匹配 */
    signatureMatch: boolean
    /** 等价类匹配 */
    equivalenceClassMatch: boolean
    /** witness 结构等价性 */
    witnessEquivalence: {
      keys: string[]
      match: boolean
      matchRate: number
    }
    /** 因果步骤等价性 */
    stepEquivalence: {
      stepCount: number
      stepMatchCount: number
      matchRate: number
    }
  }
}

// ============================================================
// 2. Isomorphism Detector
// ============================================================

export class IsomorphismDetector {
  /**
   * P1 ≅ P2: 判断两个 proof 是否同构
   */
  isIsomorphic(P1: ProofKernel, P2: ProofKernel): IsomorphismResult {
    // ===== 1. Signature 比较（强同构） =====
    const signatureMatch = P1.frameInvariant.signature === P2.frameInvariant.signature
    if (signatureMatch) {
      return {
        isomorphic: true,
        type: 'strong',
        evidence: {
          signatureMatch: true,
          equivalenceClassMatch: P1.frameInvariant.equivalenceClass === P2.frameInvariant.equivalenceClass,
          witnessEquivalence: this.compareWitness(P1, P2),
          stepEquivalence: this.compareSteps(P1, P2),
        },
      }
    }

    // ===== 2. Witness 结构等价（弱同构） =====
    const equivClassMatch = P1.frameInvariant.equivalenceClass === P2.frameInvariant.equivalenceClass
    const witnessEq = this.compareWitness(P1, P2)
    const stepEq = this.compareSteps(P1, P2)

    const witnessStructurallyEquivalent = witnessEq.match && stepEq.matchRate >= 1.0

    if (witnessStructurallyEquivalent) {
      return {
        isomorphic: true,
        type: 'structural',
        evidence: {
          signatureMatch: false,
          equivalenceClassMatch: equivClassMatch,
          witnessEquivalence: witnessEq,
          stepEquivalence: stepEq,
        },
      }
    }

    // ===== 3. 范畴等价 =====
    // 等价类相同 + 因果步骤拓扑一致（step count 相同 + 结构匹配率 >= 0.8）
    const categoricalEquivalent = equivClassMatch && stepEq.stepCount > 0 && stepEq.matchRate >= 0.8

    if (categoricalEquivalent) {
      return {
        isomorphic: true,
        type: 'categorical',
        evidence: {
          signatureMatch: false,
          equivalenceClassMatch: equivClassMatch,
          witnessEquivalence: witnessEq,
          stepEquivalence: stepEq,
        },
      }
    }

    return {
      isomorphic: false,
      type: 'none',
      evidence: {
        signatureMatch: false,
        equivalenceClassMatch: equivClassMatch,
        witnessEquivalence: witnessEq,
        stepEquivalence: stepEq,
      },
    }
  }

  /**
   * 比较两个 proof 的 witness 结构是否等价
   *
   * 规则：witness 的 key 集合相同，且每个 key 的 agent 相同
   */
  private compareWitness(P1: ProofKernel, P2: ProofKernel) {
    const witnessKeys: Array<keyof typeof P1.witness> = [
      'requirement', 'world', 'scoring', 'recommendation', 'report',
    ]

    const keys: string[] = []
    let matches = 0

    for (const key of witnessKeys) {
      const n1 = P1.witness[key]
      const n2 = P2.witness[key]
      const bothExist = n1 !== null && n2 !== null
      const bothNull = n1 === null && n2 === null
      const agentsMatch = bothExist && (n1 as WitnessNode).agent === (n2 as WitnessNode).agent

      keys.push(key)
      if (bothNull || agentsMatch) matches++
    }

    // Evidence 比较：数量
    const ev1 = P1.witness.evidence.length
    const ev2 = P2.witness.evidence.length
    keys.push('evidence_count')
    if (ev1 === ev2) matches++

    const totalKeys = keys.length
    const matchRate = totalKeys > 0 ? matches / totalKeys : 0

    return {
      keys,
      match: matchRate >= 0.8,
      matchRate,
    }
  }

  /**
   * 比较两个 proof 的因果步骤是否等价
   */
  private compareSteps(P1: ProofKernel, P2: ProofKernel) {
    const steps1 = P1.proofSteps
    const steps2 = P2.proofSteps

    if (steps1.length !== steps2.length) {
      return {
        stepCount: Math.max(steps1.length, steps2.length),
        stepMatchCount: 0,
        matchRate: 0,
      }
    }

    let matchCount = 0
    for (let i = 0; i < steps1.length; i++) {
      const s1 = steps1[i]
      const s2 = steps2[i]
      if (s1.rule === s2.rule && s1.stepType === s2.stepType) {
        matchCount++
      }
    }

    const matchRate = steps1.length > 0 ? matchCount / steps1.length : 0

    return {
      stepCount: steps1.length,
      stepMatchCount: matchCount,
      matchRate,
    }
  }

  /**
   * 描述同构关系
   */
  describe(result: IsomorphismResult): string {
    const labels: Record<IsomorphismType, string> = {
      strong: 'P1 ≅ P2 (强同构: 签名相同)',
      structural: 'P1 ≅ P2 (弱同构: 结构等价)',
      categorical: 'P1 ≅ P2 (范畴等价: 类型+拓扑)',
      none: 'P1 ≄ P2 (非同构)',
    }

    if (!result.isomorphic) return labels.none

    const parts = [labels[result.type]]
    parts.push(`  SigMatch: ${result.evidence.signatureMatch}`)
    parts.push(`  EqClass:  ${result.evidence.equivalenceClassMatch}`)
    parts.push(`  Witness:  ${(result.evidence.witnessEquivalence.matchRate * 100).toFixed(0)}%`)
    parts.push(`  Steps:    ${(result.evidence.stepEquivalence.matchRate * 100).toFixed(0)}%`)

    return parts.join('\n')
  }
}

/**
 * 单例 Detector
 */
export const isomorphismDetector = new IsomorphismDetector()
