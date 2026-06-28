/**
 * semantic-anchor.ts — Phase B-4.6 Semantic Stabilization Layer
 *
 * ============================================================
 * SemanticAnchor: 当前 B-0 → B-4.5 全系统语义快照
 * ============================================================
 *
 * 不是新结构，不是 proof 增强。
 * 是"当前状态的不可变参照点"。
 *
 * 核心原则：
 *   1. 只捕获当前快照，不转换结构
 *   2. 不重新计算 proof
 *   3. frozen = true 后，不允许任何变异
 *   4. 是 B-5 Topos 构建的唯一合法入口
 *
 * 宪法：
 *   - 引用语义锚 = 引用冻结后的全局真理
 *   - SemanticAnchor 不是"更好的 proof"，是"锁定的 proof 世界"
 *   - 不做优化、不做重构、不做增强
 */

import type { FrameInvariant } from '../../frame/frame-invariant.js'
import type { CausalEdge } from '../../causality/causal-types.js'
import type { InternalLogic } from '../b45/internal-logic.js'
import type { MorphismSnapshot } from './freeze.js'

// ============================================================
// 1. SemanticAnchor — 语义锚
// ============================================================

export interface SemanticAnchor {
  /** 语义锚唯一签名 */
  signature: string
  /** FrameInvariant 快照 */
  frameInvariantSnapshot: Readonly<FrameInvariant>
  /** CausalGraph 快照 */
  causalGraphSnapshot: ReadonlyArray<Readonly<CausalEdge>>
  /** Morphism 快照 */
  morphismSnapshot: ReadonlyArray<Readonly<MorphismSnapshot>>
  /** Internal Logic 快照 */
  logicSnapshot: Readonly<InternalLogic>
  /** 冻结标记 */
  frozen: true
}

/**
 * 创建语义锚签名
 * 从 frameInvariant 签名 + logic 摘要生成
 */
export function buildAnchorSignature(
  frameSig: string,
  logicSummary: string
): string {
  const raw = `${frameSig}::${logicSummary}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Deep freeze — 递归冻结对象
 * 确保 JavaScript 层无法修改
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  const propNames = Object.getOwnPropertyNames(obj)
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name]
    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  }

  return Object.freeze(obj) as Readonly<T>
}

/**
 * 验证 SemanticAnchor 是否完整冻结
 */
export function isAnchorFrozen(anchor: SemanticAnchor): boolean {
  return anchor.frozen === true
    && typeof anchor.signature === 'string'
    && anchor.signature.length > 0
    && anchor.frameInvariantSnapshot !== undefined
    && anchor.causalGraphSnapshot !== undefined
    && anchor.morphismSnapshot !== undefined
    && anchor.logicSnapshot !== undefined
}
