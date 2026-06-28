// ============================================================
// Agent Memory REST Routes
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function memoryRoutes(app: FastifyInstance) {
  // Store memory
  app.post('/api/platform/agent-memory', async (request, reply) => {
    const body = request.body as any
    try {
      await agentService.storeMemory(
        body.sessionId,
        body.type || 'shortTerm',
        body.content,
        body.relevanceScore,
        body.ttl,
      )
      return { success: true }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Retrieve memories
  app.get('/api/platform/agent-memory', async (request, reply) => {
    const query = request.query as any
    if (!query.sessionId) {
      return reply.status(400).send({ success: false, error: 'sessionId is required' })
    }
    const memories = await agentService.retrieveMemory(query.sessionId, query.type)
    return { success: true, data: memories }
  })

  // Summarize memories
  app.get<{ Params: { sessionId: string } }>('/api/platform/agent-memory/:sessionId/summary', async (request, reply) => {
    const summary = await agentService.summarizeMemory(request.params.sessionId)
    return { success: true, data: { summary } }
  })
}
