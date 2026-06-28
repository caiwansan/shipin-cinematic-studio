/**
 * A2-2 asset-state-transition.ts — 状态迁移纯函数
 *
 * 定义 10 态之间的合法流转表。
 * 纯函数，零 DB 依赖。
 */

import type { AssetStatus } from './asset-status.enum.js'

// ─── 合法流转表 ───

const TransitionTable: Record<AssetStatus, AssetStatus[]> = {
  draft:           ['processing'],
  processing:      ['optimized', 'partial_failed', 'failed'],
  optimized:       ['approved', 'locked'],
  approved:        ['generating'],
  generating:      ['generated', 'partial_failed', 'failed'],
  partial_failed:  ['generating', 'optimized', 'approved', 'archived'],
  generated:       ['approved', 'archived'],
  failed:          ['draft', 'processing'],
  locked:          ['draft', 'optimized'],
  archived:        ['draft'],
}

// ─── 可读描述（用于错误提示） ───

const StatusLabel: Record<AssetStatus, string> = {
  draft:          '草稿',
  processing:     '处理中',
  optimized:      '已优化',
  approved:       '已确认',
  generating:     '生成中',
  partial_failed: '部分失败',
  generated:      '已生成',
  failed:         '失败',
  locked:         '已锁定',
  archived:       '已归档',
}

/**
 * 判断 from → to 是否合法
 */
export function isValidTransition(from: AssetStatus, to: AssetStatus): boolean {
  return TransitionTable[from]?.includes(to) ?? false
}

/**
 * 获取某个状态的所有合法后续
 */
export function getNextStatuses(current: AssetStatus): AssetStatus[] {
  return TransitionTable[current] ?? []
}

/**
 * 执行迁移（纯函数，不修改 DB）
 * 如果非法则 throw。
 */
export function transition(current: AssetStatus, next: AssetStatus): AssetStatus {
  if (!isValidTransition(current, next)) {
    const fromLabel = StatusLabel[current] || current
    const toLabel = StatusLabel[next] || next
    throw new Error(
      `状态不允许：${fromLabel}(${current}) → ${toLabel}(${next})`
    )
  }
  return next
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "asset-state",
  "mode": "SHADOW"
};

