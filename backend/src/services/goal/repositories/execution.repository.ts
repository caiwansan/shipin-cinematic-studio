// ============================================================
// Execution Repository — CRUD for Execution + ExecutionResult
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { ExecutionData, ExecutionResultData, ExecutionFilter } from '../types.js'

function mapExecution(row: any): ExecutionData {
  return {
    id: row.id,
    taskId: row.taskId,
    actionType: row.actionType,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    durationMs: row.durationMs,
    retryAttempt: row.retryAttempt,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

function mapResult(row: any): ExecutionResultData {
  return {
    id: row.id,
    executionId: row.executionId,
    assetId: row.assetId,
    type: row.type,
    summary: row.summary,
    details: row.details,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
  }
}

export const executionRepository = {
  // ─── Execution ───

  async create(data: ExecutionData): Promise<ExecutionData> {
    const row = await prisma.execution.create({
      data: {
        taskId: data.taskId,
        actionType: data.actionType,
        status: data.status ?? 'running',
        input: data.input,
        output: data.output,
        error: data.error,
        durationMs: data.durationMs,
        retryAttempt: data.retryAttempt ?? 0,
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapExecution(row)
  },

  async findById(id: string): Promise<ExecutionData | null> {
    const row = await prisma.execution.findUnique({ where: { id } })
    return row ? mapExecution(row) : null
  },

  async list(filter: ExecutionFilter): Promise<{ items: ExecutionData[]; total: number }> {
    const where: any = {}
    if (filter.taskId) where.taskId = filter.taskId
    if (filter.status) where.status = filter.status
    if (filter.actionType) where.actionType = filter.actionType

    const [items, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      prisma.execution.count({ where }),
    ])
    return { items: items.map(mapExecution), total }
  },

  async listByTask(taskId: string): Promise<ExecutionData[]> {
    const rows = await prisma.execution.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapExecution)
  },

  async update(id: string, data: Partial<ExecutionData>): Promise<ExecutionData> {
    const updateData: any = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.output !== undefined) updateData.output = data.output
    if (data.error !== undefined) updateData.error = data.error
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs
    if (data.retryAttempt !== undefined) updateData.retryAttempt = data.retryAttempt
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.execution.update({ where: { id }, data: updateData })
    return mapExecution(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.execution.delete({ where: { id } })
  },

  async countByStatus(status: string): Promise<number> {
    return prisma.execution.count({ where: { status } })
  },

  // ─── ExecutionResult ───

  async createResult(data: ExecutionResultData): Promise<ExecutionResultData> {
    const row = await prisma.executionResult.create({
      data: {
        executionId: data.executionId,
        assetId: data.assetId,
        type: data.type,
        summary: data.summary,
        details: data.details,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapResult(row)
  },

  async findResultById(id: string): Promise<ExecutionResultData | null> {
    const row = await prisma.executionResult.findUnique({ where: { id } })
    return row ? mapResult(row) : null
  },

  async listResultsByExecution(executionId: string): Promise<ExecutionResultData[]> {
    const rows = await prisma.executionResult.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(mapResult)
  },

  async deleteResult(id: string): Promise<void> {
    await prisma.executionResult.delete({ where: { id } })
  },

  async deleteResultsByExecution(executionId: string): Promise<void> {
    await prisma.executionResult.deleteMany({ where: { executionId } })
  },
}
