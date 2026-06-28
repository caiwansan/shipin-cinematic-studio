/**
 * merge-engine.ts — Phase B-3 Proof Calculus
 *
 * ============================================================
 * Merge Engine (+)
 * ============================================================
 *
 * +(P1, P2) = P3
 *
 * 定义：两个 ProofKernel 的代数求和。
 *
 * 规则：
 *   1. 相同 FrameInvariant → merge witness subtree
 *   2. 不同 evidence → union set
 *   3. scoring → 保留置信度更高的
 *   4. decision → 保留
 *
 * 约束：
 *   两个 proof 的 causal graph 必须从同一 input 派生
 *
 * 宪法：
 *   1. 不执行 Runtime
 *   2. 不调用 Agent
 *   3. merge 后 proof 必须通过 validate()
 */

import type { ProofKernel, ProofStep, WitnessNode } from '../b1/proof-kernel.js'
import type { FrameInvariant } from '../../frame/frame-invariant.js'

// ============================================================
// 1. Merge Result
// ============================================================

export interface MergeResult {
  /** 合并后的 ProofKernel */
  proof: ProofKernel
  /** 合并策略详细记录 */
  strategy: {
    frameInvariant: 'keep_first' | 'keep_second' | 'identical' | 'conflict'
    evidence: 'union' | 'keep_first' | 'keep_second'
    scoring: 'higher_confidence' | 'keep_first' | 'keep_second'
    decision: 'keep_first' | 'keep_second' | 'identical'
  }
  /** 合并过程中是否有冲突 */
  conflict: boolean
}

// ============================================================
// 2. Merge Engine
// ============================================================

export class MergeEngine {
  /**
   * P1 + P2: 合并两个 ProofKernel
   *
   * 优先级：P1 高于 P2
   */
  merge(P1: ProofKernel, P2: ProofKernel): MergeResult {
    const strategy: MergeResult['strategy'] = {
      frameInvariant: 'keep_first',
      evidence: 'keep_first',
      scoring: 'keep_first',
      decision: 'keep_first',
    }
    let conflict = false

    // ===== 1. FrameInvariant =====
    const fi1 = P1.frameInvariant
    const fi2 = P2.frameInvariant
    const fiIdentical = fi1.signature === fi2.signature && fi1.equivalenceClass === fi2.equivalenceClass

    if (fiIdentical) {
      strategy.frameInvariant = 'identical'
    } else {
      conflict = true
      // 签名不兼容时，仍保留 P1 的（以先融入系统者为准）
    }
    const mergedFrameInvariant: FrameInvariant = fiIdentical ? fi1 : fi1

    // ===== 2. Witness 合并 =====
    const w1 = P1.witness
    const w2 = P2.witness

    // evidence 取 union
    const mergedEvidence: WitnessNode[] = [...w1.evidence]
    for (const ev2 of w2.evidence) {
      const exists = mergedEvidence.some(ev1 =>
        ev1.eventType === ev2.eventType && ev1.stepIndex === ev2.stepIndex
      )
      if (!exists) {
        mergedEvidence.push(ev2)
        strategy.evidence = 'union'
      }
    }

    // 非 evidence 证人取 P1（若存在）否则取 P2
    const mergeNode = (n1: WitnessNode | null, n2: WitnessNode | null): WitnessNode | null => {
      if (fiIdentical || !n1) return n1 ?? n2
      // 签名不同时，保留置信度高的
      return n1.provable ? n1 : (n2?.provable ? n2 : (n1 ?? n2))
    }

    const mergedWitness = {
      requirement: mergeNode(w1.requirement, w2.requirement),
      world: mergeNode(w1.world, w2.world),
      evidence: mergedEvidence,
      scoring: mergeNode(w1.scoring, w2.scoring),
      recommendation: mergeNode(w1.recommendation, w2.recommendation),
      report: mergeNode(w1.report, w2.report),
    }

    // ===== 3. Proof Steps 合并（按 index 排序去重） =====
    const mergedStepsMap = new Map<number, ProofStep>()

    // 先放 P1
    for (const step of P1.proofSteps) {
      mergedStepsMap.set(step.index, step)
    }

    // P2 中 P1 没有的步骤
    for (const step of P2.proofSteps) {
      if (!mergedStepsMap.has(step.index)) {
        mergedStepsMap.set(step.index, step)
      } else {
        // 索引冲突：取置信度高的
        const existing = mergedStepsMap.get(step.index)!
        if (existing.confidence < step.confidence) {
          mergedStepsMap.set(step.index, step)
          strategy.scoring = 'higher_confidence'
        }
      }
    }

    const mergedSteps = [...mergedStepsMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([_, step]) => step)

    // ===== 4. 策略记载 =====
    if (fiIdentical) {
      strategy.decision = 'identical'
    }
    if (mergedEvidence.length > Math.max(w1.evidence.length, w2.evidence.length)) {
      strategy.evidence = 'union'
    }

    const mergedProof: ProofKernel = {
      frameInvariant: mergedFrameInvariant,
      witness: mergedWitness,
      proofSteps: mergedSteps,
      createdAt: Date.now(),
    }

    return {
      proof: mergedProof,
      strategy,
      conflict,
    }
  }

  /**
   * 合并是否有效
   *
   * 有效条件：无冲突，或冲突但签名等价
   */
  isValidMerge(result: MergeResult): boolean {
    if (!result.conflict) return true
    // 有冲突但仍有效：frameInvariant 相同
    return result.strategy.frameInvariant === 'identical'
  }

  /**
   * 描述合并
   */
  describe(result: MergeResult): string {
    const parts: string[] = []
    parts.push(`FrameInvariant: ${result.strategy.frameInvariant}`)
    parts.push(`Evidence: ${result.strategy.evidence}`)
    parts.push(`Scoring: ${result.strategy.scoring}`)
    parts.push(`Decision: ${result.strategy.decision}`)
    parts.push(`Conflict: ${result.conflict ? '⚠️' : '✅'}`)
    return `Merge = { ${parts.join(', ')} }`
  }
}

/**
 * 单例 Engine
 */
export const mergeEngine = new MergeEngine()
