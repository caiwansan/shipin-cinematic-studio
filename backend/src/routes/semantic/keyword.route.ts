// ============================================================
// Keyword Routes — CRUD for SemanticKeyword
// API: /api/semantic/keyword/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'

export default async function keywordRoutes(fastify: any) {
  // Create keyword
  fastify.post('/api/semantic/keyword', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.keyword) {
      return reply.status(400).send({ success: false, error: 'projectId and keyword are required' })
    }
    const kw = await semanticService.createKeyword({
      projectId: body.projectId,
      keyword: body.keyword,
      entityId: body.entityId,
      language: body.language,
      confidence: body.confidence,
      metadata: body.metadata,
    })
    return { success: true, data: { keyword: kw } }
  })

  // List keywords by project
  fastify.get('/api/semantic/keyword/project/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const query = request.query as any
    const result = await semanticService.listKeywords({
      projectId,
      search: query.search,
      keyword: query.keyword,
      language: query.language,
      entityId: query.entityId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Get top keywords
  fastify.get('/api/semantic/keyword/top/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const query = request.query as any
    const limit = query.limit ? parseInt(query.limit) : 50
    const keywords = await semanticService.getTopKeywords(projectId, limit)
    return { success: true, data: { keywords } }
  })

  // Delete keyword
  fastify.delete('/api/semantic/keyword/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await semanticService.deleteKeyword(id)
    return { success: true }
  })
}
