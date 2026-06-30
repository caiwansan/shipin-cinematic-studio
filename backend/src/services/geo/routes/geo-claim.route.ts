// ============================================================
// GEO Claim Routes — REST API (Sprint 4 Data Integration)
// GET /api/geo/claims — list by project/entity
// GET /api/geo/claims/:id — get single with evidences
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoClaimRepository } from '../repositories/geo-claim.repository'
import { geoEvidenceRepository } from '../repositories/geo-evidence.repository'
import { prisma } from '../../utils/index.js'

export default async function geoClaimRoutes(fastify: FastifyInstance) {
  // GET /api/geo/claims?projectId=xxx&entityId=yyy&status=zzz&limit=50&offset=0
  fastify.get('/api/geo/claims', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId, entityId, status, limit, offset } = request.query as any

      let items: any[]
      let total = 0

      if (entityId) {
        items = await geoClaimRepository.findByEntityId(entityId)
        total = items.length
      } else if (projectId) {
        items = await geoClaimRepository.listByProjectId(projectId)
        total = items.length
      } else {
        return reply.status(400).send({ success: false, error: '需要 projectId 或 entityId' })
      }

      // Filter by status if provided
      if (status && items.length > 0) {
        items = items.filter((c: any) => c.status === status)
        total = items.length
      }

      // Apply limit/offset
      const l = limit ? Number(limit) : 50
      const o = offset ? Number(offset) : 0
      const paged = items.slice(o, o + l)

      return {
        success: true,
        data: paged,
        total,
        offset: o,
        limit: l,
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/claims/:id — 单条 Claim 详情（含 evidences + 证据的 citations）
  fastify.get('/api/geo/claims/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const item = await geoClaimRepository.findById(id)
      if (!item) {
        return reply.status(404).send({ success: false, error: 'Claim not found' })
      }

      // Fetch evidences with citations
      const evidences = await prisma.gEOEvidence.findMany({
        where: { claimId: id },
        include: { citations: true },
      })

      return {
        success: true,
        data: { ...item, evidences },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PATCH /api/geo/claims/:id — 更新 Claim 状态
  fastify.patch('/api/geo/claims/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const updated = await geoClaimRepository.update(id, body)
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Claim not found' })
      }
      return { success: true, data: updated }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
