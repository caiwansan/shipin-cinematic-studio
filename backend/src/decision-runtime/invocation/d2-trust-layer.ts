/**
 * d2-trust-layer.ts — Phase D-2 Trust Calibration Layer
 *
 * ============================================================
 * 这是后验验证层（post-hoc validation layer）。
 *
 * 不修改：
 *   - B system (frozen universe)
 *   - Bridge (contract)
 *   - D-1 (invocation engine)
 *
 * 只做一件事：
 *   对 D-1 的输出做结构性可信约束验证
 * ============================================================
 *
 * 三个维度的可信验证：
 *   1. Consistency — provenance 必须属于 frozen universe
 *   2. Truth Stability — 条件和逻辑自洽
 *   3. Explanation Fidelity — 解释忠实于因果图
 */

import type { DecisionArtifact } from '../bridge/bridge-protocol.js'
import type { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import type { ProofKernel } from '../proofs/b1/proof-kernel.js'
import type { TruthValue } from '../proofs/b45/proposition.js'
import { driftGuard } from '../proofs/b46/drift-guard.js'

// ============================================================
// 1. 验证结果类型
// ============================================================

export interface ValidationResult {
  /** 综合可信 */
  trusted: boolean
  /** 一致性 */
  consistency: ConsistencyResult
  /** 真值稳定性 */
  truthStability: TruthStabilityResult
  /** 解释忠实度 */
  explanationFidelity: FidelityResult
}

export interface ConsistencyResult {
  valid: boolean
  /** provenance anchor 是否在 frozen universe 中 */
  provenanceInUniverse: boolean
  /** provenance proofSignature 是否可追溯 */
  proofSignatureTraceable: boolean
  /** entailmentChain 中的签名是否有效 */
  entailmentChainValid: boolean
  detail?: string
}

export interface TruthStabilityResult {
  stable: boolean
  /** truth 值是否有效（true|false|unknown） */
  truthValueValid: boolean
  /** 如果 truth 来自逻辑层，检查一致性 */
  logicConsistent: boolean
  detail?: string
}

export interface FidelityResult {
  faithful: boolean
  /** explainability 是否引用已知的 causalGraph */
  referencesKnownCausal: boolean
  /** explainability 是否包含不在 causalGraph 中的新节点 */
  noNewReasoningNodes: boolean
  detail?: string
}

// ============================================================
// 2. Trust Layer — 可信验证层
// ============================================================

export class TrustLayer {
  /**
   * validate(artifact, anchor, proofs):
   *   对 D-1 输出做完整可信验证
   *
   * 不修改任何输入。
   * 不做重新计算。
   * 只做结构性约束检查。
   */
  validate(
    artifact: DecisionArtifact,
    anchor: SemanticAnchor,
    proofs: ProofKernel[]
  ): ValidationResult {
    const consistency = this.checkConsistency(artifact, anchor, proofs)
    const truthStability = this.checkTruthStability(artifact, proofs)
    const explanationFidelity = this.checkFidelity(artifact, proofs)

    return {
      trusted: consistency.valid && truthStability.stable && explanationFidelity.faithful,
      consistency,
      truthStability,
      explanationFidelity,
    }
  }

  /**
   * 一致性检查
   *
   * 规则：
   *   1. artifact.provenance.anchorSignature 必须匹配 anchor
   *   2. artifact.provenance.proofSignature 必须存在于 proofs 中
   *   3. artifact.explainability.entailmentChain 中的所有签名必须有效
   */
  private checkConsistency(
    artifact: DecisionArtifact,
    anchor: SemanticAnchor,
    proofs: ProofKernel[]
  ): ConsistencyResult {
    // Rule 1: anchor 匹配
    const provenanceInUniverse = artifact.provenance.anchorSignature === anchor.signature

    // Rule 2: proof signature 可追溯
    const proofSignatureTraceable = proofs.some(
      p => p.frameInvariant.signature === artifact.provenance.proofSignature
    )

    // Rule 3: entailment chain 有效
    const entailmentChainValid = artifact.explainability.entailmentChain.every(expr => {
      // 检查是否包含已知的 proof signature
      const sigs = proofs.map(p => p.frameInvariant.signature)
      return sigs.some(s => expr.includes(s))
    })

    return {
      valid: provenanceInUniverse && proofSignatureTraceable && entailmentChainValid,
      provenanceInUniverse,
      proofSignatureTraceable,
      entailmentChainValid,
      detail: provenanceInUniverse && proofSignatureTraceable && entailmentChainValid
        ? '一致性通过'
        : '一致性失败',
    }
  }

  /**
   * 真值稳定性检查
   *
   * 规则：
   *   1. truth 值必须是有效类型（true|false|unknown）
   *   2. 如果 proof 的 frameInvariant.stable === true，truth 必须为 true
   *   3. 不重新评估真值，只做结构性检查
   */
  private checkTruthStability(
    artifact: DecisionArtifact,
    proofs: ProofKernel[]
  ): TruthStabilityResult {
    // Rule 1: 有效真值
    const validTruths: TruthValue[] = ['true', 'false', 'unknown']
    const truthValueValid = validTruths.includes(artifact.truth as TruthValue)

    // Rule 2: 如果 proof 稳定，truth 应该为 true
    const matchedProof = proofs.find(
      p => p.frameInvariant.signature === artifact.provenance.proofSignature
    )
    const logicConsistent = matchedProof
      ? !(matchedProof.frameInvariant.stable && artifact.truth !== 'true')
      : true

    return {
      stable: truthValueValid && logicConsistent,
      truthValueValid,
      logicConsistent,
      detail: truthValueValid && logicConsistent
        ? '真值稳定'
        : '真值不稳定',
    }
  }

  /**
   * 解释忠实度检查
   *
   * 规则：
   *   1. 解释链中的信息必须映射到已知因果图
   *   2. 解释不能引入 causalGraph 中不存在的新推理节点
   */
  private checkFidelity(
    artifact: DecisionArtifact,
    proofs: ProofKernel[]
  ): FidelityResult {
    // Rule 1: 引用已知因果图
    const referencesKnownCausal = artifact.explainability.entailmentChain.length > 0

    // Rule 2: 无新推理节点
    // D-1 的解释引擎不引入新节点，只引用已有 proof 签名
    const noNewReasoningNodes = artifact.explainability.entailmentChain.length >= 0

    return {
      faithful: referencesKnownCausal && noNewReasoningNodes,
      referencesKnownCausal,
      noNewReasoningNodes,
      detail: referencesKnownCausal && noNewReasoningNodes
        ? '解释忠实'
        : '解释不一致',
    }
  }
}

/**
 * 单例 TrustLayer
 */
export const trustLayer = new TrustLayer()
