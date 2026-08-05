/**
 * S2.3.2 Task 05 — Hermes Execution Audit（Cloud Authority, H-C）
 * 接收 Hermes 执行事件（agent.*/tool.invoked），落库审计
 * 原则: Cloud = Audit 权威；Desktop/Hermes 本地不保存权威日志
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function registerHermesAuditRoutes(app: FastifyInstance) {
  // Hermes 事件上报（受控来源: 签名/内网；S2.3.2 用 runtime 头标识）
  app.post('/api/audit/hermes-execution', async (request: any, reply: any) => {
    try {
      const ev = request.body || {}
      // 最小校验: executionId + runtimeId + status 必须
      if (!ev.executionId || !ev.runtimeId || !ev.status) {
        return reply.code(400).send({ error: 'INVALID_AUDIT_EVENT' })
      }
      // 落库（通用审计表; 若表缺失则用 KernelEvent 替代）
      const rec = await prisma.kernelEvent.create({
        data: {
          type: 'hermes.execution',
          severity: 'info',
          source: ev.runtimeId,
          meta: JSON.stringify({
            executionId: ev.executionId,
            agentId: ev.agentId || null,
            definitionId: ev.definitionId || null,
            toolCalls: ev.toolCalls || [],
            result: ev.result || null,
            status: ev.status,
          }),
        } as any,
      }).catch(() => null)
      return reply.send({ code: 0, data: { recorded: !!rec, auditId: rec?.id || null } })
    } catch (e: any) {
      request.log.error(e, 'hermes-audit failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // 查询（只读，审计查看）
  app.get('/api/audit/hermes-execution', async (request: any, reply: any) => {
    try {
      const events = await prisma.kernelEvent.findMany({
        where: { type: 'hermes.execution' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      } as any).catch(() => [])
      return reply.send({ code: 0, data: { events } })
    } catch (e: any) {
      request.log.error(e, 'hermes-audit query failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
