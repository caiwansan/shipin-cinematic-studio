// ============================================================
// Sprint P0-B.5 — Dashboard Routes (Read-Only Data API)
//
// Endpoints under /api/geo/dashboard/:projectId/*
// No mock data — all responses come from real repositories.
// ============================================================

import { FastifyInstance } from 'fastify'
import { DashboardService } from './dashboard.service'
import { dashboardRepository } from './dashboard.repository'

const dashboardService = new DashboardService()

export async function geoDashboardRoutes(app: FastifyInstance) {
  // GET /api/geo/dashboard/:projectId/truth — 品牌 Truth 汇总
  app.get('/api/geo/dashboard/:projectId/truth', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const summary = await dashboardService.getTruthSummary(projectId)
      return { success: true, data: summary }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/dashboard/:projectId/presence — Presence 明细
  // 数据来源：Snapshots (L3) + Presence Repository (L2 Evidence) — 不直接调 Engine (L1)
  app.get('/api/geo/dashboard/:projectId/presence', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { dashboardRepository } = await import('./dashboard.repository')
      const { presenceRepository } = await import('../presence/presence.repository')

      // Get presence summary from evidence repository (L2)
      const presenceSummary = await dashboardRepository.getPresenceSummary(projectId)

      // Get score from latest snapshot (L3 — SSOT)
      const { geoScoreSnapshotRepository } = await import('../repositories/geo-score-snapshot.repository')
      const snapshot = await geoScoreSnapshotRepository.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })

      const presenceEvidence = presenceSummary.providers.map((p: any) => ({
        provider: p.provider,
        displayName: p.provider,
        status: p.status === 'visible' || p.status === 'partial' ? 'FOUND'
          : p.status === 'missing' ? 'NOT_FOUND'
          : p.status?.toUpperCase() || 'UNKNOWN',
        visibility: p.status,
        confidence: p.confidence || 0,
        evidenceLevel: null,
        evidenceCount: 0,
        checkedAt: p.checkedAt,
        summary: null,
      }))

      const overall = snapshot?.scores?.overall ?? snapshot?.snapshot?.overall ?? null

      return {
        success: true,
        data: {
          projectId,
          checkedAt: snapshot?.createdAt?.toISOString?.() ?? new Date().toISOString(),
          overall: overall !== null ? { score: overall } : null,
          evidence: presenceEvidence,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/dashboard/:projectId/verification — 验证汇总
  app.get('/api/geo/dashboard/:projectId/verification', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const summary = await dashboardRepository.getVerificationSummary(projectId)
      return { success: true, data: summary }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/dashboard/:projectId/providers — Provider 统计
  app.get('/api/geo/dashboard/:projectId/providers', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const stats = await dashboardRepository.getProviderStatistics(projectId)
      return { success: true, data: stats }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/dashboard/:projectId/timeline — 时间线
  app.get('/api/geo/dashboard/:projectId/timeline', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { limit } = req.query as any
      const events = await dashboardService.getTimeline(projectId, Number(limit) || 20)
      return { success: true, data: events }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
