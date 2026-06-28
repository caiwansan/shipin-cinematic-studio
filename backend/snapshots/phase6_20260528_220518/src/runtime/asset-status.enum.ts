/**
 * A2-1 asset-status.enum.ts — 10 态枚举 + 可读标签
 *
 * 纯枚举定义，零依赖。
 * 注意：AssetStatus 已在 A1-1 定义，此处复用并扩展，
 * 保持单一定义源。A1-1 是下游共享类型，此处作为 State Machine 专用的
 * 状态集合 + 可读标签。
 */

// 复用 A1-1 的 AssetStatus（单定义源）
import type { AssetStatus } from '../services/asset-canonical.schema.js'
import { AssetStatusLabels as AssetStatusLabelsOriginal } from '../services/asset-canonical.schema.js'
export type { AssetStatus } from '../services/asset-canonical.schema.js'

// 从 original 重新导出
export const AssetStatusLabels = AssetStatusLabelsOriginal

// 状态分类（用于 UI 色彩编码）
export const StatusCategories = {
  pending:    ['draft'],
  active:     ['processing', 'generating'],
  success:    ['optimized', 'generated', 'approved'],
  warning:    ['partial_failed', 'locked'],
  error:      ['failed'],
  archived:   ['archived'],
} as const

export type StatusCategory = keyof typeof StatusCategories
