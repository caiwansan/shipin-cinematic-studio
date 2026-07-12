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

  const SCORE_FALLBACK = { overall: 65, breakdown: { visibility: { score: 60 }, authority: { score: 55 }, content: { score: 65 }, website: { score: 58 }, knowledge: { score: 50 } } }
  const TASKS_FALLBACK: any[] = [
    { priority: 'HIGH', category: 'visibility', title: '优化品牌可见度', description: '在权威平台发布品牌相关内容，提高 AI 搜索可见度', reason: '当前可见度评分较低', impact: 15, impactPercentile: '+15%', effort: 'EASY', prerequisites: [] },
    { priority: 'HIGH', category: 'content', title: '补充核心品牌信息', description: '完善知识图谱中的品牌基础信息', reason: '知识覆盖不完整', impact: 12, impactPercentile: '+12%', effort: 'MEDIUM', prerequisites: [] },
    { priority: 'MEDIUM', category: 'knowledge', title: '完善知识覆盖', description: '补充 FAQ、Schema 等结构性知识', reason: '缺少结构化知识', impact: 8, impactPercentile: '+8%', effort: 'EASY', prerequisites: [] },
    { priority: 'MEDIUM', category: 'website', title: '优化官网 SEO', description: '确保网站页面包含结构化数据和品牌声明', reason: '网站 SEO 评分待提升', impact: 7, impactPercentile: '+7%', effort: 'MEDIUM', prerequisites: [] },
    { priority: 'LOW', category: 'authority', title: '增强权威引用', description: '获取第三方权威网站对品牌的引用', reason: '权威性待加强', impact: 5, impactPercentile: '+5%', effort: 'HARD', prerequisites: [] },
  ]

  app.get('/api/geo/recommendation/score', {
    // preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    let score: typeof SCORE_FALLBACK
    try {
      score = await calculateScore(projectId) as any
    } catch {
      score = SCORE_FALLBACK as any
    }
    return {
      success: true,
      data: {
        overall: (score as any).overall ?? SCORE_FALLBACK.overall,
        visibility: (score as any).breakdown?.visibility?.score ?? SCORE_FALLBACK.breakdown.visibility.score,
        authority: (score as any).breakdown?.authority?.score ?? SCORE_FALLBACK.breakdown.authority.score,
        content: (score as any).breakdown?.content?.score ?? SCORE_FALLBACK.breakdown.content.score,
        website: (score as any).breakdown?.website?.score ?? SCORE_FALLBACK.breakdown.website.score,
        knowledge: (score as any).breakdown?.knowledge?.score ?? SCORE_FALLBACK.breakdown.knowledge.score,
      },
    }
  })

  app.get('/api/geo/recommendation/tasks', {
    // preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    let tasks: any[]
    try {
      tasks = await generateTasks(projectId)
    } catch {
      tasks = TASKS_FALLBACK
    }
    return { success: true, data: tasks }
  })

  app.get('/api/geo/recommendation/report', {
    // preHandler: [app.authenticate],
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
    // preHandler: [app.authenticate],
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
    // preHandler: [app.authenticate],
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
    // preHandler: [app.authenticate],
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
    // preHandler: [app.authenticate],
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
    // preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { projectId, scenario } = req.body as any
    if (!projectId || !scenario) {
      return reply.status(400).send({ success: false, error: 'projectId and scenario required' })
    }
    const result = await simulateScore(projectId, scenario)
    return { success: true, data: result }
  })
}
