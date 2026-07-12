/**
 * HealthCard — 品牌健康业务组件数据模型
 *
 * 组合 ScoreCard + 状态管理（loading / error）的行为合约。
 * 此类型为冻结 Contract，不可修改。
 */

import type { ScoreCardModel } from './score-card'

/** 品牌健康卡片模型 */
export interface HealthCardModel {
  /** 评分数据 */
  score: ScoreCardModel
  /** 加载状态 */
  loading?: boolean
  /** 错误信息（存在时表示错误态） */
  error?: string
  /** 操作按钮文案 */
  actionLabel?: string
  /** 操作按钮回调 */
  onAction?: () => void
}
