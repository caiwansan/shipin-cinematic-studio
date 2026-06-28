// ============================================================
// Asset Relation Repository — manage relations between assets
// ============================================================

import { prisma } from '../../../utils/index.js'

export const assetRelationRepository = {
  async createRelation(fromAssetId: string, toAssetId: string, relation: string) {
    return prisma.unifiedAssetRelation.create({
      data: { fromAssetId, toAssetId, relation },
    })
  },

  async listRelations(assetId: string) {
    const [from, to] = await Promise.all([
      prisma.unifiedAssetRelation.findMany({
        where: { fromAssetId: assetId },
        include: { toAsset: true },
      }),
      prisma.unifiedAssetRelation.findMany({
        where: { toAssetId: assetId },
        include: { fromAsset: true },
      }),
    ])
    return { outgoing: from, incoming: to }
  },

  async deleteRelation(id: string) {
    return prisma.unifiedAssetRelation.delete({ where: { id } })
  },

  async deleteRelationsForAsset(assetId: string) {
    await prisma.unifiedAssetRelation.deleteMany({
      where: { OR: [{ fromAssetId: assetId }, { toAssetId: assetId }] },
    })
  },
}
