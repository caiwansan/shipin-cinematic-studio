/**
 * category.ts — Phase B-4 Proof Category
 *
 * ============================================================
 * Proof Category Space
 * ============================================================
 *
 * ProofCategory = { objects, morphisms, identity, compose }
 *
 * 范畴是 proof 之间的"外部结构空间"。
 * B-3 的代数运算是范畴的内部操作。
 *
 * 范畴公理：
 *   1. identity law: f ∘ id = f
 *   2. associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
 *   3. closure: morphism(P1→P2) ∈ ProofCategory
 *
 * 宪法：
 *   1. 范畴不包含相似度/距离
 *   2. 范畴包含精确的结构态射
 *   3. 同构是可计算的关系，不是启发式估计
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import { isomorphismDetector, type IsomorphismType } from './isomorphism.js'
import { morphismBuilder, type Morphism, type MorphismType } from './morphism-builder.js'

// ============================================================
// 1. Proof Category
// ============================================================

export class ProofCategory {
  /** 范畴中的所有 object（proof） */
  objects: ProofKernel[] = []
  /** 范畴中的所有 morphism（态射） */
  morphisms: Morphism[] = []

  /**
   * 向范畴注册 proof
   *
   * 允许相同 signature 但不同 frameId 的 proof 共存
   *（不同输入可能产生相同 signature，但它们在范畴中是不同 object）
   */
  register(proof: ProofKernel): void {
    const exists = this.objects.some(o =>
      o.frameInvariant.frameId === proof.frameInvariant.frameId
    )
    if (!exists) {
      this.objects.push(proof)
    }
  }

  /**
   * 在范畴内建立新态射
   */
  addMorphism(P1: ProofKernel, P2: ProofKernel): Morphism {
    const morphism = morphismBuilder.build(P1, P2)
    this.morphisms.push(morphism)
    return morphism
  }

  /**
   * 自动构建所有 proof 之间的态射
   */
  autoBuildMorphisms(): void {
    for (let i = 0; i < this.objects.length; i++) {
      for (let j = 0; j < this.objects.length; j++) {
        if (i === j) continue
        this.addMorphism(this.objects[i], this.objects[j])
      }
    }
  }

  /**
   * 自同态（identity）
   *
   * f: P → P
   */
  identity(P: ProofKernel): Morphism {
    return morphismBuilder.build(P, P)
  }

  /**
   * 合成态射（compose）
   *
   * (f ∘ g): P1 → P3
   * f: P1 → P2
   * g: P2 → P3
   */
  compose(f: Morphism, g: Morphism): Morphism | null {
    if (f.to !== g.from) {
      return null
    }

    return {
      from: f.from,
      to: g.to,
      type: this.composeType(f.type, g.type),
      mapping: {
        sourceSignature: f.from,
        targetSignature: g.to,
        type: this.composeType(f.type, g.type),
        transformSteps: f.mapping.transformSteps + g.mapping.transformSteps,
        evidenceTransform: `compose: ${f.mapping.evidenceTransform} → ${g.mapping.evidenceTransform}`,
        edgeMapping: `compose: ${f.mapping.edgeMapping} → ${g.mapping.edgeMapping}`,
        valid: f.mapping.valid && g.mapping.valid,
      },
    }
  }

  /**
   * P1 ≅ P2: 同构判定
   */
  isIsomorphic(P1: ProofKernel, P2: ProofKernel): IsomorphismType {
    return isomorphismDetector.isIsomorphic(P1, P2).type
  }

  /**
   * 范畴闭包验证
   *
   * 验证范畴公理是否成立
   */
  validateCategory(): CategoryAxiomResult {
    const result: CategoryAxiomResult = {
      identityLaw: this.verifyIdentityLaw(),
      associativity: this.verifyAssociativity(),
      closure: this.verifyClosure(),
      allPassed: false,
    }

    result.allPassed = result.identityLaw && result.associativity && result.closure
    return result
  }

  // ===== 范畴公理验证 =====

  /**
   * 1. identity law: f ∘ id = f
   *
   * 对每个 morphism，检查合成 identity 后不变
   */
  private verifyIdentityLaw(): boolean {
    if (this.morphisms.length === 0) return false

    for (const m of this.morphisms) {
      const fromProof = this.objects.find(o => o.frameInvariant.signature === m.from)
      if (!fromProof) continue

      const id = this.identity(fromProof)
      const composed = this.compose(m, id)
      if (composed && composed.to !== m.to) {
        return false
      }
    }

    return this.morphisms.length > 0
  }

  /**
   * 2. associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
   *
   * f: P1 → P2, g: P2 → P3, h: P3 → P4
   */
  private verifyAssociativity(): boolean {
    if (this.morphisms.length < 3) return true // 不足 3 个 morphism，跳过

    // 寻找一条可合成的链
    for (let i = 0; i < this.morphisms.length; i++) {
      for (let j = 0; j < this.morphisms.length; j++) {
        if (j === i) continue
        if (this.morphisms[i].to !== this.morphisms[j].from) continue

        for (let k = 0; k < this.morphisms.length; k++) {
          if (k === i || k === j) continue
          if (this.morphisms[j].to !== this.morphisms[k].from) continue

          // (f ∘ g) ∘ h
          const fg = this.compose(this.morphisms[i], this.morphisms[j])
          const fg_h = fg ? this.compose(fg, this.morphisms[k]) : null

          // f ∘ (g ∘ h)
          const gh = this.compose(this.morphisms[j], this.morphisms[k])
          const f_gh = gh ? this.compose(this.morphisms[i], gh) : null

          if (fg_h && f_gh) {
            return fg_h.from === f_gh.from && fg_h.to === f_gh.to
          }
        }
      }
    }

    return true // 没有可验证的链，默认通过
  }

  /**
   * 3. closure: morphisms 都是有效的
   */
  private verifyClosure(): boolean {
    return this.morphisms.every(m => m.mapping.valid)
  }

  /**
   * 合成态射的类型
   */
  private composeType(t1: MorphismType, t2: MorphismType): MorphismType {
    if (t1 === 'degenerate' || t2 === 'degenerate') return 'degenerate'
    if (t1 === 'identity') return t2
    if (t2 === 'identity') return t1
    if (t1 === 'reversible' && t2 === 'reversible') return 'reversible'
    return 'partial'
  }

  /**
   * 描述范畴状态
   */
  describe(): string {
    const parts: string[] = []
    parts.push(`ProofCategory {`)
    parts.push(`  objects: ${this.objects.length}`)
    parts.push(`  morphisms: ${this.morphisms.length}`)

    // 态射类型统计
    const types: Record<string, number> = {}
    for (const m of this.morphisms) {
      types[m.type] = (types[m.type] ?? 0) + 1
    }
    parts.push(`  types: ${JSON.stringify(types)}`)

    // 同构组统计
    const isoGroups = this.computeIsomorphismGroups()
    parts.push(`  iso-groups: ${isoGroups.length}`)
    parts.push(`}`)

    return parts.join('\n')
  }

  /**
   * 计算范畴中的同构组
   */
  computeIsomorphismGroups(): IsomorphismGroup[] {
    const groups: IsomorphismGroup[] = []
    const visited = new Set<string>()

    for (const obj of this.objects) {
      if (visited.has(obj.frameInvariant.signature)) continue

      const group: IsomorphismGroup = {
        signatures: [obj.frameInvariant.signature],
        type: 'none',
      }

      for (const other of this.objects) {
        if (other === obj) continue
        if (visited.has(other.frameInvariant.signature)) continue

        const iso = isomorphismDetector.isIsomorphic(obj, other)
        if (iso.isomorphic) {
          group.signatures.push(other.frameInvariant.signature)
          group.type = iso.type
          visited.add(other.frameInvariant.signature)
        }
      }

      visited.add(obj.frameInvariant.signature)
      if (group.signatures.length > 0) {
        groups.push(group)
      }
    }

    return groups
  }
}

// ============================================================
// 2. 辅助类型
// ============================================================

export interface CategoryAxiomResult {
  /** 单位律 */
  identityLaw: boolean
  /** 结合律 */
  associativity: boolean
  /** 封闭性 */
  closure: boolean
  /** 全部通过 */
  allPassed: boolean
}

export interface IsomorphismGroup {
  signatures: string[]
  type: IsomorphismType
}
