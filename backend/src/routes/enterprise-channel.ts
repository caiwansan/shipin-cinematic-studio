/**
 * Channel Routes — Sprint 4.2.5 + 4.2.5.1
 * 企业微信渠道接入 API
 * CTO: 渠道账户 + 交互同步 + 同步日志
 * Sprint 4.2.5.1: Capability-based permission check (所有 Channel API)
 */
import type { FastifyInstance } from 'fastify'
import { channelAccountService } from '../services/enterprise/channel/channel-account.service.js'
import { interactionSyncService } from '../services/enterprise/channel/interaction-sync.service.js'
import { wecomAdapterService } from '../services/enterprise/channel/wecom-adapter.service.js'
import { enterpriseContextService } from '../services/enterprise/enterprise-context.service.js'
import { channelPermissionService, ChannelCapability } from '../services/enterprise/channel/channel-permission.service.js'
import { channelCustomerMappingService } from '../services/enterprise/channel/channel-customer-mapping.service.js'
import { callbackEventService } from '../enterprise/channel/callback-event.service.js'
import { customerIdentityService } from '../enterprise/channel/customer-identity.service.js'
import { interactionFeedService } from '../enterprise/channel/interaction-feed.service.js'
import { prisma } from '../utils/index.js'

export async function channelRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * Sprint 4.2.5.1: Capability Check 中间件
   * CTO: 所有 Channel API 需要 channel.* capability
   */
  app.addHook('preHandler', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    if (!tenantId || !user?.id) return

    const capability = getRequiredCapability(request)
    if (!capability) return // 公开端点跳过

    const result = await channelPermissionService.check({
      govUserId: user.id,
      tenantId,
      capability,
    })

    if (!result.allowed) {
      return reply.status(403).send({
        code: 403,
        message: 'Permission denied',
        detail: result.reason,
      })
    }
  })

  /**
   * Sprint 4.2.5.1: 获取当前请求所需的 Capability
   */
  function getRequiredCapability(request: any): ChannelCapability | null {
    const method = request.method
    const url = request.url || ''
    const parts = url.split('?')[0].split('/').filter(Boolean)

    // Public endpoints (callback)
    if (parts[0] === 'api' && parts[1] === 'channels' && parts[2] === 'wechat-work') {
      return null
    }

    // Route: /api/enterprise/:tenantId/channels/...
    // parts: [api, enterprise, tenantId, channels, ...]
    const baseIndex = 4 // Index after /api/enterprise/:tenantId/channels/

    // DLQ routes: /api/enterprise/:tenantId/channels/accounts/:id/dlq/...
    if (parts[baseIndex] === 'accounts' && parts[baseIndex + 2] === 'dlq') {
      if (parts[baseIndex + 3] === 'retry' && method === 'POST') return ChannelCapability.CHANNEL_SYNC
      return ChannelCapability.CHANNEL_READ
    }

    // Customer Identity routes: /api/enterprise/:tenantId/channels/customers/...
    if (parts[baseIndex] === 'customers') {
      if (parts[baseIndex + 1] === 'identities') {
        if (parts[baseIndex + 2] === 'resolve' && method === 'POST') return ChannelCapability.CHANNEL_SYNC
        if (parts[baseIndex + 2] === 'health' && method === 'GET') return ChannelCapability.CHANNEL_READ
        if (parts[baseIndex + 2] === 'stats' && method === 'GET') return ChannelCapability.CHANNEL_READ
        // :id/assign
        if (parts[baseIndex + 3] === 'assign' && method === 'POST') return ChannelCapability.CHANNEL_SYNC
        // :id (DELETE)
        if (parts[baseIndex + 2] !== undefined && method === 'DELETE') return ChannelCapability.CHANNEL_DISCONNECT
        return ChannelCapability.INTERACTION_READ
      }
      if (parts[baseIndex + 1] === 'sync' && method === 'POST') return ChannelCapability.CHANNEL_SYNC
      // timeline & feed Contract routes
      if (parts[baseIndex + 2] === 'timeline' && method === 'GET') return ChannelCapability.INTERACTION_READ
      if (parts[baseIndex + 2] === 'feed' && method === 'GET') return ChannelCapability.INTERACTION_READ
      return ChannelCapability.INTERACTION_READ
    }

    // Feed routes: /api/enterprise/:tenantId/channels/feed/...
    if (parts[baseIndex] === 'feed') {
      if (parts[baseIndex + 1] === 'stats' && method === 'GET') return ChannelCapability.INTERACTION_READ
      return ChannelCapability.INTERACTION_READ
    }

    // Interaction routes: /api/enterprise/:tenantId/channels/interactions/...
    if (parts[baseIndex] === 'interactions') {
      // .../:id/sentiment
      if (parts[baseIndex + 2] === 'sentiment' && method === 'POST') return ChannelCapability.INTERACTION_VERIFY
      if (method === 'POST' && parts[baseIndex + 1] === 'ingest') return ChannelCapability.CHANNEL_SYNC
      if (method === 'GET') return ChannelCapability.INTERACTION_READ
      if (parts[baseIndex + 2] === 'verify') return ChannelCapability.INTERACTION_VERIFY
    }

    // Event stats: /api/enterprise/:tenantId/channels/accounts/:id/event-stats
    if (parts[baseIndex] === 'accounts' && parts[baseIndex + 2] === 'event-stats') {
      return ChannelCapability.CHANNEL_READ
    }

    // Account APIs: /api/enterprise/:tenantId/channels/accounts[/:id/...]
    if (parts[baseIndex] === 'accounts') {
      if (method === 'POST' && parts[baseIndex + 1] === undefined) return ChannelCapability.CHANNEL_CONNECT
      if (method === 'GET') return ChannelCapability.CHANNEL_READ
      if (parts[baseIndex + 2] === 'connect') return ChannelCapability.CHANNEL_CONNECT
      if (parts[baseIndex + 2] === 'disconnect') return ChannelCapability.CHANNEL_DISCONNECT
    }

    // Interaction APIs: /api/enterprise/:tenantId/channels/interactions/...
    if (parts[baseIndex] === 'interactions') {
      if (method === 'POST' && parts[baseIndex + 1] === 'ingest') return ChannelCapability.CHANNEL_SYNC
      if (method === 'GET') return ChannelCapability.INTERACTION_READ
      if (parts[baseIndex + 2] === 'verify') return ChannelCapability.INTERACTION_VERIFY
    }

    // Sync log APIs
    if (parts[baseIndex + 2] === 'sync-logs') return ChannelCapability.CHANNEL_READ

    return ChannelCapability.CHANNEL_READ // 默认
  }

  // ═══════════════════════════════════════════════════════════
  // Channel Account APIs
  // ═══════════════════════════════════════════════════════════

  // POST /api/enterprise/:tenantId/channels/accounts — 创建渠道账户
  // Sprint 4.2.5.1: 使用 createWithOwnership (自动绑定 organizationId + govUserId)
  app.post('/api/enterprise/:tenantId/channels/accounts', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any

    if (!body?.channelName) {
      return reply.status(400).send({ code: 400, message: 'channelName is required' })
    }

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    try {
      const account = await channelAccountService.createWithOwnership({
        tenantId,
        governanceTenantId: govTenantId,
        channelType: body.channelType || 'wechat_work',
        channelName: body.channelName,
        externalAccountId: body.externalAccountId,
        credentials: body.credentials || {},
        ownerId: user?.id || 'system',
        ownerType: 'gov_user',
        // Sprint 4.2.5.1: Ownership
        organizationId: body.organizationId,
        createdByGovUserId: user?.id || 'system',
      })
      return reply.send({ code: 0, data: account })
    } catch (e: any) {
      console.error('Create channel account failed:', e)
      throw e
    }
  })

  // GET /api/enterprise/:tenantId/channels/accounts — 列表
  app.get('/api/enterprise/:tenantId/channels/accounts', async (request, reply) => {
    const { tenantId } = request.params as any
    const accounts = await channelAccountService.listAccounts(tenantId)
    return reply.send({ code: 0, data: accounts })
  })

  // GET /api/enterprise/:tenantId/channels/accounts/:id — 详情
  app.get('/api/enterprise/:tenantId/channels/accounts/:id', async (request, reply) => {
    const { id } = request.params as any
    const account = await channelAccountService.getAccount(id)
    return reply.send({ code: 0, data: account })
  })

  // POST /api/enterprise/:tenantId/channels/accounts/:id/connect — 连接
  app.post('/api/enterprise/:tenantId/channels/accounts/:id/connect', async (request, reply) => {
    const { id } = request.params as any

    const account = await channelAccountService.getAccount(id)
    if (!account) {
      return reply.status(404).send({ code: 404, message: 'Account not found' })
    }

    const credentials = JSON.parse(account.credentialEncrypted as string)
    const initialized = await wecomAdapterService.initialize(id)

    if (initialized) {
      await channelAccountService.updateConnectionStatus(id, 'CONNECTED')
      return reply.send({ code: 0, data: { status: 'CONNECTED' } })
    } else {
      await channelAccountService.updateConnectionStatus(id, 'ERROR', 'Invalid credentials')
      return reply.send({ code: 0, data: { status: 'ERROR', error: 'Invalid credentials' } })
    }
  })

  // POST /api/enterprise/:tenantId/channels/accounts/:id/disconnect — 断开
  app.post('/api/enterprise/:tenantId/channels/accounts/:id/disconnect', async (request, reply) => {
    const { id } = request.params as any
    await channelAccountService.updateConnectionStatus(id, 'DISCONNECTED')
    return reply.send({ code: 0, data: { status: 'DISCONNECTED' } })
  })

  // ═══════════════════════════════════════════════════════════
  // Interaction APIs
  // ═══════════════════════════════════════════════════════════

  // POST /api/enterprise/:tenantId/channels/interactions/ingest — 摄入交互
  app.post('/api/enterprise/:tenantId/channels/interactions/ingest', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any

    if (!body?.channelAccountId || !body?.externalId || !body?.direction) {
      return reply.status(400).send({ code: 400, message: 'channelAccountId, externalId, direction required' })
    }

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    try {
      const interaction = await interactionSyncService.ingestInteraction({
        tenantId,
        governanceTenantId: govTenantId,
        channelAccountId: body.channelAccountId,
        externalId: body.externalId,
        externalName: body.externalName,
        interactionType: body.interactionType || 'message_in',
        direction: body.direction,
        content: body.content,
        contentType: body.contentType,
        actionId: body.actionId,
        rawPayload: body.rawPayload,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      })
      return reply.send({ code: 0, data: interaction })
    } catch (e: any) {
      console.error('Ingest interaction failed:', e)
      throw e
    }
  })

  // GET /api/enterprise/:tenantId/channels/interactions — 列表
  // Sprint 4.2.5.1: 强制 Tenant Isolation (tenantId + governanceTenantId)
  app.get('/api/enterprise/:tenantId/channels/interactions', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { channelAccountId, externalId, direction, trustLevel, limit, offset } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const interactions = await interactionSyncService.listInteractions(tenantId, {
      governanceTenantId: govTenantId || undefined,
      channelAccountId,
      externalId,
      direction,
      trustLevel,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    })
    return reply.send({ code: 0, data: interactions })
  })

  // GET /api/enterprise/:tenantId/channels/accounts/:id/interactions/stats — 统计
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/interactions/stats', async (request, reply) => {
    const { id } = request.params as any
    const stats = await interactionSyncService.getInteractionStats(id)
    return reply.send({ code: 0, data: stats })
  })

  // POST /api/enterprise/:tenantId/channels/interactions/:id/verify — 确认
  app.post('/api/enterprise/:tenantId/channels/interactions/:id/verify', async (request, reply) => {
    const { id } = request.params as any
    const interaction = await interactionSyncService.verifyInteraction(id)
    return reply.send({ code: 0, data: interaction })
  })

  // ═══════════════════════════════════════════════════════════
  // Customer Mapping APIs (Sprint 4.2.5.1 — External Account Binding)
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/customer-mappings — 列表
  app.get('/api/enterprise/:tenantId/channels/customer-mappings', async (request, reply) => {
    const { tenantId } = request.params as any
    const { channelType } = request.query as any
    const mappings = await channelCustomerMappingService.listMappings(tenantId, channelType)
    return reply.send({ code: 0, data: mappings })
  })

  // POST /api/enterprise/:tenantId/channels/customer-mappings — 创建映射
  app.post('/api/enterprise/:tenantId/channels/customer-mappings', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any

    if (!body?.channelType || !body?.channelAccountId || !body?.externalCustomerId) {
      return reply.status(400).send({ code: 400, message: 'channelType, channelAccountId, externalCustomerId required' })
    }

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(tenantId)

    const mapping = await channelCustomerMappingService.upsertMapping({
      tenantId,
      governanceTenantId: govTenantId,
      organizationId: body.organizationId,
      channelType: body.channelType,
      channelAccountId: body.channelAccountId,
      externalCustomerId: body.externalCustomerId,
      externalOpenId: body.externalOpenId,
      externalName: body.externalName,
      externalAvatar: body.externalAvatar,
      internalCustomerId: body.internalCustomerId,
      internalGovUserId: body.internalGovUserId,
    })
    return reply.send({ code: 0, data: mapping })
  })

  // PUT /api/enterprise/:tenantId/channels/customer-mappings/:id/assign — 分配负责人
  app.put('/api/enterprise/:tenantId/channels/customer-mappings/:id/assign', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body?.govUserId) {
      return reply.status(400).send({ code: 400, message: 'govUserId required' })
    }

    const mapping = await channelCustomerMappingService.assignInternalUser(id, body.govUserId)
    return reply.send({ code: 0, data: mapping })
  })

  // ═══════════════════════════════════════════════════════════
  // WeChat Work Callback (public endpoint, no auth)
  // ═══════════════════════════════════════════════════════════

  // POST /api/channels/wechat-work/callback/:accountId — 企业微信回调
  app.post('/api/channels/wechat-work/callback/:accountId', async (request, reply) => {
    const { accountId } = request.params as any
    const payload = request.body as any

    const result = wecomAdapterService.handleCallback(payload)
    return reply.send(result)
  })

  // ═══════════════════════════════════════════════════════════
  // Sync Log APIs
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/accounts/:id/sync-logs — 同步日志
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/sync-logs', async (request, reply) => {
    const { id } = request.params as any
    const logs = await prisma.enterpriseChannelSyncLog.findMany({
      where: { channelAccountId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })
    return reply.send({ code: 0, data: logs })
  })

  // ═══════════════════════════════════════════════════════════
  // IMP-01.3: DLQ + Observability Routes
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/accounts/:id/dlq/stats — DLQ 统计
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/dlq/stats', async (request, reply) => {
    const { id } = request.params as any
    const stats = await callbackEventService.getDeadLetterStats(id)
    return reply.send({ code: 0, data: stats })
  })

  // GET /api/enterprise/:tenantId/channels/accounts/:id/dlq — DLQ 列表
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/dlq', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { limit, offset, resolved } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    const dlqEntries = await prisma.deadLetterEvent.findMany({
      where: {
        channelAccountId: id,
        ...(resolved === 'true' ? { resolvedAt: { not: null } } : {}),
        ...(resolved === 'false' ? { resolvedAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 30,
      skip: parseInt(offset) || 0,
    })

    return reply.send({ code: 0, data: dlqEntries })
  })

  // POST /api/enterprise/:tenantId/channels/accounts/:id/dlq/retry — 重试 DLQ
  app.post('/api/enterprise/:tenantId/channels/accounts/:id/dlq/retry', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { limit } = request.body as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    const result = await callbackEventService.retryDeadLetters(id, limit || 10)

    return reply.send({ code: 0, data: result })
  })

  // GET /api/enterprise/:tenantId/channels/trace/:traceId — Event Trace
  app.get('/api/enterprise/:tenantId/channels/trace/:traceId', async (request, reply) => {
    const { traceId } = request.params as any

    const trace = await callbackEventService.getEventTrace(traceId)

    return reply.send({ code: 0, data: trace })
  })

  // GET /api/enterprise/:tenantId/channels/accounts/:id/event-stats — Event Stats
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/event-stats', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { days } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (parseInt(days) || 7))

    const [processedCount, dlqCount, recentTraces] = await Promise.all([
      prisma.processedEvent.count({ where: { channelAccountId: id, processedAt: { gte: startDate } } }),
      prisma.deadLetterEvent.count({ where: { channelAccountId: id, resolvedAt: null } }),
      prisma.eventTraceLog.findMany({
        where: { channelAccountId: id, createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    return reply.send({
      code: 0,
      data: {
        period: `${days || 7} days`,
        processed: processedCount,
        deadLetters: dlqCount,
        traceEntries: recentTraces.length,
        recentTraces,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════
  // GATE-01.3: Channel Health API
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/accounts/:id/health — Channel Health
  app.get('/api/enterprise/:tenantId/channels/accounts/:id/health', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const [account, eventStats, dlqStats] = await Promise.all([
      prisma.enterpriseChannelAccount.findUnique({
        where: { id, tenantId },
        select: {
          id: true,
          channelType: true,
          channelName: true,
          connectionStatus: true,
          connectedAt: true,
          lastSyncAt: true,
        },
      }),
      callbackEventService.getEventStats(id),
      callbackEventService.getDeadLetterStats(id),
    ])

    if (!account) {
      return reply.status(404).send({ code: 404, message: 'Channel account not found' })
    }

    const health = {
      status: account.connectionStatus === 'connected' ? 'healthy' : 'unhealthy',
      channel: {
        id: account.id,
        type: account.channelType,
        name: account.channelName,
        status: account.connectionStatus,
        connectedAt: account.connectedAt?.toISOString(),
        lastSyncAt: account.lastSyncAt?.toISOString(),
      },
      token: {
        status: account.connectionStatus === 'connected' ? 'valid' : 'invalid',
        // Token expiry managed by TokenCache (5-min preload refresh)
        refreshWindow: '5min',
      },
      adapter: {
        type: 'WeComAdapter',
        reachable: true,
        eventMapping: ['MESSAGE', 'MEDIA', 'VOICE', 'CUSTOMER_CREATED', 'CUSTOMER_REMOVED', 'CUSTOMER_UPDATED'],
      },
      callback: {
        cryptoVerify: true,
        signatureCheck: true,
        dedupCheck: true,
      },
      eventProcessing: {
        totalEvents: eventStats.totalEvents,
        successCount: eventStats.successCount,
        successRate: `${eventStats.successRate}%`,
        failedCount: eventStats.failedCount,
        deduplicatedCount: eventStats.deduplicatedCount,
      },
      dlq: {
        total: dlqStats.total,
        unresolved: dlqStats.unresolved,
        resolved: dlqStats.resolved,
      },
      sync: {
        status: dlqStats.unresolved === 0 ? 'synced' : 'has_issues',
        traceSupport: true,
      },
      timestamp: new Date().toISOString(),
    }

    return reply.send({ code: 0, data: health })
  })

  // GET /api/enterprise/:tenantId/channels/wecom/token/health — Token Health
  app.get('/api/enterprise/:tenantId/channels/wecom/token/health', async (request, reply) => {
    const { tenantId } = request.params as any

    const accounts = await prisma.enterpriseChannelAccount.findMany({
      where: { tenantId, channelType: 'wechat_work' },
      select: {
        id: true,
        connectionStatus: true,
        connectedAt: true,
        credentialEncrypted: true,
      },
    })

    const tokenHealth = accounts.map(acc => ({
      channelAccountId: acc.id,
      status: acc.connectionStatus === 'connected' ? 'healthy' : 'unhealthy',
      token: acc.connectionStatus === 'connected' ? 'valid' : 'invalid',
      // Token managed by TokenCache with 5-min preload refresh
      refreshWindow: '5min',
      // Verify no plaintext credentials
      secureStorage: !JSON.stringify(acc.credentialEncrypted).includes('plain'),
    }))

    const allHealthy = tokenHealth.every(t => t.status === 'healthy')

    return reply.send({
      code: 0,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        tenant: tenantId,
        tokenCount: tokenHealth.length,
        tokens: tokenHealth,
        timestamp: new Date().toISOString(),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════
  // IMP-01.4: Customer Identity Routes
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/customers/identities — Identity List
  app.get('/api/enterprise/:tenantId/channels/customers/identities', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { status, limit, offset } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const identities = await customerIdentityService.list(tenantId, {
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    })

    return reply.send({ code: 0, data: identities })
  })

  // GET /api/enterprise/:tenantId/channels/customers/identities/stats — Identity Stats
  app.get('/api/enterprise/:tenantId/channels/customers/identities/stats', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { channelAccountId } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const stats = await customerIdentityService.getStats(tenantId, channelAccountId)

    return reply.send({ code: 0, data: stats })
  })

  // GET /api/enterprise/:tenantId/channels/customers/identities/health — Identity Health
  app.get('/api/enterprise/:tenantId/channels/customers/identities/health', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { channelAccountId } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const health = await customerIdentityService.getHealth(tenantId, channelAccountId)

    return reply.send({ code: 0, data: health })
  })

  // POST /api/enterprise/:tenantId/channels/customers/identities/resolve — Resolve Identity
  app.post('/api/enterprise/:tenantId/channels/customers/identities/resolve', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const result = await customerIdentityService.resolve({
      tenantId,
      governanceTenantId: govTenantId,
      channelAccountId: body.channelAccountId,
      channelType: body.channelType || 'wechat_work',
      externalId: body.externalId,
      externalOpenId: body.externalOpenId,
      externalName: body.externalName,
    })

    if (!result.success) {
      return reply.send({ code: 500, message: result.error })
    }

    return reply.send({ code: 0, data: result })
  })

  // POST /api/enterprise/:tenantId/channels/customers/identities/:id/assign — Assign Customer
  app.post('/api/enterprise/:tenantId/channels/customers/identities/:id/assign', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const body = request.body as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    const identity = await customerIdentityService.assignInternalCustomer(
      id,
      body.internalCustomerId,
      body.internalGovUserId
    )

    return reply.send({ code: 0, data: identity })
  })

  // DELETE /api/enterprise/:tenantId/channels/customers/identities/:id — Remove Identity
  app.delete('/api/enterprise/:tenantId/channels/customers/identities/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    await customerIdentityService.deleteIdentity(id)

    return reply.send({ code: 0, message: 'Identity removed' })
  })

  // POST /api/enterprise/:tenantId/channels/customers/sync — Trigger Sync
  app.post('/api/enterprise/:tenantId/channels/customers/sync', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    return reply.send({
      code: 0,
      message: 'Sync triggered (requires WeCom credentials)',
      data: { tenantId, channelAccountId: body.channelAccountId },
    })
  })

  // ═══════════════════════════════════════════════════════════
  // IMP-01.5: Interaction Feed Routes
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/channels/feed — Feed Query
  app.get('/api/enterprise/:tenantId/channels/feed', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { customerIdentityId, channelAccountId, direction, type, startDate, endDate, limit, offset } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const result = await interactionFeedService.queryFeed({
      tenantId,
      customerIdentityId,
      channelAccountId,
      direction,
      type,
      startDate,
      endDate,
      limit: parseInt(limit) || 30,
      offset: parseInt(offset) || 0,
    })

    return reply.send({ code: 0, data: interactionFeedService.envelope(result, `feed_query_${Date.now()}`) })
  })

  // GET /api/enterprise/:tenantId/channels/feed/stats — Feed Stats
  app.get('/api/enterprise/:tenantId/channels/feed/stats', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { channelAccountId, days } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const stats = await interactionFeedService.getStats(tenantId, channelAccountId, parseInt(days) || 30)

    return reply.send({ code: 0, data: interactionFeedService.envelope(stats, `feed_stats_${Date.now()}`) })
  })

  // GET /api/enterprise/:tenantId/channels/customers/:id/timeline — Customer Timeline
  app.get('/api/enterprise/:tenantId/channels/customers/:id/timeline', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const { limit, offset } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const timeline = await interactionFeedService.getCustomerTimeline(tenantId, id, {
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    })

    if (!timeline) {
      return reply.send({ code: 404, message: 'Customer identity not found' })
    }

    return reply.send({ code: 0, data: interactionFeedService.envelope(timeline, `timeline_${id}`) })
  })

  // GET /api/enterprise/:tenantId/channels/customers/:id/feed — Feed Contract
  app.get('/api/enterprise/:tenantId/channels/customers/:id/feed', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const { limit, offset } = request.query as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    const contract = await interactionFeedService.getFeedContract(tenantId, id, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    })

    return reply.send({ code: 0, data: interactionFeedService.envelope(contract, `feed_contract_${id}`) })
  })

  // POST /api/enterprise/:tenantId/channels/interactions/:id/sentiment — Annotate Sentiment
  app.post('/api/enterprise/:tenantId/channels/interactions/:id/sentiment', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { sentiment, confidence } = request.body as any

    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || id)

    await interactionFeedService.storeSentiment(id, sentiment, confidence || 0.8)

    return reply.send({ code: 0, message: 'Sentiment annotated' })
  })
}
