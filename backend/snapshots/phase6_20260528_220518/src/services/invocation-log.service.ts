/**
 * B1-3 Invocation Log Service — 持久化 AI 执行日志
 *
 * 写往 InvocationLog 表（已有 Prisma schema）
 * append-only
 */

import { prisma } from '../utils/index.js'
import { AIInvocationEnvelope, AgentType } from './ai-invocation-envelope.js'

export class InvocationLogService {
  /**
   * 写入 AI 调用日志（write-once）
   */
  async writeLog(envelope: AIInvocationEnvelope): Promise<void> {
    const capability = this.mapCapability(envelope.agentType)
    await prisma.invocationLog.create({
      data: {
        traceId: envelope.traceId,
        userId: envelope.userId,
        projectId: envelope.projectId,
        capability,
        provider: envelope.model.provider,
        model: envelope.model.modelName,
        status: envelope.status === 'success' ? 'success' : envelope.status === 'error' ? 'failed' : 'timeout',
        latencyMs: envelope.latencyMs || null,
        errorMsg: envelope.error || null,
        agentType: envelope.agentType,
        operationType: `ai:${envelope.agentType}`,
        assetRegistryId: envelope.assetRegistryId || null,
      },
    })
  }

  /**
   * agentType → capability 映射
   */
  private mapCapability(agentType: AgentType): string {
    switch (agentType) {
      case 'orchestrator':
      case 'optimization_agent':
      case 'routing_agent':
        return 'llm'
      case 'character_agent':
        return 'chat'
      case 'scene_agent':
        return 'llm'
      case 'storyboard_agent':
        return 'image'
      default:
        return 'llm'
    }
  }

  /**
   * 获取调用日志列表
   */
  async getLogs(filters: {
    projectId?: string
    userId?: string
    traceId?: string
    limit?: number
  }) {
    const where: any = {}
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.userId) where.userId = filters.userId
    if (filters.traceId) where.traceId = filters.traceId

    return prisma.invocationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    })
  }

  /**
   * 获取资产相关的 AI 调用链
   */
  async getAssetTrace(assetRegistryId: string) {
    return prisma.invocationLog.findMany({
      where: { assetRegistryId },
      orderBy: { createdAt: 'asc' },
    })
  }
}

export const invocationLogService = new InvocationLogService()
