// ============================================================
// Conversation Repository — WorkspaceConversation
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { WorkspaceConversationDTO } from '../types.js'

function toDTO(record: any): WorkspaceConversationDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    sessionId: record.sessionId,
    role: record.role as 'user' | 'assistant' | 'system',
    content: record.content,
    context: record.context ? JSON.parse(record.context) : undefined,
    summary: record.summary ?? undefined,
    tokenCount: record.tokenCount ?? undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    createdAt: record.createdAt,
  }
}

export const conversationRepository = {
  async create(data: {
    workspaceId: string
    sessionId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    context?: Record<string, unknown>
    summary?: string
    tokenCount?: number
    metadata?: Record<string, unknown>
  }): Promise<WorkspaceConversationDTO> {
    const record = await prisma.workspaceConversation.create({
      data: {
        workspaceId: data.workspaceId,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        context: data.context ? JSON.stringify(data.context) : undefined,
        summary: data.summary,
        tokenCount: data.tokenCount,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    })
    return toDTO(record)
  },

  async findBySession(
    workspaceId: string,
    sessionId: string,
  ): Promise<WorkspaceConversationDTO[]> {
    const records = await prisma.workspaceConversation.findMany({
      where: { workspaceId, sessionId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map(toDTO)
  },

  async updateSummary(
    id: string,
    summary: string,
  ): Promise<void> {
    await prisma.workspaceConversation.update({
      where: { id },
      data: { summary },
    })
  },

  async getLatestContext(
    workspaceId: string,
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    const record = await prisma.workspaceConversation.findFirst({
      where: { workspaceId, sessionId, context: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { context: true },
    })
    return record?.context ? JSON.parse(record.context) : null
  },

  async countBySession(workspaceId: string, sessionId: string): Promise<number> {
    return prisma.workspaceConversation.count({
      where: { workspaceId, sessionId },
    })
  },
}
