// ============================================================
// Human-in-the-Loop Routes (KMKI-PLAT-011)
// Human response submission for approval, edit, review, upload, decision
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowHumanRoutes(app: FastifyInstance) {
  // Submit human response
  app.post('/api/platform/workflow/human/:instanceId/respond', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any

      if (!body.nodeType || !body.action) {
        return reply.status(400).send({ error: 'nodeType and action are required' })
      }

      await workflowService.submitHumanResponse(instanceId, body.nodeType, body.action, body.data)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Convenience: Approve
  app.post('/api/platform/workflow/human/:instanceId/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any
      await workflowService.submitHumanResponse(instanceId, 'approval', 'approved', body.data)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Convenience: Reject
  app.post('/api/platform/workflow/human/:instanceId/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any
      await workflowService.submitHumanResponse(instanceId, 'approval', 'rejected', body.data)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Convenience: Submit upload (files/urls)
  app.post('/api/platform/workflow/human/:instanceId/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { instanceId } = request.params as any
      const body = request.body as any
      await workflowService.submitHumanResponse(instanceId, 'upload', 'uploaded', body.data)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
