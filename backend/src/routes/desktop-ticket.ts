/**
 * S1.1 Identity Ticket Bridge — POST /api/auth/desktop/ticket
 * Desktop 壳内登录态 → 签发一次性 ticket（5min, 绑定 userId, 单次使用）
 * 依据: KUNLUN-AI-OS-IDENTITY-BRIDGE-v1.md / ADR-021（壳只持 auth_token，不注入）
 * 模式对齐: ecology-device.routes.ts（app.authenticate + request.user）+ auth.ts（jwt.sign）
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import Redis from 'ioredis'
import { randomBytes } from 'crypto'
import { env } from '../config/env.js'

const TICKET_TTL = 300 // 5 分钟
const PREFIX = 'auth:ticket:'

// 独立连接：轻量一次性签发，不干扰主队列连接
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
})

export default async function desktopTicketRoute(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/api/auth/desktop/ticket', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request.user as any)?.id
      if (!userId) return reply.code(401).send({ error: 'UNAUTHORIZED' })

      const deviceId = (request.body as any)?.deviceId || null
      const ticketId = randomBytes(24).toString('base64url')
      const payload = { userId, deviceId, iat: Date.now() }

      await redis.set(`${PREFIX}${ticketId}`, JSON.stringify(payload), 'EX', TICKET_TTL)

      return reply.send({ code: 0, data: { ticket: ticketId, expiresIn: TICKET_TTL } })
    } catch (e: any) {
      request.log.error(e, 'desktop/ticket failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
