// ============================================================
// Workflow Definition Routes (KMKI-PLAT-011)
// CRUD for workflow definitions
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowDefinitionRoutes(app: FastifyInstance) {
  // List definitions
  app.get('/api/platform/workflow/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const definitions = await workflowService.listDefinitions({
        status: query.status,
        category: query.category,
      })
      return reply.send({ data: definitions, total: definitions.length })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // Get definition by ID or code
  app.get('/api/platform/workflow/definitions/:idOrCode', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { idOrCode } = request.params as any
      const definition = await workflowService.getDefinition(idOrCode)
      if (!definition) {
        return reply.status(404).send({ error: 'Workflow definition not found' })
      }
      return reply.send({ data: definition })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // Create definition
  app.post('/api/platform/workflow/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      const definition = await workflowService.createDefinition(body)
      return reply.status(201).send({ data: definition })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Update definition
  app.put('/api/platform/workflow/definitions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const definition = await workflowService.updateDefinition(id, body)
      return reply.send({ data: definition })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Delete definition
  app.delete('/api/platform/workflow/definitions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      await workflowService.deleteDefinition(id)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
