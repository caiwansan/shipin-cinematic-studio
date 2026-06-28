// ============================================================
// Taxonomy Repository — CRUD for SemanticTaxonomy (tree support)
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticTaxonomyData, TaxonomyFilter } from '../types.js'

export const taxonomyRepository = {
  async create(data: SemanticTaxonomyData) {
    // Auto-generate path if parent provided
    let path = data.name
    let depth = 0
    if (data.parentId) {
      const parent = await this.findById(data.parentId)
      if (parent) {
        path = parent.path ? `${parent.path}/${data.name}` : `${parent.name}/${data.name}`
        depth = (parent.depth || 0) + 1
      }
    }

    return prisma.semanticTaxonomy.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        parentId: data.parentId || null,
        description: data.description || null,
        path: data.path || path,
        depth: data.depth ?? depth,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        schemaVersion: data.schemaVersion ?? 1,
      },
      include: { parent: true, children: true },
    })
  },

  async findById(id: string) {
    return prisma.semanticTaxonomy.findUnique({
      where: { id },
      include: { parent: true, children: true },
    })
  },

  async findByName(projectId: string, name: string) {
    return prisma.semanticTaxonomy.findFirst({
      where: { projectId, name: { equals: name, mode: 'insensitive' } },
      include: { parent: true, children: true },
    })
  },

  async list(filter: TaxonomyFilter) {
    const where: Record<string, unknown> = { projectId: filter.projectId }
    if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' }
    if (filter.parentId !== undefined) where.parentId = filter.parentId
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ]
    }

    const limit = filter.limit || 100
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.semanticTaxonomy.findMany({
        where: where as any,
        include: { parent: true, children: true },
        orderBy: [{ depth: 'asc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.semanticTaxonomy.count({ where: where as any }),
    ])
    return { items, total }
  },

  // Get full tree for a project (flat list with parent/child relationships)
  async getTree(projectId: string) {
    const nodes = await prisma.semanticTaxonomy.findMany({
      where: { projectId },
      include: { parent: true, children: true },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    })
    return nodes
  },

  // Get root nodes (no parent)
  async getRoots(projectId: string) {
    return prisma.semanticTaxonomy.findMany({
      where: { projectId, parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    })
  },

  // Get children of a specific node
  async getChildren(parentId: string) {
    return prisma.semanticTaxonomy.findMany({
      where: { parentId },
      include: { children: true },
      orderBy: { name: 'asc' },
    })
  },

  async update(id: string, data: Partial<SemanticTaxonomyData>) {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

    return prisma.semanticTaxonomy.update({
      where: { id },
      data: updateData,
      include: { parent: true, children: true },
    })
  },

  async delete(id: string) {
    // First detach children
    await prisma.semanticTaxonomy.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    })
    return prisma.semanticTaxonomy.delete({ where: { id } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticTaxonomy.count({ where: { projectId } })
  },
}
