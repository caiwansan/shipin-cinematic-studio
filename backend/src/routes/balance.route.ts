/**
 * 余额查询路由
 * 用户的 BYOK API Key 余额查询: GET/POST /api/workspace/balances
 */
import type { FastifyInstance } from 'fastify'
import { getUserBalances } from '../services/balance/index.js'

export default async function balanceRoutes(app: FastifyInstance) {
  // GET /api/workspace/balances — 查询所有已配置 Provider 的余额（缓存优先）
  app.get('/api/workspace/balances', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    if (!user?.id) {
      return reply.status(401).send({ success: false, error: '未登录' })
    }
    const result = await getUserBalances(user.id)
    return { success: true, data: result }
  })

  // POST /api/workspace/balances/refresh — 强制刷新余额
  app.post('/api/workspace/balances/refresh', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    if (!user?.id) {
      return reply.status(401).send({ success: false, error: '未登录' })
    }
    const result = await getUserBalances(user.id)
    return { success: true, data: result }
  })
}
