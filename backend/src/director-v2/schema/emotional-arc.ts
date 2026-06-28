/**
 * Emotional Arc — 情感弧线
 *
 * 定义整部作品的情感演变轨迹。
 * 这是导演理解的核心输出之一，下游所有情感相关判断的根来源。
 */

// ============================================================
// Emotional Arc
// ============================================================

export interface EmotionalArc {
  /** 作品主导情感 */
  dominantEmotion: string

  /** 弧线类型 */
  arcType: EmotionalArcType

  /** 情感分段（每场戏或每个叙事单元） */
  segments: EmotionalArcSegment[]

  /** 最高情感强度（1-10） */
  peakIntensity: number

  /** 在哪个分段达到峰值 */
  peakSegmentIndex?: number

  /** 结尾的情感基调 */
  resolutionTone: string

  /** 可选：情感曲线描述（供 review engine 可视化参考） */
  curveDescription?: string
}

export type EmotionalArcType =
  | 'linear'        // 线性上升/下降
  | 'wave'          // 波浪型起伏
  | 'inverted_u'    // 倒U型（先升后降）
  | 'u_shape'       // U型（先降后升）
  | 'crescendo'     // 渐强（持续上升）
  | 'diminuendo'    // 渐弱（持续下降）
  | 'complex'       // 复杂/多段混合

// ============================================================
// Emotional Arc Segment
// ============================================================

export interface EmotionalArcSegment {
  /** 分段 ID */
  id: string

  /** 分段名称 */
  name: string

  /** 主要情绪 */
  primaryEmotion: string

  /** 次要情绪 */
  secondaryEmotion?: string

  /** 强度（1-10） */
  intensity: number

  /** 预期的情感变化方向 */
  direction: 'rising' | 'falling' | 'plateau' | 'spike' | 'drop'

  /** 分段时长占比（0-1，相对总时长） */
  durationRatio: number

  /** 关键事件描述 */
  trigger?: string

  /** 情绪标签（用于下游镜头规则匹配） */
  emotionTags: string[]
}
