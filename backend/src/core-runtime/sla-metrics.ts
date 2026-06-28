// ============================================================================
// 盘古斧 AI OS — Phase 8.2a: Execution Metrics (SLA 感知的轻量观测层)
//
// 职责：
//   1. 记录每次执行的 SLA metrics (入队等待时间、worker 使用率)
//   2. 提供按 SLA tier + 时间窗口的聚合视图
//   3. ═══ Phase 8.2b: 新增 immunity metrics (熔断 + 降级) ═══
//   4. In-memory buffer (定长环形数组)，不持久化
// ============================================================================

import { getAllBreakerHealth } from './immunity/circuit-breaker.js'

export interface ExecutionMetric {
  tenantId: string
  slaTier: string
  action: 'enqueue' | 'dequeue' | 'complete' | 'error' | 'reject'
  waitTime?: number
  executionTime?: number
  timestamp: number
}

/** Metrics 聚合窗口 (秒) */
const AGGREGATION_WINDOW_MS = 60_000

/**
 * SLA Execution Metrics Collector
 * 
 * 环形 buffer，保留最近 1000 条记录
 */
class SLAMetricsCollector {
  private buffer: ExecutionMetric[] = []
  private readonly maxSize = 1000

  /** 记录一条 metric */
  record(metric: ExecutionMetric): void {
    this.buffer.push(metric)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  /** 获取最近 1 分钟的聚合数据 */
  getAggregated(): {
    total: number
    byTier: Record<string, { count: number; avgWait: number; avgExec: number }>
    rejectRate: number
    throughput: number
  } {
    const now = Date.now()
    const window = this.buffer.filter(m => now - m.timestamp < AGGREGATION_WINDOW_MS)

    const byTier: Record<string, { count: number; avgWait: number; avgExec: number }> = {}
    let rejects = 0

    for (const m of window) {
      if (m.action === 'reject') rejects++

      if (!byTier[m.slaTier]) {
        byTier[m.slaTier] = { count: 0, avgWait: 0, avgExec: 0 }
      }
      const tier = byTier[m.slaTier]
      tier.count++

      if (m.waitTime !== undefined) {
        tier.avgWait = (tier.avgWait * (tier.count - 1) + m.waitTime) / tier.count
      }
      if (m.executionTime !== undefined) {
        tier.avgExec = (tier.avgExec * (tier.count - 1) + m.executionTime) / tier.count
      }
    }

    return {
      total: window.length,
      byTier,
      rejectRate: window.length > 0 ? rejects / window.length : 0,
      throughput: window.length / (AGGREGATION_WINDOW_MS / 1000),
    }
  }

  /** 最近 N 条原始记录 */
  getRecent(count: number): ExecutionMetric[] {
    return this.buffer.slice(-count)
  }

  /** 清空 */
  clear(): void {
    this.buffer = []
  }
}

/** 全局单例 */
export const slaMetricsCollector = new SLAMetricsCollector()

/**
 * 快捷记录函数
 */
export function recordSLAExecutionMetric(
  metric: Omit<ExecutionMetric, 'timestamp'>
): void {
  slaMetricsCollector.record({
    ...metric,
    timestamp: Date.now(),
  })
}

/** ═══ Phase 8.2b: Immunity 健康快照 ═══ */

export interface ImmunitySnapshot {
  breakers: ReturnType<typeof getAllBreakerHealth>
  timestamp: number
}

export function getImmunitySnapshot(): ImmunitySnapshot {
  return {
    breakers: getAllBreakerHealth(),
    timestamp: Date.now(),
  }
}

/** ═══ Phase 8.2b-2: 降级记录 ═══ */

export interface DegradationEvent {
  tenantId: string
  slaTier: string
  originalMode: string
  appliedMode: string
  originalStepCount: number
  executedStepCount: number
  timestamp: number
  reason: string
}

const degradationBuffer: DegradationEvent[] = []
const MAX_DEGRADATION_BUFFER = 200

export function recordDegradation(event: Omit<DegradationEvent, 'timestamp'>): void {
  degradationBuffer.push({ ...event, timestamp: Date.now() })
  while (degradationBuffer.length > MAX_DEGRADATION_BUFFER) degradationBuffer.shift()
}

export function getDegradationLog(limit = 50): DegradationEvent[] {
  return degradationBuffer.slice(-limit)
}

export function getDegradationSummary(): {
  totalDegraded: number
  byMode: Record<string, number>
  byReason: Record<string, number>
} {
  const byMode: Record<string, number> = {}
  const byReason: Record<string, number> = {}
  for (const e of degradationBuffer) {
    byMode[e.appliedMode] = (byMode[e.appliedMode] || 0) + 1
    byReason[e.reason] = (byReason[e.reason] || 0) + 1
  }
  return {
    totalDegraded: degradationBuffer.length,
    byMode,
    byReason,
  }
}

/** ═══ Phase 8.2c: Tenant Isolation Metrics ═══ */

export interface TenantIsolationEvent {
  tenantId: string
  activeExecutions: number
  queueDepth: number
  concurrencyBudget: number
  isolationLane: string
  degradationPolicy: string
  isNoisy: boolean
  timestamp: number
}

const tenantIsolationBuffer: TenantIsolationEvent[] = []
const MAX_ISOLATION_BUFFER = 500

export function recordTenantIsolation(
  event: Omit<TenantIsolationEvent, 'timestamp'>,
): void {
  tenantIsolationBuffer.push({ ...event, timestamp: Date.now() })
  while (tenantIsolationBuffer.length > MAX_ISOLATION_BUFFER) tenantIsolationBuffer.shift()
}

export function getTenantIsolationLog(limit = 50): TenantIsolationEvent[] {
  return tenantIsolationBuffer.slice(-limit)
}

export function getTenantIsolationSummary(): {
  activeTenants: number
  noisyTenants: string[]
  totalIsolationEvents: number
} {
  const uniqueTenants = new Set<string>()
  const noisy: string[] = []

  for (const e of tenantIsolationBuffer) {
    uniqueTenants.add(e.tenantId)
    if (e.isNoisy && !noisy.includes(e.tenantId)) {
      noisy.push(e.tenantId)
    }
  }

  return {
    activeTenants: uniqueTenants.size,
    noisyTenants: noisy,
    totalIsolationEvents: tenantIsolationBuffer.length,
  }
}

/** ═══ Phase 8.3: Consistency Metrics ═══ */

export interface ConsistencyMetric {
  dagId: string
  journalVersion: number
  snapshotVersion: number
  consistencyValid: boolean
  timestamp: number
}

const consistencyBuffer: ConsistencyMetric[] = []
const MAX_CONSISTENCY_BUFFER = 200

export function recordConsistencyMetrics(dagId: string, journalVersion: number, snapshotVersion: number, valid: boolean): ConsistencyMetric {
  const metric: ConsistencyMetric = {
    dagId,
    journalVersion,
    snapshotVersion,
    consistencyValid: valid,
    timestamp: Date.now(),
  }
  consistencyBuffer.push(metric)
  while (consistencyBuffer.length > MAX_CONSISTENCY_BUFFER) consistencyBuffer.shift()
  return metric
}

export function getConsistencyMetrics(limit = 50): ConsistencyMetric[] {
  return consistencyBuffer.slice(-limit)
}

export function getConsistencySummary(): {
  totalChecks: number
  validCount: number
  invalidCount: number
  validRate: number
} {
  const totalChecks = consistencyBuffer.length
  const validCount = consistencyBuffer.filter(m => m.consistencyValid).length
  const invalidCount = totalChecks - validCount
  return {
    totalChecks,
    validCount,
    invalidCount,
    validRate: totalChecks > 0 ? validCount / totalChecks : 1,
  }
}
