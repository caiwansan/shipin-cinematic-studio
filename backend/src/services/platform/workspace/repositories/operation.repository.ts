// ============================================================
// Operation Repository — WorkspaceOperation (Undo/Redo)
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceOperationDTO, OperationType } from '../types.js'

function toDTO(record: any): WorkspaceOperationDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    type: record.type as OperationType,
    target: record.target ?? undefined,
    targetId: record.targetId ?? undefined,
    description: record.description ?? undefined,
    diff: record.diff ? JSON.parse(record.diff) : undefined,
    reverseDiff: record.reverseDiff ? JSON.parse(record.reverseDiff) : undefined,
    userId: record.userId ?? undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
  }
}

export const operationRepository = {
  async create(data: {
    workspaceId: string
    type: OperationType
    target?: string
    targetId?: string
    description?: string
    diff?: Record<string, unknown>
    reverseDiff?: Record<string, unknown>
    userId?: string
  }): Promise<WorkspaceOperationDTO> {
    const record = await prisma.workspaceOperation.create({
      data: {
        workspaceId: data.workspaceId,
        type: data.type,
        target: data.target,
        targetId: data.targetId,
        description: data.description,
        diff: data.diff ? JSON.stringify(data.diff) : undefined,
        reverseDiff: data.reverseDiff ? JSON.stringify(data.reverseDiff) : undefined,
        userId: data.userId,
      },
    })
    return toDTO(record)
  },

  async findByWorkspaceId(
    workspaceId: string,
    limit = 100,
  ): Promise<WorkspaceOperationDTO[]> {
    const records = await prisma.workspaceOperation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(toDTO)
  },

  async findLatest(workspaceId: string): Promise<WorkspaceOperationDTO | null> {
    const record = await prisma.workspaceOperation.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return record ? toDTO(record) : null
  },

  async findById(id: string): Promise<WorkspaceOperationDTO | null> {
    const record = await prisma.workspaceOperation.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceOperation.delete({ where: { id } })
  },

  async deleteAfter(workspaceId: string, afterId: string): Promise<void> {
    const target = await prisma.workspaceOperation.findUnique({
      where: { id: afterId },
      select: { createdAt: true },
    })
    if (!target) return
    await prisma.workspaceOperation.deleteMany({
      where: {
        workspaceId,
        createdAt: { gte: target.createdAt },
      },
    })
  },
}
