/**
 * Interaction Sync Service — Sprint 4.2.5 + 4.2.5.1
 * 职责: 外部交互事件同步 + Trust Level 管理
 * CTO 冻结: UNVERIFIED → IMPORTED → SYNCED → VERIFIED
 * CTO: Interaction → PENDING_VERIFY Outcome only
 * Sprint 4.2.5.1: 强制 Tenant Isolation（禁止 where userId）
 */
import { prisma } from '../../../utils/index.js'
import { governanceAuditService } from '../governance-audit.service.js'
import { enterpriseEventCollector } from '../enterprise-event-collector.service.js'

export interface IngestInteractionInput {
  tenantId: string
  governanceTenantId?: string | null
  channelAccountId: string
  externalId: string
  externalName?: string
  interactionType: string  // MESSAGE / MEDIA / VOICE / CUSTOMER_CREATED / etc.
  direction: 'inbound' | 'outbound'
  content?: string
  contentType?: string
  actionId?: string
  // IMP-01.5: Trace link for full pipeline visibility
  traceId?: string | null
  sentiment?: 'positive' | 'neutral' | 'negative' | null
  rawPayload?: Record<string, any>
  occurredAt: Date
}

export class InteractionSyncService {
  /**
   * 摄入一个交互事件
   * CTO: 每个交互必须标记 trustLevel
   */
  async ingestInteraction(input: IngestInteractionInput) {
    const now = new Date()

    // CTO: 检查重复
    const existing = await prisma.enterpriseInteraction.findFirst({
      where: {
        channelAccountId: input.channelAccountId,
        externalId: input.externalId,
        interactionType: input.interactionType,
        occurredAt: input.occurredAt,
      },
    })
    if (existing) return existing

    // CTO: 新交互默认 UNVERIFIED
    const interaction = await prisma.enterpriseInteraction.create({
      data: {
        tenantId: input.tenantId,
        governanceTenantId: input.governanceTenantId,
        channelType: 'wechat_work',
        channelAccountId: input.channelAccountId,
        externalId: input.externalId,
        externalName: input.externalName,
        interactionType: input.interactionType,
        direction: input.direction,
        content: input.content,
        contentType: input.contentType || 'text',
        actionId: input.actionId,
        trustLevel: 'UNVERIFIED',
        // IMP-01.5: Trace + sentiment
        ...(input.traceId ? { traceId: input.traceId } : {}),
        ...(input.sentiment ? { sentiment: input.sentiment } : {}),
        rawPayload: JSON.stringify(input.rawPayload || {}),
        occurredAt: input.occurredAt,
        createdAt: now,
      },
    })

    // 自动提升到 IMPORTED（已成功存储）
    await this.updateTrustLevel(interaction.id, 'IMPORTED')

    // 同时写入 OperationEvent（CTO: Interaction 是新的 Event Source）
    await enterpriseEventCollector.collect(
      {
        tenantId: input.tenantId,
        eventType: `channel.${input.interactionType}`,
        actorType: input.direction === 'inbound' ? 'external_customer' : 'system',
        actorId: input.externalId,
        actorName: input.externalName,
        targetType: 'channel_interaction',
        targetId: interaction.id,
        metadata: {
          channel: 'wechat_work',
          direction: input.direction,
        },
      },
      input.governanceTenantId,
    )

    return interaction
  }

  /**
   * 更新信任级别
   * CTO: UNVERIFIED → IMPORTED → SYNCED → VERIFIED
   */
  async updateTrustLevel(
    interactionId: string,
    trustLevel: 'UNVERIFIED' | 'IMPORTED' | 'SYNCED' | 'VERIFIED',
  ) {
    return prisma.enterpriseInteraction.update({
      where: { id: interactionId },
      data: { trustLevel },
    })
  }

  /**
   * 人工确认交互有效
   */
  async verifyInteraction(interactionId: string) {
    const interaction = await prisma.enterpriseInteraction.update({
      where: { id: interactionId },
      data: { trustLevel: 'VERIFIED' },
    })

    await governanceAuditService.log({
      governanceTenantId: interaction.governanceTenantId || '',
      actorId: 'human',
      actorType: 'user',
      action: 'interaction.verified',
      targetType: 'enterprise_interaction',
      targetId: interactionId,
      metadata: { trustLevel: 'VERIFIED' },
    })

    return interaction
  }

  /**
   * 查询交互列表
   * Sprint 4.2.5.1: 强制 tenantId + governanceTenantId 双重过滤
   * CTO 禁止: where userId
   */
  async listInteractions(
    tenantId: string,
    params?: {
      governanceTenantId?: string
      channelAccountId?: string
      externalId?: string
      direction?: string
      trustLevel?: string
      limit?: number
      offset?: number
    },
  ) {
    return prisma.enterpriseInteraction.findMany({
      where: {
        tenantId,
        ...(params?.governanceTenantId ? { governanceTenantId: params.governanceTenantId } : {}),
        ...(params?.channelAccountId ? { channelAccountId: params.channelAccountId } : {}),
        ...(params?.externalId ? { externalId: params.externalId } : {}),
        ...(params?.direction ? { direction: params.direction } : {}),
        ...(params?.trustLevel ? { trustLevel: params.trustLevel } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: params?.limit || 50,
      skip: params?.offset || 0,
    })
  }

  /**
   * 创建同步日志
   */
  async createSyncLog(params: {
    tenantId: string
    channelAccountId: string
    syncType?: string
  }) {
    return prisma.enterpriseChannelSyncLog.create({
      data: {
        tenantId: params.tenantId,
        channelAccountId: params.channelAccountId,
        syncType: params.syncType || 'incremental',
        status: 'running',
      },
    })
  }

  /**
   * 完成同步日志
   */
  async completeSyncLog(
    logId: string,
    result: { status: string; recordsSynced?: number; recordsFailed?: number; error?: string },
  ) {
    return prisma.enterpriseChannelSyncLog.update({
      where: { id: logId },
      data: {
        status: result.status,
        recordsSynced: result.recordsSynced || 0,
        recordsFailed: result.recordsFailed || 0,
        errorMessage: result.error,
        finishedAt: new Date(),
      },
    })
  }

  /**
   * 获取同步统计
   */
  async getInteractionStats(channelAccountId: string) {
    const total = await prisma.enterpriseInteraction.count({
      where: { channelAccountId },
    })
    const byTrust = await prisma.enterpriseInteraction.groupBy({
      by: ['trustLevel'],
      where: { channelAccountId },
      _count: { trustLevel: true },
    })
    const byDirection = await prisma.enterpriseInteraction.groupBy({
      by: ['direction'],
      where: { channelAccountId },
      _count: { direction: true },
    })
    const inbound = byDirection.find(d => d.direction === 'inbound')?._count?.direction || 0
    const outbound = byDirection.find(d => d.direction === 'outbound')?._count?.direction || 0

    return {
      total,
      verified: byTrust.find(t => t.trustLevel === 'VERIFIED')?._count?.trustLevel || 0,
      unverified: byTrust.find(t => t.trustLevel === 'UNVERIFIED')?._count?.trustLevel || 0,
      imported: byTrust.find(t => t.trustLevel === 'IMPORTED')?._count?.trustLevel || 0,
      inbound,
      outbound,
    }
  }
}

export const interactionSyncService = new InteractionSyncService()
