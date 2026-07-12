// ============================================================
// GEO Health Route — P0-5 Scan Runtime Recovery
// GET /api/geo/health — 从 Snapshot/Repository 读取最新健康数据
//
// SSOT: 所有健康检查数据源为 Repository/Snapshot，非 Adapter 实时调用
// provider.isStub 不会出现在此接口中（因为数据来自 Snapshot）
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository.js'
import { presenceRepository } from '../presence/presence.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js';
import { calculateScoreSimple } from '../recommendation/recommendation-score.service.js';

export default async function geoHealthRoutes(fastify: FastifyInstance) {
  try {
    // GET /api/geo/health — GEO Workspace 总体健康状态
    fastify.get('/api/geo/health', { preHandler: [] }, async (_request, reply) => {
      try {
        const projects = await geoProjectRepository.findAll()
        if (!projects || projects.length === 0) {
          return { success: true, data: { projects: [], summary: { totalProjects: 0, avgHealthScore: 0, atRiskCount: 0, healthyCount: 0 } } }
        }
        const projectIds = projects.map((p: any) => p.id)
        const snapshots = await geoScoreSnapshotRepository.findLatestByProjectIds(projectIds)
        const snapshotMap = new Map(snapshots.map((s: any) => [s.projectId, s]))
        const scanHistories = await geoScanHistoryRepository.findLatestScanByProjectIds(projectIds)

        const items = projects.map((p: any) => {
          const snap = snapshotMap.get(p.id)
          return {
            projectId: p.id,
            projectName: p.name || 'unknown',
            industry: p.industry || '',
            status: p.status || 'inactive',
            healthScore: {
              overall: snap?.score ?? 1,
              change: snap?.change ?? 0,
              trend: (snap?.change ?? 0) > 0 ? 'up' : (snap?.change ?? 0) < 0 ? 'down' : 'stable',
            },
            scannedAt: snap?.createdAt ?? null,
          }
        })
        const avgScore = items.reduce((sum: number, i: any) => sum + (i.healthScore?.overall ?? 0), 0) / (items.length || 1)
        const atRiskCount = items.filter((i: any) => (i.healthScore?.overall ?? 0) < 0.4).length
        return {
          success: true,
          data: {
            projects: items,
            summary: {
              totalProjects: items.length,
              avgHealthScore: Math.round(avgScore * 100) / 100,
              atRiskCount,
              healthyCount: items.length - atRiskCount,
            },
          },
        }
      } catch (err: any) {
        _request.log.error({ err: err.message }, 'GEO health list error')
        return reply.status(500).send({ success: false, error: err.message })
      }
    })

    // GET /api/geo/health/:projectId — 单个项目的健康详情（从 Snapshot 读取）
    fastify.get('/api/geo/health/:projectId', { preHandler: [] }, async (request, reply) => {
      const { projectId } = request.params as any
      try {
        const project = await geoProjectRepository.findById(projectId)
        if (!project) {
          return reply.status(404).send({ success: false, error: 'Project not found' })
        }
        const snapshot = await geoScoreSnapshotRepository.findLatestByProjectId(projectId)
        const presenceData = await presenceRepository.findByProjectId(projectId)
        return {
          success: true,
          data: {
            project: {
              id: project.id,
              name: project.name,
              website: project.website || '',
              industry: project.industry || '',
              status: project.status || 'inactive',
              coverage: {
                evidenceCount: presenceData?.evidenceCount ?? 0,
                entityCount: presenceData?.entityCount ?? 0,
              },
              description: presenceData?.description || '',
            },
            healthScore: {
              overall: snapshot?.score ?? 0,
              change: snapshot?.change ?? 0,
              trend: (snapshot?.change ?? 0) > 0 ? 'up' : (snapshot?.change ?? 0) < 0 ? 'down' : 'stable',
              details: snapshot?.details ?? {},
              dimensions: snapshot?.dimensions ?? [],
            },
            scannedAt: snapshot?.createdAt ?? null,
          },
        }
      } catch (err: any) {
        request.log.error({ err: err.message }, 'GEO health detail error')
        return reply.status(500).send({ success: false, error: err.message })
      }
    })
  } catch (e) {
    // Duplicate route — P0-4 legacy geo-project route registers /api/geo/health/:id
    // which conflicts with this :projectId param. Non-fatal, skip silently.
    console.info('[geoHealthRoutes] Some routes already registered (likely duplicate), continuing...')
  }
}
