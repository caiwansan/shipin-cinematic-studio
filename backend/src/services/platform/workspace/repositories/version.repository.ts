// ============================================================
// Version Repository — WorkspaceVersion (with fork/branch support)
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceVersionDTO } from '../types.js'

function toDTO(record: any): WorkspaceVersionDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    version: record.version,
    label: record.label,
    description: record.description ?? undefined,
    snapshotId: record.snapshotId ?? undefined,
    published: record.published,
    parentVersion: record.parentVersion ?? undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
  }
}

export const versionRepository = {
  async create(data: {
    workspaceId: string
    label: string
    description?: string
    snapshotId?: string
    parentVersion?: number
  }): Promise<WorkspaceVersionDTO> {
    const last = await prisma.workspaceVersion.findFirst({
      where: { workspaceId: data.workspaceId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (last?.version ?? 0) + 1

    const record = await prisma.workspaceVersion.create({
      data: {
        workspaceId: data.workspaceId,
        version: nextVersion,
        label: data.label,
        description: data.description,
        snapshotId: data.snapshotId,
        parentVersion: data.parentVersion,
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceVersionDTO | null> {
    const record = await prisma.workspaceVersion.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceVersionDTO[]> {
    const records = await prisma.workspaceVersion.findMany({
      where: { workspaceId },
      orderBy: { version: 'desc' },
    })
    return records.map(toDTO)
  },

  async publish(id: string): Promise<WorkspaceVersionDTO> {
    const record = await prisma.workspaceVersion.update({
      where: { id },
      data: { published: true },
    })
    return toDTO(record)
  },

  async findPublished(workspaceId: string): Promise<WorkspaceVersionDTO | null> {
    const record = await prisma.workspaceVersion.findFirst({
      where: { workspaceId, published: true },
      orderBy: { version: 'desc' },
    })
    return record ? toDTO(record) : null
  },

  async fork(
    workspaceId: string,
    label: string,
    parentVersion: number,
  ): Promise<WorkspaceVersionDTO> {
    return this.create({
      workspaceId,
      label,
      description: `Fork from version ${parentVersion}`,
      parentVersion,
    })
  },

  async updateSnapshotId(id: string, snapshotId: string): Promise<void> {
    await prisma.workspaceVersion.update({
      where: { id },
      data: { snapshotId },
    })
  },
}
