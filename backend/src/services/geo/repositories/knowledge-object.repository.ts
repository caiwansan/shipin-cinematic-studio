// ============================================================
// Knowledge Object Repository — CRUD for KnowledgeObject
// ============================================================

import { prisma } from '../../../utils/index'

export const knowledgeObjectRepository = {
  async create(data: {
    projectId: string
    workflowId?: string | null
    topic?: string | null
    status?: string
    confidence?: number | null
    qualityScore?: number | null
    provenance?: any
    metadata?: any
  }): Promise<any> {
    return prisma.knowledgeObject.create({
      data: {
        projectId: data.projectId,
        workflowId: data.workflowId ?? null,
        topic: data.topic ?? null,
        status: data.status ?? 'DISCOVERED',
        confidence: data.confidence ?? null,
        qualityScore: data.qualityScore ?? null,
        provenance: data.provenance ?? {},
        metadata: data.metadata ?? {},
      },
    })
  },

  async findUnique(where: { id: string }): Promise<any | null> {
    return prisma.knowledgeObject.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.knowledgeObject.findMany({ where, ...options })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.knowledgeObject.update({ where, data })
    } catch {
      return null
    }
  },
}
