// ============================================================
// Execution Main Route — aggregates all execution routes
// ============================================================

import type { FastifyInstance } from 'fastify'
import executionRoute from './execution.route.js'
import planRoute from './plan.route.js'
import historyRoute from './history.route.js'

export default async function executionMainRoute(app: FastifyInstance): Promise<void> {
  await Promise.all([
    app.register(executionRoute),
    app.register(planRoute),
    app.register(historyRoute),
  ])
}
