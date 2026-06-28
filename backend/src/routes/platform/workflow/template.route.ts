// ============================================================
// Workflow Template Routes (KMKI-PLAT-011)
// Template management
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { workflowService } from '../../../services/platform/workflow/workflow.service.js'

export default async function workflowTemplateRoutes(app: FastifyInstance) {
  // Create template
  app.post('/api/platform/workflow/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      const template = await workflowService.createTemplate(body)
      return reply.status(201).send({ data: template })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // List templates
  app.get('/api/platform/workflow/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const templates = await workflowService.listTemplates(query.category)
      return reply.send({ data: templates, total: templates.length })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
