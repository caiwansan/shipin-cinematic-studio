// ============================================================
// HDZ Agent Task Repository — CRUD for HdzAgentTask
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzAgentTaskDTO {
  id: string
  projectId: string
  sessionId: string | null
  agentType: string
  status: string
  input: any
  output: any
  approvalStatus: string | null
  approvalNote: string | null
  tokenCost: number | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzAgentTaskDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    sessionId: record.sessionId || null,
    agentType: record.agentType,
    status: record.status,
    input: record.input || {},
    output: record.output || null,
    approvalStatus: record.approvalStatus || null,
    approvalNote: record.approvalNote || null,
    tokenCost: record.tokenCost ?? null,
    startedAt: record.startedAt?.toISOString() || null,
    completedAt: record.completedAt?.toISOString() || null,
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const hdzAgentTaskRepository = {
  async findUnique(where: any): Promise<HdzAgentTaskDTO | null> {
    const record = await prisma.hdzAgentTask.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzAgentTaskDTO | null> {
    // Compat: support both { where, orderBy } and single-arg { where, orderBy, ... }
    const args = (typeof where === 'object' && where !== null && ('where' in where || 'orderBy' in where)) ? where : { where, orderBy }
    const record = await prisma.hdzAgentTask.findFirst(args)
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzAgentTaskDTO[]> {
    const args = (where && typeof where === 'object' && ('where' in where || 'orderBy' in where || 'skip' in where || 'take' in where || 'select' in where || 'include' in where)) ? where : { where, orderBy }
    const records = await prisma.hdzAgentTask.findMany(args)
    return records.map(toDTO)
  },

  async create(data: any): Promise<HdzAgentTaskDTO> {
    const record = await prisma.hdzAgentTask.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<HdzAgentTaskDTO | null> {
    try {
      const record = await prisma.hdzAgentTask.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async delete(where: any): Promise<void> {
    await prisma.hdzAgentTask.delete({ where })
  },

  async count(where?: any): Promise<number> {
    return prisma.hdzAgentTask.count({ where })
  },
}
