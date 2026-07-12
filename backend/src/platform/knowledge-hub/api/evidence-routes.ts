// ════════════════════════════════════════════════════════════
// P3B-003 — Evidence API
// ════════════════════════════════════════════════════════════
// 注册三个端点：
//   GET  /api/v1/evidence — 查询证据
//   GET  /api/v1/evidence/timeline/:targetType/:targetId — 证据时间线
//   GET  /api/v1/packages/:id/evidence — Package 证据
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { EvidenceCollector } from '../evidence/collector'

export function registerEvidenceRoutes(
  fastify: FastifyInstance,
  opts: { collector: EvidenceCollector },
) {
  const { collector } = opts

  // ── GET /api/v1/evidence ──
  // 通用证据查询，支持按 targetType/targetId/scope/level/status 筛选
  fastify.get('/api/v1/evidence', async (request, reply) => {
    const query = request.query as {
      targetType?: string
      targetId?: string
      scope?: string
      level?: string
      status?: string
    }

    // 必须至少有一个筛选条件
    if (!query.targetType && !query.targetId && !query.scope && !query.level && !query.status) {
      return reply.status(400).send({
        success: false,
        error: 'At least one filter required (targetType, targetId, scope, level, status)',
      })
    }

    const where: any = {}
    if (query.targetType) where.targetType = query.targetType
    if (query.targetId) where.targetId = query.targetId
    if (query.scope) where.scope = query.scope
    if (query.level) where.level = query.level
    if (query.status) where.status = query.status

    const { PrismaClient } = require('@prisma/client') as any
    const prisma = new PrismaClient()
    const records = await prisma.evidenceRecord.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      take: 100,
    })

    return { success: true, data: records }
  })

  // ── GET /api/v1/evidence/timeline/:targetType/:targetId ──
  fastify.get('/api/v1/evidence/timeline/:targetType/:targetId', async (request, reply) => {
    const { targetType, targetId } = request.params as { targetType: string; targetId: string }
    const records = await collector.timeline(targetType, targetId)
    return { success: true, data: records }
  })

  // ── GET /api/v1/packages/:id/evidence ──
  fastify.get('/api/v1/packages/:id/evidence', async (request, reply) => {
    const { id } = request.params as { id: string }

    const { PrismaClient } = require('@prisma/client') as any
    const prisma = new PrismaClient()

    // 验证 Package 存在
    const pkg = await prisma.knowledgePackage.findUnique({ where: { id } })
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }

    const records = await collector.findByPackage(id)
    return { success: true, data: records }
  })

  // ── GET /api/v1/packages/:id/evidence/timeline ──
  fastify.get('/api/v1/packages/:id/evidence/timeline', async (request, reply) => {
    const { id } = request.params as { id: string }

    const { PrismaClient } = require('@prisma/client') as any
    const prisma = new PrismaClient()

    const pkg = await prisma.knowledgePackage.findUnique({ where: { id } })
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }

    const records = await collector.timeline('package', id)
    return { success: true, data: records }
  })
}
