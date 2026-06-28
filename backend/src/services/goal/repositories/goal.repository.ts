// ============================================================
// Goal Repository — CRUD for Goal
// Repository pattern: Service never directly touches Prisma
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { GoalData, GoalFilter } from '../types.js'

function mapGoal(row: any): GoalData {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    successCriteria: row.successCriteria,
    targetMetric: row.targetMetric,
    deadline: row.deadline?.toISOString(),
    priority: row.priority,
    status: row.status,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

export const goalRepository = {
  async create(data: GoalData): Promise<GoalData> {
    const row = await prisma.goal.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        successCriteria: data.successCriteria,
        targetMetric: data.targetMetric,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        priority: data.priority ?? 3,
        status: data.status ?? 'draft',
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapGoal(row)
  },

  async findById(id: string): Promise<GoalData | null> {
    const row = await prisma.goal.findUnique({ where: { id } })
    return row ? mapGoal(row) : null
  },

  async list(filter: GoalFilter): Promise<{ items: GoalData[]; total: number }> {
    const where: any = { projectId: filter.projectId }
    if (filter.status) where.status = filter.status
    if (filter.priority) where.priority = filter.priority
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { description: { contains: filter.search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      prisma.goal.count({ where }),
    ])
    return { items: items.map(mapGoal), total }
  },

  async update(id: string, data: Partial<GoalData>): Promise<GoalData> {
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.successCriteria !== undefined) updateData.successCriteria = data.successCriteria
    if (data.targetMetric !== undefined) updateData.targetMetric = data.targetMetric
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.status !== undefined) updateData.status = data.status
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.goal.update({ where: { id }, data: updateData })
    return mapGoal(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.goal.delete({ where: { id } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.goal.count({ where: { projectId } })
  },

  async countByStatus(projectId: string, status: string): Promise<number> {
    return prisma.goal.count({ where: { projectId, status } })
  },
}
