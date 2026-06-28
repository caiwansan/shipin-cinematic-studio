// ============================================================
// Draft Repository — WorkspaceDraft
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceDraftDTO } from '../types.js'

function toDTO(record: any): WorkspaceDraftDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    draftNumber: record.draftNumber,
    contentState: record.contentState ? JSON.parse(record.contentState) : undefined,
    runtimeState: record.runtimeState ? JSON.parse(record.runtimeState) : undefined,
    autoSave: record.autoSave,
    createdAt: record.createdAt,
  }
}

export const draftRepository = {
  async create(data: {
    workspaceId: string
    contentState?: Record<string, unknown>
    runtimeState?: Record<string, unknown>
    autoSave?: boolean
  }): Promise<WorkspaceDraftDTO> {
    const last = await prisma.workspaceDraft.findFirst({
      where: { workspaceId: data.workspaceId },
      orderBy: { draftNumber: 'desc' },
      select: { draftNumber: true },
    })
    const nextDraft = (last?.draftNumber ?? 0) + 1

    const record = await prisma.workspaceDraft.create({
      data: {
        workspaceId: data.workspaceId,
        draftNumber: nextDraft,
        contentState: data.contentState ? JSON.stringify(data.contentState) : undefined,
        runtimeState: data.runtimeState ? JSON.stringify(data.runtimeState) : undefined,
        autoSave: data.autoSave ?? false,
      },
    })
    return toDTO(record)
  },

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceDraftDTO[]> {
    const records = await prisma.workspaceDraft.findMany({
      where: { workspaceId },
      orderBy: { draftNumber: 'desc' },
    })
    return records.map(toDTO)
  },

  async findLatest(workspaceId: string): Promise<WorkspaceDraftDTO | null> {
    const record = await prisma.workspaceDraft.findFirst({
      where: { workspaceId },
      orderBy: { draftNumber: 'desc' },
    })
    return record ? toDTO(record) : null
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceDraft.delete({ where: { id } })
  },

  async deleteOldest(workspaceId: string, keepCount: number): Promise<void> {
    const records = await prisma.workspaceDraft.findMany({
      where: { workspaceId },
      orderBy: { draftNumber: 'asc' },
      select: { id: true },
      skip: keepCount,
    })
    if (records.length > 0) {
      await prisma.workspaceDraft.deleteMany({
        where: { id: { in: records.map(r => r.id) } },
      })
    }
  },
}
