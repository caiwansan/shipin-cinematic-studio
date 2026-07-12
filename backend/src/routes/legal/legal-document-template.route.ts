/**
 * Legal Document Template Routes — 文书模板 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalDocumentTemplateRoutes(app: FastifyInstance) {
  // GET /api/legal/document-templates — 公开查询
  app.get('/api/legal/document-templates', async (request) => {
    const query = request.query as any
    const where: any = { enabled: true }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    if (query.category) where.category = query.category
    const items = await prisma.legalDocumentTemplate.findMany({ where, orderBy: { title: 'asc' } })
    return { success: true, data: items }
  })

  // GET /api/legal/document-templates/:id
  app.get('/api/legal/document-templates/:id', async (request) => {
    const { id } = request.params as any
    const item = await prisma.legalDocumentTemplate.findUnique({ where: { id } })
    if (!item) return { success: false, error: '不存在' }
    return { success: true, data: item }
  })

  // ═══ Admin Routes ═══
  // POST /api/legal/document-templates
  app.post('/api/legal/document-templates', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as any
    const item = await prisma.legalDocumentTemplate.create({ data: { title: body.title, content: body.content, category: body.category } })
    return { success: true, data: item }
  })

  // PATCH /api/legal/document-templates/:id
  app.patch('/api/legal/document-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalDocumentTemplate.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/document-templates/:id
  app.delete('/api/legal/document-templates/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    await prisma.legalDocumentTemplate.delete({ where: { id } })
    return { success: true, data: { id } }
  })
}
