// ============================================================
// Citation Route — Platform-level REST endpoints
// ============================================================
// Endpoints under /api/citations/
// GET    /api/citations?evidenceId=xxx&q=xxx&limit=20&offset=0
// GET    /api/citations/:id
// POST   /api/citations
// PATCH  /api/citations/:id
// DELETE /api/citations/:id
// POST   /api/citations/import
// GET    /api/citations/export?evidenceId=xxx
// ============================================================

import { FastifyInstance } from 'fastify'
import { citationService } from '../CitationService'
import { validateCreateCitation, validateUpdateCitation } from '../CitationValidator'

export default async function (fastify: FastifyInstance) {
  // ─── POST /api/citations — Create a citation ───
  fastify.post('/api/citations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any
      const validation = validateCreateCitation(body)
      if (!validation.valid) {
        return reply.status(400).send({ success: false, errors: validation.errors })
      }

      const citation = await citationService.create({
        evidenceId: body.evidenceId,
        format: body.format,
        citationText: body.citationText,
        sourceUrl: body.sourceUrl,
        publisher: body.publisher,
        author: body.author,
        datePublished: body.datePublished,
        authorityLevel: body.authorityLevel,
        metadata: body.metadata,
      })

      return reply.status(201).send({ success: true, data: citation })
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── GET /api/citations — Search/lists citations ───
  fastify.get('/api/citations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any
      const result = await citationService.search({
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

  // ─── GET /api/citations/:id — Get a citation by ID ───
  fastify.get('/api/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const citation = await citationService.findById(id)
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

  // ─── PATCH /api/citations/:id — Update a citation ───
  fastify.patch('/api/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any

      const validation = validateUpdateCitation(body)
      if (!validation.valid) {
        return reply.status(400).send({ success: false, errors: validation.errors })
      }

      const citation = await citationService.update(id, {
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

  // ─── DELETE /api/citations/:id — Delete a citation ───
  fastify.delete('/api/citations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const deleted = await citationService.delete(id)
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

  // ─── POST /api/citations/import — Bulk import citations ───
  fastify.post('/api/citations/import', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any
      const citations = body.citations as Array<any>

      if (!Array.isArray(citations) || citations.length === 0) {
        return reply.status(400).send({ success: false, error: 'citations array is required' })
      }

      // Validate all first
      for (let i = 0; i < citations.length; i++) {
        const validation = validateCreateCitation(citations[i])
        if (!validation.valid) {
          return reply.status(400).send({
            success: false,
            errors: validation.errors,
            message: `Validation failed for citation at index ${i}`,
          })
        }
      }

      const created = await citationService.importCitations(citations)
      return reply.status(201).send({ success: true, data: created, count: created.length })
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })

  // ─── GET /api/citations/export — Export citations by evidenceId ───
  fastify.get('/api/citations/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any
      const { evidenceId } = query

      if (!evidenceId) {
        return reply.status(400).send({ success: false, error: 'evidenceId query parameter is required' })
      }

      const citations = await citationService.exportCitations(evidenceId)
      return { success: true, data: citations }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }
  })
}
