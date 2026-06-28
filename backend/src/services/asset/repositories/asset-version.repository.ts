// ============================================================
// Asset Version Repository — version management
// ============================================================

import { prisma } from '../../../utils/index.js'

export const assetVersionRepository = {
  async createVersion(assetId: string, content: string | null, hash?: string) {
    // Compute next version number
    const lastVersion = await prisma.unifiedAssetVersion.findFirst({
      where: { assetId },
      orderBy: { version: 'desc' },
    })
    const version = (lastVersion?.version || 0) + 1

    return prisma.unifiedAssetVersion.create({
      data: { assetId, version, content, hash: hash || null },
    })
  },

  async listVersions(assetId: string) {
    return prisma.unifiedAssetVersion.findMany({
      where: { assetId },
      orderBy: { version: 'desc' },
    })
  },

  async getVersion(assetId: string, version: number) {
    return prisma.unifiedAssetVersion.findUnique({
      where: { assetId_version: { assetId, version } },
    })
  },

  async getLatestVersion(assetId: string) {
    return prisma.unifiedAssetVersion.findFirst({
      where: { assetId },
      orderBy: { version: 'desc' },
    })
  },

  async restoreVersion(assetId: string, version: number) {
    const v = await prisma.unifiedAssetVersion.findUnique({
      where: { assetId_version: { assetId, version } },
    })
    if (!v) return null
    return prisma.unifiedAsset.update({
      where: { id: assetId },
      data: { content: v.content, hash: v.hash || undefined },
    })
  },
}
