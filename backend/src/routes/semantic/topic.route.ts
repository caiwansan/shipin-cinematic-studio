// ============================================================
// Topic Routes — CRUD for SemanticTopic
// API: /api/semantic/topic/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'

export default async function topicRoutes(fastify: any) {
  // Create topic
  fastify.post('/api/semantic/topic', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.name) {
      return reply.status(400).send({ success: false, error: 'projectId and name are required' })
    }
    const topic = await semanticService.createTopic({
      projectId: body.projectId,
      name: body.name,
      description: body.description,
      confidence: body.confidence,
      metadata: body.metadata,
    })
    return { success: true, data: { topic } }
  })

  // Get topic by ID
  fastify.get('/api/semantic/topic/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const topic = await semanticService.getTopic(id)
    if (!topic) {
      return reply.status(404).send({ success: false, error: 'Topic not found' })
    }
    return { success: true, data: { topic } }
  })

  // List topics by project
  fastify.get('/api/semantic/topic/project/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const query = request.query as any
    const result = await semanticService.listTopics({
      projectId,
      search: query.search,
      name: query.name,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Update topic
  fastify.put('/api/semantic/topic/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const topic = await semanticService.updateTopic(id, {
      name: body.name,
      description: body.description,
      confidence: body.confidence,
      metadata: body.metadata,
      projectId: body.projectId,
    })
    if (!topic) {
      return reply.status(404).send({ success: false, error: 'Topic not found' })
    }
    return { success: true, data: { topic } }
  })

  // Delete topic
  fastify.delete('/api/semantic/topic/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await semanticService.deleteTopic(id)
    return { success: true }
  })

  // Link entity to topic
  fastify.post('/api/semantic/topic/link', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.entityId || !body.topicId) {
      return reply.status(400).send({ success: false, error: 'entityId and topicId are required' })
    }
    const link = await semanticService.linkEntityToTopic(body.entityId, body.topicId)
    return { success: true, data: { link } }
  })

  // Get entities for a topic
  fastify.get('/api/semantic/topic/:id/entities', async (request: any, reply: any) => {
    const { id } = request.params
    const entities = await semanticService.getTopicEntities(id)
    return { success: true, data: { entities } }
  })
}
