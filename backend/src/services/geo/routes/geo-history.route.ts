// ============================================================
// GEO History Routes — REST API (Sprint 4 Data Integration)
// GET /api/geo/history?projectId=xxx — aggregated timeline
//
// History 不单独建表，而是聚合自多个现有数据源：
//   - traces (execution traces)
//   - scans (GeoScanHistory)
//   - claims (GEOClaim)
//   - knowledge objects (KnowledgeObject)
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index.js'

interface HistoryEvent {
  id: string
  type: string
  description: string
  timestamp: string
  projectId: string
  metadata?: Record<string, unknown>
}

export default async function geoHistoryRoutes(fastify: FastifyInstance) {
  // GET /api/geo/history?projectId=xxx&limit=50&offset=0&type=scan|claim|evidence|knowledge|all
  fastify.get('/api/geo/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId, limit, offset, type } = request.query as any

      if (!projectId) {
        return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
      }

      const events: HistoryEvent[] = []
      const filterType = type && type !== 'all' ? type : null

      // Source 1: Scan History
      if (!filterType || filterType === 'scan') {
        const scans = await prisma.geoScanHistory.findMany({
          where: { projectId },
          orderBy: { startedAt: 'desc' },
          take: 50,
        })
        for (const scan of scans) {
          events.push({
            id: `scan-${scan.id}`,
            type: 'website_scanned',
            description: scan.scanType === 'website'
              ? `网站扫描完成（${scan.topic || projectId}）`
              : `${scan.scanType} 扫描完成`,
            timestamp: (scan.completedAt || scan.startedAt || scan.createdAt).toISOString(),
            projectId,
            metadata: { scanId: scan.id, scanType: scan.scanType, status: scan.status },
          })
        }
      }

      // Source 2: Claims (as proxy for evidence/claim generation events)
      if (!filterType || filterType === 'claim') {
        const claims = await prisma.gEOClaim.findMany({
          where: { entity: { projectId } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { entity: { select: { name: true } } },
        })
        for (const claim of claims) {
          events.push({
            id: `claim-${claim.id}`,
            type: 'claim_generated',
            description: `Claim 生成: "${claim.text.substring(0, 80)}${claim.text.length > 80 ? '...' : ''}"`,
            timestamp: claim.createdAt.toISOString(),
            projectId,
            metadata: { claimId: claim.id, claimType: claim.claimType, confidence: claim.confidence },
          })
        }
      }

      // Source 3: Knowledge Objects
      if (!filterType || filterType === 'knowledge') {
        const kos = await prisma.knowledgeObject.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        for (const ko of kos) {
          events.push({
            id: `ko-${ko.id}`,
            type: 'knowledge_updated',
            description: `Knowledge 更新: ${ko.title || ko.topic || '无标题'} (${ko.status})`,
            timestamp: ko.updatedAt.toISOString(),
            projectId,
            metadata: { koId: ko.id, status: ko.status, entityCount: (ko as any).entities?.length || 0 },
          })
        }
      }

      // Source 4: Execution Traces
      if (!filterType || filterType === 'execution') {
        try {
          const traces = await prisma.executionTrace.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
          for (const trace of traces) {
            events.push({
              id: `trace-${trace.id}`,
              type: trace.status === 'completed' ? 'execution_completed' : 'execution_started',
              description: `${trace.agent || 'Agent'} 执行${trace.status === 'completed' ? '完成' : '开始'}: ${(trace.input as any)?.topic || trace.id?.substring(0, 8)}`,
              timestamp: (trace.completedAt || trace.createdAt).toISOString(),
              projectId,
              metadata: { traceId: trace.id, agent: trace.agent, status: trace.status },
            })
          }
        } catch { /* traces table may not exist */ }
      }

      // Sort all events by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Apply pagination
      const l = limit ? Number(limit) : 50
      const o = offset ? Number(offset) : 0
      const paged = events.slice(o, o + l)

      return {
        success: true,
        data: paged,
        total: events.length,
        offset: o,
        limit: l,
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/history/stats?projectId=xxx — event type counts
  fastify.get('/api/geo/history/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.query as any
      if (!projectId) {
        return reply.status(400).send({ success: false, error: 'projectId 不能为空' })
      }

      const [scanCount, claimCount, koCount] = await Promise.all([
        prisma.geoScanHistory.count({ where: { projectId } }),
        prisma.gEOClaim.count({ where: { entity: { projectId } } }),
        prisma.knowledgeObject.count({ where: { projectId } }),
      ])

      // Evidence count via claims
      const claimIds = (await prisma.gEOClaim.findMany({
        where: { entity: { projectId } },
        select: { id: true },
      })).map(c => c.id)
      const evidenceCount = claimIds.length > 0
        ? await prisma.gEOEvidence.count({ where: { claimId: { in: claimIds } } })
        : 0

      return {
        success: true,
        data: {
          scans: scanCount,
          claims: claimCount,
          knowledge: koCount,
          evidence: evidenceCount,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
