// ============================================================
// Workflow Replay Routes (KMKI-PLAT-011)
// Replay: full, from node, failed nodes, branch
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowReplayRoutes(app: FastifyInstance) {
  // Full replay
  app.post('/api/platform/workflow/replays/:instanceId/full', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.replay(instanceId)
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Replay from specific node
  app.post('/api/platform/workflow/replays/:instanceId/from-node/:nodeId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId, nodeId } = request.params as any
      const instance = await workflowService.replay(instanceId, { fromNode: nodeId })
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Replay failed nodes only
  app.post('/api/platform/workflow/replays/:instanceId/failed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.replay(instanceId, { failedOnly: true })
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Replay branch
  app.post('/api/platform/workflow/replays/:instanceId/branch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any
      const instance = await workflowService.replay(instanceId, {
        branch: { start: body.startNodeId, end: body.endNodeId },
      })
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
