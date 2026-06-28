/**
 * compose-engine.ts — Phase B-3 Proof Calculus
 *
 * ============================================================
 * Composition Engine (∘)
 * ============================================================
 *
 * P1 ∘ P2 = P12
 *
 * 定义：两个 ProofKernel 的链式组合。
 *
 * 规则：
 *   - P1 的 decision（recommendation_computed）作为 P2 的 input
 *   - P2 的 requirement 被 P1 的 decision 替代
 *   - causal graph 必须兼容
 *   - frame signature 空间不可冲突
 *
 * 不是 merge（并行加法）。
 * 是 compose（串行组合）。
 *
 * 使用场景：
 *   "租房推荐"的 proof ∘ "租房合同流程"的 proof
 *   = 从推荐到签约的完整证明链
 *
 * 宪法：
 *   1. 不执行 Runtime
 *   2. 不调用 Agent
 *   3. compose 后 proof 必须通过 validate()
 */

import type { ProofKernel, ProofStep, WitnessNode } from '../b1/proof-kernel.js'
import type { FrameInvariant } from '../../frame/frame-invariant.js'

// ============================================================
// 1. Compose Result
// ============================================================

export interface ComposeResult {
  /** 组合后的 ProofKernel */
  proof: ProofKernel | null
  /** 组合是否兼容 */
  compatible: boolean
  /** 不兼容原因 */
  incompatibilityReason: string | null
  /** 组合策略详情 */
  strategy: {
    frameInvariant: 'keep_first' | 'chained' | 'incompatible'
    causalGraph: 'forward_chain' | 'incompatible'
    witness: 'chained' | 'incompatible'
  }
}

// ============================================================
// 2. Composition Engine
// ============================================================

export class ComposeEngine {
  /**
   * P1 ∘ P2: 组合两个 ProofKernel
   *
   * P1 的 decision 作为 P2 的 input。
   * P2 的 requirement 必须接受 P1 的 decision 作为输入。
   */
  compose(P1: ProofKernel, P2: ProofKernel): ComposeResult {
    // ===== 1. 兼容性检查 =====
    const p1Decision = P1.witness.recommendation
    const p2Requirement = P2.witness.requirement

    // P1 必须有 recommendation
    if (!p1Decision) {
      return {
        proof: null,
        compatible: false,
        incompatibilityReason: 'P1 缺少 recommendation，无法作为 P2 输入',
        strategy: {
          frameInvariant: 'keep_first',
          causalGraph: 'incompatible',
          witness: 'incompatible',
        },
      }
    }

    // P2 必须有 requirement
    if (!p2Requirement) {
      return {
        proof: null,
        compatible: false,
        incompatibilityReason: 'P2 缺少 requirement，无法接收 P1 输出',
        strategy: {
          frameInvariant: 'keep_first',
          causalGraph: 'incompatible',
          witness: 'incompatible',
        },
      }
    }

    // ===== 2. 签名空间兼容性检查 =====
    // P2 的等价类与 P1 不可矛盾（相同 domain 才可链）
    const fi1 = P1.frameInvariant
    const fi2 = P2.frameInvariant

    const lineage1 = fi1.lineage
    const lineage2 = fi2.lineage
    const sameDomain = lineage1.requirement === lineage2.requirement

    if (!sameDomain) {
      return {
        proof: null,
        compatible: false,
        incompatibilityReason: `P1 的 domain "${lineage1.requirement}" ≠ P2 的 domain "${lineage2.requirement}"`,
        strategy: {
          frameInvariant: 'keep_first',
          causalGraph: 'incompatible',
          witness: 'incompatible',
        },
      }
    }

    // ===== 2b. 等价类冲突检查 =====
    // 两个 proof 同 domain 但不同等价类 → 不可 compose
    // (租房推荐 ∘ 买房合同 即使都是 real_estate，语义冲突)
    const eqMatch = fi1.equivalenceClass === fi2.equivalenceClass
    if (!eqMatch) {
      return {
        proof: null,
        compatible: false,
        incompatibilityReason: `P1 的等价类 "${fi1.equivalenceClass}" ≠ P2 的等价类 "${fi2.equivalenceClass}"`,
        strategy: {
          frameInvariant: 'keep_first',
          causalGraph: 'incompatible',
          witness: 'incompatible',
        },
      }
    }

    // ===== 3. 构建组合的 FrameInvariant =====
    const chainedFrameInvariant: FrameInvariant = {
      ...fi1,
      signature: `${fi1.signature}∘${fi2.signature}`,
      lineage: {
        requirement: `${lineage1.requirement}∘chain`,
        world: lineage1.world,
        scoring: lineage2.scoring,
      },
    }

    // ===== 4. 构建组合的 Witness =====
    const chainedWitness = {
      requirement: P1.witness.requirement,
      world: P1.witness.world,
      evidence: [...P1.witness.evidence, ...P2.witness.evidence],
      scoring: P1.witness.scoring,
      recommendation: P1.witness.recommendation,
      report: P2.witness.report,
    }

    // ===== 5. 组合的 Proof Steps =====
    // 代数组合不强制 index 连续性
    // P1 的全部步骤 + 链接步骤 + P2 的全部步骤（index 偏移）
    const p1StepCount = P1.proofSteps.length
    const linkIndex = p1StepCount + 1

    const linkStep: ProofStep = {
      index: linkIndex,
      from: P1.proofSteps[P1.proofSteps.length - 1]?.to ?? 'decision_completed',
      to: P2.proofSteps[0]?.from ?? 'requirement_analyzed',
      rule: 'recommendation_reported',
      confidence: Math.min(
        P1.proofSteps[P1.proofSteps.length - 1]?.confidence ?? 0.8,
        0.95
      ),
      stepType: 'derive',
      inboundDegree: 1,
      outboundDegree: 1,
    }

    const p2Steps = P2.proofSteps.map((s, i) => ({
      ...s,
      index: linkIndex + 1 + i,
    }))

    const allSteps = [...P1.proofSteps, linkStep, ...p2Steps]

    const composedProof: ProofKernel = {
      frameInvariant: chainedFrameInvariant,
      witness: chainedWitness,
      proofSteps: allSteps,
      createdAt: Date.now(),
    }

    return {
      proof: composedProof,
      compatible: true,
      incompatibilityReason: null,
      strategy: {
        frameInvariant: 'chained',
        causalGraph: 'forward_chain',
        witness: 'chained',
      },
    }
  }

  /**
   * 描述组合
   */
  describe(result: ComposeResult): string {
    if (!result.compatible) {
      return `Compose = incompatible: ${result.incompatibilityReason}`
    }
    const proof = result.proof!
    return `Compose = { FrameInvariant: ${result.strategy.frameInvariant}, CausalGraph: ${result.strategy.causalGraph}, Witness: ${result.strategy.witness}, Steps: ${proof.proofSteps.length} }`
  }
}

/**
 * 单例 Engine
 */
export const composeEngine = new ComposeEngine()
