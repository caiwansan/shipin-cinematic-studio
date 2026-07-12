// KMKI-RUNTIME-016 — Knowledge Object CRUD Routes
// GET /api/geo/knowledge — list by project (returns KO objects)
// GET /api/geo/knowledge — map to Dashboard data format when ?view=dashboard
// GET /api/geo/knowledge/:id — get single
// PATCH /api/geo/knowledge/:id/status — update status
// POST /api/geo/knowledge/merge — merge multiple KOs

import { FastifyInstance } from 'fastify'
import { knowledgeObjectService } from '../runtime/knowledge/KnowledgeObjectService'

export default async function (fastify: FastifyInstance) {
  // GET /api/geo/knowledge?projectId=xxx — Knowledge Dashboard view
  fastify.get('/api/geo/knowledge', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.query as any
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId required' })

    let kos: any[]
    try {
      kos = await knowledgeObjectService.getByProject(projectId)
    } catch {
      kos = []
    }

    // Map to frontend KnowledgeData format
    const total = kos.length
    const entities = kos.filter(k => k.type === 'entity').length
    const claims = kos.filter(k => k.type === 'claim').length
    const evidences = kos.filter(k => k.type === 'evidence').length
    const relations = kos.filter(k => k.type === 'relation').length
    const keywords = kos.filter(k => k.type === 'keyword').length

    // Build categories from KO types
    const categoryMap = new Map<string, { name: string; count: number; items: string[] }>()
    for (const ko of kos) {
      const cat = ko.category || ko.type || 'general'
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { name: cat, count: 0, items: [] })
      }
      const entry = categoryMap.get(cat)!
      entry.count++
      if (ko.name) entry.items.push(ko.name)
    }

    const categories = Array.from(categoryMap.values())

    // Determine freshness from KOs creation dates
    const dates = kos.filter(k => k.createdAt).map(k => new Date(k.createdAt!).getTime())
    const lastUpdated = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null

    return {
      success: true,
      data: {
        assets: {
          total,
          entities,
          claims,
          evidences,
          relations,
          schemas: 0,
          faqs: 0,
          keywords,
          knowledgeObjects: total,
        },
        coverage: {
          percentage: categories.length > 0 ? Math.round((categories.filter(c => c.count > 0).length / Math.max(1, categories.length)) * 100) : 0,
          coveredDimensions: categories.filter(c => c.count > 0).length,
          totalDimensions: Math.max(7, categories.length),
          dimensions: categories.map(c => ({ name: c.name, covered: c.count > 0, count: c.count })),
        },
        categories,
        freshness: {
          overall: 0,
          lastUpdated,
          staleItems: 0,
          freshItems: dates.length,
        },
        missingKnowledge: categories.length === 0 ? [
          { category: '知识源', suggestion: '添加品牌官网、产品页面等来源以建立知识库' },
          { category: '实体', suggestion: '运行发现扫描以提取品牌实体' },
        ] : [],
        relationships: [],
      },
    }
  })

  // POST /api/geo/knowledge — Create a knowledge object (知识源/知识条目)
  fastify.post('/api/geo/knowledge', { preHandler: [] }, async (request, reply) => {
    const { projectId, type, name, content, category } = request.body as any
    if (!projectId || !name) {
      return reply.status(400).send({ success: false, error: 'projectId and name are required' })
    }
    const ko = await knowledgeObjectService.getOrCreate({
      projectId,
      topic: name,
      provenance: content || undefined,
    })
    return reply.status(201).send({ success: true, data: ko })
  })

  // GET /api/geo/knowledge/:id
  fastify.get('/api/geo/knowledge/:id', { preHandler: [] }, async (request, reply) => {
    const ko = await knowledgeObjectService.getById((request.params as any).id)
    if (!ko) return reply.status(404).send({ success: false, error: 'Not found' })
    return { success: true, data: ko }
  })

  // PATCH /api/geo/knowledge/:id/status
  fastify.patch('/api/geo/knowledge/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body as any
    const ko = await knowledgeObjectService.updateStatus((request.params as any).id, status)
    if (!ko) return reply.status(404).send({ success: false, error: 'Not found' })
    return { success: true, data: ko }
  })

  // POST /api/geo/knowledge/merge
  fastify.post('/api/geo/knowledge/merge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { koIds } = request.body as any
    if (!koIds?.length) return reply.status(400).send({ success: false, error: 'koIds required' })
    const merged = await knowledgeObjectService.merge(koIds)
    return { success: true, data: merged }
  })
}
