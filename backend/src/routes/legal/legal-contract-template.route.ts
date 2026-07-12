/**
 * Legal Contract Template Routes — 合同模板 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalContractTemplateRoutes(app: FastifyInstance) {
  // GET /api/legal/contract-templates — 公开查询（仅启用的）
  app.get('/api/legal/contract-templates', async (request) => {
    const query = request.query as any
    const where: any = { enabled: true }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    if (query.category) where.category = query.category
    const items = await prisma.legalContractTemplate.findMany({ where, orderBy: { title: 'asc' } })
    return { success: true, data: items }
  })

  // GET /api/legal/contract-templates/:id
  app.get('/api/legal/contract-templates/:id', async (request) => {
    const { id } = request.params as any
    const item = await prisma.legalContractTemplate.findUnique({ where: { id } })
    if (!item) return { success: false, error: '不存在' }
    return { success: true, data: item }
  })

  // ═══ Admin Routes ═══
  // POST /api/legal/contract-templates
  app.post('/api/legal/contract-templates', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as any
    const item = await prisma.legalContractTemplate.create({ data: { title: body.title, content: body.content, category: body.category } })
    return { success: true, data: item }
  })

  // PATCH /api/legal/contract-templates/:id
  app.patch('/api/legal/contract-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalContractTemplate.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/contract-templates/:id
  app.delete('/api/legal/contract-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    await prisma.legalContractTemplate.delete({ where: { id } })
    return { success: true, data: { id } }
  })
}
