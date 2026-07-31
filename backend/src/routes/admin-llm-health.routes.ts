/**
 * routes/admin-llm-health.routes.ts — Sprint-RECRUITMENT-REALITY-04 T01
 *
 * Model Health Center API（Admin）
 *  - GET  /api/admin/llm/health          健康状态列表（不含 key）
 *  - POST /api/admin/llm/health/test/all 全量测试连接
 *  - POST /api/admin/llm/health/test/:id 单个测试连接
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { listLlmHealth, testAllConfigs, testLlmConfig, listHealthIssues } from '../services/enterprise/llm-health.service.js'

export default async function adminLlmHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/llm/health', { preHandler: [requireAdmin] }, async () => {
    const data = await listLlmHealth()
    const summary = {
      total: data.length,
      ok: data.filter((d) => d.healthStatus === 'ok').length,
      failed: data.filter((d) => d.healthStatus === 'failed').length,
      decryptError: data.filter((d) => d.healthStatus === 'decrypt_error').length,
      disabled: data.filter((d) => d.healthStatus === 'disabled').length,
      untested: data.filter((d) => d.healthStatus === 'untested').length,
    }
    return { success: true, data, summary }
  })

  fastify.get('/api/admin/llm/health/issues', { preHandler: [requireAdmin] }, async () => {
    const data = await listHealthIssues()
    return { success: true, data }
  })

  fastify.post('/api/admin/llm/health/test/all', { preHandler: [requireAdmin] }, async () => {
    const result = await testAllConfigs()
    return { success: true, data: result }
  })

  fastify.post('/api/admin/llm/health/test/:id', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    try {
      const result = await testLlmConfig(id)
      return { success: true, data: result }
    } catch (e: any) {
      return reply.status(404).send({ success: false, message: e?.message || '测试失败' })
    }
  })
}
