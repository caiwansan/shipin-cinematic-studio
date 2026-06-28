/**
 * A2-3 asset-state-guard.ts — 守卫规则（防污染层）
 *
 * 供 workflow / API 层调用，避免非法操作。
 */

import type { AssetStatus } from './asset-status.enum.js'
import { isValidTransition } from './asset-state-transition.js'

export class StateGuard {
  /**
   * 断言状态迁移合法
   */
  static assertCanTransition(current: AssetStatus, target: AssetStatus): void {
    if (!isValidTransition(current, target)) {
      throw new Error(`状态不允许：${current} → ${target}`)
    }
  }

  /**
   * 断言资产当前可编辑（draft / optimized / partial_failed）
   */
  static assertEditable(status: AssetStatus): void {
    const editable: AssetStatus[] = ['draft', 'optimized', 'partial_failed']
    if (!editable.includes(status)) {
      throw new Error(`资产当前状态不可编辑：${status}`)
    }
  }

  /**
   * 断言资产未被锁定（非 locked, non-generating）
   */
  static assertNotLocked(status: AssetStatus): void {
    if (status === 'locked') {
      throw new Error('资产已被锁定，无法操作')
    }
    if (status === 'generating') {
      throw new Error('资产正在生成中，无法操作')
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "asset-state",
  "mode": "SHADOW"
};

