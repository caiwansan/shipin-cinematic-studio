// ============================================================
// Checkpoint Repository — WorkspaceCheckpoint
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceCheckpointDTO } from '../types.js'

function toDTO(record: any): WorkspaceCheckpointDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    description: record.description ?? undefined,
    snapshotId: record.snapshotId ?? undefined,
    versionId: record.versionId ?? undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
  }
}

export const checkpointRepository = {
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    snapshotId?: string
    versionId?: string
    metadata?: Record<string, unknown>
  }): Promise<WorkspaceCheckpointDTO> {
    const record = await prisma.workspaceCheckpoint.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        snapshotId: data.snapshotId,
        versionId: data.versionId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceCheckpointDTO | null> {
    const record = await prisma.workspaceCheckpoint.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceCheckpointDTO[]> {
    const records = await prisma.workspaceCheckpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceCheckpoint.delete({ where: { id } })
  },
}
