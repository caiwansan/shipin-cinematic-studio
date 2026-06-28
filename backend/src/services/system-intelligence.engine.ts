/**
 * F2 System Intelligence Engine — 系统智能引擎
 *
 * 聚合 metrics.ts + system-health + queue stats + worker stats + B2 AI logs
 * 统一对外输出 SystemSnapshot
 */

import { jobQueueManager } from './job-queue-manager.js'

// 导入 observability/metrics 的 snapshot 函数
let metricsSnapshotFn: (() => any) | null = null

async function getMetricsSnapshot(): Promise<any> {
  if (!metricsSnapshotFn) {
    try {
      const mod = await import('../observability/metrics.js')
      metricsSnapshotFn = (mod as any).getSnapshot || (mod as any).getMetrics
    } catch {
      // metrics 模块可能不存在
    }
  }
  try {
    return metricsSnapshotFn?.()
  } catch {
    return null
  }
}

export interface SystemSnapshot {
  timestamp: number
  systemState: 'healthy' | 'degraded' | 'critical'
  queue: {
    depth: number
    processing: number
    total: number
    deadLetter: number
    backlogRisk: boolean
  }
  workers: {
    active: number
    capacity: number
    saturation: number
  }
  ai: {
    latencyP95: number | null
    failureRate: number | null
    circuitOpen: boolean
  }
  anomalies: AnomalySignal[]
}

export interface AnomalySignal {
  type: 'queue_spike' | 'worker_starvation' | 'ai_latency_spike' | 'retry_explosion'
  severity: 'low' | 'medium' | 'high' | 'critical'
  value: number
  threshold: number
}

export class SystemIntelligenceEngine {
  private lastSnapshot: SystemSnapshot | null = null
  private lastBottlenecks: AnomalySignal[] = []
  private circuitOpen = false
  private workerCount = 2

  /**
   * 获取系统快照
   */
  async getSnapshot(): Promise<SystemSnapshot> {
    const queueStats = jobQueueManager.stats()
    const metricsData = await getMetricsSnapshot()

    const queueDepth = queueStats.pending
    const processing = queueStats.processing
    const total = queueStats.total
    const deadLetter = queueStats.deadLetter

    // 计算负载风险
    const backlogRisk = queueDepth > 10

    // Worker 饱和度
    const workerSaturation = processing / Math.max(this.workerCount, 1)

    // AI 指标
    const latencyP95 = metricsData?.system?.p95Latency ?? null
    const aiFailureRate = this.computeFailureRate(metricsData)
    const circuitOpen = this.circuitOpen

    // 计算系统状态
    const systemState = this.computeSystemState({
      backlogRisk,
      workerSaturation,
      aiFailureRate,
      circuitOpen,
    })

    // 检测瓶颈
    const anomalies = this.detectAnomalies({
      queueDepth,
      workerSaturation,
      aiFailureRate,
      queueStats,
    })

    this.lastSnapshot = {
      timestamp: Date.now(),
      systemState,
      queue: {
        depth: queueDepth,
        processing,
        total,
        deadLetter,
        backlogRisk,
      },
      workers: {
        active: Math.min(processing, this.workerCount),
        capacity: this.workerCount,
        saturation: Math.round(workerSaturation * 100) / 100,
      },
      ai: {
        latencyP95,
        failureRate: aiFailureRate,
        circuitOpen,
      },
      anomalies,
    }

    this.lastBottlenecks = anomalies
    return this.lastSnapshot
  }

  /**
   * 获取最近的瓶颈事件
   */
  getBottlenecks(): AnomalySignal[] {
    return this.lastBottlenecks
  }

  /**
   * 更新 Worker 数
   */
  updateWorkerCount(count: number) {
    this.workerCount = count
  }

  /**
   * 更新 Circuit Breaker 状态
   */
  updateCircuitState(open: boolean) {
    this.circuitOpen = open
  }

  private computeFailureRate(metricsData: any): number | null {
    if (!metricsData?.system?.requestCount || metricsData.system.requestCount === 0) return null
    return Math.round(
      (metricsData.system.errorRate ?? 0) * 100
    ) / 100
  }

  private computeSystemState(params: {
    backlogRisk: boolean
    workerSaturation: number
    aiFailureRate: number | null
    circuitOpen: boolean
  }): 'healthy' | 'degraded' | 'critical' {
    if (params.circuitOpen || (params.aiFailureRate !== null && params.aiFailureRate > 0.5)) {
      return 'critical'
    }
    if (params.backlogRisk || params.workerSaturation > 0.8) {
      return 'degraded'
    }
    return 'healthy'
  }

  private detectAnomalies(params: {
    queueDepth: number
    workerSaturation: number
    aiFailureRate: number | null
    queueStats: { pending: number; processing: number; deadLetter: number }
  }): AnomalySignal[] {
    const signals: AnomalySignal[] = []

    // Queue 堵塞
    if (params.queueDepth > 20) {
      signals.push({
        type: 'queue_spike',
        severity: params.queueDepth > 50 ? 'critical' : 'high',
        value: params.queueDepth,
        threshold: 20,
      })
    }

    // Worker 饱和
    if (params.workerSaturation > 0.9) {
      signals.push({
        type: 'worker_starvation',
        severity: params.workerSaturation > 1.5 ? 'critical' : 'high',
        value: params.workerSaturation,
        threshold: 0.9,
      })
    }

    // AI 延迟
    if (params.aiFailureRate !== null && params.aiFailureRate > 0.3) {
      signals.push({
        type: 'ai_latency_spike',
        severity: params.aiFailureRate > 0.6 ? 'critical' : 'high',
        value: params.aiFailureRate,
        threshold: 0.3,
      })
    }

    // 重试爆炸
    if (params.queueStats.deadLetter > 5) {
      signals.push({
        type: 'retry_explosion',
        severity: params.queueStats.deadLetter > 20 ? 'critical' : 'medium',
        value: params.queueStats.deadLetter,
        threshold: 5,
      })
    }

    return signals
  }
}

export const systemIntelligenceEngine = new SystemIntelligenceEngine()
