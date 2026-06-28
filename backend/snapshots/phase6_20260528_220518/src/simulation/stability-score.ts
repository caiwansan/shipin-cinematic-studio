/**
 * Stability Score Engine — 综合稳定性评分
 *
 * 不是快照评分，是纯时序评分。
 *
 * 评分维度：
 *   S_queue  — 队列稳定性（0-25）
 *   S_worker — Worker 效率稳定性（0-25）
 *   S_memory — 内存漂移（0-20）
 *   S_pid    — PID 控制稳定性（0-20）
 *   S_ses    — 系统均衡得分（0-10）
 *
 * 等级：
 *   A (90-100): 生产就绪
 *   B (70-89): 接近就绪
 *   C (50-69): 需调优
 *   D (30-49): 需干预
 *   F (0-29): 不稳定
 */

import { DriftAnalysis } from './drift-analyzer.js'

export interface StabilityScore {
  total: number            // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: {
    queue: { score: number; max: 25; detail: string }
    worker: { score: number; max: 25; detail: string }
    memory: { score: number; max: 20; detail: string }
    pid: { score: number; max: 20; detail: string }
    ses: { score: number; max: 10; detail: string }
  }
  recommendation: string
  productionReady: boolean   // grade === 'A'
}

export function computeStabilityScore(analysis: DriftAnalysis): StabilityScore {
  // 1. Queue Stability (0-25)
  let queueScore = 25
  let queueDetail = ''

  if (analysis.queueGrowthStability === 'growing') {
    const penalty = Math.min(20, Math.abs(analysis.queueGrowthRate) * 50)
    queueScore -= penalty
    queueDetail = `queue_growing:+${analysis.queueGrowthRate.toFixed(3)}/s`
  } else if (analysis.queueGrowthStability === 'oscillating') {
    queueScore -= 10
    queueDetail = 'queue_oscillating'
  } else {
    queueDetail = 'queue_stable'
  }

  // Off-by-one: 队列压力过大也减分
  if (analysis.pointCount > 10) {
    // 用最后一个数据点：如果 SES < 0.3 说明压力过大
    if (analysis.sesDegraded) {
      queueScore = Math.max(0, queueScore - 10)
      queueDetail = 'queue_overloaded'
    }
  }

  // 2. Worker Efficiency (0-25)
  let workerScore = 25
  let workerDetail = ''

  if (analysis.workerEfficiencyTrend < -0.1) {
    const penalty = Math.min(18, Math.abs(analysis.workerEfficiencyTrend) * 30)
    workerScore -= penalty
    workerDetail = `worker_degrading:${analysis.workerEfficiencyTrend.toFixed(3)}/s`
  } else if (analysis.workerEfficiency > 0) {
    workerDetail = `working:${analysis.workerEfficiency.toFixed(2)}/s`
  } else {
    workerScore -= 5
    workerDetail = 'worker_stalled'
  }

  // 3. Memory Drift (0-20)
  let memoryScore = 20
  let memoryDetail = ''

  if (analysis.memoryGrowthWarning) {
    const penalty = Math.min(18, analysis.memoryGrowthSlope * 20)
    memoryScore -= penalty
    memoryDetail = `memory_leak:${analysis.memoryGrowthSlope.toFixed(3)}MB/s`
  } else if (analysis.memoryGrowthSlope < -0.1) {
    // 负波动也算异常
    memoryScore -= 3
    memoryDetail = 'memory_flush_cycle'
  } else if (analysis.memoryGrowthSlope > 0.1) {
    memoryScore -= 5
    memoryDetail = `slow_memory_growth:${analysis.memoryGrowthSlope.toFixed(3)}MB/s`
  } else {
    memoryDetail = `memory_stable:${analysis.memoryGrowthSlope.toFixed(4)}MB/s`
  }

  // 4. PID Stability (0-20)
  let pidScore = 20
  let pidDetail = ''

  if (analysis.pidOscillating) {
    pidScore -= 15
    pidDetail = `pid_oscillation:${analysis.pidOscillationAmplitude.toFixed(2)}`
  } else if (analysis.pidRateStability > 1) {
    pidScore -= 5
    pidDetail = `pid_unstable:σ=${analysis.pidRateStability.toFixed(2)}`
  } else {
    pidDetail = `pid_stable:σ=${analysis.pidRateStability.toFixed(2)}`
  }

  // 5. SES (0-10)
  let sesScore = 10
  let sesDetail = ''

  if (analysis.sesDegraded) {
    sesScore -= 8
    sesDetail = 'SES_degrading'
  } else if (analysis.sesTrend < -0.001) {
    sesScore -= 3
    sesDetail = `SES_dropping:${analysis.sesTrend.toFixed(5)}/s`
  } else {
    sesDetail = `SES_stable:${analysis.sesTrend.toFixed(5)}/s`
  }

  // 汇总
  queueScore = Math.max(0, Math.min(25, queueScore))
  workerScore = Math.max(0, Math.min(25, workerScore))
  memoryScore = Math.max(0, Math.min(20, memoryScore))
  pidScore = Math.max(0, Math.min(20, pidScore))
  sesScore = Math.max(0, Math.min(10, sesScore))

  const total = queueScore + workerScore + memoryScore + pidScore + sesScore

  // 等级
  const grade: StabilityScore['grade'] =
    total >= 90 ? 'A' :
    total >= 70 ? 'B' :
    total >= 50 ? 'C' :
    total >= 30 ? 'D' : 'F'

  // 推荐
  const recommendation = grade === 'A'
    ? 'ready_for_production'
    : grade === 'B'
    ? `tune:${analysis.recommendedAction}`
    : `investigate:${analysis.warningFlags.join(',') || analysis.recommendedAction}`

  return {
    total,
    grade,
    dimensions: {
      queue: { score: queueScore, max: 25, detail: queueDetail },
      worker: { score: workerScore, max: 25, detail: workerDetail },
      memory: { score: memoryScore, max: 20, detail: memoryDetail },
      pid: { score: pidScore, max: 20, detail: pidDetail },
      ses: { score: sesScore, max: 10, detail: sesDetail },
    },
    recommendation,
    productionReady: grade === 'A',
  }
}
