// ============================================================
// Asset Repository — WorkspaceAsset
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceAssetDTO, AssetType } from '../types.js'

function toDTO(record: any): WorkspaceAssetDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    type: record.type as AssetType,
    path: record.path,
    mimeType: record.mimeType ?? undefined,
    size: record.size ?? undefined,
    hash: record.hash ?? undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
  }
}

export const assetRepository = {
  async create(data: {
    workspaceId: string
    type: AssetType
    path: string
    mimeType?: string
    size?: number
    hash?: string
    metadata?: Record<string, unknown>
  }): Promise<WorkspaceAssetDTO> {
    const record = await prisma.workspaceAsset.create({
      data: {
        workspaceId: data.workspaceId,
        type: data.type,
        path: data.path,
        mimeType: data.mimeType,
        size: data.size,
        hash: data.hash,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceAssetDTO | null> {
    const record = await prisma.workspaceAsset.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceAssetDTO[]> {
    const records = await prisma.workspaceAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async findByType(workspaceId: string, type: AssetType): Promise<WorkspaceAssetDTO[]> {
    const records = await prisma.workspaceAsset.findMany({
      where: { workspaceId, type },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceAsset.delete({ where: { id } })
  },

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return prisma.workspaceAsset.count({ where: { workspaceId } })
  },
}
