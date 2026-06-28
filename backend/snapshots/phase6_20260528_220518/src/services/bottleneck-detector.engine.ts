/**
 * F3 Bottleneck Detector — 瓶颈检测
 *
 * 基于 F2 的 SystemSnapshot 分析瓶颈信号
 */

import { systemIntelligenceEngine, AnomalySignal } from './system-intelligence.engine.js'

export class BottleneckDetector {
  private history: AnomalySignal[][] = []
  private maxHistory = 60  // 保留最近 60 次检测（10min，每10s一次）

  /**
   * 检测一次瓶颈
   */
  async detect(): Promise<AnomalySignal[]> {
    const snapshot = await systemIntelligenceEngine.getSnapshot()
    const signals = snapshot.anomalies

    this.history.push(signals)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    return signals
  }

  /**
   * 获取瓶颈趋势
   */
  getTrend(): {
    queueSpikeCount: number
    workerStarvationCount: number
    aiLatencyCount: number
    retryExplosionCount: number
    topSeverity: string
  } {
    let queue = 0, worker = 0, ai = 0, retry = 0
    let topSeverity = 'none'

    for (const batch of this.history) {
      for (const s of batch) {
        if (s.type === 'queue_spike') queue++
        if (s.type === 'worker_starvation') worker++
        if (s.type === 'ai_latency_spike') ai++
        if (s.type === 'retry_explosion') retry++
        if (s.severity === 'critical') topSeverity = 'critical'
        else if (s.severity === 'high' && topSeverity !== 'critical') topSeverity = 'high'
        else if (s.severity === 'medium' && topSeverity === 'none') topSeverity = 'medium'
      }
    }

    return {
      queueSpikeCount: queue,
      workerStarvationCount: worker,
      aiLatencyCount: ai,
      retryExplosionCount: retry,
      topSeverity,
    }
  }
}

export const bottleneckDetector = new BottleneckDetector()
