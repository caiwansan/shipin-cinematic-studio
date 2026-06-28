/**
 * Drift Analyzer — 长期运行行为趋势分析
 *
 * 采集时序数据点，计算变化率、漂移、退化信号。
 * 核心指标：
 *   - queueGrowthRate: 队列变化斜率（queue/时间）
 *   - workerEfficiency: worker 完工速率
 *   - memoryGrowthSlope: 内存漂移 (MB/s)
 *   - costPerMinute: 每分钟成本消耗
 *   - pidOscillation: PID 压力振荡幅度
 */

import { prisma } from '../utils/index.js'
import { pushGlobalEvent } from '../services/lifecycle-manager.js'

// ============================================================
// 类型定义
// ============================================================

export interface DriftPoint {
  timestamp: number
  queueLength: number
  queuePressure: number
  workerThroughput: number
  workerCompleted: number
  memoryMb: number
  pidRate: number
  ses: number
}

export interface DriftAnalysis {
  duration: number                    // 分析时间跨度（ms）
  pointCount: number                  // 数据点数

  // 队列相关
  queueGrowthRate: number             // 队列增长速率（tasks/s）
  queueGrowthStability: 'stable' | 'growing' | 'oscillating'

  // Worker 相关
  workerEfficiency: number            // 平均吞吐（tasks/s）
  workerEfficiencyTrend: number       // 效率变化趋势（正=提升 负=退化）

  // 内存相关
  memoryGrowthSlope: number           // 内存漂移（MB/s）
  memoryGrowthWarning: boolean        // > 0.5 MB/s

  // PID 相关
  pidRateStability: number            // PID 速率标准差
  pidOscillationAmplitude: number     // 振荡幅度
  pidOscillating: boolean             // 高频振荡检测

  // 系统均衡
  sesTrend: number                    // SES 变化趋势（正=变好 负=变差）
  sesDegraded: boolean                // SES < 0.3 持续下降

  // 综合
  overallHealthScore: number          // 0-100
  warningFlags: string[]              // 告警列表
  recommendedAction: string           // 推荐动作
}

// ============================================================
// 环形缓冲区
// ============================================================

class DriftHistory {
  private points: DriftPoint[] = []
  private maxPoints: number

  constructor(maxPoints = 300) {
    this.maxPoints = maxPoints
  }

  push(point: DriftPoint): void {
    this.points.push(point)
    if (this.points.length > this.maxPoints) {
      this.points.splice(0, Math.floor(this.maxPoints * 0.25))
    }
  }

  getAll(): DriftPoint[] {
    return [...this.points]
  }

  getRecent(count: number): DriftPoint[] {
    return this.points.slice(-count)
  }

  clear(): void {
    this.points = []
  }

  get length(): number {
    return this.points.length
  }
}

// ============================================================
// Core Analyzer
// ============================================================

export class DriftAnalyzer {
  private history: DriftHistory
  private samplingIntervalMs: number
  private timerId: ReturnType<typeof setInterval> | null = null

  // 分析缓存（避免重复计算）
  private lastAnalysis: DriftAnalysis | null = null
  private lastAnalysisTime = 0

  constructor(samplingIntervalMs = 2000) {
    this.history = new DriftHistory(300)
    this.samplingIntervalMs = samplingIntervalMs
  }

  /**
   * 采集一个数据点
   */
  recordPoint(data: {
    queueLength: number
    queuePressure: number
    workerThroughput: number
    workerCompleted: number
    memoryMb?: number
    pidRate: number
    ses: number
  }): void {
    const usage = process.memoryUsage()
    this.history.push({
      timestamp: Date.now(),
      queueLength: data.queueLength,
      queuePressure: data.queuePressure,
      workerThroughput: data.workerThroughput,
      workerCompleted: data.workerCompleted,
      memoryMb: data.memoryMb ?? Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      pidRate: data.pidRate,
      ses: data.ses,
    })
  }

  /**
   * 运行漂移分析
   */
  analyze(now = Date.now()): DriftAnalysis {
    const points = this.history.getAll()
    if (points.length < 10) {
      return {
        duration: 0,
        pointCount: points.length,
        queueGrowthRate: 0,
        queueGrowthStability: 'stable',
        workerEfficiency: 0,
        workerEfficiencyTrend: 0,
        memoryGrowthSlope: 0,
        memoryGrowthWarning: false,
        pidRateStability: 0,
        pidOscillationAmplitude: 0,
        pidOscillating: false,
        sesTrend: 0,
        sesDegraded: false,
        overallHealthScore: 100,
        warningFlags: ['insufficient_data'],
        recommendedAction: 'collect more samples',
      }
    }

    const duration = now - points[0].timestamp
    const warnings: string[] = []

    // 1. Queue Growth Rate (线性回归斜率)
    const queueSlope = this.linearRegression(points.map(p => p.queueLength))
    const qGrowthRate = duration > 0 ? queueSlope / (duration / 1000) : 0

    // 2. Queue Growth Stability
    const queueStd = this.stdDev(points.map(p => p.queueLength))
    const queueMean = points[points.length - 1].queueLength
    const qStability: DriftAnalysis['queueGrowthStability'] =
      Math.abs(qGrowthRate) < 0.1 ? 'stable' :
      qGrowthRate > 0 ? 'growing' : 'oscillating'

    if (qStability === 'growing') {
      warnings.push(`queue_growth=${qGrowthRate.toFixed(2)}/s`)
    }

    // 3. Worker Efficiency
    const completedValues = points.map(p => p.workerCompleted)
    const completedRate = completedValues.length > 1
      ? (completedValues[completedValues.length - 1] - completedValues[0]) / (duration / 1000)
      : 0

    const efficiencyTrend = this.linearRegression(
      points.map(p => p.workerThroughput)
    )

    if (efficiencyTrend < -0.1) {
      warnings.push(`worker_degradation=${efficiencyTrend.toFixed(3)}/s`)
    }

    // 4. Memory Growth Slope
    const memSlope = this.linearRegression(points.map(p => p.memoryMb))
    const memGrowthPerSec = memSlope / (duration / 1000)
    const memWarning = memGrowthPerSec > 0.5

    if (memWarning) {
      warnings.push(`memory_leak=${memGrowthPerSec.toFixed(2)}MB/s`)
    }

    // 5. PID Oscillation
    const pidRates = points.map(p => p.pidRate)
    const pidStd = this.stdDev(pidRates)
    const pidOscillationAmplitude = this.detectOscillation(pidRates)
    const pidOscillating = pidOscillationAmplitude > 2.0

    if (pidOscillating) {
      warnings.push(`pid_oscillation=${pidOscillationAmplitude.toFixed(2)}`)
    }

    // 6. SES Trend
    const sesSlope = this.linearRegression(points.map(p => p.ses))
    const sesTrend = sesSlope / (duration / 1000)

    // SES 退化 = SES < 0.3 且持续下降
    const recentSes = points.slice(-Math.min(20, points.length)).map(p => p.ses)
    const sesDegraded = recentSes[recentSes.length - 1] < 0.3 &&
      this.linearRegression(recentSes) < 0

    if (sesDegraded) {
      warnings.push(`ses_degraded=${sesTrend.toFixed(5)}/s`)
    }

    // 7. Overall Health Score
    let score = 100
    if (!pidOscillating) score += 0
    else score -= 30
    if (sesDegraded) score -= 20
    if (memWarning) score -= 25
    if (qStability === 'growing') score -= 15
    if (efficiencyTrend < -0.1) score -= 10
    score = Math.max(0, Math.min(100, score))

    // 8. Recommended Action
    let action = 'nothing'
    if (qStability === 'growing') action = 'increase_worker_concurrency'
    if (warnings.length >= 2) action = 'investigate_immediately'
    if (memWarning) action = 'check_memory_leak'
    if (pidOscillating) action = 'retune_pid_parameters'

    const analysis: DriftAnalysis = {
      duration,
      pointCount: points.length,
      queueGrowthRate: Math.round(qGrowthRate * 1000) / 1000,
      queueGrowthStability: qStability,
      workerEfficiency: Math.round(completedRate * 100) / 100,
      workerEfficiencyTrend: Math.round(efficiencyTrend * 1000) / 1000,
      memoryGrowthSlope: Math.round(memGrowthPerSec * 1000) / 1000,
      memoryGrowthWarning: memWarning,
      pidRateStability: Math.round(pidStd * 100) / 100,
      pidOscillationAmplitude: Math.round(pidOscillationAmplitude * 100) / 100,
      pidOscillating,
      sesTrend: Math.round(sesTrend * 100000) / 100000,
      sesDegraded,
      overallHealthScore: Math.round(score),
      warningFlags: warnings,
      recommendedAction: action,
    }

    this.lastAnalysis = analysis
    this.lastAnalysisTime = now
    return analysis
  }

  getLastAnalysis(): DriftAnalysis | null {
    return this.lastAnalysis
  }

  // ============================================================
  // 数学工具
  // ============================================================

  private linearRegression(values: number[]): number {
    const n = values.length
    if (n < 2) return 0
    const indices = Array.from({ length: n }, (_, i) => i)
    const sumX = indices.reduce((a, b) => a + b, 0)
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = indices.reduce((a, _, i) => a + i * values[i], 0)
    const sumXX = indices.reduce((a, b) => a + b * b, 0)
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }

  private stdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
  }

  private detectOscillation(values: number[]): number {
    if (values.length < 10) return 0
    const recent = values.slice(-20)
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length
    // 正负变化频率
    let signChanges = 0
    for (let i = 1; i < recent.length; i++) {
      if ((recent[i] - mean) * (recent[i - 1] - mean) < 0) signChanges++
    }
    // 振荡幅度 = 标准差 × 符号变化频率 / 预期
    const expected = recent.length / 2
    return this.stdDev(recent) * (signChanges / expected)
  }
}
