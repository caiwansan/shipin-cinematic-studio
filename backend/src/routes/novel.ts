/**
 * routes/novel.ts — 小说阅读板块公开路由
 *
 * GET    /api/novels              — 小说列表（推荐/新书/分类）
 * GET    /api/novels/hot          — 热门 Top 10
 * GET    /api/novels/new          — 新书榜
 * GET    /api/novels/:id          — 小说详情 + 章节列表
 * GET    /api/novels/:id/chapters/:no — 章节内容
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function novelRoutes(app: FastifyInstance) {
  // GET /api/novels — 小说列表（分类筛选）
  app.get('/api/novels', async (request, reply) => {
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const where: any = { status: 'approved' }
    if (query.genre) where.genre = query.genre
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { authorNick: { contains: query.search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.novelPost.findMany({
        where,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          authorNick: true,
          coverUrl: true,
          genre: true,
          intro: true,
          wordCount: true,
          viewCount: true,
          likeCount: true,
          collectCount: true,
          commentCount: true,
          isNewBook: true,
          publishedAt: true,
        },
      }),
      prisma.novelPost.count({ where }),
    ])

    return { success: true, data: { items, total, page, pageSize } }
  })

  // GET /api/novels/hot — 热门 Top 10
  app.get('/api/novels/hot', async () => {
    const items = await prisma.novelPost.findMany({
      where: { status: 'approved' },
      orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }, { collectCount: 'desc' }, { commentCount: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        authorNick: true,
        coverUrl: true,
        genre: true,
        wordCount: true,
        viewCount: true,
        likeCount: true,
        collectCount: true,
      },
    })
    return { success: true, data: items }
  })

  // GET /api/novels/new — 新书榜（按发布时间倒序 + isNewBook 标识）
  app.get('/api/novels/new', async () => {
    const items = await prisma.novelPost.findMany({
      where: { status: 'approved' },
      orderBy: { publishedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        authorNick: true,
        coverUrl: true,
        genre: true,
        wordCount: true,
        isNewBook: true,
        publishedAt: true,
      },
    })
    return { success: true, data: items }
  })

  // GET /api/novels/genres — 获取所有分类
  app.get('/api/novels/genres', async () => {
    const genres = await prisma.novelPost.findMany({
      where: { status: 'approved' },
      select: { genre: true },
      distinct: ['genre'],
    })
    const list = genres.map(g => g.genre).filter(Boolean) as string[]
    return { success: true, data: list }
  })

  // GET /api/novels/:id — 小说详情 + 章节列表
  app.get('/api/novels/:id', async (request, reply) => {
    const { id } = request.params as any

    // 先查 NovelPost
    const novel = await prisma.novelPost.findUnique({ where: { id } })
    if (!novel || novel.status !== 'approved') {
      return reply.status(404).send({ success: false, error: '小说不存在' })
    }

    // 加一次阅读量
    await prisma.novelPost.update({ where: { id }, data: { viewCount: { increment: 1 } } })

    // 从 HdzProject 获取章节
    const project = await prisma.hdzProject.findUnique({
      where: { id: novel.projectId },
      select: { styleDesc: true },
    })

    const chapters = await prisma.hdzChapter.findMany({
      where: { projectId: novel.projectId, status: { not: 'outline' } },
      orderBy: { chapterNo: 'asc' },
      select: {
        id: true,
        chapterNo: true,
        title: true,
        wordCount: true,
        status: true,
      },
    })

    return {
      success: true,
      data: {
        ...novel,
        intro: novel.intro || project?.styleDesc || '',
        chapters,
      },
    }
  })

  // GET /api/novels/:id/chapters/:no — 章节内容
  app.get('/api/novels/:id/chapters/:no', async (request, reply) => {
    const { id, no } = request.params as any
    const chapterNo = parseInt(no, 10)

    const novel = await prisma.novelPost.findUnique({ where: { id } })
    if (!novel || novel.status !== 'approved') {
      return reply.status(404).send({ success: false, error: '小说不存在' })
    }

    const chapter = await prisma.hdzChapter.findFirst({
      where: { projectId: novel.projectId, chapterNo, status: { not: 'outline' } },
      select: { id: true, chapterNo: true, title: true, content: true, wordCount: true, createdAt: true },
    })
    if (!chapter) {
      return reply.status(404).send({ success: false, error: '章节不存在' })
    }

    return { success: true, data: chapter }
  })
}
