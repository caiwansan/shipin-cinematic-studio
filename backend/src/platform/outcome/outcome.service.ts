/**
 * OutcomeService — OutcomeRecord CRUD
 * OI-01 Schema Foundation
 * 
 * Tenant Isolation: organizationId 作为一级隔离键
 * 禁止: userId → ownership, client body → organizationId
 */

import { prisma } from '../../utils/index.js'
import type {
  CreateOutcomeInput,
  OutcomeRecord,
  OutcomeStatus,
} from './types.js'

export const OutcomeService = {
  /**
   * 创建 OutcomeRecord
   * organizationId 必须来自 Identity Resolution (getOrganizationIdForUser)
   * 禁止从 client body 传入
   */
  async create(input: CreateOutcomeInput): Promise<OutcomeRecord> {
    return prisma.outcomeRecord.create({
      data: {
        organizationId: input.organizationId,
        actionId: input.actionId,
        agentId: input.agentId,
        type: input.type ?? 'OPERATIONAL',
        status: 'PENDING_VERIFY',
        description: input.description,
        evidence: input.evidence ?? [],
        occurredAt: input.occurredAt,
      },
    })
  },

  /**
   * 获取单个 OutcomeRecord
   * 只能通过 organizationId 查询 (组织隔离)
   */
  async get(id: string, organizationId: string): Promise<OutcomeRecord | null> {
    return prisma.outcomeRecord.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * 列出组织的所有 OutcomeRecord
   * 只返回 organizationId 匹配的记录
   */
  async listByOrganization(
    organizationId: string,
    options?: {
      status?: OutcomeStatus
      actionId?: string
      agentId?: string
      limit?: number
      offset?: number
    },
  ): Promise<OutcomeRecord[]> {
    return prisma.outcomeRecord.findMany({
      where: {
        organizationId,
        ...(options?.status ? { status: options.status } : {}),
        ...(options?.actionId ? { actionId: options.actionId } : {}),
        ...(options?.agentId ? { agentId: options.agentId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    })
  },

  /**
   * 更新 OutcomeRecord 状态
   * 只能更新 organizationId 匹配的记录
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: OutcomeStatus,
  ): Promise<OutcomeRecord | null> {
    const existing = await prisma.outcomeRecord.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null

    return prisma.outcomeRecord.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    })
  },

  /**
   * 附加 Evidence
   * 只能更新 organizationId 匹配的记录
   */
  async appendEvidence(
    id: string,
    organizationId: string,
    evidence: unknown[],
  ): Promise<OutcomeRecord | null> {
    const existing = await prisma.outcomeRecord.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null

    const updatedEvidence = [...(existing.evidence as unknown[]), ...evidence]

    return prisma.outcomeRecord.update({
      where: { id },
      data: { evidence: updatedEvidence, updatedAt: new Date() },
    })
  },

  /**
   * 统计组织内的 Outcome 数量
   */
  async countByOrganization(
    organizationId: string,
    options?: { status?: OutcomeStatus; type?: string },
  ): Promise<number> {
    return prisma.outcomeRecord.count({
      where: {
        organizationId,
        ...(options?.status ? { status: options.status } : {}),
        ...(options?.type ? { type: options.type } : {}),
      },
    })
  },
}
