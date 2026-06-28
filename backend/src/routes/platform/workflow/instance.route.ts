// ============================================================
// Workflow Instance Routes (KMKI-PLAT-011)
// Instance management: create, list, get, describe
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowInstanceRoutes(app: FastifyInstance) {
  // Create instance
  app.post('/api/platform/workflow/instances', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      const instance = await workflowService.createInstance(
        body.workflowCode,
        body.workspaceId,
        body.input,
      )
      return reply.status(201).send({ data: instance })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // List instances
  app.get('/api/platform/workflow/instances', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const instances = await workflowService.listInstances({
        workflowId: query.workflowId,
        workspaceId: query.workspaceId,
        status: query.status,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      })
      return reply.send({ data: instances, total: instances.length })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // Get instance
  app.get('/api/platform/workflow/instances/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const instance = await workflowService.getInstance(id)
      if (!instance) {
        return reply.status(404).send({ error: 'Workflow instance not found' })
      }
      return reply.send({ data: instance })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // Describe instance (with nodes, edges, events)
  app.get('/api/platform/workflow/instances/:id/describe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const detail = await workflowService.describeInstance(id)
      if (!detail.instance) {
        return reply.status(404).send({ error: 'Workflow instance not found' })
      }
      return reply.send({ data: detail })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
