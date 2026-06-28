/**
 * Runtime API — Routes
 *
 * Three-layer API + SSE event stream + Replay API.
 */

import type { FastifyInstance } from 'fastify'
import {
  handleValidate,
  handleCompile,
  handleExecute,
  handleRunStatus,
  handleRunEvents,
  handleRunList,
  handleRunReplay,
} from './runtime.controller.js'

export async function runtimeRoutes(app: FastifyInstance): Promise<void> {
  // ── Runtime API ──
  app.post('/runtime/validate', handleValidate)
  app.post('/runtime/compile', handleCompile)
  app.post('/runtime/execute', handleExecute)

  // ── Run Management ──
  app.get('/runtime/runs', handleRunList)
  app.get('/runtime/runs/:runId', handleRunStatus)
  app.get('/runtime/runs/:runId/stream', handleRunEvents)
  app.get('/runtime/runs/:runId/replay', handleRunReplay)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

