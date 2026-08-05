/**
 * S2.3.2 Task 05 - Hermes Execution Audit (Cloud Authority, H-C)
 * Receive Hermes execution events, record to audit store
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function registerHermesAuditRoutes(app: FastifyInstance) {
  app.post('/api/audit/hermes-execution', async (request: any, reply: any) => {
    try {
      const ev = request.body || {}
      if (!ev.executionId || !ev.runtimeId || !ev.status) {
        return reply.code(400).send({ error: 'INVALID_AUDIT_EVENT' })
      }
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
