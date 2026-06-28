// ============================================================
// Workflow Execution Routes (KMKI-PLAT-011)
// Execute, Pause, Resume, Cancel
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowExecutionRoutes(app: FastifyInstance) {
  // Execute workflow
  app.post('/api/platform/workflow/executions/:instanceId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.execute(instanceId)
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Pause workflow
  app.post('/api/platform/workflow/executions/:instanceId/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.pause(instanceId)
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Resume workflow
  app.post('/api/platform/workflow/executions/:instanceId/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.resume(instanceId)
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Cancel workflow
  app.post('/api/platform/workflow/executions/:instanceId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const instance = await workflowService.cancel(instanceId)
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
