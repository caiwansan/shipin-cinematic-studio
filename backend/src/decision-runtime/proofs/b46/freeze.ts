/**
 * freeze.ts — Phase B-4.6 Semantic Stabilization Layer
 *
 * ============================================================
 * Freeze Engine: 冻结整个 B-0 → B-4.5 系统为不可变语义锚
 * ============================================================
 *
 * freeze() 不做三件事：
 *   ❌ 不优化 proof
 *   ❌ 不重构 graph
 *   ❌ 不增强 logic
 *
 * 只做一件事：
 *   ✅ 把"当前状态"变成不可变参照点
 *
 * 宪法：
 *   - freeze 是纯捕获操作
 *   - 不会修改任何输入结构
 *   - frozen = true 后不可解冻
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import type { CausalEdge } from '../../causality/causal-types.js'
import type { InternalLogic } from '../b45/internal-logic.js'
import {
  buildAnchorSignature,
  deepFreeze,
} from './semantic-anchor.js'
import type { SemanticAnchor } from './semantic-anchor.js'

// ============================================================
// 1. Morphism 提取器（从 proof 推导态射信息）
// ============================================================

/**
 * 从 ProofKernel 的 witness 中提取态射信息
 * 不做结构性分析——只是把 witness 结构映射为 morphism-like 对象
 */
export interface MorphismSnapshot {
  source: string
  target: string
  type: 'identity' | 'derived'
}

function extractMorphismSnapshots(proof: ProofKernel): MorphismSnapshot[] {
  // identity morphism: proof → itself
  const morphisms: MorphismSnapshot[] = [{
    source: proof.frameInvariant.signature,
    target: proof.frameInvariant.signature,
    type: 'identity',
  }]

  return morphisms
}

// ============================================================
// 2. Freeze Engine
// ============================================================

export class FreezeEngine {
  /**
   * freeze(proof, logic): 把 proof 冻结为不可变语义锚
   *
   * 捕获：
   *   - frameInvariant（当前签名）
   *   - causalGraph（当前边集，从外部传入）
   *   - morphisms（从 witness 快照提取）
   *   - internal logic（B-4.5 命题+蕴含+真值）
   *
   * 输出：
   *   - 不可变 SemanticAnchor
   */
  freeze(
    proof: ProofKernel,
    logic: InternalLogic,
    causalEdges?: CausalEdge[]
  ): SemanticAnchor {
    // 捕获 morphisms（从 witness 快照提取）
    const morphisms = extractMorphismSnapshots(proof)

    // 生成签名
    const signature = buildAnchorSignature(
      proof.frameInvariant.signature,
      `props:${logic.context.propositions.size},ents:${logic.context.entailments.size}`
    )

    const anchor: SemanticAnchor = {
      signature,
      frameInvariantSnapshot: deepFreeze({ ...proof.frameInvariant }),
      causalGraphSnapshot: deepFreeze(causalEdges ?? []),
      morphismSnapshot: deepFreeze(morphisms),
      logicSnapshot: deepFreeze(logic),
      frozen: true,
    }

    return anchor
  }

  /**
   * 批量冻结
   */
  freezeAll(
    proofs: ProofKernel[],
    logics: InternalLogic[],
    causalEdges?: CausalEdge[]
  ): SemanticAnchor[] {
    return proofs.map((proof, i) =>
      this.freeze(proof, logics[i] ?? logics[0], causalEdges)
    )
  }
}

/**
 * 单例 FreezeEngine
 */
export const freezeEngine = new FreezeEngine()
