// ============================================================
// Agent REST Routes — CRUD for AgentDefinitions
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function agentRoutes(app: FastifyInstance) {
  // List all agents
  app.get('/api/platform/agents', async (request, reply) => {
    const agents = agentService.listAgents()
    return { success: true, data: agents }
  })

  // Get single agent
  app.get<{ Params: { code: string } }>('/api/platform/agents/:code', async (request, reply) => {
    const agent = agentService.getAgent(request.params.code)
    if (!agent) {
      return reply.status(404).send({ success: false, error: 'Agent not found' })
    }
    return { success: true, data: agent }
  })

  // Register agent
  app.post('/api/platform/agents', async (request, reply) => {
    const body = request.body as any
    try {
      const agent = await agentService.register(body)
      return reply.status(201).send({ success: true, data: agent })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Unregister agent
  app.delete<{ Params: { code: string } }>('/api/platform/agents/:code', async (request, reply) => {
    const removed = await agentService.unregister(request.params.code)
    if (!removed) {
      return reply.status(404).send({ success: false, error: 'Agent not found' })
    }
    return { success: true, data: { code: request.params.code } }
  })

  // Execute agent
  app.post('/api/platform/agents/:code/execute', async (request, reply) => {
    const { code } = request.params as any
    const body = request.body as any
    try {
      const result = await agentService.execute(code, body?.input || {}, {
        userId: (request as any).userId,
        workspaceId: body?.workspaceId,
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
