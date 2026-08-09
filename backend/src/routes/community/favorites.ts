import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { isInteractionAllowed } from '../../services/community/hotness.service.js'

// COMMUNITY-ENGAGEMENT-01 帖子收藏（掌柜 2026-08-07）：收藏/取消收藏 toggle + 状态查询 + 我的收藏列表
export default async function communityFavoriteRoutes(fastify: FastifyInstance) {
  // POST /api/community/favorites — 收藏/取消收藏（toggle）
  fastify.post('/api/community/favorites', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

    const existing = await prisma.communityFavorite.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    if (existing) {
      // 取消收藏
      await prisma.communityFavorite.delete({ where: { id: existing.id } })
      await prisma.communityPost.update({
        where: { id: postId },
        data: { favoriteCount: { decrement: 1 } },
      })
      return { favorited: false }
    }

    // 收藏
    await prisma.communityFavorite.create({ data: { postId, userId } })
    await prisma.communityPost.update({
      where: { id: postId },
      data: { favoriteCount: { increment: 1 } },
    })
    return { favorited: true }
  })

  // GET /api/community/posts/:id/favorites/status — 当前用户收藏状态
  fastify.get('/api/community/posts/:id/favorites/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id: postId } = request.params as { id: string }

    const favorited = await prisma.communityFavorite.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    return { favorited: !!favorited }
  })

  // GET /api/community/my/favorites — 我的收藏列表（分页）
  fastify.get('/api/community/my/favorites', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const query = request.query as { page?: string; pageSize?: string }
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const [favorites, total] = await Promise.all([
      prisma.communityFavorite.findMany({
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
      prisma.communityFavorite.count({ where: { userId } }),
    ])

    return {
      favorites: favorites
        .filter(f => f.post && f.post.status === 'approved') // 只展示已审核通过的帖子
        .map(f => f.post),
      pagination: { page, pageSize, total: favorites.filter(f => f.post && f.post.status === 'approved').length },
    }
  })
}
