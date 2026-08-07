import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { containsSensitiveWord } from '../../services/community/sensitive-word.service.js'
// 注意：发帖不再直接发积分；奖励在后台审核通过时发放（admin-posts.ts approve 已有逻辑）

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
          giftCount: true,
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
    const { title, content, category, tags, media, mediaJson } = request.body as {
      title: string
      content: string
      category?: string
      tags?: string
      media?: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string }>
      mediaJson?: string
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

    // 社区发帖有钻石奖励：每天前 N 篇（community_daily_post_limit，默认 20）审核通过时有奖励，
    // 之后无奖励；发帖数量不限制（掌柜 2026-08-07 12:48 定调，取消硬限发）
    const limitCfg = await prisma.systemConfig.findUnique({ where: { key: 'community_daily_post_limit' } })
    const dailyLimit = Math.min(1000, Math.max(1, Math.floor(Number(limitCfg?.value || 20)) || 20))
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayCount = await prisma.communityPost.count({
      where: { userId, createdAt: { gte: startOfDay } },
    })

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
        // 兼容两种入参：桌面端 media 数组 / 手机端 mediaJson 字符串（手机端此前图片被静默丢弃）
        mediaJson: typeof mediaJson === 'string' && mediaJson ? mediaJson : JSON.stringify(media || []),
        status: 'pending', // 发帖先进入后台审核；通过后展示 + 发放钻石（/api/admin/posts/:id/approve）
      },
    })

    // 更新分类计数（审核通过时才计入公开计数；此处仅记录待审，不计入 postCount）
    return { post, daily: { limit: dailyLimit, used: todayCount + 1, remaining: Math.max(0, dailyLimit - todayCount - 1) } }
  })

  // GET /api/community/posts/:id — 帖子详情（含评论）
  // 公开可见仅限 approved；pending/rejected 仅作者本人（带 JWT）可见，其他人 404
  fastify.get('/api/community/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // 可选鉴权：解析 Bearer token 拿 viewerId（无 token 不影响公开帖子访问）
    let viewerId: string | null = null
    try {
      const authHeader = request.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded: any = fastify.jwt.verify(authHeader.slice(7))
        viewerId = decoded?.id || decoded?.userId || null
      }
    } catch { /* token 无效视为匿名 */ }

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

    // 非公开状态：仅作者本人可看（待审/已驳回），管理员（x-admin-token）可看，其他人一律 404
    if (post.status !== 'approved' && post.userId !== viewerId) {
      let isAdmin = false
      try {
        const adminToken = request.headers['x-admin-token']
        if (adminToken) {
          const decoded: any = fastify.jwt.verify(adminToken)
          const adminUser = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
          if (adminUser) isAdmin = true
        }
      } catch { /* token 无效视为匿名 */ }
      if (!isAdmin) {
        return reply.status(404).send({ error: '帖子不存在' })
      }
    }

    // 增加浏览量（管理员预览不计入）
    if (post.status === 'approved') {
      await prisma.communityPost.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {})
    }

    return { post }
  })

  // DELETE /api/community/posts/:id — 删帖（需认证+作者本人）
  fastify.delete('/api/community/posts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id } = request.params as { id: string }

    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { userId: true, category: true, status: true },
    })

    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }
    if (post.userId !== userId) {
      return reply.status(403).send({ error: '只能删除自己的帖子' })
    }

    await prisma.communityPost.delete({ where: { id } })

    // 减少分类计数（仅公开过的帖子参与计数）
    if (post.status === 'approved') {
      try {
        await prisma.communityCategory.updateMany({
          where: { name: post.category },
          data: { postCount: { decrement: 1 } },
        })
      } catch {}
    }

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
    const post = await prisma.communityPost.findUnique({
      where: { id: request.params.id },
      select: { id: true, category: true, userId: true, status: true },
    })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    await prisma.communityPost.update({
      where: { id: request.params.id },
      data: { status: 'approved', reviewedBy: request.adminUser?.username || 'admin', reviewedAt: new Date() },
    })
    // 首次通过才计入分类计数 + 发放积分（驳回后重新通过的场景不重复计数/奖励）
    if (post.status !== 'approved') {
      try {
        await prisma.communityCategory.updateMany({
          where: { name: post.category },
          data: { postCount: { increment: 1 } },
        })
      } catch (e) {
        console.warn('[community-admin] 更新分类计数失败:', e instanceof Error ? e.message : e)
      }
      try {
        const { rewardPostCreation } = await import('../../services/community/community-reward.service.js')
        await rewardPostCreation(post.userId, post.id)
      } catch (e) {
        console.warn('[community-admin] 社区积分奖励失败:', e instanceof Error ? e.message : e)
      }
    }
    return { success: true }
  })
  fastify.patch('/api/community/admin/posts/:id/reject', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    await prisma.communityPost.update({
      where: { id: request.params.id },
      data: { status: 'rejected', reviewedBy: request.adminUser?.username || 'admin', reviewedAt: new Date() },
    })
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
