// ============================================================
// Snapshot Repository — WorkspaceSnapshot
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceSnapshotDTO, CreateSnapshotInput } from '../types.js'

function toDTO(record: any): WorkspaceSnapshotDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    version: record.version,
    label: record.label ?? undefined,
    runtimeState: record.runtimeState ? JSON.parse(record.runtimeState) : undefined,
    assetState: record.assetState ? JSON.parse(record.assetState) : undefined,
    graphState: record.graphState ? JSON.parse(record.graphState) : undefined,
    variables: record.variables ? JSON.parse(record.variables) : undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
    autoSave: record.autoSave,
  }
}

export const snapshotRepository = {
  async create(
    workspaceId: string,
    input: CreateSnapshotInput,
  ): Promise<WorkspaceSnapshotDTO> {
    // Compute next version number
    const last = await prisma.workspaceSnapshot.findFirst({
      where: { workspaceId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (last?.version ?? 0) + 1

    const record = await prisma.workspaceSnapshot.create({
      data: {
        workspaceId,
        version: nextVersion,
        label: input.label,
        runtimeState: input.runtimeState ? JSON.stringify(input.runtimeState) : undefined,
        assetState: input.assetState ? JSON.stringify(input.assetState) : undefined,
        graphState: input.graphState ? JSON.stringify(input.graphState) : undefined,
        variables: input.variables ? JSON.stringify(input.variables) : undefined,
        autoSave: input.autoSave ?? false,
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceSnapshotDTO | null> {
    const record = await prisma.workspaceSnapshot.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSnapshotDTO[]> {
    const records = await prisma.workspaceSnapshot.findMany({
      where: { workspaceId },
      orderBy: { version: 'desc' },
    })
    return records.map(toDTO)
  },

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return prisma.workspaceSnapshot.count({ where: { workspaceId } })
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceSnapshot.delete({ where: { id } })
  },

  async deleteOldest(workspaceId: string, keepCount: number): Promise<void> {
    const records = await prisma.workspaceSnapshot.findMany({
      where: { workspaceId },
      orderBy: { version: 'asc' },
      select: { id: true },
      skip: keepCount,
    })
    if (records.length > 0) {
      await prisma.workspaceSnapshot.deleteMany({
        where: { id: { in: records.map(r => r.id) } },
      })
    }
  },

  async findLatest(workspaceId: string): Promise<WorkspaceSnapshotDTO | null> {
    const record = await prisma.workspaceSnapshot.findFirst({
      where: { workspaceId },
      orderBy: { version: 'desc' },
    })
    return record ? toDTO(record) : null
  },
}
