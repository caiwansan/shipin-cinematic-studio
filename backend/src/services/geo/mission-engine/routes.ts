// ─────────────────────────────────────────────────
// Mission Engine — REST API Routes
// P0 — FROZEN
// ─────────────────────────────────────────────────

import { FastifyInstance } from 'fastify'
import { IssueGraphBuilder } from '../decision-intelligence/issue-graph-builder'
import { MissionGenerator } from './mission-generator'
import { MissionVerifier } from './mission-verifier'
import type { Mission, MissionCenterState } from './types'
import { geoProjectRepository } from '../repositories/geo-project.repository'

// In-memory mission store (could be replaced with Redis/DB later)
const missionStore = new Map<string, Mission[]>()
const missionStatusStore = new Map<string, MissionStatusOverrides>()

interface MissionStatusOverrides {
  completed: Set<string>
  skipped: Set<string>
  inProgress: Set<string>
}

function getStatusOverrides(brandId: string): MissionStatusOverrides {
  if (!missionStatusStore.has(brandId)) {
    missionStatusStore.set(brandId, {
      completed: new Set(),
      skipped: new Set(),
      inProgress: new Set(),
    })
  }
  return missionStatusStore.get(brandId)!
}

// In-memory graph cache (reuse DI graph)
const graphCache = new Map<string, { graph: any; brandName: string }>()

export default async function geoMissionEngineRoutes(fastify: FastifyInstance) {
  const builder = new IssueGraphBuilder()
  const verifier = new MissionVerifier()

  /**
   * GET /api/geo/missions?brandId=xxx
   * 获取 Mission List（自动生成 Issue Graph → Missions）
   */
  fastify.get('/api/geo/missions', async (request, reply) => {
    const { brandId } = request.query as { brandId: string }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      const missions = await buildMissions(brandId)
      return { success: true, data: missions }
    } catch (err: any) {
      fastify.log.error(err, 'Mission generation failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  /**
   * GET /api/geo/missions/center?brandId=xxx
   * 获取 Mission Center State（含整体进度）
   */
  fastify.get('/api/geo/missions/center', async (request, reply) => {
    const { brandId } = request.query as { brandId: string }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      const missions = await buildMissions(brandId)
      const overrides = getStatusOverrides(brandId)

      // Apply status overrides
      const appliedMissions = missions.map(m => {
        if (overrides.completed.has(m.id)) return { ...m, status: 'completed' as const, completedAt: m.completedAt || new Date().toISOString() }
        if (overrides.skipped.has(m.id)) return { ...m, status: 'skipped' as const }
        if (overrides.inProgress.has(m.id)) return { ...m, status: 'in_progress' as const }
        return m
      })

      const completedMissions = appliedMissions.filter(m => m.status === 'completed')
      const inProgressMissions = appliedMissions.filter(m => m.status === 'in_progress')
      const pendingMissions = appliedMissions.filter(m => m.status === 'pending')
      const totalMissions = appliedMissions.length
      const score = totalMissions > 0 ? Math.round((completedMissions.length / totalMissions) * 100) : 0

      // Find next mission (first pending or in_progress)
      const nextMission = appliedMissions.find(m => m.status === 'pending' || m.status === 'in_progress')

      const state: MissionCenterState = {
        brandId,
        totalMissions,
        completedMissions: completedMissions.length,
        inProgressMissions: inProgressMissions.length,
        pendingMissions: pendingMissions.length,
        missions: appliedMissions,
        nextMission,
        score,
      }

      return { success: true, data: state }
    } catch (err: any) {
      fastify.log.error(err, 'Mission center load failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/geo/missions/:id/complete
   * 标记 Mission 完成
   */
  fastify.post('/api/geo/missions/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { brandId } = request.body as { brandId: string }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required in body' })
    }

    try {
      const overrides = getStatusOverrides(brandId)
      overrides.completed.add(id)
      overrides.inProgress.delete(id)
      overrides.skipped.delete(id)

      return { success: true, data: { id, status: 'completed' } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/geo/missions/:id/skip
   * 跳过 Mission
   */
  fastify.post('/api/geo/missions/:id/skip', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { brandId } = request.body as { brandId: string }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required in body' })
    }

    try {
      const overrides = getStatusOverrides(brandId)
      overrides.skipped.add(id)
      overrides.completed.delete(id)
      overrides.inProgress.delete(id)

      return { success: true, data: { id, status: 'skipped' } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/geo/missions/center
   * 从 Recommendation 创建 Mission
   * Body: { brandId, title, description, tasks, source }
   */
  fastify.post('/api/geo/missions/center', async (request, reply) => {
    const { brandId, title, description, tasks, source } = request.body as {
      brandId: string
      title?: string
      description?: string
      tasks?: string[]
      source?: string
    }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      // Build missions first to ensure they exist
      const missions = await buildMissions(brandId)

      // Create a custom mission from the recommendation
      const mission: Mission = {
        id: `mission-rec-${Date.now()}`,
        brandId,
        title: title || '基于优化建议的 Mission',
        description: description || '从优化建议自动创建的 Mission',
        why: '基于 Discovery 扫描和 AI 优化建议生成',
        impact: [
          { dimension: 'AI 综合评分', gain: tasks?.length ? tasks.length * 5 : 10, unit: '%' },
        ],
        estimatedTime: tasks?.length ? `${tasks.length * 5}分钟` : '10分钟',
        difficulty: 'medium',
        action: {
          label: '查看 Mission',
          type: 'navigate',
          destination: '/workspace/geo/mission-center',
        },
        status: 'pending',
        sourceIssueKind: 'recommendation',
        score: 80,
        createdAt: new Date().toISOString(),
        order: missions.length,
      }

      // Add the new mission to the store
      const existing = missionStore.get(brandId) || []
      existing.push(mission)
      missionStore.set(brandId, existing)

      return { success: true, data: mission }
    } catch (err: any) {
      fastify.log.error(err, 'Mission creation failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/geo/missions/regenerate?brandId=xxx
   * 重新生成（清除缓存 + 重新跑 Decision Graph + 重新生成 Mission）
   */
  fastify.post('/api/geo/missions/regenerate', async (request, reply) => {
    const { brandId } = request.query as { brandId: string }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      // Clear caches
      graphCache.delete(brandId)
      missionStore.delete(brandId)
      missionStatusStore.delete(brandId)

      // Regenerate
      const missions = await buildMissions(brandId)
      return { success: true, data: missions }
    } catch (err: any) {
      fastify.log.error(err, 'Mission regeneration failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── Internal helper ──

  async function buildMissions(brandId: string): Promise<Mission[]> {
    // Check cache
    const cached = missionStore.get(brandId)
    if (cached) return cached

    // Get brand name
    let brandName = brandId
    try {
      const project = await geoProjectRepository.findUnique({ id: brandId })
      if (project) {
        brandName = (project as any).name || brandId
      }
    } catch (e) {
      // ignore, use brandId as name
    }

    let graph: any
    try {
      graph = await builder.build(brandId)

      // If no nodes found, generate empty missions
      if (!graph.nodes || graph.nodes.length === 0) {
        const missions = MissionGenerator.generateEmptyMissions(brandId)
        missionStore.set(brandId, missions)
        return missions
      }
    } catch (err) {
      fastify.log.error(err, 'Failed to build issue graph for missions')
      // Fallback to empty missions
      const missions = MissionGenerator.generateEmptyMissions(brandId)
      missionStore.set(brandId, missions)
      return missions
    }

    // Generate missions from graph
    const missions = MissionGenerator.generate(graph, brandId, brandName)
    missionStore.set(brandId, missions)
    return missions
  }
}
