// ============================================================
// GEO Graph Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoGraphService } from '../services/geo-graph.service'

export default async function geoGraphRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects/:projectId/graph/build — Build knowledge graph
  fastify.post('/api/geo/projects/:projectId/graph/build', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const graph = await geoGraphService.buildGraph(projectId)
      return { success: true, data: graph }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/graph — Get full graph
  fastify.get('/api/geo/projects/:projectId/graph', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const graph = await geoGraphService.getGraph(projectId)
      if (!graph) {
        return reply.status(404).send({ success: false, error: 'No graph found for this project' })
      }
      return { success: true, data: graph }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/graph/node/:entityId — Get graph node
  fastify.get('/api/geo/projects/:projectId/graph/node/:entityId', { preHandler: [] }, async (request, reply) => {
    const { projectId, entityId } = request.params as any

    try {
      const node = await geoGraphService.getGraphNode(projectId, entityId)
      if (!node) {
        return reply.status(404).send({ success: false, error: 'Node not found' })
      }
      return { success: true, data: node }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/graph/edges — Get all edges
  fastify.get('/api/geo/projects/:projectId/graph/edges', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const edges = await geoGraphService.getGraphEdges(projectId)
      return { success: true, data: edges }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/graph/versions/:version — Get graph version
  fastify.get('/api/geo/projects/:projectId/graph/versions/:version', { preHandler: [] }, async (request, reply) => {
    const { projectId, version } = request.params as any

    try {
      const graphVersion = await geoGraphService.getGraphVersion(projectId, parseInt(version))
      if (!graphVersion) {
        return reply.status(404).send({ success: false, error: 'Graph version not found' })
      }
      return { success: true, data: graphVersion }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:projectId/graph/visualize — Visualization data
  fastify.get('/api/geo/projects/:projectId/graph/visualize', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as any

    try {
      const viz = await geoGraphService.visualize(projectId)
      if (!viz) {
        return reply.status(404).send({ success: false, error: 'No graph data to visualize' })
      }
      return { success: true, data: viz }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
