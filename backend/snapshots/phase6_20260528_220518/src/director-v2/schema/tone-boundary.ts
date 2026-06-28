/**
 * Tone Boundary — 基调边界
 *
 * 定义可接受/不可接受的风格边界。
 * Review Engine 使用此边界判断镜头/场景设计是否越界。
 * ToneBoundary 是 Constitution 最"软"但又最重要的防御层。
 */

export interface ToneBoundary {
  /** 维度名称（如 humor, violence, romance, horror） */
  dimension: string

  /** 最小值（0-10） */
  min: number

  /** 最大值（0-10） */
  max: number

  /** 可选：越界时自动修正的策略 */
  autoCorrect?: 'clamp' | 'reject' | 'warn'

  /** 边界说明 */
  note?: string
}

// ============================================================
// 工厂函数：常见的基调边界模板
// ============================================================

export const PRESET_TONE_BOUNDARIES = {
  /** 合家欢 */
  familyFriendly: [
    { dimension: 'humor', min: 1, max: 6, autoCorrect: 'clamp', note: '轻度幽默' },
    { dimension: 'violence', min: 0, max: 2, autoCorrect: 'clamp', note: '无暴力' },
    { dimension: 'romance', min: 0, max: 3, autoCorrect: 'clamp', note: '含蓄' },
    { dimension: 'horror', min: 0, max: 1, autoCorrect: 'clamp', note: '无恐怖' },
  ] as ToneBoundary[],

  /** 暗黑成人 */
  darkMature: [
    { dimension: 'humor', min: 0, max: 4, autoCorrect: 'clamp', note: '黑色幽默' },
    { dimension: 'violence', min: 3, max: 8, autoCorrect: 'warn', note: '允许但克制的暴-力' },
    { dimension: 'romance', min: 1, max: 7, autoCorrect: 'clamp', note: '根据故事需要' },
    { dimension: 'horror', min: 2, max: 8, autoCorrect: 'warn', note: '悬疑惊悚' },
  ] as ToneBoundary[],
}
