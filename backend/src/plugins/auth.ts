import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'

// AI 相关 API 路径前缀，VIP 会员必须有私有 key
const AI_API_PREFIXES = [
  '/images/generate',
  '/videos/generate',
  '/api/tts/generate',
  '/api/v1/pipeline',
  '/api/v1/narrative',
  '/api/v1/customer-service',
  '/api/storyboards/generate',
  '/api/images/optimize',
  '/api/images/evaluate',
  '/api/projects/create',
  '/api/characters',
]

// GEO workspace — 要求 JWT 认证
const GEO_REQUIRED_PREFIXES = [
  '/api/geo/',
]

// GEO 路由白名单 — 不需要 JWT 认证（目前没有公开端点，保留扩展）
const GEO_PUBLIC_PATHS: string[] = []

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
      // 单设备登录检查：token 中的 tokenVersion 必须与数据库一致
      const decoded = request.user as any
      if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
        const dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { tokenVersion: true },
        })
        if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) {
          reply.status(401).send({ error: '未授权', message: '账号已在其他设备登录，请重新登录' })
          return reply
        }
      }
      // 更新用户最后活跃时间（不 await，不阻塞请求）
      const userId = decoded?.id
      if (userId) {
        prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date() },
        }).catch(() => {}) // 静默失败，不影响业务
      }
    } catch (err: any) {
      const errMsg = err.message || String(err)
      const errCode = err.code || ''
      console.log(`[Auth] ❌ POST ${request.url} auth failed: code=${errCode}, message="${errMsg}", hasAuthHeader=${!!request.headers.authorization}, authPrefix=${request.headers.authorization?.substring(0, 10) || 'none'}`)
      reply.status(401).send({ error: '未授权', message: 'token 无效或已过期，请重新登录' })
      return reply
    }
  })

  /**
   * 全局拦截：VIP 会员必须配置私有 API Key 才能使用 AI 功能
   * 免费/基础会员不受限制
   */
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url

    // ── GEO 工作台 — 强制 JWT 认证 ──
    const isGeoRequest = GEO_REQUIRED_PREFIXES.some(prefix => url.startsWith(prefix))
    if (isGeoRequest) {
      try {
        await request.jwtVerify()
        const decoded = request.user as any
        if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
          const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { tokenVersion: true },
          })
          if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) {
            reply.status(401).send({ error: '未授权', message: '账号已在其他设备登录，请重新登录' })
            return reply
          }
        }
        const userId = decoded?.id
        if (userId) {
          prisma.user.update({
            where: { id: userId },
            data: { lastActiveAt: new Date() },
          }).catch(() => {})
        }
        return // 认证通过
      } catch {
        reply.status(401).send({ error: '未授权', message: '请先登录后再使用 GEO 工作台' })
        return reply
      }
    }

    // ── AI 功能 — VIP 会员必须配置私有 API Key ──
    const isAiRequest = AI_API_PREFIXES.some(prefix => url.startsWith(prefix))
    if (!isAiRequest) return

    // 尝试解析 JWT，没有 token 则跳过（未登录用户走平台 key）
    let userId: string | undefined
    try {
      await request.jwtVerify()
      userId = (request.user as any)?.id
    } catch {
      // 未认证请求不拦截
      return
    }

    if (!userId) return

    // 查询用户等级
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true, membership: { select: { tier: true } } },
    })
    if (!dbUser) return

    const { getEffectiveTier } = await import('../utils/membership-tier.js')
    const tier = getEffectiveTier({ membership: dbUser.membership, memberTier: dbUser.memberTier })
    // 只有 VIP 会员需要检查私有 key
    if (tier === 'free' || tier === 'basic') return

    // VIP 会员必须有至少一个私有 API Key（V2 配置）
    const v2Config = await prisma.userModelConfigV2.findUnique({ where: { userId } })
    const hasV2Key = !!(v2Config?.llmApiKey || v2Config?.imageApiKey || v2Config?.videoApiKey || v2Config?.ttsApiKey)
    if (!hasV2Key) {
      reply.status(403).send({
        code: 403,
        message: 'VIP 会员必须配置自己的 API Key 才能使用 AI 功能，请在「用户设置」中接入 API Key',
      })
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

