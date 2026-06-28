import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/runtime-trace.ts — Phase 4.2 / 4.2.5
 *
 * GET /api/v1/runtime/trace — Return current runtime invocation snapshot.
 * POST /api/v1/runtime/trace/flush — Force flush runtime trace to disk.
 *
 * On first import, starts periodic flush (60s interval).
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "OBSERVE" }
 */

import { FastifyInstance } from 'fastify'
import { snapshotTrace, startPeriodicFlush, runtimeTrace } from '../runtime/trace/runtime-trace.js'

// Phase 4.2.5: Start periodic flush on module load
startPeriodicFlush(60_000)

export default async function runtimeTraceRoutes(app: FastifyInstance) {
  app.get('/api/v1/runtime/trace', async (_req, _reply) => {
    const trace = snapshotTrace()

    return {
      success: true,
      totalEvents: trace.events.length,
      invokedModules: [...new Set(trace.events.map(e => e.module))],
      events: trace.events.slice(-50), // last 50 events
    }
  })

  // Phase 4.2.5: Manual flush endpoint
  app.post('/api/v1/runtime/trace/flush', async (_req, _reply) => {
    runtimeTrace.flush()
    return { success: true, message: 'Trace flushed to disk' } satisfies ApiResponse<unknown>;

  })
}
