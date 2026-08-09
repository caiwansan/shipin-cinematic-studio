import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { containsSensitiveWord } from '../../services/community/sensitive-word.service.js'
import { calcHotness } from '../../services/community/hotness.service.js'
// 注意：发帖不再直接发积分；奖励在后台审核通过时发放（admin-posts.ts approve 已有逻辑）

// COMMUNITY-HOTNESS-V2 多样性控制：热榜/精选榜同一作者最多占 N 条，防马太效应
const MAX_PER_AUTHOR = 3

export default async function communityPostRoutes(fastify: FastifyInstance) {
  // GET /api/community/posts — 列表（支持分类筛选、搜索、分页）
  fastify.get('/api/community/posts', async (request, reply) => {
    const query = request.query as {
      categorySlug?: string
      search?: string
      page?: string
      pageSize?: string
      sort?: string // latest | hot（COMMUNITY-ENGAGEMENT-01）
    }

    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize
    const sort = query.sort === 'hot' || query.sort === 'best' ? query.sort : 'latest'

    const where: any = { status: 'approved' }

    if (query.categorySlug) {
      const category = await prisma.communityCategory.findUnique({
        where: { slug: query.categorySlug },
      })
      if (category) {
        where.category = category.name
      }
    }

    // 搜索：标题/正文/标签 模糊匹配（COMMUNITY-SEARCH-01）
    const search = String(query.search || '').trim().slice(0, 50)
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    // COMMUNITY-HOTNESS-V2 热度/精选排序（行业顶尖算法，见 services/community/hotness.service.ts）
    // hot：对数缩放 + 时间衰减 + 打赏强信号；best：质量分（收藏/转发/打赏率）
    // 置顶帖始终优先；热度相同按最新；同作者最多 MAX_PER_AUTHOR 条
    let posts: any[]
    let total: number

    if (sort === 'hot' || sort === 'best') {
      // 拉取候选集（全量，内存计算排序；社区量级小，性能无忧）
      const candidates = await prisma.communityPost.findMany({
        where,
        select: {
          id: true,
          userId: true,
          isPinned: true,
          giftCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          favoriteCount: true,
          viewCount: true,
          createdAt: true,
        },
      })
      const scored = candidates.map(c => ({
        ...c,
        hotness: calcHotness({
          likeCount: c.likeCount,
          commentCount: c.commentCount,
          favoriteCount: c.favoriteCount,
          shareCount: c.shareCount,
          giftCount: c.giftCount,
          viewCount: c.viewCount,
          createdAt: c.createdAt,
        }),
      }))
      const rankKey = sort === 'hot' ? 'hotScore' : 'qualityScore'
      const ranked = scored
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          const diff = (b.hotness as any)[rankKey] - (a.hotness as any)[rankKey]
          if (diff !== 0) return diff
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        // 多样性：同作者最多 MAX_PER_AUTHOR 条（置顶帖不占名额）
        .filter((() => {
          const authorCount = new Map<string, number>()
          return (c: any) => {
            if (c.isPinned) return true
            const n = (authorCount.get(c.userId) || 0) + 1
            if (n > MAX_PER_AUTHOR) return false
            authorCount.set(c.userId, n)
            return true
          }
        })())
      total = ranked.length
      const rankedIds = ranked.slice(skip, skip + pageSize).map(c => c.id)
      const rankMap = new Map(ranked.map(c => [c.id, c.hotness]))
      const rankedPosts = rankedIds.length
        ? await prisma.communityPost.findMany({
            where: { id: { in: rankedIds }, status: 'approved' },
            select: {
              id: true,
              title: true,
              content: true,
              summary: true,
              tags: true,
              category: true,
              viewCount: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
              favoriteCount: true,
              giftCount: true,
              isPinned: true,
              isEssence: true,
              createdAt: true,
              user: { select: { id: true, username: true } },
            },
          })
        : []
      // 按 rankedIds 顺序还原（findMany in 不保证顺序）
      const byId = new Map(rankedPosts.map(p => [p.id, p]))
      posts = rankedIds
        .map(id => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(p => {
          const h = rankMap.get(p.id)!
          return {
            ...p,
            hotScore: h.hotScore,
            qualityScore: h.qualityScore,
            hotBreakdown: {
              giftScore: h.giftScore,
              likeScore: h.likeScore,
              commentScore: h.commentScore,
              shareScore: h.shareScore,
              favoriteScore: h.favoriteScore,
              decayFactor: h.decayFactor,
              newPostBoost: h.newPostBoost,
              raw: h.raw,
            },
          }
        })
    } else {
      ;[posts, total] = await Promise.all([
        prisma.communityPost.findMany({
          where,
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: pageSize,
          select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            tags: true,
            category: true,
            viewCount: true,
            likeCount: true,
            commentCount: true,
            shareCount: true,
            favoriteCount: true,
            giftCount: true,
            isPinned: true,
            isEssence: true,
            createdAt: true,
            user: { select: { id: true, username: true } },
          },
        }),
        prisma.communityPost.count({ where }),
      ])
    }

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
    const { title, content, category, tags, media, mediaJson, summary } = request.body as {
      title: string
      content: string
      category?: string
      tags?: string
      media?: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string }>
      mediaJson?: string
      summary?: string // GEO-REVIEW-01 作者声明摘要（AI 收录/推荐优先引用）
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
        summary: (summary || '').trim().slice(0, 200), // GEO-REVIEW-01
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

    // COMMUNITY-ENGAGEMENT-01 当前用户交互状态（点赞/收藏/转发）
    let liked = false
    let favorited = false
    let shared = false
    if (viewerId) {
      const [likeRec, favRec, shareRec] = await Promise.all([
        prisma.communityLike.findUnique({ where: { postId_userId: { postId: id, userId: viewerId } } }).catch(() => null),
        prisma.communityFavorite.findUnique({ where: { postId_userId: { postId: id, userId: viewerId } } }).catch(() => null),
        prisma.communityShare.findUnique({ where: { postId_userId: { postId: id, userId: viewerId } } }).catch(() => null),
      ])
      liked = !!likeRec
      favorited = !!favRec
      shared = !!shareRec
    }

    // 非公开状态：仅作者本人可看（待审/已驳回），管理员（x-admin-token）可看，其他人一律 404
    if (post.status !== 'approved' && post.userId !== viewerId) {
      let isAdmin = false
      try {
        const adminToken = String(request.headers['x-admin-token'] || '')
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

    return {
      post: {
        ...post,
        viewerState: { liked, favorited, shared },
      },
    }
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

  // COMMUNITY-ENGAGEMENT-01 我的文章列表（会员中心）— 需认证，含全部状态（含待审/驳回）
  fastify.get('/api/community/my/posts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const query = request.query as { page?: string; pageSize?: string }
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          tags: true,
          category: true,
          status: true,
          rejectReason: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          favoriteCount: true,
          giftCount: true,
          isPinned: true,
          isEssence: true,
          createdAt: true,
        },
      }),
      prisma.communityPost.count({ where: { userId } }),
    ])

    return {
      posts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
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

  // 审核帖子（站长，AdminUser）——核心逻辑与版主共用 moderation.service
  fastify.patch('/api/community/admin/posts/:id/approve', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const { approvePost } = await import('../../services/community/moderation.service.js')
    const r = await approvePost(request.params.id, request.adminUser?.username || 'admin')
    if (!r.ok) return reply.status(404).send({ error: r.error })
    return { success: true }
  })
  fastify.patch('/api/community/admin/posts/:id/reject', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const body = (request.body || {}) as { reason?: string }
    const { rejectPost } = await import('../../services/community/moderation.service.js')
    const r = await rejectPost(request.params.id, request.adminUser?.username || 'admin', body.reason?.toString().trim().slice(0, 200) || undefined)
    if (!r.ok) return reply.status(404).send({ error: r.error })
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
