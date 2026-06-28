// ============================================================
// Entity Routes — CRUD + search for SemanticEntity
// API: /api/semantic/entity/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'

export default async function entityRoutes(fastify: any) {
  // Create entity
  fastify.post('/api/semantic/entity', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.type || !body.name) {
      return reply.status(400).send({ success: false, error: 'projectId, type, and name are required' })
    }
    const entity = await semanticService.createEntity({
      projectId: body.projectId,
      type: body.type,
      name: body.name,
      description: body.description,
      confidence: body.confidence,
      assetId: body.assetId,
      metadata: body.metadata,
    })
    return { success: true, data: { entity } }
  })

  // Get entity by ID
  fastify.get('/api/semantic/entity/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const entity = await semanticService.getEntity(id)
    if (!entity) {
      return reply.status(404).send({ success: false, error: 'Entity not found' })
    }
    return { success: true, data: { entity } }
  })

  // List entities by project
  fastify.get('/api/semantic/entity/project/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const query = request.query as any
    const result = await semanticService.listEntities({
      projectId,
      type: query.type,
      name: query.name,
      search: query.search,
      confidenceMin: query.confidenceMin ? parseFloat(query.confidenceMin) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Search entities
  fastify.get('/api/semantic/entity/search', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.projectId) {
      return reply.status(400).send({ success: false, error: 'projectId is required' })
    }
    const result = await semanticService.listEntities({
      projectId: query.projectId,
      search: query.q,
      type: query.type,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Update entity
  fastify.put('/api/semantic/entity/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const entity = await semanticService.updateEntity(id, {
      type: body.type,
      name: body.name,
      description: body.description,
      confidence: body.confidence,
      metadata: body.metadata,
    })
    if (!entity) {
      return reply.status(404).send({ success: false, error: 'Entity not found' })
    }
    return { success: true, data: { entity } }
  })

  // Delete entity (soft)
  fastify.delete('/api/semantic/entity/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const result = await semanticService.deleteEntity(id)
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Entity not found' })
    }
    return { success: true, data: result }
  })

  // Resolve entity by name
  fastify.get('/api/semantic/entity/resolve/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const { name } = request.query as any
    if (!name) {
      return reply.status(400).send({ success: false, error: 'name query param is required' })
    }
    const resolved = await semanticService.resolveEntity(projectId, name)
    if (!resolved) {
      return { success: true, data: null }
    }
    return { success: true, data: { entity: resolved.entity, matchedVia: resolved.matchedVia } }
  })

  // Get entity type stats
  fastify.get('/api/semantic/entity/stats/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const stats = await semanticService.getEntityStats(projectId)
    return { success: true, data: { stats } }
  })
}
