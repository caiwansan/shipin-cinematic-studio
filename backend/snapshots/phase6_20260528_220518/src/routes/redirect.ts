/**
 * S3 Route Redirect — 旧路由 → 新路由 301 重定向 + 审计
 *
 * 仅包含无冲突的旧路由（与现存的 411 个路由不重复）
 */

import { FastifyInstance } from 'fastify'

export default async function routeRedirect(fastify: FastifyInstance) {
  // 旧 AI gateway invoke（POST 入口，不冲突）
  fastify.post('/api/ai/gateway/invoke', async (request, reply) => {
    request.log.warn('[DEPRECATED] POST /api/ai/gateway/invoke → POST /api/v1/ai/invoke')
    return reply.redirect(301, '/api/v1/ai/invoke')
  })
}
