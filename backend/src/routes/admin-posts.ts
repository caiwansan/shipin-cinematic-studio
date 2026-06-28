import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminPostRoutes(fastify: FastifyInstance) {
  // 插件模式需要注册 preHandler 时能够被访问
  fastify.decorate('requireAdmin', requireAdmin)

  // GET /api/admin/posts — 管理员帖子列表（含待审核、已通过、已拒绝）
  fastify.get('/api/admin/posts', { preHandler: [requireAdmin] }, async (request, reply) => {
    const query = request.query as {
      status?: string
      page?: string
      pageSize?: string
      search?: string
    }

    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const where: any = {}
    if (query.status && ['pending', 'approved', 'rejected'].includes(query.status)) {
      where.status = query.status
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { content: { contains: query.search } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      }),
      prisma.communityPost.count({ where }),
    ])

    return {
      posts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  })

  // GET /api/admin/posts/:id — 管理员查看帖子完整详情
  fastify.get('/api/admin/posts/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const post = await prisma.communityPost.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
      },
    })

    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    return { post }
  })

  // POST /api/admin/posts/:id/approve — 审核通过
  fastify.post('/api/admin/posts/:id/approve', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const admin = (request as any).admin

    const post = await prisma.communityPost.findUnique({ where: { id } })
    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    await prisma.communityPost.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedBy: admin?.username || 'admin',
        reviewedAt: new Date(),
      },
    })

    // 更新分类计数
    try {
      await prisma.communityCategory.updateMany({
        where: { name: post.category },
        data: { postCount: { increment: 1 } },
      })
    } catch (e) {
      console.warn('[admin-posts] 更新分类计数失败:', e instanceof Error ? e.message : e)
    }

    // 奖励积分
    try {
      const { rewardPostCreation } = await import('../services/community/community-reward.service.js')
      await rewardPostCreation(post.userId)
    } catch (e) {
      console.warn('[admin-posts] 社区积分奖励失败:', e instanceof Error ? e.message : e)
    }

    return { success: true, message: '帖子审核通过' }
  })

  // POST /api/admin/posts/:id/reject — 审核拒绝
  fastify.post('/api/admin/posts/:id/reject', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { reason, reasonDescription } = request.body as { reason?: string; reasonDescription?: string }
    const admin = (request as any).admin

    const post = await prisma.communityPost.findUnique({ where: { id } })
    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    await prisma.communityPost.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: reason || reasonDescription || '不符合社区规范',
        reviewedBy: admin?.username || 'admin',
        reviewedAt: new Date(),
      },
    })

    return { success: true, message: '帖子已拒绝' }
  })
}
