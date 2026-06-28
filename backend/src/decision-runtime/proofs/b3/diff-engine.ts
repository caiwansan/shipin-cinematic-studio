/**
 * diff-engine.ts — Phase B-3 Proof Calculus
 *
 * ============================================================
 * Diff Engine (Δ)
 * ============================================================
 *
 * Δ(P1, P2) = ProofDelta
 *
 * 定义：两个 ProofKernel 之间的结构差异。
 * 不是"因果边删除/添加"的差值。
 * 是"证明结构"的结构差。
 *
 * 运算规则：
 *   - Δ(P1, P1) = 零差异
 *   - Δ(P1, P2) 可逆 iff signature 空间兼容
 *
 * 宪法：
 *   1. 不做内容比较（只做结构比较）
 *   2. 不执行 Runtime
 *   3. 输出的是代数差异，不是差异报告
 */

import type { ProofKernel, ProofStep } from '../b1/proof-kernel.js'

// ============================================================
// 1. ProofDelta
// ============================================================

export interface ProofDelta {
  /** 是否零差异 */
  isZero: boolean
  /** 两个 proof 的签名是否相同（等价类判断） */
  signatureMatch: boolean
  /** 原始输入的语义差异（即使结构相同） */
  inputDiff: {
    /** 输入是否不同 */
    different: boolean
    /** 差异幅度（0~1） */
    magnitude: number
  }
  /** P1 中存在但 P2 中不存在的步骤索引 */
  removedSteps: number[]
  /** P2 中存在但 P1 中不存在的步骤索引 */
  addedSteps: number[]
  /** 步骤修改（索引相同但内容不同） */
  modifiedEdges: Array<{
    index: number
    oldFrom: string
    oldTo: string
    oldRule: string
    newFrom: string
    newTo: string
    newRule: string
  }>
  /** 证人对齐变化 */
  witnessDiff: {
    unchanged: number
    added: number
    removed: number
  }
  /** 差异幅度（0~1） */
  magnitude: number
}

// ============================================================
// 2. Diff Engine
// ============================================================

export class DiffEngine {
  /**
   * Δ(P1, P2): 计算两个 proof 之间的代数差异
   *
   * P1 — 参考 proof
   * P2 — 目标 proof
   *
   * 返回：代数差异结构
   *
   * 注：Δ 不仅要检测"proof 结构"差异，
   *     还要检测"导致证明差异的深层原因"——
   *     如果两个 proof 的 signature 相同但 input 不同，
   *     Δ ≠ 0（因为存在结构等价性之下的语义差异）
   */
  diff(P1: ProofKernel, P2: ProofKernel): ProofDelta {
    // 0. 输入差异检测（在 signature 相同的情况下仍有可能是不同 input）
    //   通过检测 evidence 数量、步骤细节等来判断
    const p1EvCount = P1.witness.evidence.length
    const p2EvCount = P2.witness.evidence.length

    // 1. 签名比较
    const sig1 = P1.frameInvariant.signature
    const sig2 = P2.frameInvariant.signature
    const signatureMatch = sig1 === sig2

    // 2. 步骤差异（按 index 对齐）
    const steps1 = [...P1.proofSteps].sort((a, b) => a.index - b.index)
    const steps2 = [...P2.proofSteps].sort((a, b) => a.index - b.index)

    const removedSteps: number[] = []
    const addedSteps: number[] = []
    const modifiedEdges: ProofDelta['modifiedEdges'] = []

    // P1 中存在但 P2 中不存在（按 index 匹配）
    for (const s1 of steps1) {
      const match = steps2.find(s2 => s2.index === s1.index)
      if (!match) {
        removedSteps.push(s1.index)
      }
    }

    // P2 中存在但 P1 中不存在
    for (const s2 of steps2) {
      const match = steps1.find(s1 => s1.index === s2.index)
      if (!match) {
        addedSteps.push(s2.index)
      }
    }

    // 输入差异（即使结构相同，不同 input 也是不同的代数对象）
    const inputDiff = {
      different: P1.frameInvariant.frameId !== P2.frameInvariant.frameId,
      magnitude: 0.3, // 不同的 FrameId 代表不同的决策实例
    }

    // 即使 signature 相同，也检查步骤内容是否一致
    //（同 signature 但不同 input → 步骤内容必有差异）
    for (const s1 of steps1) {
      const s2 = steps2.find(s => s.index === s1.index)
      if (s2 && (s1.from !== s2.from || s1.to !== s2.to || s1.rule !== s2.rule)) {
        modifiedEdges.push({
          index: s1.index,
          oldFrom: s1.from,
          oldTo: s1.to,
          oldRule: s1.rule,
          newFrom: s2.from,
          newTo: s2.to,
          newRule: s2.rule,
        })
      }
    }

    // 当签名相同但没有任何步骤差异时——检查 evidence 数量
    if (signatureMatch && removedSteps.length === 0 && addedSteps.length === 0 && modifiedEdges.length === 0) {
      // Evidence 数量不同 → 是一类差异
      if (p1EvCount !== p2EvCount) {
        modifiedEdges.push({
          index: -1,
          oldFrom: `evidence(${p1EvCount})`,
          oldTo: `evidence(${p1EvCount})`,
          oldRule: 'evidence_count',
          newFrom: `evidence(${p2EvCount})`,
          newTo: `evidence(${p2EvCount})`,
          newRule: 'evidence_count',
        })
      }
    }

    // 3. 证人差异
    const witnessKeys = ['requirement', 'world', 'scoring', 'recommendation', 'report'] as const
    const p1Witness = P1.witness
    const p2Witness = P2.witness

    const witnessDiff = witnessKeys.reduce(
      (acc, key) => {
        const p1Has = p1Witness[key as keyof typeof p1Witness] !== null
        const p2Has = p2Witness[key as keyof typeof p2Witness] !== null
        if (p1Has && p2Has) acc.unchanged++
        else if (p2Has && !p1Has) acc.added++
        else if (p1Has && !p2Has) acc.removed++
        return acc
      },
      { unchanged: 0, added: 0, removed: 0 }
    )

    // 4. 差异幅度
    const hasStructuralChanges = removedSteps.length > 0 || addedSteps.length > 0 || modifiedEdges.length > 0
    const hasWitnessChanges = witnessDiff.added > 0 || witnessDiff.removed > 0
    const inputImpact = inputDiff.different ? 1 : 0
    const totalChanges = removedSteps.length + addedSteps.length + modifiedEdges.length + witnessDiff.added + witnessDiff.removed + inputImpact
    const totalElements = Math.max(steps1.length + steps2.length + 10, 1)
    const magnitude = Math.min(totalChanges / totalElements, 1)

    // isZero: 结构无变化 且 输入无差异
    const isZero = !hasStructuralChanges && !hasWitnessChanges && !inputDiff.different

    return {
      isZero,
      signatureMatch,
      inputDiff,
      removedSteps,
      addedSteps,
      modifiedEdges,
      witnessDiff,
      magnitude,
    }
  }

  /**
   * Δ 是否可逆
   *
   * 可逆条件：差异幅度 <= 0.5（如果结构变化 > 50%，不可逆）
   */
  isReversible(delta: ProofDelta): boolean {
    return delta.magnitude <= 0.5 && !delta.isZero
  }

  /**
   * 描述 Δ
   */
  describe(delta: ProofDelta): string {
    if (delta.isZero) return 'Δ = 0（零差异，证明等价）'

    const parts: string[] = []
    parts.push(`签名匹配: ${delta.signatureMatch ? '✅' : '❌'}`)
    if (delta.inputDiff.different) parts.push(`输入不同 (${delta.inputDiff.magnitude.toFixed(1)})`)
    if (delta.removedSteps.length > 0) parts.push(`-${delta.removedSteps.length} 步`)
    if (delta.addedSteps.length > 0) parts.push(`+${delta.addedSteps.length} 步`)
    if (delta.modifiedEdges.length > 0) parts.push(`~${delta.modifiedEdges.length} 边修改`)
    if (delta.witnessDiff.added > 0 || delta.witnessDiff.removed > 0) {
      parts.push(`证人: +${delta.witnessDiff.added}/-${delta.witnessDiff.removed}`)
    }
    parts.push(`幅度: ${(delta.magnitude * 100).toFixed(0)}%`)

    return `Δ = { ${parts.join(', ')} }`
  }
}

/**
 * 单例 Engine
 */
export const diffEngine = new DiffEngine()
