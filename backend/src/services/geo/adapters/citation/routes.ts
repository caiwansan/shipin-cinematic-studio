// ============================================================
// GEO Citation Routes — Proxy endpoints to core/citation
// ============================================================
// Routes under /api/geo/citations/
// These are thin proxies that delegate to the GEO Citation Adapter.
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoCitationAdapter } from './GeoCitationAdapter'

export default async function (fastify: FastifyInstance) {
  // ─── POST /api/geo/citations — Create a citation ───
  fastify.post('/api/geo/citations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any
      const tenantId = (request as any).user?.tenantId || 'anonymous'

      const citation = await geoCitationAdapter.create({
        evidenceId: body.evidenceId,
        format: body.format,
        citationText: body.citationText,
        sourceUrl: body.sourceUrl,
        publisher: body.publisher,
        author: body.author,
        datePublished: body.datePublished,
        authorityLevel: body.authorityLevel,
        metadata: body.metadata,
      }, tenantId)

      return reply.status(201).send({ success: true, data: citation })
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── GET /api/geo/citations — Search citations ───
  fastify.get('/api/geo/citations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any
      const result = await geoCitationAdapter.search({
        evidenceId: query.evidenceId,
        authorityLevel: query.authorityLevel,
        q: query.q,
        limit: query.limit ? parseInt(query.limit as string, 10) : 20,
        offset: query.offset ? parseInt(query.offset as string, 10) : 0,
      })

      return {
        success: true,
        data: result.items,
        total: result.total,
        limit: query.limit ? parseInt(query.limit as string, 10) : 20,
        offset: query.offset ? parseInt(query.offset as string, 10) : 0,
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── GET /api/geo/citations/:id — Get by ID ───
  fastify.get('/api/geo/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const citation = await geoCitationAdapter.findById(id)
      if (!citation) {
        return reply.status(404).send({ success: false, error: 'Citation not found' })
      }
      return { success: true, data: citation }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── PATCH /api/geo/citations/:id — Update a citation ───
  fastify.patch('/api/geo/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any

      const citation = await geoCitationAdapter.update(id, {
        format: body.format,
        citationText: body.citationText,
        sourceUrl: body.sourceUrl,
        publisher: body.publisher,
        author: body.author,
        datePublished: body.datePublished,
        authorityLevel: body.authorityLevel,
        metadata: body.metadata,
      })

      if (!citation) {
        return reply.status(404).send({ success: false, error: 'Citation not found' })
      }

      return { success: true, data: citation }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── DELETE /api/geo/citations/:id — Delete a citation ───
  fastify.delete('/api/geo/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const deleted = await geoCitationAdapter.delete(id)
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Citation not found' })
      }
      return { success: true, message: 'Citation deleted' }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })
}
