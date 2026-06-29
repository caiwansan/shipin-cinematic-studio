// ============================================================
// GEO SchemaMarkup Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { SchemaMarkup } from '../types'

function mapPrismaSchema(s: any): SchemaMarkup {
  return {
    id: s.id,
    entityId: s.entityId,
    schemaType: s.schemaType,
    markup: typeof s.markup === 'string' ? JSON.parse(s.markup) : s.markup,
    validationStatus: s.validationStatus,
    validationErrors: typeof s.validationErrors === 'string'
      ? JSON.parse(s.validationErrors)
      : (s.validationErrors || []),
    provenance: typeof s.provenance === 'string' ? JSON.parse(s.provenance) : s.provenance,
    metadata: s.metadata || undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export const geoSchemaRepository = {
  async create(data: {
    entityId: string
    schemaType: string
    markup: Record<string, unknown>
    validationStatus?: string
    validationErrors?: string[]
    provenance: any
    metadata?: Record<string, unknown>
  }): Promise<SchemaMarkup> {
    const schema = await prisma.gEOSchemaMarkup.create({
      data: {
        entityId: data.entityId,
        schemaType: data.schemaType,
        markup: data.markup as any,
        validationStatus: data.validationStatus || 'pending',
        validationErrors: (data.validationErrors || []) as any,
        provenance: data.provenance,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaSchema(schema)
  },

  async findById(id: string): Promise<SchemaMarkup | null> {
    const schema = await prisma.gEOSchemaMarkup.findUnique({ where: { id } })
    if (!schema) return null
    return mapPrismaSchema(schema)
  },

  async findByEntityId(entityId: string): Promise<SchemaMarkup[]> {
    const items = await prisma.gEOSchemaMarkup.findMany({
      where: { entityId },
    })
    return items.map(mapPrismaSchema)
  },

  async listByProjectId(projectId: string): Promise<SchemaMarkup[]> {
    const items = await prisma.gEOSchemaMarkup.findMany({
      where: { entity: { projectId } },
    })
    return items.map(mapPrismaSchema)
  },

  async findBySchemaType(schemaType: string): Promise<SchemaMarkup[]> {
    const items = await prisma.gEOSchemaMarkup.findMany({
      where: { schemaType },
    })
    return items.map(mapPrismaSchema)
  },

  async update(id: string, data: Partial<SchemaMarkup>): Promise<SchemaMarkup | null> {
    const existing = await prisma.gEOSchemaMarkup.findUnique({ where: { id } })
    if (!existing) return null

    const schema = await prisma.gEOSchemaMarkup.update({
      where: { id },
      data: {
        schemaType: data.schemaType,
        markup: data.markup as any,
        validationStatus: data.validationStatus,
        validationErrors: data.validationErrors as any,
        provenance: data.provenance as any,
        metadata: data.metadata as any,
      },
    })
    return mapPrismaSchema(schema)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOSchemaMarkup.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  async countByEntityId(entityId: string): Promise<number> {
    return prisma.gEOSchemaMarkup.count({ where: { entityId } })
  },
}
