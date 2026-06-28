/**
 * freeze-pipeline.ts — Phase B-4.6 Semantic Stabilization Layer
 *
 * ============================================================
 * Freeze Pipeline: B-0 → B-4.5 → SemanticAnchor 统一入口
 * ============================================================
 *
 * 不改造任何现有模块。
 * 不增强 proof。
 * 只提供"从 B-0→B-4.5 到冻结语义锚"的统一链路。
 *
 * 用法：
 *   const pipeline = new FreezePipeline()
 *   const anchor = pipeline.freeze(proof, logic)
 *   // anchor 现在是 B-5 的唯一合法入口
 *
 * 宪法：
 *   - 单次 pipeline = 一次冻结
 *   - pipeline 不持有状态（纯函数管道）
 *   - freeze 之后如需 B-5，必须经 toposGate 检查
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import type { CausalEdge } from '../../causality/causal-types.js'
import { InternalLogic } from '../b45/internal-logic.js'
import { propositionEvaluator } from '../b45/proposition.js'
import { entailmentEngine } from '../b45/entailment.js'
import { FreezeEngine, freezeEngine } from './freeze.js'
import { DriftGuard, driftGuard, DriftViolation } from './drift-guard.js'
import { ToposGate, toposGate } from './topos-gate.js'
import { SemanticAnchor, isAnchorFrozen } from './semantic-anchor.js'

// ============================================================
// 1. Freeze Pipeline
// ============================================================

export class FreezePipeline {
  private engine: FreezeEngine
  private guard: DriftGuard
  private gate: ToposGate

  constructor() {
    this.engine = freezeEngine
    this.guard = driftGuard
    this.gate = toposGate
  }

  /**
   * freeze(proof): 单 proof 冻结
   *
   * 步骤：
   *   1. 用当前 proof 构建 InternalLogic
   *   2. 注册命题
   *   3. 冻结为 SemanticAnchor
   *   4. 验证锚完整性
   */
  freeze(proof: ProofKernel, causalEdges?: CausalEdge[]): SemanticAnchor {
    // Step 1: 构建内部逻辑（B-4.5）
    const logic = new InternalLogic('intuitionistic')
    logic.register(proof)

    // Step 2: 注册蕴含（自反）
    logic.entails(proof, proof)

    // Step 3: 冻结
    const anchor = this.engine.freeze(proof, logic, causalEdges)

    // Step 4: 验证
    this.guard.check(anchor)

    return anchor
  }

  /**
   * freezeAll(proofs): 批量冻结
   *
   * 步骤：
   *   1. 为每个 proof 构建 InternalLogic
   *   2. 注册所有命题
   *   3. 计算蕴含表
   *   4. 批量冻结
   */
  freezeAll(proofs: ProofKernel[]): SemanticAnchor[] {
    // Step 1: 共享一个 InternalLogic 实例（多 proof 共享逻辑宇宙）
    const logic = new InternalLogic('intuitionistic')

    // Step 2: 注册所有命题
    for (const proof of proofs) {
      logic.register(proof)
    }

    // Step 3: 计算蕴含表
    for (const P of proofs) {
      for (const Q of proofs) {
        logic.entails(P, Q)
      }
    }

    // Step 4: 批量冻结
    const anchors = this.engine.freezeAll(proofs, proofs.map(() => logic))

    // Step 5: 验证
    for (const anchor of anchors) {
      this.guard.check(anchor)
    }

    return anchors
  }

  /**
   * isFrozen(anchor): 检查是否已冻结
   */
  isFrozen(anchor: SemanticAnchor): boolean {
    return isAnchorFrozen(anchor)
  }

  /**
   * checkDrift(anchor): 漂移检测
   */
  checkDrift(anchor: SemanticAnchor): void {
    this.guard.check(anchor)
  }

  /**
   * requireToposReady(anchor): B-5 门控
   */
  requireToposReady(anchor: SemanticAnchor): void {
    this.gate.requireReady(anchor)
  }

  /**
   * canEnterB5(anchor): B-5 准入判断
   */
  canEnterB5(anchor: SemanticAnchor): boolean {
    return this.gate.isReady(anchor)
  }
}

/**
 * 单例 FreezePipeline
 */
export const freezePipeline = new FreezePipeline()

// 导出所有类型和类，方便 B-5 使用
export { SemanticAnchor, isAnchorFrozen } from './semantic-anchor.js'
export { freezeEngine, FreezeEngine } from './freeze.js'
export { driftGuard, DriftGuard, DriftViolation } from './drift-guard.js'
export { toposGate, ToposGate } from './topos-gate.js'
