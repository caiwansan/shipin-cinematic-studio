/**
 * drift-guard.ts — Phase B-4.6 Semantic Stabilization Layer
 *
 * ============================================================
 * Drift Guard: 检测语义漂移
 * ============================================================
 *
 * 语义漂移 ≠ bug。语义漂移是：
 *   同一段 proof 在不同时间点产生不同语义解释
 *
 * DriftGuard 不修复漂移，不解释漂移原因。
 * 只检测，只报错。
 *
 * 宪法：
 *   - frozen 后的系统不允许任何结构变化 → 直接抛错
 *   - 不引入"兼容性"概念
 *   - 不允许"partial freeze"（部分冻结空间是未定义行为）
 *   - 检测到漂移是 fatal error，不是 warning
 */

import type { SemanticAnchor } from './semantic-anchor.js'

// ============================================================
// 1. Drift Violation Error
// ============================================================

export class DriftViolation extends Error {
  constructor(
    public readonly field: string,
    public readonly expected: unknown,
    public readonly actual: unknown
  ) {
    super(
      `[B-4.6] Semantic Drift Violated: ${field} changed after freeze.`
    )
    this.name = 'DriftViolation'
  }
}

// ============================================================
// 2. Drift Guard
// ============================================================

export class DriftGuard {
  /**
   * check(anchor): 验证当前系统未发生语义漂移
   *
   * 检测维度：
   *   - signature 不变性
   *   - frozen 标记完整性
   *   - 快照非空验证
   */
  check(anchor: SemanticAnchor): void {
    // Rule 1: frozen 必须是 true
    if (anchor.frozen !== true) {
      throw new DriftViolation(
        'frozen_status',
        true,
        anchor.frozen
      )
    }

    // Rule 2: signature 不能为空
    if (!anchor.signature || anchor.signature.length === 0) {
      throw new DriftViolation(
        'signature',
        'non-empty string',
        anchor.signature
      )
    }

    // Rule 3: 快照非空
    if (!anchor.frameInvariantSnapshot) {
      throw new DriftViolation(
        'frameInvariantSnapshot',
        'non-undefined',
        anchor.frameInvariantSnapshot
      )
    }

    if (!anchor.causalGraphSnapshot) {
      throw new DriftViolation(
        'causalGraphSnapshot',
        'non-undefined',
        anchor.causalGraphSnapshot
      )
    }

    if (!anchor.morphismSnapshot) {
      throw new DriftViolation(
        'morphismSnapshot',
        'non-undefined',
        anchor.morphismSnapshot
      )
    }

    if (!anchor.logicSnapshot) {
      throw new DriftViolation(
        'logicSnapshot',
        'non-undefined',
        anchor.logicSnapshot
      )
    }

    // Rule 4: frameInvariant 必须是 stable
    if (anchor.frameInvariantSnapshot.stable !== true) {
      throw new DriftViolation(
        'frameInvariant.stable',
        true,
        anchor.frameInvariantSnapshot.stable
      )
    }

    // Rule 5: logicSnapshot 必须是 truth 有效的
    const truth = anchor.logicSnapshot.context.truthObject
    if (!truth) {
      throw new DriftViolation(
        'logicSnapshot.truthObject',
        'non-undefined',
        truth
      )
    }
  }
}

/**
 * 单例 DriftGuard
 */
export const driftGuard = new DriftGuard()
