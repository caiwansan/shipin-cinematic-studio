// ============================================================
// Task Repository — CRUD for Task + dependency management
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { TaskData, TaskFilter } from '../types.js'

function mapTask(row: any): TaskData {
  return {
    id: row.id,
    goalId: row.goalId,
    strategyId: row.strategyId,
    workflowId: row.workflowId,
    stageId: row.stageId,
    title: row.title,
    description: row.description,
    actionType: row.actionType,
    priority: row.priority,
    dependencies: row.dependencies,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    deadline: row.deadline?.toISOString(),
    status: row.status,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

export const taskRepository = {
  async create(data: TaskData): Promise<TaskData> {
    const row = await prisma.task.create({
      data: {
        goalId: data.goalId,
        strategyId: data.strategyId,
        workflowId: data.workflowId,
        stageId: data.stageId,
        title: data.title,
        description: data.description,
        actionType: data.actionType,
        priority: data.priority ?? 3,
        dependencies: data.dependencies,
        retryCount: data.retryCount ?? 0,
        maxRetries: data.maxRetries ?? 3,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        status: data.status ?? 'pending',
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapTask(row)
  },

  async createMany(dataList: TaskData[]): Promise<TaskData[]> {
    const rows = await Promise.all(dataList.map(d => this.create(d)))
    return rows
  },

  async findById(id: string): Promise<TaskData | null> {
    const row = await prisma.task.findUnique({ where: { id } })
    return row ? mapTask(row) : null
  },

  async list(filter: TaskFilter): Promise<{ items: TaskData[]; total: number }> {
    const where: any = {}
    if (filter.goalId) where.goalId = filter.goalId
    if (filter.strategyId) where.strategyId = filter.strategyId
    if (filter.workflowId) where.workflowId = filter.workflowId
    if (filter.stageId) where.stageId = filter.stageId
    if (filter.status) where.status = filter.status
    if (filter.actionType) where.actionType = filter.actionType

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: filter.limit ?? 100,
        skip: filter.offset ?? 0,
      }),
      prisma.task.count({ where }),
    ])
    return { items: items.map(mapTask), total }
  },

  async listByGoal(goalId: string): Promise<TaskData[]> {
    const rows = await prisma.task.findMany({ where: { goalId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapTask)
  },

  async listByStrategy(strategyId: string): Promise<TaskData[]> {
    const rows = await prisma.task.findMany({ where: { strategyId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapTask)
  },

  async listByWorkflow(workflowId: string): Promise<TaskData[]> {
    const rows = await prisma.task.findMany({ where: { workflowId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapTask)
  },

  async listByStage(stageId: string): Promise<TaskData[]> {
    const rows = await prisma.task.findMany({ where: { stageId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapTask)
  },

  /** Get tasks that are ready to execute (no pending dependencies) */
  async listReady(limit = 20): Promise<TaskData[]> {
    const rows = await prisma.task.findMany({
      where: { status: 'ready' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    return rows.map(mapTask)
  },

  /** Get tasks that are ready and have no dependencies OR all dependencies are completed */
  async listExecutable(limit = 20): Promise<TaskData[]> {
    const pendingTasks = await prisma.task.findMany({
      where: { status: 'ready' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })

    // Filter out tasks with incomplete dependencies
    const executable: any[] = []
    for (const task of pendingTasks) {
      if (!task.dependencies) {
        executable.push(task)
        continue
      }
      try {
        const depIds: string[] = JSON.parse(task.dependencies)
        if (!depIds.length) {
          executable.push(task)
          continue
        }
        // Check all dependencies are completed
        const deps = await prisma.task.findMany({
          where: { id: { in: depIds } },
          select: { status: true },
        })
        const allDone = deps.every(d => d.status === 'completed')
        if (allDone) executable.push(task)
      } catch {
        executable.push(task)
      }
    }

    return executable.map(mapTask)
  },

  async update(id: string, data: Partial<TaskData>): Promise<TaskData> {
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.actionType !== undefined) updateData.actionType = data.actionType
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.dependencies !== undefined) updateData.dependencies = data.dependencies
    if (data.retryCount !== undefined) updateData.retryCount = data.retryCount
    if (data.maxRetries !== undefined) updateData.maxRetries = data.maxRetries
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null
    if (data.status !== undefined) updateData.status = data.status
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.task.update({ where: { id }, data: updateData })
    return mapTask(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } })
  },

  async deleteByGoal(goalId: string): Promise<void> {
    await prisma.task.deleteMany({ where: { goalId } })
  },

  async countByStatus(status: string): Promise<number> {
    return prisma.task.count({ where: { status } })
  },

  async countByGoalAndStatus(goalId: string, status: string): Promise<number> {
    return prisma.task.count({ where: { goalId, status } })
  },
}
