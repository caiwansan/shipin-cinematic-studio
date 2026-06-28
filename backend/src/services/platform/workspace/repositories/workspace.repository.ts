// ============================================================
// Workspace Repository — Workspace CRUD
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type {
  WorkspaceDTO,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '../types.js'

function toDTO(record: any): WorkspaceDTO {
  return {
    id: record.id,
    type: record.type,
    tenantId: record.tenantId,
    name: record.name,
    description: record.description ?? undefined,
    status: record.status,
    runtimeState: record.runtimeState ? JSON.parse(record.runtimeState) : undefined,
    manifest: record.manifest ?? undefined,
    settings: record.settings ? JSON.parse(record.settings) : undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    schemaVersion: record.schemaVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    activatedAt: record.activatedAt ?? undefined,
    archivedAt: record.archivedAt ?? undefined,
  }
}

export const workspaceRepository = {
  async create(input: CreateWorkspaceInput): Promise<WorkspaceDTO> {
    const record = await prisma.workspaceRuntime.create({
      data: {
        type: input.type,
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        settings: input.settings ? JSON.stringify(input.settings) : undefined,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        activatedAt: new Date(),
      },
    })
    return toDTO(record)
  },

  async findById(id: string): Promise<WorkspaceDTO | null> {
    const record = await prisma.workspaceRuntime.findUnique({ where: { id } })
    return record ? toDTO(record) : null
  },

  async findByTenantId(tenantId: string): Promise<WorkspaceDTO[]> {
    const records = await prisma.workspaceRuntime.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async update(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceDTO> {
    const record = await prisma.workspaceRuntime.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        settings: input.settings ? JSON.stringify(input.settings) : undefined,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    })
    return toDTO(record)
  },

  async delete(id: string): Promise<void> {
    await prisma.workspaceRuntime.delete({ where: { id } })
  },

  async list(filter?: {
    type?: string
    status?: string
    tenantId?: string
    search?: string
  }): Promise<WorkspaceDTO[]> {
    const where: any = {}
    if (filter?.type) where.type = filter.type
    if (filter?.status) where.status = filter.status
    if (filter?.tenantId) where.tenantId = filter.tenantId
    if (filter?.search) {
      where.name = { contains: filter.search, mode: 'insensitive' }
    }
    const records = await prisma.workspaceRuntime.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
    return records.map(toDTO)
  },

  async saveRuntimeState(id: string, runtimeState: Record<string, unknown>): Promise<void> {
    await prisma.workspaceRuntime.update({
      where: { id },
      data: { runtimeState: JSON.stringify(runtimeState) },
    })
  },

  async saveManifest(id: string, manifest: string): Promise<void> {
    await prisma.workspaceRuntime.update({
      where: { id },
      data: { manifest },
    })
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const data: any = { status }
    if (status === 'archived') data.archivedAt = new Date()
    await prisma.workspaceRuntime.update({ where: { id }, data })
  },
}
