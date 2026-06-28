/**
 * Cinematic Identity — 电影身份
 *
 * 导演风格认同标识。定义本作品的「电影 DNA」。
 * 这是视觉上区分"这个导演的作品"和"AI 随机生成"的关键。
 */

export interface CinematicIdentity {
  /** 主要风格影响源（导演/电影/运动） */
  primaryInfluences: string[]

  /** 签名元素（本作品特有的视觉/叙事签名） */
  signatureElements: SignatureElement[]

  /** 时代标签 */
  eraTags: EraTag[]

  /** 视觉一致性等级（影响 review engine 的严格度） */
  visualConsistencyLevel: 'standard' | 'strict' | 'creative'

  /** 风格置信区间（允许偏离的范围，0=必须精确匹配，1=可自由发挥） */
  styleDeviationBudget?: number

  /** 可选：一号作品的风格指纹（用于跨作品一致性） */
  franchiseFingerprint?: string
}

export interface SignatureElement {
  /** 元素名称 */
  name: string

  /** 元素描述 */
  description: string

  /** 必须性（每个场景/镜头都必须包含） */
  mandatory: boolean
}

export type EraTag =
  | 'classic_hollywood'
  | 'new_wave'
  | 'neo_noir'
  | 'post_modern'
  | 'contemporary'
  | 'futurist'
  | 'retro_futurist'
  | 'vaporwave'
  | 'anime_influenced'
  | 'documentary'
  | 'experimental'
  | 'custom'
