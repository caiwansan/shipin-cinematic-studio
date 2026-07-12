/**
 * Legal Knowledge Routes — 法律知识库 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalKnowledgeRoutes(app: FastifyInstance) {
  // GET /api/legal/knowledge — 获取启用的知识库列表
  app.get('/api/legal/knowledge', async (request) => {
    const query = request.query as any
    const where: any = { enabled: true }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    if (query.category) where.category = query.category
    const items = await prisma.legalKnowledge.findMany({ where, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: items }
  })

  // GET /api/legal/knowledge/:id
  app.get('/api/legal/knowledge/:id', async (request) => {
    const { id } = request.params as any
    const item = await prisma.legalKnowledge.findUnique({ where: { id } })
    if (!item) return { success: false, error: '不存在' }
    return { success: true, data: item }
  })

  // ═══ Admin Routes ═══

  // GET /api/admin/legal/knowledge
  app.get('/api/admin/legal/knowledge', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as any
    const where: any = {}
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    if (query.category) where.category = query.category
    const items = await prisma.legalKnowledge.findMany({ where, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: items }
  })

  // POST /api/admin/legal/knowledge
  app.post('/api/admin/legal/knowledge', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as any
    const item = await prisma.legalKnowledge.create({ data: { title: body.title, content: body.content, category: body.category, tags: body.tags } })
    return { success: true, data: item }
  })

  // PATCH /api/admin/legal/knowledge/:id
  app.patch('/api/admin/legal/knowledge/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalKnowledge.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })
}
