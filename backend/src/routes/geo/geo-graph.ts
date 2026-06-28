// ============================================================
// GEO Graph Routes (Brand GEO compat → KMKI-GEO Sprint 1A)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoGraphService } from '../../services/geo/services/geo-graph.service'

export default async function geoGraphRoutes(fastify: FastifyInstance) {
  // GET /api/geo/projects/:projectId/graph — Get graph
  fastify.get('/api/geo/projects/:projectId/graph', async (request, reply) => {
    const { projectId } = request.params as any
    try {
      const graph = await geoGraphService.getGraph(projectId)
      return { success: true, data: { graph } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:projectId/graph/build — Build graph
  fastify.post('/api/geo/projects/:projectId/graph/build', async (request, reply) => {
    const { projectId } = request.params as any
    try {
      const graph = await geoGraphService.buildGraph(projectId)
      return { success: true, data: { graph } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
