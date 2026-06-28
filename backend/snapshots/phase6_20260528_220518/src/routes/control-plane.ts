/**
 * Control Plane — Trace API
 *
 * Read-only observability layer for the dual-plane architecture.
 * Data collected by fire-and-forget hooks in:
 *   - policy-adapter.ts   → PolicyTrace
 *   - worker-runtime.ts   → ExecutionTrace
 *   - routes/director.ts  → FieldSnapshot
 *
 * GET /api/v1/control/traces           — list recent trace IDs
 * GET /api/v1/control/trace/:id        — full trace bundle
 * GET /api/v1/control/trace/:id/policy — policy trace
 * GET /api/v1/control/trace/:id/exec   — execution trace
 * GET /api/v1/control/trace/:id/field  — field snapshot
 * GET /api/v1/control/buffers          — buffer stats
 */

import { FastifyInstance } from 'fastify'
import {
  policyTraceBuffer,
  execTraceBuffer,
  fieldSnapshotBuffer,
  getFullTrace,
  getAllTraceIds,
  ringBufferGetAll,
} from '../control-plane/index.js'

export default async function controlPlaneRoutes(fastify: FastifyInstance): Promise<void> {

  // ── List recent traces ──
  fastify.get('/api/v1/control/traces', async () => {
    return { traceIds: getAllTraceIds() }
  })

  // ── Full trace bundle ──
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/control/trace/:id',
    async (req) => {
      const trace = getFullTrace(req.params.id)
      if (!trace) return { error: 'trace not found' }
      return trace
    },
  )

  // ── Policy trace ──
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/control/trace/:id/policy',
    async (req) => {
      const trace = getFullTrace(req.params.id)
      if (!trace || !trace.policy) return { error: 'policy trace not found' }
      return trace.policy
    },
  )

  // ── Execution trace ──
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/control/trace/:id/exec',
    async (req) => {
      const trace = getFullTrace(req.params.id)
      if (!trace || !trace.execution) return { error: 'execution trace not found' }
      return trace.execution
    },
  )

  // ── Field snapshot ──
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/control/trace/:id/field',
    async (req) => {
      const trace = getFullTrace(req.params.id)
      if (!trace || !trace.field) return { error: 'field snapshot not found' }
      return trace.field
    },
  )

  // ── Buffer stats ──
  fastify.get('/api/v1/control/buffers', async () => {
    return {
      policyTrace: { size: policyTraceBuffer.size, capacity: policyTraceBuffer.capacity, seq: policyTraceBuffer.seq },
      executionTrace: { size: execTraceBuffer.size, capacity: execTraceBuffer.capacity, seq: execTraceBuffer.seq },
      fieldSnapshot: { size: fieldSnapshotBuffer.size, capacity: fieldSnapshotBuffer.capacity, seq: fieldSnapshotBuffer.seq },
    }
  })

  // ── Raw recent entries (for debugging) ──
  fastify.get('/api/v1/control/buffers/policy', async () => {
    return { entries: ringBufferGetAll(policyTraceBuffer).slice(-50) }
  })

  fastify.get('/api/v1/control/buffers/exec', async () => {
    return { entries: ringBufferGetAll(execTraceBuffer).slice(-50) }
  })

  fastify.get('/api/v1/control/buffers/field', async () => {
    return { entries: ringBufferGetAll(fieldSnapshotBuffer).slice(-50) }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "control-plane",
  "mode": "LEGACY"
};

