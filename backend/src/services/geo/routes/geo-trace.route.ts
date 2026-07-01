// KMKI-RUNTIME-010 — Execution Trace Routes
// GET /api/geo/traces — list traces
// GET /api/geo/traces/:traceId — get single trace
// GET /api/geo/traces/project/:projectId/summary — project summary

import { FastifyInstance } from 'fastify'
import { executionTraceService } from '../runtime/trace/ExecutionTraceService'

export default async function geoTraceRoutes(fastify: FastifyInstance) {
  // GET /api/geo/traces?projectId=xxx&agent=xxx&limit=20&offset=0
  fastify.get('/api/geo/traces', { preHandler: [] }, async (request, reply) => {
    try {
      const { projectId, agent, limit, offset } = request.query as any
      const result = await executionTraceService.listTraces({
        projectId: projectId as string,
        agent: agent as string,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/traces/:traceId
  fastify.get('/api/geo/traces/:traceId', { preHandler: [] }, async (request, reply) => {
    try {
      const { traceId } = request.params as any
      const trace = await executionTraceService.getTrace(traceId)
      if (!trace) {
        return reply.status(404).send({ success: false, error: 'Trace not found' })
      }
      return { success: true, data: trace }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/traces/project/:projectId/summary
  fastify.get('/api/geo/traces/project/:projectId/summary', { preHandler: [] }, async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const summary = await executionTraceService.getProjectSummary(projectId)
      if (!summary) {
        return reply.status(404).send({ success: false, error: 'No traces for project' })
      }
      return { success: true, data: summary }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
