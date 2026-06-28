// ============================================================
// GEO Entity Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoEntityService } from '../services/geo-entity.service'

export default async function geoEntityRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects/:projectId/discover — Discover entities
  fastify.post('/api/geo/projects/:projectId/discover', async (request, reply) => {
    const { projectId } = request.params as any
    const body = request.body as any

    if (!body.topic) {
      return reply.status(400).send({ success: false, error: 'topic is required' })
    }

    try {
      const result = await geoEntityService.discoverEntities(projectId, body.topic)
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/entities/:id — Get entity
  fastify.get('/api/geo/entities/:id', async (request, reply) => {
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
  fastify.get('/api/geo/projects/:projectId/entities', async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const entities = await geoEntityService.listEntities(projectId)
      return { success: true, data: entities }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/entities/:id — Update entity
  fastify.put('/api/geo/entities/:id', async (request, reply) => {
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
  fastify.post('/api/geo/entities/:sourceId/relations', async (request, reply) => {
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
  fastify.get('/api/geo/entities/:id/relations', async (request, reply) => {
    const { id } = request.params as any

    try {
      const relations = await geoEntityService.getEntityRelations(id)
      return { success: true, data: relations }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/entities/:id/provenance — Get entity provenance
  fastify.get('/api/geo/entities/:id/provenance', async (request, reply) => {
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
