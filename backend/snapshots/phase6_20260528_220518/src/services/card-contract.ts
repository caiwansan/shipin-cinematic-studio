/**
 * C1-1 Card Contract — 卡片契约接口
 *
 * 卡片是前端展示层与后端资产层的桥梁。
 * 只读渲染，不直接操作资产。
 */

export type CardType = 'character' | 'scene' | 'storyboard' | 'shot' | 'keyframe'

export type CardStatus = 'draft' | 'optimized' | 'approved' | 'generating' | 'locked'

/**
 * 精简版 CardMeta（供列表使用）
 */
export interface CardMeta {
  id: string
  assetId: string
  projectId: string
  type: CardType
  status: CardStatus
  version: number
  summary?: string
  updatedAt: string
}

/**
 * 完整卡片数据
 */
export interface CardData {
  meta: CardMeta
  rawContent: any
  renderedContent: any
  prompt?: any
  versionId?: string
  diffSummary?: string
}
