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
  ChannelMetrics,
  EnterpriseChannelAdapter,
} from '../../enterprise/channel/channel.adapter.js'
import { ContentStatus } from '../../enterprise/channel/channel.adapter.js'
import { agentChannelBindingService } from './agent-channel-binding.service.js'
import { channelBrowserSessionService } from './channel-browser-session.service.js'
import { browserRuntime } from '../media/browser-runtime.service.js'

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
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — AdapterRegistry 渠道解析
   * channelType（如 douyin）→ 对应 EnterpriseChannelAdapter
   */
  resolveAdapter(platform: string): EnterpriseChannelAdapter {
    const adapter = this.adapters.get(platform)
    if (!adapter) {
      throw new Error(`未注册渠道适配器: ${platform}（请在 index.ts 注册 EnterpriseChannelAdapter 实现）`)
    }
    return adapter
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — AI 员工渠道操作授权（大脑层）
   * Adapter = 手脚（纯执行）｜ ChannelService = 大脑（权限校验）｜ AgentChannelBinding = 权限系统
   * 校验失败统一抛 code=permission_denied 错误
   */
  async authorizeAgentAction(agentInstanceId: string, channelAccountId: string, permission: string) {
    const r = await agentChannelBindingService.authorize(agentInstanceId, channelAccountId, permission)
    if (!r.allowed) {
      const err: any = new Error(
        r.reason === 'permission_denied'
          ? `AI 员工无权执行 ${permission} 操作（AgentChannelBinding.permissions.${permission}=false）`
          : `渠道绑定未就绪: ${r.reason}`,
      )
      err.code = 'permission_denied'
      throw err
    }
    return r
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
        connectionStatus: 'pending',
        connectedAt: null,
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
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.4 — 凭证续期回写（仅 Runtime 适配器内部调用）
   * adapter 不落库：refreshCredential 取到新 cookie 后经此方法加密写回 credentialEncrypted
   */
  async updateCredential(accountId: string, credential: Record<string, string>): Promise<void> {
    const encryptedCred = encryptKey(JSON.stringify(credential))
    await prisma.enterpriseChannelAccount.update({
      where: { id: accountId },
      data: {
        credentialEncrypted: { cipher: 'aes-256-gcm', payload: encryptedCred } as any,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：连接渠道
   * 企业渠道账号 → resolveAdapter(channelType) → adapter.connect（浏览器自动化登录）
   */
  async connectChannel(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)

    // TASK03.1.5 — 记录运行环境（ChannelBrowserSession，账号身份与运行环境分离）
    const profilePath = browserRuntime.getProfilePath(account.channelType, account.id)
    const session = await channelBrowserSessionService.getOrCreate(account.id, {
      browserType: 'chromium',
      profilePath,
    })
    await channelBrowserSessionService.markStarted(session.id)

    const result = await adapter.connect(account.id)
    if (result.status === 'connected') {
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: 'connected', connectedAt: new Date() },
      })
      await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
    } else if (result.status === 'waiting_login' && account.connectionStatus === 'connected') {
      // SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase E — 登录态失效：connected → expired（不得一直显示在线）
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: 'expired' },
      })
    }
    return result
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A — 等待扫码登录完成（大脑层编排）
   * adapter.waitForLogin 轮询登录态（不刷新页面）→ 登录成功更新 connected + connectedAt
   */
  async waitChannelLogin(accountId: string, timeoutMs?: number) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    if (!adapter.waitForLogin) {
      throw new Error('当前渠道不支持等待登录流程')
    }
    const result = await adapter.waitForLogin(account.id, timeoutMs)
    if (result.status === 'connected') {
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: 'connected', connectedAt: new Date() },
      })
      // TASK03.1.5 — 登录成功：记录运行环境健康检查
      try {
        const session = await channelBrowserSessionService.findByAccount(account.id)
        if (session) {
          await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
        }
      } catch (e: any) {
        console.warn(`[ChannelService] 浏览器会话健康检查记录失败: ${e.message}`)
      }
    }
    return result
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：读取真实指标
   * 企业渠道账号 → resolveAdapter → adapter.fetchMetrics（粉丝/作品/获赞，禁止 mock）
   * Task03.2 Phase D — 支持 AI 员工上下文：传入 agentInstanceId 时先做权限校验（analyze/read）
   */
  async fetchMetrics(accountId: string, opts?: { agentInstanceId?: string }): Promise<ChannelMetrics> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    if (opts?.agentInstanceId) {
      await this.authorizeAgentAction(opts.agentInstanceId, accountId, 'analyze')
    }
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.fetchMetrics(account.id)
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：凭证续期
   * adapter.refreshCredential → updateCredential（AES 回写）
   */
  async refreshChannelCredential(accountId: string) {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    const result = await adapter.refreshCredential(account.id)
    if (result.ok) {
      await prisma.enterpriseChannelAccount.update({
        where: { id: account.id },
        data: { connectionStatus: 'connected', connectedAt: new Date() },
      })
    }
    return result
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.1.3 — Enterprise Channel Runtime 编排：健康检查
   */
  async getChannelHealth(accountId: string): Promise<ChannelHealth> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.healthCheck()
  }

  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — 发布（权限层放行后进入 adapter 执行层）
   * adapter.publish 在 Task 03 阶段仍硬编码禁用（掌柜暂时禁止事项：❌ 自动发布），
   * 权限放行 ≠ 开放发布；本方法验证的是 AgentChannelBinding 权限隔离链路
   */
  async publishWithPermission(accountId: string, content: ChannelContent, opts?: { agentInstanceId?: string }): Promise<PublishResult> {
    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Channel account not found')
    if (opts?.agentInstanceId) {
      await this.authorizeAgentAction(opts.agentInstanceId, accountId, 'publish')
    }
    const adapter = this.resolveAdapter(account.channelType)
    return adapter.publish(content)
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
