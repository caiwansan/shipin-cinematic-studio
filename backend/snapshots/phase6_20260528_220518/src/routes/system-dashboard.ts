/**
 * F6 System Dashboard API — 统一只读 Dashboard
 *
 * 所有数据来源于 F2 + F3，无业务逻辑
 */

import { FastifyInstance } from 'fastify'
import { systemIntelligenceEngine } from '../services/system-intelligence.engine.js'
import { bottleneckDetector } from '../services/bottleneck-detector.engine.js'
import { jobQueueManager } from '../services/job-queue-manager.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { prisma } from '../utils/index.js'

export default async function systemDashboardRoutes(fastify: FastifyInstance) {
  // 系统总览
  fastify.get('/api/v1/system/overview', async (_request, reply) => {
    try {
      const snapshot = await systemIntelligenceEngine.getSnapshot()
      const bottlenecks = await bottleneckDetector.detect()
      const trend = bottleneckDetector.getTrend()

      const projectCount = await prisma.project.count().catch(() => 0)
      const userCount = await prisma.user.count().catch(() => 0)

      return RuntimeValidator.ok({
        snapshot,
        bottlenecks,
        trend,
        counts: {
          projects: projectCount,
          users: userCount,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 系统健康（接入现有 system-health + F2 — 用 overview 替代避免冲突）
  fastify.get('/api/v1/system/snapshot', async (_request, reply) => {
    try {
      const snapshot = await systemIntelligenceEngine.getSnapshot()
      return RuntimeValidator.ok({
        timestamp: snapshot.timestamp,
        status: snapshot.systemState,
        queue: snapshot.queue,
        workers: snapshot.workers,
        ai: snapshot.ai,
        recommendation: snapshot.systemState === 'critical'
          ? 'check_ai_providers'
          : snapshot.systemState === 'degraded'
            ? 'scale_workers_or_reduce_load'
            : 'normal',
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 队列详情
  fastify.get('/api/v1/system/queue', async (_request, reply) => {
    try {
      const stats = jobQueueManager.stats()
      const snapshot = await systemIntelligenceEngine.getSnapshot()
      return RuntimeValidator.ok({
        ...stats,
        backlogRisk: snapshot.queue.backlogRisk,
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // Worker 详情
  fastify.get('/api/v1/system/workers', async (_request, reply) => {
    try {
      const snapshot = await systemIntelligenceEngine.getSnapshot()
      return RuntimeValidator.ok(snapshot.workers)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 瓶颈检测
  fastify.get('/api/v1/system/bottlenecks', async (_request, reply) => {
    try {
      const signals = await bottleneckDetector.detect()
      const trend = bottleneckDetector.getTrend()
      return RuntimeValidator.ok({ signals, trend })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 租户统计
  fastify.get('/api/v1/system/tenants', async (_request, reply) => {
    try {
      const userCount = await prisma.user.count().catch(() => 0)
      const projectCount = await prisma.project.count().catch(() => 0)

      return RuntimeValidator.ok({
        totalUsers: userCount,
        totalProjects: projectCount,
        usersPerProject: projectCount > 0 ? Math.round(userCount / projectCount) : 0,
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
