/**
 * ScoreCard — 通用评分数据模型
 *
 * 不绑定任何业务领域：Health / Knowledge / Visibility / Authority 全部复用此结构。
 * 此类型为冻结 Contract，不可修改。
 */

/** 等级枚举 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

/** 趋势方向 */
export type TrendDirection = 'up' | 'down' | 'flat'

/** 趋势信息 */
export interface TrendData {
  direction: TrendDirection
  delta: number
  label?: string
}

/** 评分模型 */
export interface ScoreCardModel {
  score: number
  grade: Grade
  gradeLabel: string
  trend?: TrendData
  summary?: string
}

/**
 * 等级颜色映射表
 *
 * A → 绿色 (#22c55e)
 * B → 蓝色 (#3b82f6)
 * C → 黄色 (#eab308)
 * D → 橙色 (#f97316)
 * F → 红色 (#ef4444)
 */
export const GRADE_COLORS: Record<Grade, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
}
