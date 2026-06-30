import { FastifyInstance } from 'fastify'
import { LearningService } from './learning.service'
import { signalRegistry } from './normalizers/signal-registry'
import { prisma } from '../../utils/index.js'
const learningService = new LearningService(prisma)

export async function geoLearningRoutes(app: FastifyInstance) {
  // POST /api/geo/learning/run — 触发学习
  app.post('/api/geo/learning/run', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId } = req.body as any
      const signals = await learningService.learn(projectId)
      return { success: true, data: { signalCount: signals.length, signals } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/learning/signals — 获取推荐信号
  app.get('/api/geo/learning/signals', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId } = req.query as any
      const signals = await learningService.getRecommendationSignals(projectId)
      return { success: true, data: signals }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/learning/explain/:signalId — 解释信号
  app.get('/api/geo/learning/explain/:signalId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { signalId } = req.params as any
      const explain = await learningService.explain(signalId)
      if (!explain) return reply.status(404).send({ success: false, error: 'Signal not found' })
      return { success: true, data: explain }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/learning/history — 学习历史
  app.get('/api/geo/learning/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId, limit, offset } = req.query as any
      const history = await learningService.getHistory(projectId, Number(limit) || 20, Number(offset) || 0)
      return { success: true, data: history }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/learning/dashboard — 学习仪表盘
  app.get('/api/geo/learning/dashboard', { preHandler: [app.authenticate] }, async () => {
    const dashboard = await learningService.getDashboard()
    return { success: true, data: dashboard }
  })

  // GET /api/geo/learning/providers — 列出 Signal Provider
  app.get('/api/geo/learning/providers', { preHandler: [app.authenticate] }, async () => {
    return { success: true, data: signalRegistry.list().map(p => ({ name: p.name, source: p.source })) }
  })
}
