/**
 * Phase 3: Growth Execution Layer
 * Enterprise Channel Service — 渠道管理服务
 *
 * 统一接口，支持：微信公众号、企业微信、抖音、小红书、快手
 * 遵循 EnterpriseChannelAdapter 接口规范
 */
import { prisma } from '../../utils/index.js'
import { randomUUID } from 'crypto'
import { encryptKey, decryptKey } from '../crypto.service.js'
import type {
  ChannelContent,
  PublishResult,
  PlatformInteraction,
  ChannelHealth,
  EnterpriseChannelAdapter,
} from '../../enterprise/channel/channel.adapter.js'
import { ContentStatus } from '../../enterprise/channel/channel.adapter.js'

export class ChannelService {
  private adapters: Map<string, EnterpriseChannelAdapter> = new Map()

  /**
   * 注册渠道适配器
   */
  registerAdapter(adapter: EnterpriseChannelAdapter) {
    console.log(`[ChannelService] 注册渠道: ${adapter.platform}`)
    this.adapters.set(adapter.platform, adapter)
  }

  /**
   * 连接渠道账号
   *
   * SPRINT-MEDIA-CHANNEL-01 Task02 — 凭证层冻结修复：
   * - 修复前：credential 明文 JSON 落库（security TODO），且字段名与模型不匹配（platform/encryptedCred/status 不存在）
   * - 修复后：AES-256-GCM 加密（crypto.service encryptKey，格式 iv:tag:ciphertext）写入 credentialEncrypted
   * - 规则：never plaintext / never frontend exposed（解密仅服务端适配器内部使用）
   */
  async connectAccount(input: {
    tenantId: string
    organizationId?: string
    platform: string
    accountName: string
    externalAccountId?: string
    credential: Record<string, string>
  }) {
    const encryptedCred = encryptKey(JSON.stringify(input.credential))
    return prisma.enterpriseChannelAccount.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        organizationId: input.organizationId ?? null,
        channelType: input.platform,
        channelName: input.accountName,
        externalAccountId: input.externalAccountId ?? null,
        credentialEncrypted: { cipher: 'aes-256-gcm', payload: encryptedCred } as any,
        connectionStatus: 'connected',
        connectedAt: new Date(),
        ownerId: '',
        ownerType: 'org',
      },
    })
  }

  /**
   * 解密渠道凭证（仅服务端适配器/运行时内部调用，禁止暴露到前端）
   */
  async getCredential(accountId: string): Promise<Record<string, string>> {
    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: accountId },
      select: { credentialEncrypted: true },
    })
    if (!account) throw new Error('Channel account not found')
    const enc = (account.credentialEncrypted as any)?.payload
    if (!enc) throw new Error('Channel credential is empty')
    return JSON.parse(decryptKey(enc))
  }

  /**
   * 获取企业所有渠道账号
   */
  async getAccounts(tenantId: string) {
    return prisma.enterpriseChannelAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 创建内容（草稿）
   */
  async createContent(input: {
    tenantId: string
    agentId: string
    channelAccountId: string
    platform: string
    title: string
    body: string
    images?: string[]
  }) {
    return prisma.enterpriseContentPublish.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        agentId: input.agentId,
        channelAccountId: input.channelAccountId,
        title: input.title,
        body: input.body,
        images: JSON.stringify(input.images || []),
        platform: input.platform,
        status: ContentStatus.DRAFT,
      },
    })
  }

  /**
   * 提交AI审核
   */
  async submitForReview(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.AI_REVIEW },
    })
  }

  /**
   * AI审核通过，等待人工审批
   */
  async aiReviewPassed(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.WAIT_APPROVAL },
    })
  }

  /**
   * 人工审批通过
   */
  async approve(contentId: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.APPROVED },
    })
  }

  /**
   * 拒绝
   */
  async reject(contentId: string, reason: string) {
    return prisma.enterpriseContentPublish.update({
      where: { id: contentId },
      data: { status: ContentStatus.REJECTED, rejectionReason: reason },
    })
  }

  /**
   * 发布内容（直接发布已审批内容）
   */
  async publish(contentId: string): Promise<PublishResult> {
    const content = await prisma.enterpriseContentPublish.findUnique({ where: { id: contentId } })
    if (!content) return { publishId: '', publishedAt: new Date(), status: 'failed', error: '内容不存在' }

    const adapter = this.adapters.get(content.platform)
    if (!adapter) return { publishId: contentId, publishedAt: new Date(), status: 'failed', error: `渠道 ${content.platform} 未注册` }

    try {
      const result = await adapter.publish({
        title: content.title,
        body: content.body,
        images: JSON.parse(content.images || '[]'),
      })

      // 更新发布状态
      await prisma.enterpriseContentPublish.update({
        where: { id: contentId },
        data: {
          status: result.status === 'success' ? ContentStatus.PUBLISHED : ContentStatus.REJECTED,
          publishTime: result.publishedAt,
          platformPostId: result.platformPostId,
          platformUrl: result.url,
        },
      })

      return result
    } catch (e: any) {
      return { publishId: contentId, publishedAt: new Date(), status: 'failed', error: e.message }
    }
  }

  /**
   * 拉取互动
   */
  async fetchInteractions(tenantId: string, since?: Date): Promise<PlatformInteraction[]> {
    const adapter = this.adapters.get('mock') // TODO: 使用实际适配器
    if (!adapter) return []
    return adapter.fetchInteractions(since)
  }

  /**
   * 获取企业内容列表
   */
  async getContentList(tenantId: string, status?: string, platform?: string) {
    const where: any = { tenantId }
    if (status) where.status = status
    if (platform) where.platform = platform
    return prisma.enterpriseContentPublish.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  /**
   * 记录用户互动
   */
  async recordInteraction(input: {
    tenantId: string
    channelAccountId: string
    contentPublishId?: string
    platformUserId: string
    platform: string
    type: string
    content: string
    intentScore?: number
    leadStatus?: string
  }) {
    return prisma.enterpriseInteraction.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        channelAccountId: input.channelAccountId,
        contentPublishId: input.contentPublishId,
        platformUserId: input.platformUserId,
        platform: input.platform,
        type: input.type,
        content: input.content,
        intentScore: input.intentScore || 0,
        leadStatus: input.leadStatus || 'cold',
      },
    })
  }

  /**
   * 获取互动列表
   */
  async getInteractions(tenantId: string, type?: string, leadStatus?: string) {
    const where: any = { tenantId }
    if (type) where.type = type
    if (leadStatus) where.leadStatus = leadStatus
    return prisma.enterpriseInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  /**
   * 回复用户
   */
  async replyToInteraction(interactionId: string, replyContent: string) {
    return prisma.enterpriseInteraction.update({
      where: { id: interactionId },
      data: { replied: true, replyContent, repliedAt: new Date() },
    })
  }

  /**
   * 获取发布漏斗数据（用于Growth Dashboard）
   */
  async getGrowthFunnel(tenantId: string, startDate?: Date, endDate?: Date) {
    const publishWhere: any = { tenantId, status: ContentStatus.PUBLISHED }
    if (startDate) publishWhere.publishTime = { gte: startDate }
    if (endDate) publishWhere.publishTime = { ...publishWhere.publishTime, lte: endDate }

    const [totalPublished, totalInteractions, totalComments, totalMessages, leads, hotLeads] = await Promise.all([
      prisma.enterpriseContentPublish.count({ where: publishWhere }),
      prisma.enterpriseInteraction.count({ where: { tenantId } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, type: 'comment' } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, type: 'message' } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, leadStatus: { in: ['warm', 'hot', 'customer'] } } }),
      prisma.enterpriseInteraction.count({ where: { tenantId, leadStatus: 'hot' } }),
    ])

    return {
      totalPublished,
      totalInteractions,
      totalComments,
      totalMessages,
      leads,
      hotLeads,
      conversionRate: totalInteractions > 0 ? (leads / totalInteractions * 100).toFixed(1) : '0.0',
    }
  }
}

export const channelService = new ChannelService()
