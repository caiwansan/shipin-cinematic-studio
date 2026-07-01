// ============================================================
// GEO Keyword Routes — REST API (Sprint P1)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoKeywordRepository } from '../repositories/geo-keyword.repository.js'

interface KeywordCreateBody {
  projectId: string
  keyword: string
  type?: string
  source?: string
}

interface KeywordBulkCreateBody {
  projectId: string
  keywords: Array<{ keyword: string; type?: string; source?: string }>
}

export default async function geoKeywordRoutes(fastify: FastifyInstance) {
  // GET /api/geo/keywords — List keywords
  fastify.get('/api/geo/keywords', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, type } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      const where: any = { projectId }
      if (type) where.type = type

      const keywords = await geoKeywordRepository.findMany(where, { createdAt: 'desc' })

      return { success: true, data: keywords, total: keywords.length }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/keywords — Create keyword (supports batch)
  fastify.post('/api/geo/keywords', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as KeywordCreateBody | KeywordBulkCreateBody

    try {
      // Check if it's a bulk creation
      if ('keywords' in body && Array.isArray(body.keywords)) {
        const count = await geoKeywordRepository.createMany(
          body.keywords.map(k => ({
            projectId: body.projectId,
            keyword: k.keyword,
            source: k.source || 'manual',
          }))
        )
        return reply.status(201).send({ success: true, data: { count } })
      }

      // Single keyword creation
      const singleBody = body as KeywordCreateBody
      if (!singleBody.keyword) {
        return reply.status(400).send({ success: false, error: '关键词不能为空' })
      }

      const existing = await geoKeywordRepository.findFirst({
        where: { projectId: singleBody.projectId, keyword: singleBody.keyword },
      })
      if (existing) {
        return reply.status(409).send({ success: false, error: '关键词已存在' })
      }

      const keyword = await geoKeywordRepository.create({
        projectId: singleBody.projectId,
        keyword: singleBody.keyword,
        source: singleBody.source || 'manual',
      })

      return reply.status(201).send({ success: true, data: keyword })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/keywords/:id — Delete keyword
  fastify.delete('/api/geo/keywords/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const existing = await geoKeywordRepository.findUnique({ where: { id } })
      if (!existing) {
        return reply.status(404).send({ success: false, error: '关键词未找到' })
      }

      await geoKeywordRepository.delete({ where: { id } })
      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/keywords/import — Import keywords
  fastify.post('/api/geo/keywords/import', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { projectId, content, type: importType } = body

    if (!projectId || !content) {
      return reply.status(400).send({ success: false, error: 'projectId 和 content 不能为空' })
    }

    try {
      // Parse content: one keyword per line, or comma-separated
      const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean)
      const keywordItems: Array<{ projectId: string; keyword: string; source: string }> = []

      for (const line of lines) {
        // Support comma-separated keywords on a single line
        const parts = line.split(',').map((p: string) => p.trim()).filter(Boolean)
        for (const kw of parts) {
          keywordItems.push({
            projectId,
            keyword: kw,
            source: 'import',
          })
        }
      }

      if (keywordItems.length === 0) {
        return reply.status(400).send({ success: false, error: '未解析到有效关键词' })
      }

      const count = await geoKeywordRepository.createMany(keywordItems)

      return reply.status(201).send({
        success: true,
        data: { imported: count, total: keywordItems.length },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/keywords/export — Export keywords
  fastify.get('/api/geo/keywords/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, type } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
    }

    try {
      const where: any = { projectId }
      if (type) where.type = type

      const keywords = await geoKeywordRepository.findMany(where, { createdAt: 'asc' })

      // Generate CSV text
      const header = 'keyword,type,source,createdAt'
      const rows = keywords.map((k: any) =>
        `"${k.keyword}","${k.type || 'brand'}","${k.source || ''}","${k.createdAt}"`
      )
      const csv = [header, ...rows].join('\n')

      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="keywords-${projectId}.csv"`)
      return reply.send(csv)
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
