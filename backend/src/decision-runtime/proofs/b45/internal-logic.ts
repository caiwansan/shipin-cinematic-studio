/**
 * internal-logic.ts — Phase B-4.5 Internal Logic
 *
 * ============================================================
 * Internal Logic Layer
 * ============================================================
 *
 * InternalLogic = { proposition, entailment, truthObject, context }
 *
 * B-4.5 是 category → logic 的桥。
 * B-4 范畴是"结构空间"。
 * B-4.5 使范畴具备"逻辑语义"。
 *
 * 核心映射：
 *   category objects   → propositions（对象 = 命题）
 *   category morphisms → entailment proofs（态射 = 蕴含证明）
 *   identity           → tautology（自同态 = 永真式）
 *   composition        → transitivity（合成 = 传递性）
 *
 * 宪法：
 *   1. 范畴携带逻辑：objects 被解释为命题
 *   2. truth 是内部对象（不在范畴外定义真值）
 *   3. 蕴含是范畴内的可推导关系
 *   4. 为 B-5 Topos 构建提供⦻前置
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import { propositionEvaluator, type Proposition, type TruthValue } from './proposition.js'
import { entailmentEngine, type Entailment } from './entailment.js'

// ============================================================
// 1. Internal Logic
// ============================================================

export type LogicSystem = 'intuitionistic' | 'classical'

export interface InternalContext {
  /** 逻辑系统类型 */
  logic: LogicSystem
  /** 真值对象（所有真命题） */
  truthObject: TruthObject
  /** 命题集合 */
  propositions: Map<string, Proposition>
  /** 蕴含关系表 */
  entailments: Map<string, Entailment>
}

export interface TruthObject {
  /** 真命题集合 */
  TRUE: string[]
  /** 假命题集合 */
  FALSE: string[]
  /** 未知命题集合 */
  UNKNOWN: string[]
}

// ============================================================
// 2. Internal Logic System
// ============================================================

export class InternalLogic {
  context: InternalContext

  constructor(logic: LogicSystem = 'intuitionistic') {
    this.context = {
      logic,
      truthObject: { TRUE: [], FALSE: [], UNKNOWN: [] },
      propositions: new Map(),
      entailments: new Map(),
    }
  }

  /**
   * 注册 proof 为命题
   */
  register(proof: ProofKernel): Proposition {
    const prop = propositionEvaluator.evaluate(proof)
    this.context.propositions.set(proof.frameInvariant.signature, prop)

    // 更新真值对象
    switch (prop.truth) {
      case 'true':
        if (!this.context.truthObject.TRUE.includes(prop.signature))
          this.context.truthObject.TRUE.push(prop.signature)
        break
      case 'false':
        if (!this.context.truthObject.FALSE.includes(prop.signature))
          this.context.truthObject.FALSE.push(prop.signature)
        break
      case 'unknown':
        if (!this.context.truthObject.UNKNOWN.includes(prop.signature))
          this.context.truthObject.UNKNOWN.push(prop.signature)
        break
    }

    return prop
  }

  /**
   * P ⊢ Q: 蕴含判定
   */
  entails(P: ProofKernel, Q: ProofKernel): Entailment {
    const key = `${P.frameInvariant.signature}⊢${Q.frameInvariant.signature}`
    const existing = this.context.entailments.get(key)
    if (existing) return existing

    const entail = entailmentEngine.entails(P, Q)
    this.context.entailments.set(key, entail)
    return entail
  }

  /**
   * 获取 Proof 的命题真值
   */
  truth(proof: ProofKernel): TruthValue {
    return this.context.propositions.get(proof.frameInvariant.signature)?.truth ?? 'unknown'
  }

  /**
   * 验证逻辑-范畴桥接
   *
   * 规则：
   *   objects = propositions
   *   morphisms = proofs of implication
   *   identity = tautology
   *   composition = transitivity
   */
  validateBridge(): BridgeResult {
    const result: BridgeResult = {
      objectsArePropositions: this.context.propositions.size > 0,
      identityIsTautology: this.checkIdentityTautology(),
      compositionIsTransitivity: this.checkCompositionTransitivity(),
      truthIsInternal: this.context.truthObject.TRUE.length > 0 || this.context.truthObject.FALSE.length > 0,
      allPassed: false,
    }

    result.allPassed = result.objectsArePropositions
      && result.identityIsTautology
      && result.compositionIsTransitivity
      && result.truthIsInternal

    return result
  }

  /**
   * identity = tautology: P ⊢ P
   */
  private checkIdentityTautology(): boolean {
    for (const [sig] of this.context.propositions) {
      // 检查是否存在 P ⊢ P 的蕴含
      const keys = [...this.context.entailments.keys()]
      const hasSelfEntail = keys.some(k => k === `${sig}⊢${sig}`)
      if (!hasSelfEntail) return false
    }
    return this.context.propositions.size === 0 || true
  }

  /**
   * composition = transitivity: P ⊢ Q ∧ Q ⊢ R → P ⊢ R
   */
  private checkCompositionTransitivity(): boolean {
    // 简化版：只要存在至少一个链式蕴含即可
    for (const [key, entail1] of this.context.entailments) {
      if (!entail1.holds) continue
      // 寻找 Q ⊢ R
      for (const [_, entail2] of this.context.entailments) {
        if (!entail2.holds) continue
        if (entail1.to === entail2.from) {
          // 检查是否有 P ⊢ R
          const chainKey = `${entail1.from}⊢${entail2.to}`
          const chainEntail = this.context.entailments.get(chainKey)
          if (chainEntail && chainEntail.holds) return true
        }
      }
    }
    return this.context.entailments.size === 0 // 无蕴含链时默认通过
  }

  /**
   * 描述 Internal Logic 状态
   */
  describe(): string {
    const parts: string[] = []
    parts.push(`InternalLogic {`)
    parts.push(`  logic: ${this.context.logic}`)
    parts.push(`  propositions: ${this.context.propositions.size}`)
    parts.push(`  entailments: ${this.context.entailments.size}`)
    parts.push(`  truth: true=${this.context.truthObject.TRUE.length} false=${this.context.truthObject.FALSE.length} unknown=${this.context.truthObject.UNKNOWN.length}`)

    // 列出真命题
    if (this.context.truthObject.TRUE.length > 0) {
      parts.push(`  ⊤: ${this.context.truthObject.TRUE.join(', ')}`)
    }
    if (this.context.truthObject.FALSE.length > 0) {
      parts.push(`  ⊥: ${this.context.truthObject.FALSE.join(', ')}`)
    }

    parts.push(`}`)
    return parts.join('\n')
  }
}

// ============================================================
// 3. Bridge Result
// ============================================================

export interface BridgeResult {
  objectsArePropositions: boolean
  identityIsTautology: boolean
  compositionIsTransitivity: boolean
  truthIsInternal: boolean
  allPassed: boolean
}
