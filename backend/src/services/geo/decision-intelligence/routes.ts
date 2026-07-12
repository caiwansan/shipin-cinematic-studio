// ─────────────────────────────────────────────────
// Decision Intelligence — Routes
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify'
import { IssueGraphBuilder } from './issue-graph-builder'

interface RouteOptions {
  builder?: IssueGraphBuilder
}

export function registerDIIssueGraphRoutes(fastify: FastifyInstance, opts?: RouteOptions) {
  const builder = opts?.builder || new IssueGraphBuilder()

  // POST — Generate issue graph for a brand
  fastify.post('/api/geo/recommendation/issues', { preHandler: [] }, async (request, reply) => {
    const body = request.body as any
    if (!body.brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      const graph = await builder.build(body.brandId)
      return { success: true, data: graph }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET — Get cached issue graph for a brand
  fastify.get('/api/geo/recommendation/issues/:brandId', { preHandler: [] }, async (request, reply) => {
    const { brandId } = request.params as any

    try {
      const cached = builder.getCached(brandId)
      if (!cached) {
        // Auto-generate if not cached
        const graph = await builder.build(brandId)
        return { success: true, data: graph }
      }
      return { success: true, data: cached }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET — Get dependencies for a specific issue
  fastify.get('/api/geo/recommendation/issues/:brandId/:issueId/dependencies', { preHandler: [] }, async (request, reply) => {
    const { brandId, issueId } = request.params as any

    try {
      const cached = builder.getCached(brandId)
      if (!cached) {
        return reply.status(404).send({ success: false, error: 'No issue graph found for this brand' })
      }

      const issue = cached.nodes.find(n => n.id === issueId)
      if (!issue) {
        return reply.status(404).send({ success: false, error: 'Issue not found' })
      }

      const deps = cached.edges.filter(e => e.from === issueId || e.to === issueId)
      return { success: true, data: deps }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
