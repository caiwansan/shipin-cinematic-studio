// ============================================================
// Brand GEO — Brand Profile Routes
// CRUD: /api/geo/brand/:projectId
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoBrandService } from '../../services/geo/brand.service.js'

export default async function geoBrandRoutes(fastify: FastifyInstance) {
  // Get brand profile
  fastify.get('/api/geo/brand/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const brand = await geoBrandService.getByProjectId(projectId)
    if (!brand) {
      return reply.status(404).send({ success: false, error: 'Brand profile not found' })
    }
    return { success: true, data: { brand } }
  })

  // Create brand profile
  fastify.post('/api/geo/brand/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const body = request.body as any
    const brand = await geoBrandService.create(projectId, body)
    return { success: true, data: { brand } }
  })

  // Update brand profile (upsert)
  fastify.put('/api/geo/brand/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const body = request.body as any
    const brand = await geoBrandService.update(projectId, body)
    return { success: true, data: { brand } }
  })
}
