// ============================================================
// Agent Dispatch REST Routes
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function dispatchRoutes(app: FastifyInstance) {
  // Dispatch single agent
  app.post('/api/platform/agent-dispatch', async (request, reply) => {
    const body = request.body as any
    try {
      const result = await agentService.dispatch({
        agentCode: body.agentCode,
        input: body.input || {},
        metadata: body.metadata,
      }, {
        userId: (request as any).userId,
        workspaceId: body.workspaceId,
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // Dispatch multiple agents
  app.post('/api/platform/agent-dispatch/multiple', async (request, reply) => {
    const body = request.body as any
    try {
      const results = await agentService.dispatchMultiple({
        agents: body.agents || [],
        mode: body.mode || 'sequential',
        metadata: body.metadata,
      }, {
        userId: (request as any).userId,
        workspaceId: body.workspaceId,
      })
      return { success: true, data: results }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
