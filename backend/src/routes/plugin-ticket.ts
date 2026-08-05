/**
 * S2.2 Plugin Invocation Ticket — POST /api/auth/plugin/ticket
 * 复用 S1.1 ticket 机制（同 Redis 命名空间 auth:ticket:*，GETDEL 防重放）
 * 设计: KUNLUN-S2.2-PLUGIN-ROUTER-DESIGN-GATE.md §4
 * 铁律: 只签发调用意图凭证，不触发任何执行
 * 权限: Cloud Authority 判断（Registry + License），Desktop 不判断
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import Redis from 'ioredis'
import { randomBytes } from 'crypto'
import { env } from '../config/env.js'
import { prisma } from '../utils/index.js'

const TICKET_TTL = 300 // 5 分钟（与 S1.1 一致）
const PREFIX = 'auth:ticket:'

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
})

export default async function pluginTicketRoute(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/api/auth/plugin/ticket', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request.user as any)?.id
      if (!userId) return reply.code(401).send({ error: 'UNAUTHORIZED' })

      const { pluginId, action } = (request.body || {}) as { pluginId?: string; action?: string }
      if (!pluginId || typeof pluginId !== 'string') {
        return reply.code(400).send({ error: 'PLUGIN_ID_REQUIRED' })
      }

      // ── 1. Registry Lookup（S2.1 adapter 语义: 只读，Ecology 权威）──
      const plugin = await prisma.ecologyPlugin.findUnique({
        where: { pluginId },
        select: { pluginId: true, status: true, lifecycleState: true, manifest: true },
      })
      if (!plugin) return reply.code(404).send({ error: 'PLUGIN_NOT_FOUND' })
      if (plugin.lifecycleState === 'DISABLED' || plugin.status === 'DEPRECATED') {
        return reply.code(403).send({ error: 'PLUGIN_DISABLED' })
      }

      // ── 2. Permission Check（Cloud Authority: License 授权判定）──
      // user → org → License(org+plugin)。未授权且非免费 → 阻断
      const manifest = (plugin.manifest as any) || {}
      const pricingModel = manifest.pricing?.model || manifest.billing?.model || 'free'

      let authorized = pricingModel === 'free'
      if (!authorized) {
        // 尝试解析用户 org 并查 License（user → member → org → license）
        const member = await prisma.orgMember.findFirst({
          where: { userId },
          select: { organizationId: true },
        }).catch(() => null)
        const orgMember = member || (await prisma.organization.findFirst({
          where: { members: { some: { userId } } },
          select: { id: true },
        }).catch(() => null))
        const orgId = member?.organizationId || orgMember?.id
        if (orgId) {
          const license = await prisma.ecologyLicense.findFirst({
            where: { organizationId: orgId, pluginId: plugin.pluginId },
            select: { status: true, expireAt: true },
          }).catch(() => null)
          if (license && license.status === 'active' && (!license.expireAt || new Date(license.expireAt) > new Date())) {
            authorized = true
          }
        }
      }
      if (!authorized) {
        return reply.code(403).send({ error: 'PLUGIN_PERMISSION_REQUIRED' })
      }

      // ── 3. action 校验（预留 S2.3; 未知 action 阻断）──
      if (action) {
        const capabilities = manifest.capabilities || []
        const known = capabilities.some((c: any) => (c.code || c) === action)
        if (!known && action !== 'open') {
          return reply.code(400).send({ error: 'PLUGIN_ACTION_UNSUPPORTED' })
        }
      }

      // ── 4. 签发 Plugin Invocation Ticket（复用 Redis 命名空间 + GETDEL 防重放）──
      const ticketId = randomBytes(24).toString('base64url')
      const payload = {
        type: 'plugin',          // ← 扩展类型（workspace | plugin）
        pluginId,
        action: action || null,
        userId,
        permissions: authorized ? ['plugin:invoke'] : [],
        iat: Date.now(),
      }
      await redis.set(`${PREFIX}${ticketId}`, JSON.stringify(payload), 'EX', TICKET_TTL)

      return reply.send({
        code: 0,
        data: {
          ticket: ticketId,
          type: 'plugin',
          pluginId,
          expiresIn: TICKET_TTL,
          // S2.3 扩展点: 此 ticket 可直接作为 Hermes 输入（含 pluginId + action + userId + permissions）
        },
      })
    } catch (e: any) {
      request.log.error(e, 'plugin/ticket failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
