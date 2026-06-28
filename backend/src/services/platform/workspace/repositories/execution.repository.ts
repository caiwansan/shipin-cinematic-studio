// ============================================================
// Execution Repository — WorkspaceExecution
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceExecutionDTO, ExecutionStatus } from '../types.js'

function toDTO(record: any): WorkspaceExecutionDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    executionId: record.executionId,
    planVersion: record.planVersion,
    status: record.status as ExecutionStatus,
    result: record.result ? JSON.parse(record.result) : undefined,
    runtimeState: record.runtimeState ? JSON.parse(record.runtimeState) : undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
    completedAt: record.completedAt ?? undefined,
  }
}

export const executionRepository = {
  async create(data: {
    workspaceId: string
    executionId: string
    planVersion: string
    status?: ExecutionStatus
    runtimeState?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }): Promise<WorkspaceExecutionDTO> {
    const record = await prisma.workspaceExecution.create({
      data: {
        workspaceId: data.workspaceId,
        executionId: data.executionId,
        planVersion: data.planVersion,
        status: data.status ?? 'pending',
        runtimeState: data.runtimeState ? JSON.stringify(data.runtimeState) : undefined,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceExecutionDTO | null> {
    const record = await prisma.workspaceExecution.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceExecutionDTO[]> {
    const records = await prisma.workspaceExecution.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async updateStatus(
    id: string,
    status: ExecutionStatus,
    result?: Record<string, unknown>,
  ): Promise<void> {
    const data: any = { status }
    if (result) data.result = JSON.stringify(result)
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      data.completedAt = new Date()
    }
    await prisma.workspaceExecution.update({ where: { id }, data })
  },

  async findLatestByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceExecutionDTO | null> {
    const record = await prisma.workspaceExecution.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return record ? toDTO(record) : null
  },
}
