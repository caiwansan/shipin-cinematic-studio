// ════════════════════════════════════════════════════════════
// KH4-T006 — Distribution API
// Sole entry: DistributionEngine. No approval logic.
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { DistributionEngine } from './distribution-engine'
import { DistributionRegistry } from './distribution-registry'

export function registerDistributionRoutes(
  fastify: FastifyInstance,
  opts: {
    engine: DistributionEngine
    registry: DistributionRegistry
  },
) {
  // ── POST /knowledge/distribution/start — Start distribution ──
  fastify.post('/api/knowledge/distribution/start', async (request, reply) => {
    const body = request.body as any
    if (!body.packageId || !body.publishTargets?.length) {
      return reply.status(400).send({ success: false, error: 'packageId and publishTargets are required' })
    }

    try {
      const result = await opts.engine.start({
        packageId: body.packageId,
        publishTargets: body.publishTargets,
        initiatedBy: (request as any).user?.id || 'anonymous',
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── GET /knowledge/distribution/jobs — List jobs ──
  fastify.get('/api/knowledge/distribution/jobs', async () => {
    const jobs = await opts.engine.listJobs()
    return { success: true, data: jobs }
  })

  // ── GET /knowledge/distribution/jobs/:id — Get job ──
  fastify.get('/api/knowledge/distribution/jobs/:id', async (request, reply) => {
    const { id } = request.params as any
    const job = await opts.engine.getJob(id)
    if (!job) return reply.status(404).send({ success: false, error: 'Job not found' })
    return { success: true, data: job }
  })

  // ── GET /knowledge/distribution/results/:planId — Get result ──
  fastify.get('/api/knowledge/distribution/results/:planId', async (request, reply) => {
    const { planId } = request.params as any
    const result = await opts.engine.getResult(planId)
    if (!result) return reply.status(404).send({ success: false, error: 'Result not found' })
    return { success: true, data: result }
  })

  // ── GET /knowledge/distribution/targets — List targets ──
  fastify.get('/api/knowledge/distribution/targets', async () => {
    const targets = opts.registry.getAll().map(t => ({
      name: t.name,
      type: t.type,
      capabilities: t.capabilities,
    }))
    return { success: true, data: targets }
  })
}
