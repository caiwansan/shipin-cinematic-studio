// ============================================================
// GEO Evidence Routes — REST API (Sprint 4 Data Integration)
// GET /api/geo/evidence — list by project/claim
// GET /api/geo/evidence/:id — get single with citations
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoEvidenceRepository } from '../repositories/geo-evidence.repository'
import { geoCitationRepository } from '../repositories/geo-citation.repository.js'

export default async function geoEvidenceRoutes(fastify: FastifyInstance) {
  // GET /api/geo/evidence?projectId=xxx&claimId=yyy&limit=50&offset=0
  fastify.get('/api/geo/evidence', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId, claimId, limit, offset } = request.query as any

      let items: any[]
      let total = 0

      if (claimId) {
        items = await geoEvidenceRepository.findByClaimId(claimId)
        total = items.length
      } else if (projectId) {
        items = await geoEvidenceRepository.listByProjectId(projectId)
        total = items.length
      } else {
        return reply.status(400).send({ success: false, error: '需要 projectId 或 claimId' })
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

  // GET /api/geo/evidence/:id — 单条证据详情（含 citations）
  fastify.get('/api/geo/evidence/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const item = await geoEvidenceRepository.findById(id)
      if (!item) {
        return reply.status(404).send({ success: false, error: 'Evidence not found' })
      }

      // Fetch citations linked to this evidence
      const citations = await geoCitationRepository.findMany({
        where: { evidenceId: id },
      })

      return {
        success: true,
        data: { ...item, citations },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
