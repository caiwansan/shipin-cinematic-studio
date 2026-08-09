import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { isInteractionAllowed } from '../../services/community/hotness.service.js'

// COMMUNITY-ENGAGEMENT-01 帖子转发（掌柜 2026-08-07）：记录转发 + 计数 + 状态 + 我的转发列表
export default async function communityShareRoutes(fastify: FastifyInstance) {
  // POST /api/community/shares — 转发（同一用户对同一帖子只计一次，防刷）
  fastify.post('/api/community/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { postId } = request.body as { postId?: string }

    if (!postId) {
      return reply.status(400).send({ error: '缺少 postId' })
    }

    // COMMUNITY-HOTNESS-V2 防刷：新账号冷却期禁止互动
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
    const gate = isInteractionAllowed(user)
    if (!gate.allowed) {
      return reply.status(403).send({ error: gate.reason })
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })
    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    const existing = await prisma.communityShare.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    if (existing) {
      return { shared: true, already: true, shareCount: await prisma.communityPost.findUnique({ where: { id: postId }, select: { shareCount: true } }).then(p => p?.shareCount || 0) }
    }

    await prisma.communityShare.create({ data: { postId, userId } })
    await prisma.communityPost.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    })
    return { shared: true, already: false }
  })

  // GET /api/community/posts/:id/shares/status — 当前用户是否转发过
  fastify.get('/api/community/posts/:id/shares/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id: postId } = request.params as { id: string }

    const shared = await prisma.communityShare.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    return { shared: !!shared }
  })

  // GET /api/community/my/shares — 我的转发列表（分页）
  fastify.get('/api/community/my/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const query = request.query as { page?: string; pageSize?: string }
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const [shares, total] = await Promise.all([
      prisma.communityShare.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              title: true,
              summary: true,
              tags: true,
              category: true,
              viewCount: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
              favoriteCount: true,
              status: true,
              createdAt: true,
              user: { select: { id: true, username: true } },
            },
          },
        },
      }),
      prisma.communityShare.count({ where: { userId } }),
    ])

    const approved = shares.filter(s => s.post && s.post.status === 'approved')
    return {
      shares: approved.map(s => s.post),
      pagination: { page, pageSize, total: approved.length },
    }
  })
}
