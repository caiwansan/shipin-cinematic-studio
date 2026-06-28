// ============================================================
// Agent Session REST Routes
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function sessionRoutes(app: FastifyInstance) {
  // List sessions
  app.get('/api/platform/agent-sessions', async (request, reply) => {
    const query = request.query as any
    const sessions = agentService.listSessions({
      status: query.status,
      agentCode: query.agentCode,
    })
    return { success: true, data: sessions }
  })

  // Get single session
  app.get<{ Params: { id: string } }>('/api/platform/agent-sessions/:id', async (request, reply) => {
    const session = agentService.getSession(request.params.id)
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Session not found' })
    }
    return { success: true, data: session }
  })
}
