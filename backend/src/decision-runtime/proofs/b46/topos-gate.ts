/**
 * topos-gate.ts — Phase B-4.6 Semantic Stabilization Layer
 *
 * ============================================================
 * Topos Gate: B-5 的唯一合法入口
 * ============================================================
 *
 * 没有 frozen anchor → 不允许进入 B-5 Topos 构建。
 *
 * 这不是"可以跳过"的检查——是结构要求。
 * B-5 需要语义固定的基底，否则 topos 中的 truth 会漂移。
 *
 * 宪法：
 *   - toposGate 是 B-5 的唯一入口
 *   - 如果 anchor 未冻结，拒绝进入 Topos
 *   - 不提供 bypass 机制
 *   - isToposReady 只读检查，不修改任何状态
 */

import type { SemanticAnchor } from './semantic-anchor.js'
import { isAnchorFrozen } from './semantic-anchor.js'

// ============================================================
// 1. Topos Gate
// ============================================================

export class ToposGate {
  /**
   * isReady(anchor): 检查是否可进入 B-5 Topos
   *
   * 条件：
   *   - anchor frozen = true
   *   - anchor 快照完整
   */
  isReady(anchor: SemanticAnchor): boolean {
    return isAnchorFrozen(anchor)
  }

  /**
   * requireReady(anchor): 强制门控
   * 未冻结 → 抛错，阻止 B-5 构建
   */
  requireReady(anchor: SemanticAnchor): void {
    if (!this.isReady(anchor)) {
      throw new Error(
        `[B-4.6] Topos Gate Rejected: anchor "${anchor.signature}" is not frozen. ` +
        `Semantic stabilization required before B-5 construction.`
      )
    }
  }
}

/**
 * 单例 ToposGate
 */
export const toposGate = new ToposGate()
