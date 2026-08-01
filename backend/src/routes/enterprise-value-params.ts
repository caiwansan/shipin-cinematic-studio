/**
 * routes/enterprise-value-params.ts — SPRINT-AGENT-OPERATIONS-01 T01
 * 企业价值参数配置 API（ROI 前置）
 *
 * 原则：价值参数由企业输入，平台禁止估算/猜测。
 *  - GET  /api/enterprise/value-params            → 企业 AI 员工列表 + 参数 + 30 天真实统计
 *  - PUT  /api/enterprise/value-params/:agentId   → 保存（upsert）某员工价值参数
 *  - DELETE /api/enterprise/value-params/:agentId → 删除（回到未配置）
 */
import type { FastifyInstance } from 'fastify'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'

export default async function enterpriseValueParamRoutes(fastify: FastifyInstance) {

  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/enterprise/value-params
  fastify.get('/api/enterprise/value-params', async (request, reply) => {
    try {
      const user = request.user as any
      const userId = user?.id
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const orgId = await resolveEnterpriseId(userId)
      if (!orgId) return reply.status(404).send({ error: '企业身份未找到' })

      const { listValueParams } = await import('../services/enterprise/value-param.service.js')
      const result = await listValueParams(orgId)
      return { code: 0, success: true, data: result }
    } catch (e: any) {
      return reply.status(500).send({ code: 500, success: false, message: e.message })
    }
  })

  // PUT /api/enterprise/value-params/:agentId
  fastify.put('/api/enterprise/value-params/:agentId', async (request, reply) => {
    try {
      const user = request.user as any
      const userId = user?.id
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const orgId = await resolveEnterpriseId(userId)
      if (!orgId) return reply.status(404).send({ error: '企业身份未找到' })

      const agentInstanceId = (request.params as any)?.agentId as string
      if (!agentInstanceId) return reply.status(400).send({ code: 400, success: false, message: '缺少 AI 员工 ID' })

      const body = (request.body || {}) as any
      const { saveValueParam } = await import('../services/enterprise/value-param.service.js')
      const result = await saveValueParam(orgId, agentInstanceId, {
        laborHourlyCost: body.laborHourlyCost,
        manualMinutesPerTask: body.manualMinutesPerTask,
        aiSecondsPerTask: body.aiSecondsPerTask,
        note: body.note || null,
      })
      return { code: 0, success: true, data: result }
    } catch (e: any) {
      return reply.status(400).send({ code: 400, success: false, message: e.message })
    }
  })

  // DELETE /api/enterprise/value-params/:agentId
  fastify.delete('/api/enterprise/value-params/:agentId', async (request, reply) => {
    try {
      const user = request.user as any
      const userId = user?.id
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const orgId = await resolveEnterpriseId(userId)
      if (!orgId) return reply.status(404).send({ error: '企业身份未找到' })

      const agentInstanceId = (request.params as any)?.agentId as string
      const { deleteValueParam } = await import('../services/enterprise/value-param.service.js')
      const result = await deleteValueParam(orgId, agentInstanceId)
      return { code: 0, success: true, data: result }
    } catch (e: any) {
      return reply.status(500).send({ code: 500, success: false, message: e.message })
    }
  })
}
