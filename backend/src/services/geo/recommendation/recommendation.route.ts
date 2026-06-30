// ============================================================
// Recommendation Routes v2 — Intelligence, Explain, Score, Tasks, Roadmap, Timeline, Report, Simulate
// ============================================================

import { FastifyInstance } from 'fastify'
import { calculateScore } from './recommendation-score.service.js'
import { generateTasks } from './optimization-task.service.js'
import { generateReport } from './optimization-report.service.js'
import { generateRoadmap } from './optimization-roadmap.service.js'
import { getTimeline } from './recommendation-timeline.service.js'
import { getIntelligence } from './recommendation-intelligence.service.js'
import { simulateScore } from './recommendation-simulator.service.js'

export async function geoRecommendationRoutes(app: FastifyInstance) {
  // ── v1 endpoints (backward compatible) ──

  app.get('/api/geo/recommendation/score', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const score = await calculateScore(projectId)
    // Backward compatible: flatten to simple numeric scores
    return {
      success: true,
      data: {
        overall: score.overall,
        visibility: score.breakdown.visibility.score,
        authority: score.breakdown.authority.score,
        content: score.breakdown.content.score,
        website: score.breakdown.website.score,
        knowledge: score.breakdown.knowledge.score,
      },
    }
  })

  app.get('/api/geo/recommendation/tasks', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const tasks = await generateTasks(projectId)
    return { success: true, data: tasks }
  })

  app.get('/api/geo/recommendation/report', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const report = await generateReport(projectId)
    return { success: true, data: report }
  })

  // ── v2 endpoints ──

  /**
   * GET /api/geo/recommendation/explain?projectId=
   * Returns full ScoreExplainability with per-dimension breakdown and reasons
   */
  app.get('/api/geo/recommendation/explain', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const score = await calculateScore(projectId)
    return { success: true, data: score }
  })

  /**
   * GET /api/geo/recommendation/roadmap?projectId=
   * Returns optimization roadmap: today, this week, all tasks with target scores
   */
  app.get('/api/geo/recommendation/roadmap', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const roadmap = await generateRoadmap(projectId)
    return { success: true, data: roadmap }
  })

  /**
   * GET /api/geo/recommendation/timeline?projectId=&range=7d
   * Returns historical score timeline data
   */
  app.get('/api/geo/recommendation/timeline', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId, range } = req.query as { projectId: string; range?: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const validRanges = ['7d', '30d', '90d', '1y']
    const timelineRange = validRanges.includes(range || '') ? (range as '7d' | '30d' | '90d' | '1y') : '7d'
    const timeline = await getTimeline(projectId, timelineRange)
    return { success: true, data: timeline }
  })

  /**
   * GET /api/geo/recommendation/intelligence?projectId=
   * Unified intelligence endpoint: score + tasks + roadmap + timeline + summary
   */
  app.get('/api/geo/recommendation/intelligence', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId, range } = req.query as { projectId: string; range?: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const validRanges = ['7d', '30d', '90d', '1y']
    const timelineRange = validRanges.includes(range || '') ? (range as '7d' | '30d' | '90d' | '1y') : '7d'
    const intelligence = await getIntelligence(projectId, timelineRange)
    return { success: true, data: intelligence }
  })

  /**
   * POST /api/geo/recommendation/simulate — Score simulation
   * Body: { projectId: string, scenario: SimulationScenario }
   */
  app.post('/api/geo/recommendation/simulate', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId, scenario } = req.body as any
    if (!projectId || !scenario) {
      return reply.status(400).send({ success: false, error: 'projectId and scenario required' })
    }
    const result = await simulateScore(projectId, scenario)
    return { success: true, data: result }
  })
}
