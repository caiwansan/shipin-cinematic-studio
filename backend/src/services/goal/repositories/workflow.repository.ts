// ============================================================
// Workflow Repository — CRUD for Workflow + WorkflowStage
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { WorkflowData, WorkflowStageData } from '../types.js'

function mapWorkflow(row: any): WorkflowData {
  return {
    id: row.id,
    strategyId: row.strategyId,
    name: row.name,
    description: row.description,
    status: row.status,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

function mapStage(row: any): WorkflowStageData {
  return {
    id: row.id,
    workflowId: row.workflowId,
    name: row.name,
    order: row.order,
    status: row.status,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
  }
}

export const workflowRepository = {
  // ─── Workflow ───

  async create(data: WorkflowData): Promise<WorkflowData> {
    const row = await prisma.workflow.create({
      data: {
        strategyId: data.strategyId,
        name: data.name,
        description: data.description,
        status: data.status ?? 'draft',
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapWorkflow(row)
  },

  async createMany(dataList: WorkflowData[]): Promise<WorkflowData[]> {
    const rows = await Promise.all(dataList.map(d => this.create(d)))
    return rows
  },

  async findById(id: string): Promise<WorkflowData | null> {
    const row = await prisma.workflow.findUnique({ where: { id } })
    return row ? mapWorkflow(row) : null
  },

  async listByStrategy(strategyId: string): Promise<WorkflowData[]> {
    const rows = await prisma.workflow.findMany({ where: { strategyId }, orderBy: { createdAt: 'asc' } })
    return rows.map(mapWorkflow)
  },

  async update(id: string, data: Partial<WorkflowData>): Promise<WorkflowData> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.workflow.update({ where: { id }, data: updateData })
    return mapWorkflow(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.workflow.delete({ where: { id } })
  },

  async countByStrategy(strategyId: string): Promise<number> {
    return prisma.workflow.count({ where: { strategyId } })
  },

  // ─── WorkflowStage ───

  async createStage(data: WorkflowStageData): Promise<WorkflowStageData> {
    const row = await prisma.workflowStage.create({
      data: {
        workflowId: data.workflowId,
        name: data.name,
        order: data.order,
        status: data.status ?? 'pending',
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapStage(row)
  },

  async createStages(dataList: WorkflowStageData[]): Promise<WorkflowStageData[]> {
    // Sort by order before creating
    const sorted = [...dataList].sort((a, b) => a.order - b.order)
    const rows = await Promise.all(sorted.map(d => this.createStage(d)))
    return rows
  },

  async findStageById(id: string): Promise<WorkflowStageData | null> {
    const row = await prisma.workflowStage.findUnique({ where: { id } })
    return row ? mapStage(row) : null
  },

  async listStagesByWorkflow(workflowId: string): Promise<WorkflowStageData[]> {
    const rows = await prisma.workflowStage.findMany({
      where: { workflowId },
      orderBy: { order: 'asc' },
    })
    return rows.map(mapStage)
  },

  async updateStage(id: string, data: Partial<WorkflowStageData>): Promise<WorkflowStageData> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.order !== undefined) updateData.order = data.order
    if (data.status !== undefined) updateData.status = data.status
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.workflowStage.update({ where: { id }, data: updateData })
    return mapStage(row)
  },

  async deleteStage(id: string): Promise<void> {
    await prisma.workflowStage.delete({ where: { id } })
  },

  async deleteStagesByWorkflow(workflowId: string): Promise<void> {
    await prisma.workflowStage.deleteMany({ where: { workflowId } })
  },
}
