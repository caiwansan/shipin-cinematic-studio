// DEPRECATED（ADMIN-IA-REALITY-05-C-0）: Legacy Agent Registry — 引用不存在的 agent_def 表（旧图引擎未迁移）。保留路由不删除（禁补表/禁恢复），AI 员工管理统一走 /api/admin/ai-employees（EnterpriseAgentProfile 体系）。
/**
 * routes/admin-agents.ts — 后台 Agent 管理路由
 *
 * GET    /api/admin/agents       — 获取所有 Agent
 * POST   /api/admin/agents       — 创建 Agent
 * PUT    /api/admin/agents/:id   — 更新 Agent
 * DELETE /api/admin/agents/:id   — 删除 Agent
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { randomUUID } from 'crypto'

export default async function adminAgentRoutes(fastify: FastifyInstance) {
  // GET 所有 Agent
  fastify.get('/api/admin/agents', { preHandler: [requireAdmin] }, async (_request: any, reply: any) => {
    return reply.code(410).send({ error: '已废弃: Legacy Agent Registry（agent_def 表不存在）。AI 员工管理请使用 /api/admin/ai-employees（EnterpriseAgentProfile 体系）' })
    const agents = await prisma.agentDef.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: agents, agents }
  })

  // POST 创建 Agent
  fastify.post('/api/admin/agents', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    if (!body.name) {
      return reply.status(400).send({ success: false, message: 'name 为必填' })
    }

    // 生成可读的 id，如 agent_xxx
    const id = 'agent_' + randomUUID().slice(0, 8)

    return reply.code(410).send({ error: '已废弃: Legacy Agent Registry（agent_def 表不存在）。AI 员工管理请使用 /api/admin/ai-employees' })
    const agent = await prisma.agentDef.create({
      data: {
        id,
        name: body.name,
        role: body.role || 'default',
        type: body.type || 'llm',
        model: body.model || null,
        systemPrompt: body.systemPrompt || '',
        status: body.status || 'active',
        version: 'v1',
      },
    })

    return { success: true, data: agent }
  })

  // PUT 更新 Agent
  fastify.put('/api/admin/agents/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.role !== undefined) data.role = body.role
    if (body.type !== undefined) data.type = body.type
    if (body.model !== undefined) data.model = body.model
    if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt
    if (body.status !== undefined) data.status = body.status

    return reply.code(410).send({ error: '已废弃: Legacy Agent Registry（agent_def 表不存在）。AI 员工管理请使用 /api/admin/ai-employees' })
    const agent = await prisma.agentDef.update({ where: { id }, data })
    return { success: true, data: agent }
  })

  // DELETE 删除 Agent
  fastify.delete('/api/admin/agents/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.agentDef.delete({ where: { id } })
    return { success: true }
  })
}
