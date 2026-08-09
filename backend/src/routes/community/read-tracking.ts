import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

// COMMUNITY-READ-TRACKING-01 完读率埋点（掌柜 2026-08-07 拍板）
// 阶段一：只采集落库，不影响排序；两周数据后接入 hotness 公式（阶段二）
// 有效阅读判定（聚合时）：seconds>=15 && depth>=0.4
const MAX_SECONDS = 600 // 单次会话封顶 10 分钟（防挂机刷时长）
const RATE_LIMIT_MS = 30_000 // 同一用户同一帖 30s 内重复上报直接丢弃（幂等防刷）

export default async function communityReadTrackingRoutes(fastify: FastifyInstance) {
  // POST /api/community/posts/:id/read-progress — 上报阅读会话（需认证）
  // 认证双通道：header Bearer（普通 fetch）/ query token（sendBeacon 不支持自定义 header）
  fastify.post(
    '/api/community/posts/:id/read-progress',
    async (request, reply) => {
      const authHeader = String(request.headers.authorization || '')
      const queryToken = (request.query as any)?.token
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : queryToken
      if (!token) return reply.status(401).send({ error: '未授权' })
      let userId: string
      try {
        const decoded: any = fastify.jwt.verify(token)
        userId = decoded.id
      } catch {
        return reply.status(401).send({ error: '未授权' })
      }
      const { id } = request.params as { id: string }
      const { seconds = 0, depth = 0 } = request.body as { seconds?: number; depth?: number }

      // 归一化：秒数 0-600 整数；深度 0-1
      const normSeconds = Math.min(Math.max(Math.round(Number(seconds) || 0), 0), MAX_SECONDS)
      const normDepth = Math.min(Math.max(Number(depth) || 0, 0), 1)

      if (normSeconds <= 0) return { ok: true } // 零时长会话无意义，静默忽略
      if (normSeconds < 15 && normDepth < 0.4) return { ok: true } // 明显无效会话直接忽略（不落库）

      const post = await prisma.communityPost.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!post) return reply.status(404).send({ error: '帖子不存在' })

      // 幂等防刷：同用户同帖 30s 内已有会话 → 丢弃（前端每次访问只上报一次，重复上报多为异常）
      const recent = await prisma.communityReadSession.findFirst({
        where: { postId: id, userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (recent && Date.now() - recent.createdAt.getTime() < RATE_LIMIT_MS) {
        return { ok: true, ignored: 'rate_limited' }
      }

      await prisma.communityReadSession.create({
        data: { postId: id, userId, seconds: normSeconds, depth: normDepth },
      })

      return { ok: true }
    }
  )

  // GET /api/community/posts/:id/read-stats — 阅读聚合（阶段二公式用；现阶段供人工观察）
  fastify.get('/api/community/posts/:id/read-stats', async (request, reply) => {
    const { id } = request.params as { id: string }

    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, viewCount: true },
    })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })

    const sessions = await prisma.communityReadSession.findMany({
      where: { postId: id },
      select: { seconds: true, depth: true },
    })

    const total = sessions.length
    const totalSeconds = sessions.reduce((s, r) => s + r.seconds, 0)
    const valid = sessions.filter((s) => s.seconds >= 15 && s.depth >= 0.4).length

    return {
      postId: id,
      viewCount: post.viewCount,
      sessions: total,
      avgSeconds: total ? Math.round(totalSeconds / total) : 0,
      completion: post.viewCount > 0 ? valid / post.viewCount : 0, // 有效阅读会话 / 打开次数
      validSessions: valid,
    }
  })
}
