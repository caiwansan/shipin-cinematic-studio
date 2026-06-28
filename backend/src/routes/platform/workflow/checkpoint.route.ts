// ============================================================
// Workflow Checkpoint Routes (KMKI-PLAT-011)
// Checkpoint management
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowCheckpointRoutes(app: FastifyInstance) {
  // Save checkpoint
  app.post('/api/platform/workflow/checkpoints/:instanceId/save', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any
      const checkpoint = await workflowService.saveCheckpoint(instanceId, body.nodeId)
      return reply.status(201).send({ data: checkpoint })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // List checkpoints
  app.get('/api/platform/workflow/checkpoints/:instanceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const checkpoints = await workflowService.listCheckpoints(instanceId)
      return reply.send({ data: checkpoints, total: checkpoints.length })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
