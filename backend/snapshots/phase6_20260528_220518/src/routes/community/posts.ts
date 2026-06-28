import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { containsSensitiveWord } from '../../services/community/sensitive-word.service.js'
import { rewardPostCreation } from '../../services/community/community-reward.service.js'

export default async function communityPostRoutes(fastify: FastifyInstance) {
  // GET /api/community/posts — 列表（支持分类筛选、分页）
  fastify.get('/api/community/posts', async (request, reply) => {
    const query = request.query as {
      categorySlug?: string
      page?: string
      pageSize?: string
    }

    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const where: any = { status: 'approved' }

    if (query.categorySlug) {
      const category = await prisma.communityCategory.findUnique({
        where: { slug: query.categorySlug },
      })
      if (category) {
        where.category = category.name
      }
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          category: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          isPinned: true,
          isEssence: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      prisma.communityPost.count({ where }),
    ])

    return {
      posts: posts.map(p => ({
        ...p,
        content: p.content.substring(0, 200), // excerpt only
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

  // GET /api/community/sidebar — sidebar data (pinned, essence, hot)
  fastify.get('/api/community/sidebar', async (request, reply) => {
    const [pinned, essence, hot] = await Promise.all([
      prisma.communityPost.findMany({
        where: { status: 'approved', isPinned: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, commentCount: true, createdAt: true, user: { select: { id: true, username: true } } },
      }),
      prisma.communityPost.findMany({
        where: { status: 'approved', isEssence: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, title: true, commentCount: true, createdAt: true, user: { select: { id: true, username: true } } },
      }),
      prisma.communityPost.findMany({
        where: { status: 'approved' },
        orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: { id: true, title: true, viewCount: true, commentCount: true, createdAt: true, user: { select: { id: true, username: true } } },
      }),
    ])
    return { pinned, essence, hot }
  })

  // POST /api/community/posts — 发帖（需认证）
  fastify.post('/api/community/posts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { title, content, category, tags, media } = request.body as {
      title: string
      content: string
      category?: string
      tags?: string
      media?: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string }>
    }

    if (!title || !title.trim()) {
      return reply.status(400).send({ error: '标题不能为空' })
    }
    if (!content || !content.trim()) {
      return reply.status(400).send({ error: '内容不能为空' })
    }
    if (title.length > 100) {
      return reply.status(400).send({ error: '标题不能超过100个字符' })
    }

    // 敏感词检查
    const sensitiveWord = await containsSensitiveWord(title + ' ' + content)
    if (sensitiveWord) {
      return reply.status(400).send({ error: `内容包含敏感词: ${sensitiveWord}` })
    }

    // 确定分类
    let categoryName = category || 'general'
    if (category) {
      const cat = await prisma.communityCategory.findUnique({ where: { slug: category } })
      if (cat) {
        categoryName = cat.name
      }
    }

    const post = await prisma.communityPost.create({
      data: {
        userId,
        title: title.trim(),
        content: content.trim(),
        category: categoryName,
        tags: tags || '',
        mediaJson: JSON.stringify(media || []),
        status: 'approved', // Auto-approve for now, pending for review system later
      },
    })

    // 奖励积分
    try {
      await rewardPostCreation(userId)
    } catch (err) {
      console.warn('[Community] Failed to reward post creation:', err)
    }

    // 更新分类计数
    try {
      await prisma.communityCategory.updateMany({
        where: { name: categoryName },
        data: { postCount: { increment: 1 } },
      })
    } catch {}

    return { post }
  })

  // GET /api/community/posts/:id — 帖子详情（含评论）
  fastify.get('/api/community/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const post = await prisma.communityPost.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        comments: {
          where: { parentId: null }, // top-level comments only
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            likeCount: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                content: true,
                likeCount: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    // 增加浏览量
    await prisma.communityPost.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {})

    return { post }
  })

  // DELETE /api/community/posts/:id — 删帖（需认证+作者本人）
  fastify.delete('/api/community/posts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id } = request.params as { id: string }

    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { userId: true, category: true },
    })

    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }
    if (post.userId !== userId) {
      return reply.status(403).send({ error: '只能删除自己的帖子' })
    }

    await prisma.communityPost.delete({ where: { id } })

    // 减少分类计数
    try {
      await prisma.communityCategory.updateMany({
        where: { name: post.category },
        data: { postCount: { decrement: 1 } },
      })
    } catch {}

    return { success: true }
  })

  // --- 社区管理 API（需 admin JWT token）---
  async function adminCheck(request: any, reply: any) {
    const token = request.headers['x-admin-token']
    if (!token) return reply.status(401).send({ error: '未登录' })
    try {
      const decoded: any = fastify.jwt.verify(token)
      const user = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
      if (!user) return reply.status(401).send({ error: '管理员不存在' })
      request.adminUser = user
    } catch (e) {
      return reply.status(401).send({ error: 'Token 无效或已过期' })
    }
  }

  // 帖子列表（管理态，含待审核）
  fastify.get('/api/community/admin/posts', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const query = request.query
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { content: { contains: query.search } },
      ]
    }
    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true } },
        },
      }),
      prisma.communityPost.count({ where }),
    ])
    return { posts, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  })

  // 审核帖子
  fastify.patch('/api/community/admin/posts/:id/approve', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    await prisma.communityPost.update({ where: { id: request.params.id }, data: { status: 'approved' } })
    return { success: true }
  })
  fastify.patch('/api/community/admin/posts/:id/reject', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    await prisma.communityPost.update({ where: { id: request.params.id }, data: { status: 'rejected' } })
    return { success: true }
  })

  // 置顶/取消置顶
  fastify.patch('/api/community/admin/posts/:id/pin', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const post = await prisma.communityPost.findUnique({ where: { id: request.params.id }, select: { isPinned: true } })
    await prisma.communityPost.update({ where: { id: request.params.id }, data: { isPinned: !post!.isPinned } })
    return { success: true, isPinned: !post!.isPinned }
  })

  // 精华/取消精华
  fastify.patch('/api/community/admin/posts/:id/essence', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const post = await prisma.communityPost.findUnique({ where: { id: request.params.id }, select: { isEssence: true } })
    await prisma.communityPost.update({ where: { id: request.params.id }, data: { isEssence: !post!.isEssence } })
    return { success: true, isEssence: !post!.isEssence }
  })

  // 删除帖子（管理员强行删除）
  fastify.delete('/api/community/admin/posts/:id', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const post = await prisma.communityPost.findUnique({ where: { id: request.params.id }, select: { id: true } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    await prisma.$transaction([
      prisma.communityLike.deleteMany({ where: { postId: request.params.id } }),
      prisma.communityComment.deleteMany({ where: { postId: request.params.id } }),
      prisma.communityPost.delete({ where: { id: request.params.id } }),
    ])
    return { success: true }
  })
}
