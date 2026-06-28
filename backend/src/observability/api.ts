/**
 * Observability Persistence API v2 — 时序指标查询端点
 */

import { FastifyInstance } from 'fastify'
import { queryMetrics, queryRecentMetrics } from './timeseries.js'
import { getCollectorStatus } from './collector.js'
import { BackpressureState, MetricCache } from '../utils/redis-state.js'
import { startSnapshotCollector, stopSnapshotCollector } from './collector.js'

export async function registerObservabilityPersistence(app: FastifyInstance) {
  // 查询时间范围指标
  app.get('/api/observability/metrics', async (request) => {
    const query = request.query as any
    const startTime = parseInt(query.start || '0')
    const endTime = parseInt(query.end || Date.now().toString())
    const limit = parseInt(query.limit || '500')

    const metrics = await queryMetrics(startTime, endTime, limit)
    return { metrics, count: metrics.length }
  })

  // 查询最近指标
  app.get('/api/observability/metrics/recent', async (request) => {
    const query = request.query as any
    const limit = parseInt(query.limit || '100')
    const metrics = await queryRecentMetrics(limit)
    return { metrics, count: metrics.length }
  })

  // 实时缓存指标（从 Redis 读取，无 DB 查询）
  app.get('/api/observability/metrics/live', async () => {
    const bp = await BackpressureState.snapshot()
    const recent = await MetricCache.recent(30)
    return {
      backpressure: bp,
      recentSamples: recent,
      sampleCount: recent.length,
    }
  })

  // 采集器状态（Redis-backed，跨进程一致）
  app.get('/api/observability/collector', async () => {
    return getCollectorStatus()
  })

  // 启动采集器
  app.post('/api/observability/collector/start', async () => {
    await startSnapshotCollector()
    return getCollectorStatus()
  })

  // 停止采集器
  app.post('/api/observability/collector/stop', async () => {
    await stopSnapshotCollector()
    return getCollectorStatus()
  })
}
