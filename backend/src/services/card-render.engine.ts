/**
 * C1-2 Card Render Engine — 资产 → 卡片 只读渲染
 *
 * 将 AssetVersion 内容转换为前端可用的卡片格式
 */

import { prisma } from '../utils/index.js'
import { CardMeta, CardData, CardType, CardStatus } from './card-contract.js'

const statusMap: Record<string, CardStatus> = {
  draft: 'draft',
  processing: 'locked',
  optimized: 'optimized',
  approved: 'approved',
  generated: 'optimized',
}

export class CardRenderEngine {
  /**
   * 渲染单个资产为卡片
   */
  async renderCard(assetId: string, type?: CardType): Promise<CardData | null> {
    const asset = await prisma.assetRegistry.findUnique({
      where: { id: assetId },
    })
    if (!asset) return null

    // 获取最新版本
    const latestVersion = await prisma.assetVersion.findFirst({
      where: { assetRegistryId: assetId },
      orderBy: { version: 'desc' },
    })

    const meta: CardMeta = {
      id: assetId,
      assetId: assetId,
      projectId: asset.projectId,
      type: (type as CardType) || (asset.type as CardType) || 'scene',
      status: statusMap[asset.status] || 'draft',
      version: asset.currentVersion,
      summary: latestVersion?.diffSummary || undefined,
      updatedAt: asset.updatedAt.toISOString(),
    }

    return {
      meta,
      rawContent: latestVersion?.content || {},
      renderedContent: latestVersion?.content || {},
      prompt: latestVersion?.prompt || {},
      versionId: latestVersion?.id,
      diffSummary: latestVersion?.diffSummary || undefined,
    }
  }

  /**
   * 渲染项目下所有资产为卡片列表
   */
  async renderProjectCards(projectId: string): Promise<CardData[]> {
    const assets = await prisma.assetRegistry.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })

    const cards: CardData[] = []
    for (const asset of assets) {
      const card = await this.renderCard(asset.id, asset.type as CardType)
      if (card) cards.push(card)
    }
    return cards
  }

  /**
   * 批量渲染指定类型资产
   */
  async renderCardsByType(projectId: string, type: CardType): Promise<CardData[]> {
    const assets = await prisma.assetRegistry.findMany({
      where: { projectId, type },
      orderBy: { sortOrder: 'asc' },
    })

    const cards: CardData[] = []
    for (const asset of assets) {
      const card = await this.renderCard(asset.id, type)
      if (card) cards.push(card)
    }
    return cards
  }
}

export const cardRenderEngine = new CardRenderEngine()
