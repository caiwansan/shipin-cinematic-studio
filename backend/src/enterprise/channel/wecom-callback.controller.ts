/**
 * P4.2.5.2-IMP-01.2 — WeCom Callback Controller (Token-Aware)
 * 
 * 企业微信事件回调 HTTP Endpoint
 * 
 * Changes from IMP-01.1:
 * - Token 加载: credentialEncrypted → corpId 作为 Cache Key
 * - 调用 WeComAdapter.initWithChannelAccount() 替代 connect()
 * - 新增: GET /token/stats 获取缓存统计
 * - 新增: POST /token/invalidate/:accountId 手动失效
 * - 新增: GET /token/health/:accountId 检查 Token 健康状态
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../utils/index.js'
import { decryptWeComMessage, verifyCallbackUrl } from './wecom-crypto.js'
import { WeComAdapter } from './wecom-adapter.js'
import { tokenService } from './token.service.js'
import { callbackEventService } from './callback-event.service.js'

/**
 * 注册 WeCom 回调路由 + Token Management 路由
 */
export async function registerWeComCallbackRoutes(app: FastifyInstance) {
  
  // ─── 回调 URL 验证（GET ──────────────────────────────────

  app.get('/api/enterprise/wecom/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { msg_signature, timestamp, nonce, echostr } = request.query as any

    if (!msg_signature || !timestamp || !nonce || !echostr) {
      return reply.status(400).send({ code: 400, message: 'Missing parameters' })
    }

    // Step 1: Find active channel account
    const channelAccount = await prisma.enterpriseChannelAccount.findFirst({
      where: { channelType: 'wechat_work', connectionStatus: 'CONNECTED' },
    })

    if (!channelAccount) {
      return reply.status(404).send({ code: 404, message: 'No active WeCom channel' })
    }

    try {
      const credentials = channelAccount.credentialEncrypted as any
      const result = verifyCallbackUrl(
        credentials.token,
        credentials.encodingAESKey,
        credentials.corpId,
        msg_signature,
        timestamp,
        nonce,
        echostr
      )

      if (result === null) {
        return reply.status(403).send({ code: 403, message: 'Signature verification failed' })
      }

      return reply.send(result)
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── 事件回调（POST ─────────────────────────────────────

  app.post('/api/enterprise/wecom/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { msg_signature, timestamp, nonce } = request.query as any

    if (!msg_signature || !timestamp || !nonce) {
      return reply.status(400).send({ code: 400, message: 'Missing parameters' })
    }

    // Step 1: Find channel account
    const channelAccount = await prisma.enterpriseChannelAccount.findFirst({
      where: { channelType: 'wechat_work', connectionStatus: 'CONNECTED' },
    })

    if (!channelAccount) {
      return reply.status(404).send({ code: 404, message: 'No active WeCom channel' })
    }

    try {
      const credentials = channelAccount.credentialEncrypted as any

      // Step 2: Decrypt message
      const encryptedData = (request.body as any).Encrypt
      const { message } = decryptWeComMessage(
        credentials.encodingAESKey,
        encryptedData,
        credentials.corpId
      )

      const event = JSON.parse(message)

      // Step 3: Process event (with Token-aware Adapter)
      await handleWeComEvent(channelAccount.id, event)

      return reply.send('success')
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── Token Management Routes (NEW for IMP-01.2) ─────────

  /**
   * GET /api/enterprise/wecom/token/stats
   * 获取 Token Cache 统计（供 Debug/Dashboard）
   */
  app.get('/api/enterprise/wecom/token/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = tokenService.getCacheStats()
      return reply.send({
        code: 0,
        data: stats,
        message: 'Token cache stats retrieved successfully',
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  /**
   * POST /api/enterprise/wecom/token/invalidate/:channelAccountId
   * 手动使某个渠道的 Token 失效（断网/Error 恢复后）
   */
  app.post(
    '/api/enterprise/wecom/token/invalidate/:channelAccountId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { channelAccountId } = request.params as any

      try {
        await tokenService.invalidateToken(channelAccountId, 'Manual invalidation via API')
        return reply.send({
          code: 0,
          data: { channelAccountId, invalidated: true },
          message: 'Token invalidated successfully',
        })
      } catch (e: any) {
        return reply.status(500).send({ code: 500, message: e.message })
      }
    }
  )

  /**
   * GET /api/enterprise/wecom/token/health/:channelAccountId
   * 检查 Token 健康状态
   */
  app.get(
    '/api/enterprise/wecom/token/health/:channelAccountId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { channelAccountId } = request.params as any

      try {
        // Find channel account
        const account = await prisma.enterpriseChannelAccount.findUnique({
          where: { id: channelAccountId },
        })

        if (!account) {
          return reply.status(404).send({ code: 404, message: 'Channel account not found' })
        }

        // Create adapter and check health
        const adapter = new WeComAdapter()
        adapter.setChannelAccountId(channelAccountId)
        const health = await adapter.health()

        const stats = tokenService.getCacheStats()

        return reply.send({
          code: 0,
          data: {
            health,
            cacheStats: stats,
            channelAccountId,
            connectionStatus: account.connectionStatus,
            lastError: account.lastError,
          },
          message: 'Token health retrieved',
        })
      } catch (e: any) {
        return reply.status(500).send({ code: 500, message: e.message })
      }
    }
  )
}

/**
 * 处理 WeCom 事件
 * 
 * IMP-01.3: 使用 CallbackEventService 实现完整 Pipeline
 * (Dedup → Ordering → Process → Retry → DLQ)
 */
async function handleWeComEvent(channelAccountId: string, event: any): Promise<void> {
  // Get tenantId from channelAccount
  const account = await prisma.enterpriseChannelAccount.findUnique({
    where: { id: channelAccountId },
    select: { tenantId: true },
  })

  if (!account) {
    throw new Error(`Channel account not found: ${channelAccountId}`)
  }

  // Delegate to CallbackEventService for full processing pipeline
  const result = await callbackEventService.processEvent(
    channelAccountId,
    account.tenantId,
    event
  )

  if (!result.success && result.status !== 'deduplicated') {
    console.error(`[WeCom Callback] Event processing failed: ${result.error} (traceId: ${result.traceId})`)
  }
}
