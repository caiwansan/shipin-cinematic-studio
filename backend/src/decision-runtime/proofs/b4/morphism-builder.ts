/**
 * morphism-builder.ts — Phase B-4 Proof Category
 *
 * ============================================================
 * Morphism Generator (→)
 * ============================================================
 *
 * morphism: P1 → P2 = StructuralMapping
 *
 * 态射不是"差异报告"，不是"变化幅度"。
 * 态射是：proof A 到 proof B 的合法结构变换路径。
 *
 * 类型：
 *   - identity:   P → P（自同态，每个 proof 都有）
 *   - reversible: P1 → P2 ∧ P2 → P1（可逆态射 → 同构）
 *   - partial:    P1 → P2（evidence/subsets 部分变换）
 *   - degenerate: P → nothing（退化态射，单向变换失败）
 *
 * 宪法：
 *   1. 态射不基于距离/similarity
 *   2. 态射基于结构映射规则
 *   3. 每个态射可应用于 proof 产生新的 proof
 */

import type { ProofKernel } from '../b1/proof-kernel.js'

// ============================================================
// 1. 态射类型
// ============================================================

export type MorphismType =
  | 'identity'      // P → P
  | 'reversible'    // P1 → P2 且 P2 → P1
  | 'partial'       // P1 → P2 部分变换
  | 'degenerate'    // P → nothing

export interface MorphismTransform {
  /** 变换描述 */
  description: string
  /** 是否可通过 apply 验证 */
  verifiable: boolean
}

export interface StructuralMapping {
  /** 源 proof 的 signature */
  sourceSignature: string
  /** 目标 proof 的 signature */
  targetSignature: string
  /** 映射类型 */
  type: MorphismType
  /** 变换步数 */
  transformSteps: number
  /** evidence 变换说明 */
  evidenceTransform: string
  /** 因果边映射 */
  edgeMapping: string
  /** 态射是否合法 */
  valid: boolean
  /** 如果可逆，逆态射的 signature */
  inverseSignature?: string
}

export interface Morphism {
  from: string  // source proof 的 signature
  to: string    // target proof 的 signature
  type: MorphismType
  mapping: StructuralMapping
}

// ============================================================
// 2. Morphism Builder
// ============================================================

export class MorphismBuilder {
  /**
   * 构造 P1 → P2 的态射
   */
  build(P1: ProofKernel, P2: ProofKernel): Morphism {
    // 1. identity 检测
    if (P1.frameInvariant.signature === P2.frameInvariant.signature) {
      return this.identityMorphism(P1)
    }

    // 2. 检查可逆性（结构性相似）
    const reversible = this.isPotentiallyReversible(P1, P2)

    // 3. 计算证据变换
    const evidenceTransform = this.computeEvidenceTransform(P1, P2)

    // 4. 边缘映射
    const edgeMapping = this.computeEdgeMapping(P1, P2)

    const mapping: StructuralMapping = {
      sourceSignature: P1.frameInvariant.signature,
      targetSignature: P2.frameInvariant.signature,
      type: reversible ? 'reversible' : 'partial',
      transformSteps: reversible ? P1.proofSteps.length + P2.proofSteps.length : Math.abs(P1.proofSteps.length - P2.proofSteps.length),
      evidenceTransform,
      edgeMapping,
      valid: true,
    }

    if (reversible) {
      mapping.inverseSignature = P2.frameInvariant.signature
    }

    return {
      from: P1.frameInvariant.signature,
      to: P2.frameInvariant.signature,
      type: mapping.type,
      mapping,
    }
  }

  /**
   * P → P: 自同态
   */
  private identityMorphism(P: ProofKernel): Morphism {
    return {
      from: P.frameInvariant.signature,
      to: P.frameInvariant.signature,
      type: 'identity',
      mapping: {
        sourceSignature: P.frameInvariant.signature,
        targetSignature: P.frameInvariant.signature,
        type: 'identity',
        transformSteps: 0,
        evidenceTransform: 'identity (no change)',
        edgeMapping: 'identity (no change)',
        valid: true,
      },
    }
  }

  /**
   * 判断两个 proof 之间是否存在可逆态射
   *
   * 可逆条件：
   *   - 因果步数相同
   *   - evidence 数量相同
   *   - 等价类相同
   */
  private isPotentiallyReversible(P1: ProofKernel, P2: ProofKernel): boolean {
    const sameStepCount = P1.proofSteps.length === P2.proofSteps.length
    const sameEvidenceCount = P1.witness.evidence.length === P2.witness.evidence.length
    const sameClass = P1.frameInvariant.equivalenceClass === P2.frameInvariant.equivalenceClass

    return sameStepCount && sameEvidenceCount && sameClass
  }

  /**
   * 计算证据变换描述
   */
  private computeEvidenceTransform(P1: ProofKernel, P2: ProofKernel): string {
    const ev1 = P1.witness.evidence
    const ev2 = P2.witness.evidence

    if (ev1.length === 0 && ev2.length === 0) return 'no evidence'
    if (ev1.length === 0) return `add ${ev2.length} evidence`
    if (ev2.length === 0) return `remove ${ev1.length} evidence`
    if (ev1.length === ev2.length) return `replace ${ev1.length} evidence`
    return `resize ${ev1.length} → ${ev2.length} evidence`
  }

  /**
   * 计算边缘映射描述
   */
  private computeEdgeMapping(P1: ProofKernel, P2: ProofKernel): string {
    const s1 = P1.proofSteps.length
    const s2 = P2.proofSteps.length
    if (s1 === s2) return `${s1} edges, structurally preserved`
    if (s1 > s2) return `contract ${s1 - s2} edges`
    return `expand ${s2 - s1} edges`
  }

  /**
   * 描述态射
   */
  describe(morphism: Morphism): string {
    const labels: Record<MorphismType, string> = {
      identity: 'id',
      reversible: '↔',
      partial: '→',
      degenerate: '-/→',
    }

    const parts: string[] = []
    parts.push(`${morphism.from} ${labels[morphism.type]} ${morphism.to}`)
    parts.push(`  Type:     ${morphism.type}`)
    parts.push(`  Steps:    ${morphism.mapping.transformSteps}`)
    parts.push(`  Evidence: ${morphism.mapping.evidenceTransform}`)
    parts.push(`  Edges:    ${morphism.mapping.edgeMapping}`)
    parts.push(`  Valid:    ${morphism.mapping.valid}`)

    return parts.join('\n')
  }
}

/**
 * 单例 Builder
 */
export const morphismBuilder = new MorphismBuilder()
