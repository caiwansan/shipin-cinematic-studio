// ============================================================
// Brand GEO — Graph Routes
// CRUD: /api/geo/projects/:projectId/graph/*
//       /api/geo/graph/edges
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoGraphService } from '../../services/geo/graph.service.js'

export default async function geoGraphRoutes(fastify: FastifyInstance) {
  // List graph nodes for a project
  fastify.get('/api/geo/projects/:projectId/graph/nodes', async (request, reply) => {
    const { projectId } = request.params as any
    const nodes = await geoGraphService.listNodes(projectId)
    return { success: true, data: { nodes } }
  })

  // Create graph node
  fastify.post('/api/geo/projects/:projectId/graph/nodes', async (request, reply) => {
    const { projectId } = request.params as any
    const body = request.body as any
    if (!body.type || !body.label) {
      return reply.status(400).send({ success: false, error: 'type and label are required' })
    }
    const node = await geoGraphService.createNode({
      projectId,
      type: body.type,
      label: body.label,
      properties: body.properties || undefined,
    })
    return { success: true, data: { node } }
  })

  // List graph edges for a project
  fastify.get('/api/geo/projects/:projectId/graph/edges', async (request, reply) => {
    const { projectId } = request.params as any
    const edges = await geoGraphService.listEdges(projectId)
    return { success: true, data: { edges: edges } }
  })

  // Create graph edge (top-level /api/geo/graph/edges)
  fastify.post('/api/geo/graph/edges', async (request, reply) => {
    const body = request.body as any
    if (!body.sourceId || !body.targetId || !body.type) {
      return reply.status(400).send({ success: false, error: 'sourceId, targetId, and type are required' })
    }
    const edge = await geoGraphService.createEdge({
      sourceId: body.sourceId,
      targetId: body.targetId,
      type: body.type,
      properties: body.properties || undefined,
    })
    return { success: true, data: { edge } }
  })
}
