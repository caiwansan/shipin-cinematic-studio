/**
 * Session Compare API — 跨实验对比端点
 */

import { FastifyInstance } from 'fastify'
import { compareSessions } from './session-compare.js'

export async function registerCompareRoutes(app: FastifyInstance) {
  // 对比两次 Session
  app.get('/api/replay/compare', async (request) => {
    const query = request.query as any
    const base = parseInt(query.base || '0')
    const target = parseInt(query.target || '0')

    if (!base || !target) {
      return { error: 'Required: ?base=<sessionId>&target=<sessionId>' }
    }

    const result = await compareSessions(base, target)
    return result
  })

  // 获取 Session 的可比较列表（哪些 session 之间可以对比）
  app.get('/api/replay/compare/sessions', async () => {
    // Just use the session list — no need for a separate endpoint
    // This is a convenience endpoint
    return { message: 'Use GET /api/stability/sessions to list sessions, then compare with /api/replay/compare' }
  })
}
