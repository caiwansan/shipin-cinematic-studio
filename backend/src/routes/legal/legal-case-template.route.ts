/**
 * Legal Case Template Routes — 公开案例 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalCaseTemplateRoutes(app: FastifyInstance) {
  // GET /api/legal/case-templates — 公开查询
  app.get('/api/legal/case-templates', async (request) => {
    const query = request.query as any
    const where: any = { enabled: true }
    if (query.search) {
      where.OR = [
        { caseName: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    if (query.category) where.category = query.category
    const items = await prisma.legalCaseTemplate.findMany({ where, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: items }
  })

  // GET /api/legal/case-templates/:id
  app.get('/api/legal/case-templates/:id', async (request) => {
    const { id } = request.params as any
    const item = await prisma.legalCaseTemplate.findUnique({ where: { id } })
    if (!item) return { success: false, error: '不存在' }
    return { success: true, data: item }
  })

  // ═══ Admin Routes ═══
  // PATCH /api/legal/case-templates/:id — 启用/停用
  app.patch('/api/legal/case-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalCaseTemplate.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // POST /api/admin/legal/case-templates
  app.post('/api/admin/legal/case-templates', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as any
    const item = await prisma.legalCaseTemplate.create({ data: body })
    return { success: true, data: item }
  })

  // DELETE /api/admin/legal/case-templates/:id
  app.delete('/api/admin/legal/case-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    await prisma.legalCaseTemplate.delete({ where: { id } })
    return { success: true, data: { id } }
  })
}
