// ============================================================
// Action Repository — CRUD for Action Registry
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { ActionData } from '../types.js'

function mapAction(row: any): ActionData {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider,
    config: row.config,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

export const actionRepository = {
  async create(data: ActionData): Promise<ActionData> {
    const row = await prisma.action.create({
      data: {
        name: data.name,
        description: data.description,
        provider: data.provider,
        config: data.config,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapAction(row)
  },

  async findById(id: string): Promise<ActionData | null> {
    const row = await prisma.action.findUnique({ where: { id } })
    return row ? mapAction(row) : null
  },

  async findByName(name: string): Promise<ActionData | null> {
    const row = await prisma.action.findUnique({ where: { name } })
    return row ? mapAction(row) : null
  },

  async list(): Promise<ActionData[]> {
    const rows = await prisma.action.findMany({ orderBy: { name: 'asc' } })
    return rows.map(mapAction)
  },

  async update(id: string, data: Partial<ActionData>): Promise<ActionData> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.config !== undefined) updateData.config = data.config

    const row = await prisma.action.update({ where: { id }, data: updateData })
    return mapAction(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.action.delete({ where: { id } })
  },

  async upsert(data: ActionData): Promise<ActionData> {
    const existing = await this.findByName(data.name)
    if (existing) {
      return this.update(existing.id!, data)
    }
    return this.create(data)
  },
}
