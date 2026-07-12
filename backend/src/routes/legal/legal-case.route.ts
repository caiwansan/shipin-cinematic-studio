/**
 * Legal Case Routes — 案件 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalCaseRoutes(app: FastifyInstance) {
  // GET /api/legal/cases — 用户获取自己的案件列表
  app.get('/api/legal/cases', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const cases = await prisma.legalCase.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return { success: true, data: cases }
  })

  // POST /api/legal/cases — 创建案件
  app.post('/api/legal/cases', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const body = request.body as any
    const c = await prisma.legalCase.create({
      data: {
        caseName: body.caseName,
        description: body.description,
        party: body.party,
        category: body.category,
        userId: user.id,
      },
    })
    return { success: true, data: c }
  })

  // GET /api/legal/cases/:id — 获取单个案件详情
  app.get('/api/legal/cases/:id', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { id } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }
    return { success: true, data: c }
  })

  // PATCH /api/legal/cases/:id — 更新案件
  app.patch('/api/legal/cases/:id', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { id } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }
    const updated = await prisma.legalCase.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/cases/:id — 删除案件
  app.delete('/api/legal/cases/:id', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { id } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }
    await prisma.legalCase.delete({ where: { id } })
    return { success: true, data: { id } }
  })

  // ═══ Admin Routes ═══

  // GET /api/admin/legal/cases — 管理员获取所有案件
  app.get('/api/admin/legal/cases', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as any
    const where: any = {}
    if (query.search) {
      where.caseName = { contains: query.search, mode: 'insensitive' }
    }
    const cases = await prisma.legalCase.findMany({ where, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: cases }
  })

  // PATCH /api/admin/legal/cases/:id — 管理员更新案件状态
  app.patch('/api/admin/legal/cases/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalCase.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/admin/legal/cases/:id — 管理员删除案件
  app.delete('/api/admin/legal/cases/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    await prisma.legalCase.delete({ where: { id } })
    return { success: true, data: { id } }
  })

  // GET /api/legal/dashboard — Dashboard 统计数据
  app.get('/api/legal/dashboard', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const userId = user?.id

    const [allCases, activeCases, totalContracts, totalDocuments, recentAnalyses] = await Promise.all([
      prisma.legalCase.count({ where: userId ? { userId } : {} }),
      prisma.legalCase.count({ where: userId ? { userId, status: { in: ['active', 'pending'] } } : { status: { in: ['active', 'pending'] } } }),
      prisma.legalContractTemplate.count({ where: { enabled: true } }),
      prisma.legalDocumentTemplate.count({ where: { enabled: true } }),
      prisma.legalCase.count({ where: userId ? { userId, status: 'active' } : { status: 'active' } }),
    ])

    const userFilter = userId ? { userId } : {}
    const recentCases = await prisma.legalCase.findMany({
      where: userFilter,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, caseName: true, status: true, updatedAt: true },
    })

    const pendingCases = await prisma.legalCase.findMany({
      where: { ...userFilter, status: { in: ['active', 'pending'] }, analysisProgress: { lt: 100 } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, caseName: true, analysisProgress: true, status: true },
    })

    return {
      success: true,
      data: {
        stats: {
          totalAdviserSessions: 0,
          activeCases,
          totalContracts,
          totalDocuments,
          recentAnalyses,
        },
        recentCases,
        pendingCases,
      },
    }
  })
}
