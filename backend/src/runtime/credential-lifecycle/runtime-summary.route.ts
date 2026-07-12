// ============================================================
// Runtime Summary API — GET /api/runtime/summary
// ============================================================

import { FastifyInstance } from 'fastify'
import { getCredentialLifecycleService } from './credential-lifecycle.service.js'

const registerRuntimeSummaryRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/runtime/summary', async (_req, reply) => {
    const service = getCredentialLifecycleService()
    const summary = await service.getSummary()
    return reply.send(summary)
  })
}

export { registerRuntimeSummaryRoutes }
