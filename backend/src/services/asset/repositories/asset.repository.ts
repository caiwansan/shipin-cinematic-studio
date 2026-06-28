// ============================================================
// Asset Repository — CRUD + list + search for UnifiedAsset
// Repository 只操作 Prisma，不做业务逻辑
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { AssetData, AssetFilter } from '../types.js'

function mapFilter(filter: AssetFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (filter.projectId) where.projectId = filter.projectId
  if (filter.type) where.type = filter.type
  if (filter.status) where.status = filter.status
  if (filter.source) where.source = filter.source
  if (filter.language) where.language = filter.language
  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: 'insensitive' } },
      { content: { contains: filter.search, mode: 'insensitive' } },
      { summary: { contains: filter.search, mode: 'insensitive' } },
    ]
  }
  if (filter.tag) {
    where.tags = { some: { tag: filter.tag } }
  }
  return where
}

export const assetRepository = {
  async create(data: AssetData) {
    return prisma.unifiedAsset.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        title: data.title,
        language: data.language || 'zh',
        source: data.source || null,
        sourceUrl: data.sourceUrl || null,
        content: data.content || null,
        summary: data.summary || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        hash: data.hash || null,
        status: data.status || 'draft',
      },
      include: { tags: true },
    })
  },

  async findById(id: string) {
    return prisma.unifiedAsset.findUnique({
      where: { id },
      include: { tags: true, versions: { orderBy: { version: 'desc' }, take: 5 } },
    })
  },

  async findByHash(hash: string) {
    return prisma.unifiedAsset.findFirst({ where: { hash } })
  },

  async list(filter: AssetFilter) {
    const where = mapFilter(filter)
    const limit = filter.limit || 50
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.unifiedAsset.findMany({
        where: where as any,
        include: { tags: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.unifiedAsset.count({ where: where as any }),
    ])
    return { items, total }
  },

  async update(id: string, data: Partial<AssetData>) {
    return prisma.unifiedAsset.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.metadata !== undefined ? { metadata: JSON.stringify(data.metadata) } : {}),
        ...(data.hash !== undefined ? { hash: data.hash } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { tags: true },
    })
  },

  async softDelete(id: string) {
    return prisma.unifiedAsset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'archived' },
    })
  },

  async hardDelete(id: string) {
    return prisma.unifiedAsset.delete({ where: { id } })
  },

  async getStats(projectId: string): Promise<Record<string, number>> {
    const groups = await prisma.unifiedAsset.groupBy({
      by: ['type'],
      where: { projectId, deletedAt: null },
      _count: true,
    })
    const stats: Record<string, number> = { total: 0 }
    for (const g of groups) {
      stats[g.type] = g._count
      stats.total += g._count
    }
    return stats
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.unifiedAsset.count({
      where: { projectId, deletedAt: null },
    })
  },
}
