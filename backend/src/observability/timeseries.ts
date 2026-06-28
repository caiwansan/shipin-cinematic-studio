/**
 * TimeSeries 持久层 — 系统时序指标
 *
 * 将 Drift Analyzer 采样点持久化到 PostgreSQL
 * 支持查询历史趋势、稳定性评分回放
 */

import { prisma } from '../utils/index.js'

/**
 * 写入一次系统指标快照
 */
export async function persistMetric(snapshot: DriftPoint): Promise<void> {
  await prisma.systemMetric.create({
    data: {
      timestamp: new Date(snapshot.timestamp),
      memoryMb: snapshot.memoryMb,
      queueLength: snapshot.queueLength,
      queuePressure: snapshot.queuePressure,
      workerEfficiency: snapshot.workerThroughput,
      workerCompleted: snapshot.workerCompleted,
      pidPressure: snapshot.pidRate,
      generatorRate: snapshot.pidRate,
      ses: snapshot.ses,
      degraded: false,
    },
  })
}

/**
 * 批量写入多个快照（用于长测试结束时的批量落盘）
 */
export async function persistMetricsBulk(snapshots: DriftPoint[]): Promise<number> {
  let count = 0
  const batchSize = 100
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize)
    try {
      await prisma.systemMetric.createMany({
        data: batch.map(s => ({
          timestamp: new Date(s.timestamp),
          memoryMb: s.memoryMb,
          queueLength: s.queueLength,
          queuePressure: s.queuePressure,
          workerEfficiency: s.workerThroughput,
          workerCompleted: s.workerCompleted,
          pidPressure: s.pidRate,
          generatorRate: s.pidRate,
          ses: s.ses,
          degraded: false,
        })),
      })
      count += batch.length
    } catch (err) {
      console.error('[Timeseries] Batch persist error:', (err as Error).message)
    }
  }
  return count
}

/**
 * 查询时间范围内的指标
 */
export async function queryMetrics(
  startTime: number,
  endTime: number,
  limit = 500
): Promise<any[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      EXTRACT(EPOCH FROM timestamp) * 1000 AS "timestamp",
      "memoryMb", "queueLength", "queuePressure",
      "workerEfficiency", "workerCompleted",
      "pidPressure", "generatorRate", ses,
      "stabilityScore", "stabilityGrade"
    FROM system_metrics
    WHERE timestamp BETWEEN to_timestamp($1 / 1000.0) AND to_timestamp($2 / 1000.0)
    ORDER BY timestamp ASC
    LIMIT $3
  `, startTime, endTime, limit)

  return rows
}

/**
 * 查询最近 N 条指标
 */
export async function queryRecentMetrics(limit = 100): Promise<any[]> {
  const rows = await prisma.systemMetric.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
  })

  return rows.reverse().map(r => ({
    timestamp: new Date(r.timestamp).getTime(),
    memoryMb: r.memoryMb,
    queueLength: r.queueLength,
    queuePressure: r.queuePressure,
    workerEfficiency: r.workerEfficiency,
    workerCompleted: r.workerCompleted,
    pidPressure: r.pidPressure,
    generatorRate: r.generatorRate,
    ses: r.ses,
    stabilityScore: r.stabilityScore,
    stabilityGrade: r.stabilityGrade,
  }))
}
