// ============================================================
// GEO Growth Engine — REST API Routes (v3)
// Growth Center: generate content, execute optimization, list options, forecast
// ============================================================

import { FastifyInstance } from 'fastify'
import { generateContent } from './content-generator.service.js'
import { executeOptimization } from './optimization-executor.service.js'
import { getForecast } from './growth-forecast.service.js'

export async function geoGrowthRoutes(app: FastifyInstance) {
  // ── POST /api/geo/growth/generate — Generate content ──
  app.post('/api/geo/growth/generate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user?.id || (req as any).user?.userId
    const { projectId, contentType, brandName, context } = req.body as any
    if (!projectId || !contentType || !brandName) {
      return reply.status(400).send({ success: false, error: 'projectId, contentType, brandName required' })
    }
    const result = await generateContent({ userId, projectId, contentType, brandName, context })
    return { success: true, data: result }
  })

  // ── POST /api/geo/growth/execute — Execute optimization ──
  app.post('/api/geo/growth/execute', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user?.id || (req as any).user?.userId
    const { projectId, type, brandName } = req.body as any
    if (!projectId || !type || !brandName) {
      return reply.status(400).send({ success: false, error: 'projectId, type, brandName required' })
    }
    const result = await executeOptimization({ userId, projectId, type, brandName })
    return { success: true, data: result }
  })

  // ── GET /api/geo/growth/options — List available optimization types ──
  app.get('/api/geo/growth/options', { preHandler: [app.authenticate] }, async (req, reply) => {
    return {
      success: true,
      data: [
        { type: 'generate-faq', label: '生成 FAQ', effort: 'EASY', impact: 8 },
        { type: 'generate-about', label: '生成品牌介绍', effort: 'EASY', impact: 6 },
        { type: 'generate-brand-story', label: '生成品牌故事', effort: 'MEDIUM', impact: 10 },
        { type: 'generate-knowledge', label: '生成知识文章', effort: 'MEDIUM', impact: 7 },
        { type: 'generate-product', label: '生成产品说明', effort: 'MEDIUM', impact: 5 },
        { type: 'generate-schema-org', label: '生成 Organization Schema', effort: 'EASY', impact: 8 },
        { type: 'generate-schema-faq', label: '生成 FAQ Schema', effort: 'EASY', impact: 6 },
        { type: 'generate-schema-breadcrumb', label: '生成 Breadcrumb Schema', effort: 'EASY', impact: 4 },
      ]
    }
  })

  // ── GET /api/geo/growth/forecast — Growth forecast ──
  app.get('/api/geo/growth/forecast', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { projectId } = req.query as { projectId: string }
    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }
    const forecast = await getForecast(projectId)
    return { success: true, data: forecast }
  })
}
