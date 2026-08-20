/**
 * routes/admin-novels.ts — 后台小说管理路由
 *
 * GET    /api/admin/novels                — 小说列表（带筛选）
 * PUT    /api/admin/novels/:id/approve    — 审核通过
 * PUT    /api/admin/novels/:id/reject     — 审核拒绝
 * GET    /api/admin/novels/stats          — 统计数据
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminNovelRoutes(fastify: FastifyInstance) {
  // GET /api/admin/novels — 小说列表
  fastify.get('/api/admin/novels', { preHandler: [requireAdmin] }, async (request, reply) => {
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const skip = (page - 1) * pageSize

    const where: any = {}
    if (query.status && ['draft', 'active', 'completed', 'published'].includes(query.status)) {
      where.status = query.status
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { authorNickname: { contains: query.search } },
      ]
    }
    if (query.genre) {
      where.genre = query.genre
    }

    const [items, total] = await Promise.all([
      prisma.hdzProject.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          authorNickname: true,
          genre: true,
          status: true,
          isPublished: true,
          publishedAt: true,
          coverImgUrl: true,
          wordTarget: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { chapters: true } },
        },
      }),
      prisma.hdzProject.count({ where }),
    ])

    // 计算每个项目的总字数
    const projectsWithWords = await Promise.all(items.map(async (p) => {
      const wordSum = await prisma.hdzChapter.aggregate({
        where: { projectId: p.id },
        _sum: { wordCount: true },
      })
      return { ...p, totalWordCount: wordSum._sum.wordCount || 0 }
    }))

    return { success: true, data: { items: projectsWithWords, total, page, pageSize } }
  })

  // GET /api/admin/novels/stats — 统计数据
  fastify.get('/api/admin/novels/stats', { preHandler: [requireAdmin] }, async () => {
    const [totalProjects, publishedCount, pendingCount, totalChapters] = await Promise.all([
      prisma.hdzProject.count(),
      prisma.hdzProject.count({ where: { isPublished: true } }),
      prisma.novelPost.count({ where: { status: 'pending' } }),
      prisma.hdzChapter.count(),
    ])
    const totalWordSum = await prisma.hdzChapter.aggregate({ _sum: { wordCount: true } })

    return {
      success: true,
      data: {
        totalProjects,
        publishedCount,
        pendingCount,
        totalChapters,
        totalWords: totalWordSum._sum.wordCount || 0,
      },
    }
  })
}
