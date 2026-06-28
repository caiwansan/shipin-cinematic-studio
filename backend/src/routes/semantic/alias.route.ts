// ============================================================
// Alias Routes — Resolve + CRUD for SemanticAlias
// API: /api/semantic/alias/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'

export default async function aliasRoutes(fastify: any) {
  // Create alias
  fastify.post('/api/semantic/alias', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.entityId || !body.alias) {
      return reply.status(400).send({ success: false, error: 'entityId and alias are required' })
    }
    const alias = await semanticService.createAlias({
      entityId: body.entityId,
      alias: body.alias,
      language: body.language,
      confidence: body.confidence,
    })
    return { success: true, data: { alias } }
  })

  // Get aliases for a project
  fastify.get('/api/semantic/alias/project/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const aliases = await semanticService.listAliases(projectId)
    return { success: true, data: { aliases } }
  })

  // Get aliases for an entity
  fastify.get('/api/semantic/alias/entity/:entityId', async (request: any, reply: any) => {
    const { entityId } = request.params
    const aliases = await semanticService.getEntityAliases(entityId)
    return { success: true, data: { aliases } }
  })

  // Resolve alias to entity
  fastify.get('/api/semantic/alias/resolve/:alias', async (request: any, reply: any) => {
    const { alias } = request.params
    const { projectId } = request.query as any
    const result = await semanticService.resolveAlias(alias, projectId)
    if (!result) {
      return { success: true, data: null }
    }
    return { success: true, data: { alias: result } }
  })

  // Delete alias
  fastify.delete('/api/semantic/alias/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await semanticService.deleteAlias(id)
    return { success: true }
  })
}
