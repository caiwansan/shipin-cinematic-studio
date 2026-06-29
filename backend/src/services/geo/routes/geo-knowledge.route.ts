// KMKI-RUNTIME-016 — Knowledge Object CRUD Routes
// GET /api/geo/knowledge — list by project
// GET /api/geo/knowledge/:id — get single
// PATCH /api/geo/knowledge/:id/status — update status
// POST /api/geo/knowledge/merge — merge multiple KOs

import { FastifyInstance } from 'fastify'
import { knowledgeObjectService } from '../runtime/knowledge/KnowledgeObjectService'

export default async function (fastify: FastifyInstance) {
  // GET /api/geo/knowledge?projectId=xxx
  fastify.get('/api/geo/knowledge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.query as any
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId required' })
    const kos = await knowledgeObjectService.getByProject(projectId)
    return { success: true, data: kos }
  })

  // GET /api/geo/knowledge/:id
  fastify.get('/api/geo/knowledge/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
