import { FastifyInstance } from 'fastify'
import { sceneService } from '../services/scene.service.js'

export default async function sceneRoutes(fastify: FastifyInstance) {
  // GET /api/projects/:projectId/scenes
  fastify.get('/api/projects/:projectId/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    return await sceneService.findByProject(projectId)
  })

  // GET /api/scenes/:id
  fastify.get('/api/scenes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await sceneService.findById(id)
  })

  // POST /api/projects/:projectId/scenes
  fastify.post('/api/projects/:projectId/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const data = request.body as any
    return await sceneService.create(projectId, data)
  })

  // PUT /api/scenes/:id
  fastify.put('/api/scenes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const data = request.body as any
    return await sceneService.update(id, data)
  })

  // DELETE /api/scenes/:id
  fastify.delete('/api/scenes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await sceneService.delete(id)
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

