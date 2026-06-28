// ============================================================
// Agent Schedule REST Routes
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function scheduleRoutes(app: FastifyInstance) {
  // Schedule a plan
  app.post('/api/platform/agent-schedule', async (request, reply) => {
    const body = request.body as any
    try {
      const job = await agentService.schedule({
        workspaceId: body.workspaceId || '',
        steps: body.steps || [],
        priority: body.priority || 0,
        maxRetries: body.maxRetries,
        timeout: body.timeout,
        metadata: body.metadata,
      }, {
        userId: (request as any).userId,
        workspaceId: body.workspaceId,
      })
      return { success: true, data: job }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // List schedules
  app.get('/api/platform/agent-schedule', async (request, reply) => {
    const query = request.query as any
    const jobs = agentService.listSchedules({ status: query.status })
    return { success: true, data: jobs }
  })

  // Get schedule
  app.get<{ Params: { id: string } }>('/api/platform/agent-schedule/:id', async (request, reply) => {
    const job = agentService.getSchedule(request.params.id)
    if (!job) {
      return reply.status(404).send({ success: false, error: 'Schedule not found' })
    }
    return { success: true, data: job }
  })

  // Cancel schedule
  app.post<{ Params: { id: string } }>('/api/platform/agent-schedule/:id/cancel', async (request, reply) => {
    const cancelled = await agentService.cancelSchedule(request.params.id)
    if (!cancelled) {
      return reply.status(404).send({ success: false, error: 'Schedule not found or not running' })
    }
    return { success: true, data: { id: request.params.id, status: 'cancelled' } }
  })
}
