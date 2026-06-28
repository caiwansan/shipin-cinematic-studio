// ============================================================
// GEO Brand Routes (Brand GEO compat → KMKI-GEO Sprint 1A)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../../services/geo/services/geo-project.service'

export default async function geoBrandRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands — Get brand profile (delegates to project service)
  fastify.get('/api/geo/brands', async (request, reply) => {
    const userId = (request as any).user?.id || 'anonymous'
    try {
      const projects = await geoProjectService.listProjects(userId)
      return { success: true, data: { brands: projects } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
