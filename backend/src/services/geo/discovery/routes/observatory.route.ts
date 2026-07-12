// ============================================================
// RC-D1-003: Discovery Observatory API Routes
//
// 实时查看 Discovery 执行情况
// GET /api/geo/discovery/observatory/latest      — 最新一次执行
// GET /api/geo/discovery/observatory/:executionId — 特定执行
// GET /api/geo/discovery/observatory/project/:projectId — 项目执行历史
// GET /api/geo/discovery/observatory/history      — 全局执行历史
// ============================================================

import { FastifyInstance } from 'fastify'
import { observatoryStore } from '../services/observatory'

export async function discoveryObservatoryRoutes(app: FastifyInstance) {
  // 最新一次执行
  app.get('/api/geo/discovery/observatory/latest', async (_req, reply) => {
    const latest = observatoryStore.getLatest()
    if (!latest) {
      return reply.status(404).send({ success: false, error: '暂无执行记录' })
    }
    return { success: true, data: latest }
  })

  // 特定 executionId
  app.get<{ Params: { executionId: string } }>(
    '/api/geo/discovery/observatory/:executionId',
    async (req, reply) => {
      const snapshot = observatoryStore.getByExecution(req.params.executionId)
      if (!snapshot) {
        return reply.status(404).send({ success: false, error: '执行记录未找到' })
      }
      return { success: true, data: snapshot }
    }
  )

  // 项目执行历史
  app.get<{ Params: { projectId: string } }>(
    '/api/geo/discovery/observatory/project/:projectId',
    async (req, reply) => {
      const history = observatoryStore.getByProject(req.params.projectId)
      return { success: true, data: history }
    }
  )

  // 全局执行历史
  app.get('/api/geo/discovery/observatory/history', async (req) => {
    const { limit } = req.query as { limit?: string }
    const history = observatoryStore.getHistory(limit ? parseInt(limit, 10) : 50)
    return { success: true, data: history }
  })
}
