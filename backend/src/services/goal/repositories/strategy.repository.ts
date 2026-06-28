// ============================================================
// Strategy Repository — CRUD for Strategy
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { StrategyData, StrategyFilter } from '../types.js'

function mapStrategy(row: any): StrategyData {
  return {
    id: row.id,
    goalId: row.goalId,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

export const strategyRepository = {
  async create(data: StrategyData): Promise<StrategyData> {
    const row = await prisma.strategy.create({
      data: {
        goalId: data.goalId,
        name: data.name,
        description: data.description,
        type: data.type,
        status: data.status ?? 'draft',
        priority: data.priority ?? 3,
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapStrategy(row)
  },

  async createMany(dataList: StrategyData[]): Promise<StrategyData[]> {
    const rows = await Promise.all(dataList.map(d => this.create(d)))
    return rows
  },

  async findById(id: string): Promise<StrategyData | null> {
    const row = await prisma.strategy.findUnique({ where: { id } })
    return row ? mapStrategy(row) : null
  },

  async list(filter: StrategyFilter): Promise<{ items: StrategyData[]; total: number }> {
    const where: any = {}
    if (filter.goalId) where.goalId = filter.goalId
    if (filter.type) where.type = filter.type
    if (filter.status) where.status = filter.status

    const [items, total] = await Promise.all([
      prisma.strategy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      prisma.strategy.count({ where }),
    ])
    return { items: items.map(mapStrategy), total }
  },

  async listByGoal(goalId: string): Promise<StrategyData[]> {
    const rows = await prisma.strategy.findMany({ where: { goalId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapStrategy)
  },

  async update(id: string, data: Partial<StrategyData>): Promise<StrategyData> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.strategy.update({ where: { id }, data: updateData })
    return mapStrategy(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.strategy.delete({ where: { id } })
  },

  async deleteByGoal(goalId: string): Promise<void> {
    await prisma.strategy.deleteMany({ where: { goalId } })
  },

  async countByGoal(goalId: string): Promise<number> {
    return prisma.strategy.count({ where: { goalId } })
  },
}
