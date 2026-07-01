// ============================================================
// GEO Entity Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { geoEntityService } from '../services/geo-entity.service'

export default async function geoEntityRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects/:projectId/discover — Discover entities
  // Returns KnowledgeObject (not raw entity array)
  fastify.post('/api/geo/projects/:projectId/discover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const body = request.body as any

    if (!body.topic) {
      return reply.status(400).send({ success: false, error: 'topic is required' })
    }

    try {
      const user = request.user as any
      const traceId = body.traceId || uuidv4()
      console.log('[EntityRoute] Discover starting for project:', projectId, 'topic:', body.topic, 'traceId:', traceId, 'user:', user?.id)
      const ko = await geoEntityService.discoverEntities(projectId, body.topic, user?.id)
      console.log('[EntityRoute] Discover result: KO', ko.id, 'entities:', ko.entities.length, 'relations:', ko.relations.length)
      return {
        success: true,
        data: {
          id: ko.id,
          projectId: ko.projectId,
          topic: ko.topic,
          status: ko.status,
          entities: ko.entities,
          relations: ko.relations,
          entityCount: ko.entities.length,
          relationCount: ko.relations.length,
          provenance: ko.provenance,
          createdAt: ko.createdAt,
          updatedAt: ko.updatedAt,
        },
      }
    } catch (err: any) {
      console.error('[EntityRoute] Discover error:', err.message, err.stack?.slice(0, 500))
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/entities/:id — Get entity
  fastify.get('/api/geo/entities/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const entity = await geoEntityService.getEntity(id)
      if (!entity) {
        return reply.status(404).send({ success: false, error: 'Entity not found' })
      }
      return { success: true, data: entity }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/entities — List entities
  fastify.get('/api/geo/projects/:projectId/entities', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const entities = await geoEntityService.listEntities(projectId)
      return { success: true, data: entities }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/entities/:id — Update entity
  fastify.put('/api/geo/entities/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    try {
      const entity = await geoEntityService.updateEntity(id, body)
      if (!entity) {
        return reply.status(404).send({ success: false, error: 'Entity not found' })
      }
      return { success: true, data: entity }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/entities/:sourceId/relations — Add relation
  fastify.post('/api/geo/entities/:sourceId/relations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { sourceId } = request.params as any
    const body = request.body as any

    if (!body.targetId || !body.type) {
      return reply.status(400).send({ success: false, error: 'targetId and type are required' })
    }

    try {
      const relation = await geoEntityService.addRelation(sourceId, body.targetId, body.type, body.metadata)
      return reply.status(201).send({ success: true, data: relation })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/entities/:id/relations — Get entity relations
  fastify.get('/api/geo/entities/:id/relations', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const relations = await geoEntityService.getEntityRelations(id)
      return { success: true, data: relations }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/entities/:id/provenance — Get entity provenance
  fastify.get('/api/geo/entities/:id/provenance', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const provenance = await geoEntityService.getEntityProvenance(id)
      if (!provenance) {
        return reply.status(404).send({ success: false, error: 'Entity not found' })
      }
      return { success: true, data: provenance }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
