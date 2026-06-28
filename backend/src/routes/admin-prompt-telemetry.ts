/**
 * admin-prompt-telemetry.ts — Phase 4-B Prompt 遥测 Dashboard API
 *
 * 职责：
 * 1. 提供聚合数据的只读查询接口
 * 2. 供前端 Dashboard 渲染
 * 3. 纯统计层，无 AI 评分
 *
 * @phase-4b
 */

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'
import { runFullAggregation } from '../runtime/prompt/PromptTelemetryAggregator.js'
import { getRecentLogs, getPromptStats } from '../runtime/prompt/PromptRuntimeLogger.js'

export default async function adminPromptTelemetryRoutes(app: FastifyInstance) {
  // ─── 手动触发聚合（管理用） ───
  app.post('/api/admin/prompt-telemetry/aggregate', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    await runFullAggregation()
    return reply.send({ success: true })
  })

  // ─── 1. Prompt Overview Panel ───
  app.get('/api/admin/prompt-telemetry/overview', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const [totalCallsResult, successRateResult, topPromptsResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ total: bigint }>>('SELECT COUNT(*)::int AS total FROM prompt_runtime_log'),
      prisma.$queryRawUnsafe<Array<{ rate: number }>>(`SELECT ROUND((SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / GREATEST(COUNT(*)::numeric, 1))::numeric, 4)::float8 AS rate FROM prompt_runtime_log`),
      prisma.$queryRawUnsafe<Array<{ prompt_name: string; calls: bigint }>>(`
        SELECT prompt_name, COUNT(*)::int AS calls
        FROM prompt_runtime_log
        GROUP BY prompt_name
        ORDER BY calls DESC
        LIMIT 10
      `),
    ])

    return reply.send({
      success: true,
      data: {
        totalCalls: Number(totalCallsResult[0]?.total || 0),
        successRate: successRateResult[0]?.rate || 1,
        topPrompts: topPromptsResult.map(r => ({
          name: r.prompt_name,
          calls: Number(r.calls),
        })),
      },
    })
  })

  // ─── 2. Version Distribution ───
  app.get('/api/admin/prompt-telemetry/version-distribution', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const versions = await prisma.promptVersionStats.findMany({
      orderBy: [{ promptName: 'asc' }, { version: 'asc' }],
    })

    return reply.send({
      success: true,
      data: versions.map(v => ({
        promptName: v.promptName,
        version: v.version,
        totalCalls: v.totalCalls,
        successCalls: v.successCalls,
        avgLatency: v.avgLatency,
        failureRate: v.failureRate,
      })),
    })
  })

  // ─── 3. Routing Behavior Panel ───
  app.get('/api/admin/prompt-telemetry/routing-behavior', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const routes = await prisma.promptRoutingDistribution.findMany({
      orderBy: { entropy: 'desc' },
    })

    return reply.send({
      success: true,
      data: routes.map(r => ({
        promptName: r.promptName,
        stablePercent: Math.round((r.stableCount / Math.max(r.total, 1)) * 10000) / 100,
        canaryPercent: Math.round((r.canaryCount / Math.max(r.total, 1)) * 10000) / 100,
        overridePercent: Math.round((r.overrideCount / Math.max(r.total, 1)) * 10000) / 100,
        total: r.total,
        entropy: r.entropy,
      })),
    })
  })

  // ─── 4. Latency Heatmap ───
  app.get('/api/admin/prompt-telemetry/latency-heatmap', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const result = await prisma.$queryRawUnsafe<Array<{
      prompt_name: string
      avg_latency: number
      min_latency: number
      max_latency: number
      p50_latency: number
      p95_latency: number
      count: bigint
    }>>(`
      SELECT
        prompt_name,
        ROUND(AVG(latency_ms)::numeric, 2)::float8 AS avg_latency,
        MIN(latency_ms)::int AS min_latency,
        MAX(latency_ms)::int AS max_latency,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2)::float8 AS p50_latency,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2)::float8 AS p95_latency,
        COUNT(*)::int AS count
      FROM prompt_runtime_log
      GROUP BY prompt_name
      ORDER BY count DESC
    `)

    return reply.send({ success: true, data: result })
  })

  // ─── 5. Failure Cluster Map ───
  app.get('/api/admin/prompt-telemetry/failure-clusters', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const clusters = await prisma.promptFailureCluster.findMany({
      orderBy: { count: 'desc' },
      take: 50,
    })

    return reply.send({
      success: true,
      data: clusters.map(c => ({
        promptName: c.promptName,
        failureSignature: c.failureSignature,
        count: c.count,
        sampleContext: c.sampleContext,
        firstSeen: c.firstSeen,
        lastSeen: c.lastSeen,
      })),
    })
  })

  // ─── 6. Drift Timeline ───
  app.get('/api/admin/prompt-telemetry/drift-timeline', { preHandler: [requireAdmin] }, async (_req: any, reply: any) => {
    const snapshots = await prisma.promptVersionSnapshot.findMany({
      orderBy: [{ promptName: 'asc' }, { windowStart: 'asc' }],
      take: 500,
    })

    return reply.send({
      success: true,
      data: snapshots.map(s => ({
        promptName: s.promptName,
        version: s.version,
        callCount: s.callCount,
        windowStart: s.windowStart,
      })),
    })
  })

  // ─── 7. 单 prompt 完整状态 ───
  app.get('/api/admin/prompt-telemetry/prompt/:name', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { name } = req.params as any

    const [stats, routing, logStats, clusters] = await Promise.all([
      prisma.promptVersionStats.findMany({ where: { promptName: name } }),
      prisma.promptRoutingDistribution.findUnique({ where: { promptName: name } }),
      getPromptStats(name),
      prisma.promptFailureCluster.findMany({ where: { promptName: name }, orderBy: { count: 'desc' } }),
    ])

    return reply.send({
      success: true,
      data: {
        promptName: name,
        versionStats: stats.map(s => ({
          version: s.version,
          totalCalls: s.totalCalls,
          successCalls: s.successCalls,
          avgLatency: s.avgLatency,
          p95Latency: s.p95Latency,
          failureRate: s.failureRate,
        })),
        routing: routing ? {
          stableCount: routing.stableCount,
          canaryCount: routing.canaryCount,
          overrideCount: routing.overrideCount,
          total: routing.total,
          entropy: routing.entropy,
        } : null,
        recent: {
          totalCalls: logStats.totalCalls,
          avgLatency: logStats.avgLatency,
          successRate: logStats.successRate,
        },
        failureClusters: clusters.map(c => ({
          signature: c.failureSignature,
          count: c.count,
          lastSeen: c.lastSeen,
        })),
      },
    })
  })
}
