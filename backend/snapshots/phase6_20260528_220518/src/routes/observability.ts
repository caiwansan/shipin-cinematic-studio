import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/observability.ts — 可观测性 API 路由
 *
 * 提供：
 * - GET /observability/traces — 追踪列表
 * - GET /observability/trace/:id — 单条追踪详情
 * - GET /observability/metrics — 实时指标
 * - GET /observability/costs — 成本分析
 * - GET /observability/providers — Provider 评分排名
 * - GET /observability/logs — 结构化日志
 * - GET /observability/queue — 队列可见性
 */

import { FastifyInstance } from 'fastify'
import { getRecentTraces, getTrace, getActiveTraceCount } from '../observability/trace.js'
import { getMetricsSnapshot } from '../observability/metrics.js'
import { costIntelligence } from '../observability/cost-intelligence.js'
import { getProviderRanking } from '../observability/provider-score.js'
import { getRecentLogs, classifyError } from '../observability/logger.js'
import { getSystemHealth } from '../core/backpressure.js'
import { getQueueStats } from '../services/task-queue.service.js'
import { getAllCircuitBreakerStatus } from '../core/circuit-breaker.js'

export default async function observabilityRoutes(fastify: FastifyInstance) {

  // GET /observability/overview — 全局概览
  fastify.get('/observability/overview', async (request, reply) => {
    const health = getSystemHealth()
    const metrics = getMetricsSnapshot()
    const activeTraces = getActiveTraceCount()
    const providers = getAllCircuitBreakerStatus()
    const cbHealth = Object.values(providers).filter(s => s.state === 'HEALTHY').length
    const cbOpen = Object.values(providers).filter(s => s.state === 'OPEN').length

    return {
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        mode: health.mode,
        health: health.health,
        overallScore: calculateOverallHealth(metrics, health),
      },
      requests: {
        total: metrics.system.requestCount,
        successRate: Math.round(metrics.system.successRate * 100) + '%',
        avgLatency: metrics.system.avgLatency + 'ms',
        p95Latency: metrics.system.p95Latency + 'ms',
        activeTraces,
      },
      queue: {
        depth: health.queueDepth,
        avgWait: metrics.queue.avgWaitTime + 'ms',
        avgProcess: metrics.queue.avgProcessingTime + 'ms',
      },
      providers: {
        total: Object.keys(providers).length,
        healthy: cbHealth,
        open: cbOpen,
      },
      costs: {
        providerEstimates: metrics.providers,
      },
    }
  })

  // GET /observability/traces — 追踪列表
  fastify.get('/observability/traces', async (request, reply) => {
    const query = request.query as any
    const traces = getRecentTraces({
      limit: Math.min(parseInt(query.limit) || 50, 200),
      status: query.status,
      userId: query.userId,
    })

    return {
      success: true,
      traces: traces.map(t => ({
        traceId: t.traceId,
        userId: t.userId?.substring(0, 12) + '...',
        taskType: t.taskType,
        provider: t.provider,
        spanCount: t.spans.length,
        totalDuration: t.totalDuration,
        status: t.status,
        error: t.error,
        createdAt: new Date(t.createdAt).toISOString(),
      })),
    }
  })

  // GET /observability/trace/:id — 单条追踪详情
  fastify.get('/observability/trace/:id', async (request, reply) => {
    const { id } = request.params as any
    const trace = getTrace(id)
    if (!trace) {
      return reply.status(404).send({ success: false, error: 'Trace not found' })
    }
    return { success: true, trace } satisfies ApiResponse<unknown>;

  })

  // GET /observability/metrics — 实时指标
  fastify.get('/observability/metrics', async (request, reply) => {
    const metrics = getMetricsSnapshot()
    return { success: true, ...metrics } satisfies ApiResponse<unknown>;

  })

  // GET /observability/costs — 成本分析
  fastify.get('/observability/costs', async (request, reply) => {
    const query = request.query as any
    const days = parseInt(query.days) || 7

    const [userRanking, byFeature, byProvider] = await Promise.all([
      costIntelligence.getUserCostRanking(days),
      costIntelligence.getCostByFeature(days),
      costIntelligence.getCostByProvider(days),
    ])

    return {
      success: true,
      period: `${days}d`,
      userRanking,
      byFeature,
      byProvider,
      total: Object.values(byFeature).reduce((a, b) => a + b, 0),
    }
  })

  // GET /observability/providers — Provider 评分排名
  fastify.get('/observability/providers', async (request, reply) => {
    const ranking = getProviderRanking()
    return {
      success: true,
      ranking,
      circuitBreakers: getAllCircuitBreakerStatus(),
    }
  })

  // GET /observability/logs — 结构化日志
  fastify.get('/observability/logs', async (request, reply) => {
    const query = request.query as any
    const logs = getRecentLogs(
      query.level,
      query.module,
      Math.min(parseInt(query.limit) || 100, 500)
    )
    return { success: true, logs } satisfies ApiResponse<unknown>;

  })

  // GET /observability/queue — 队列可见性
  fastify.get('/observability/queue', async (request, reply) => {
    let queueStats = null
    try {
      queueStats = await getQueueStats()
    } catch {}

    const health = getSystemHealth()

    return {
      success: true,
      systemMode: health.mode,
      queueDepth: health.queueDepth,
      queueStats,
      providerStatus: getAllCircuitBreakerStatus(),
    }
  })

  // POST /observability/classify-error — 错误分类工具
  fastify.post('/observability/classify-error', async (request, reply) => {
    const { message, statusCode } = request.body as any
    if (!message) {
      return reply.status(400).send({ success: false, error: 'message required' })
    }
    const result = classifyError(message, statusCode)
    return { success: true, classification: result } satisfies ApiResponse<unknown>;

  })
}

/**
 * 计算整体健康评分 (0-100)
 */
function calculateOverallHealth(metrics: any, health: any): number {
  let score = 100

  // 扣分：错误率
  if (metrics.system.errorRate > 0.1) score -= 20
  else if (metrics.system.errorRate > 0.05) score -= 10

  // 扣分：延迟
  if (metrics.system.p95Latency > 20000) score -= 20
  else if (metrics.system.p95Latency > 10000) score -= 10

  // 扣分：队列压力
  if (health.queueCapacityRatio > 0.8) score -= 20
  else if (health.queueCapacityRatio > 0.5) score -= 10

  // 扣分：熔断 provider
  if (health.openProviderCount > 2) score -= 15
  else if (health.openProviderCount > 0) score -= 5

  return Math.max(0, score)
}
