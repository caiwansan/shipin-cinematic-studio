import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function featuredRoutes(fastify: FastifyInstance) {
  // GET /api/featured — 获取推荐作品列表（分页）
  fastify.get('/api/featured', async (request, reply) => {
    const { page = '1', pageSize = '20' } = request.query as any

    // 尝试获取当前用户 ID（未登录也可浏览）
    let currentUserId: string | null = null
    try {
      await request.jwtVerify()
      currentUserId = (request.user as any).id
    } catch {
      // 未登录用户也能看
    }

    const where = { isFeatured: true }

    const [data, total] = await Promise.all([
      prisma.userAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          membership: {
            select: {
              user: {
                select: { id: true, username: true }
              }
            }
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            }
          },
          likes: currentUserId ? {
            where: { userId: currentUserId },
            select: { id: true }
          } : false,
        },
      }),
      prisma.userAsset.count({ where }),
    ])

    // 格式化返回
    const items = data.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      url: item.url,
      thumbnail: item.thumbnail,
      prompt: item.prompt,
      style: item.style,
      createdAt: item.createdAt,
      user: item.membership?.user ? {
        id: item.membership.user.id,
        username: item.membership.user.username,
      } : null,
      likeCount: item._count.likes,
      commentCount: item._count.comments,
      liked: currentUserId ? (item.likes && Array.isArray(item.likes) ? item.likes.length > 0 : false) : false,
    }))

    return { data: items, total, page: Number(page), pageSize: Number(pageSize) }
  })

  // GET /api/featured/my — 获取当前用户的可推荐作品列表
  fastify.get('/api/featured/my', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { page = '1', pageSize = '50' } = request.query as any

    const where = { userId }

    const [data, total] = await Promise.all([
      prisma.userAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: {
          id: true,
          title: true,
          type: true,
          url: true,
          thumbnail: true,
          prompt: true,
          isFeatured: true,
          createdAt: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            }
          },
        },
      }),
      prisma.userAsset.count({ where }),
    ])

    return { data, total, page: Number(page), pageSize: Number(pageSize) }
  })

  // POST /api/featured/:assetId/toggle — 推荐/取消推荐自己的作品
  fastify.post('/api/featured/:assetId/toggle', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { assetId } = request.params as any

    const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    if (asset.userId !== userId) return reply.status(403).send({ error: '只能操作自己的作品' })

    const updated = await prisma.userAsset.update({
      where: { id: assetId },
      data: { isFeatured: !asset.isFeatured },
    })

    return {
      success: true,
      isFeatured: updated.isFeatured,
      message: updated.isFeatured ? '已推荐展示' : '已取消推荐',
    }
  })

  // POST /api/featured/:assetId/like — 点赞/取消点赞
  fastify.post('/api/featured/:assetId/like', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { assetId } = request.params as any

    // 检查作品存在
    const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })

    // 检查是否已点赞
    const existingLike = await prisma.assetLike.findUnique({
      where: { assetId_userId: { assetId, userId } },
    })

    if (existingLike) {
      // 取消点赞
      await prisma.assetLike.delete({
        where: { assetId_userId: { assetId, userId } },
      })
      const count = await prisma.assetLike.count({ where: { assetId } })
      return { liked: false, likeCount: count }
    } else {
      // 点赞
      await prisma.assetLike.create({
        data: { assetId, userId },
      })
      const count = await prisma.assetLike.count({ where: { assetId } })
      return { liked: true, likeCount: count }
    }
  })

  // POST /api/featured/:assetId/comment — 发表评论
  fastify.post('/api/featured/:assetId/comment', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { assetId } = request.params as any
    const { content } = request.body as any

    if (!content || !content.trim()) {
      return reply.status(400).send({ error: '评论内容不能为空' })
    }

    const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })

    const comment = await prisma.assetComment.create({
      data: {
        assetId,
        userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    const count = await prisma.assetComment.count({ where: { assetId } })
    return { comment, commentCount: count }
  })

  // GET /api/featured/:assetId/comments — 获取评论列表（分页）
  fastify.get('/api/featured/:assetId/comments', async (request, reply) => {
    const { assetId } = request.params as any
    const { page = '1', pageSize = '20' } = request.query as any

    const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })

    const [data, total] = await Promise.all([
      prisma.assetComment.findMany({
        where: { assetId },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      }),
      prisma.assetComment.count({ where: { assetId } }),
    ])

    return { data, total, page: Number(page), pageSize: Number(pageSize) }
  })
}
