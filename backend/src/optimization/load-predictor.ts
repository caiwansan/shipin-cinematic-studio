/**
 * optimization/load-predictor.ts — 负载预测系统
 *
 * 基于历史队列深度、请求模式、时间段等，预测未来负载
 * 实现预反应式扩缩容
 */

import { getQueueStats } from '../services/task-queue.service.js'

interface LoadPrediction {
  predictedQueueLoad: number     // 1m 后预估队列深度
  predictedWorkerUsage: number   // 0~1 worker 利用率
  riskOfSpike: 'none' | 'low' | 'medium' | 'high'
  recommendedActions: string[]
}

// 历史数据（滚动窗口）
interface HistoryPoint {
  timestamp: number
  queueDepth: number
  workerLoad: number
}

const history: HistoryPoint[] = []
const MAX_HISTORY = 1000     // 保存最近 1000 个采样点
const SAMPLE_INTERVAL = 60_000  // 每 60s 采样一次

/**
 * 采样当前状态
 */
export async function sampleCurrentLoad() {
  let queueDepth = 0
  try {
    const stats = await getQueueStats()
    if (stats && Array.isArray(stats.queues)) {
      queueDepth = stats.queues.reduce((s: number, q: any) => s + q.waiting + q.active, 0)
    }
  } catch {}

  history.push({
    timestamp: Date.now(),
    queueDepth,
    workerLoad: Math.min(1, queueDepth / 100),  // 近似
  })

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY)
  }
}

/**
 * 预测未来 1m 负载
 */
export async function predictLoad(): Promise<LoadPrediction> {
  await sampleCurrentLoad()

  if (history.length < 5) {
    return {
      predictedQueueLoad: 0,
      predictedWorkerUsage: 0,
      riskOfSpike: 'none',
      recommendedActions: [],
    }
  }

  const recent = history.slice(-20) // 最近 20 个采样点（~20 分钟）
  const current = recent[recent.length - 1]

  // 1. 趋势检测 — 简单线性回归
  const n = recent.length
  const indices = recent.map((_, i) => i)
  const depths = recent.map(p => p.queueDepth)

  const sumX = indices.reduce((a, b) => a + b, 0)
  const sumY = depths.reduce((a, b) => a + b, 0)
  const sumXY = indices.reduce((s, i) => s + i * depths[i], 0)
  const sumXX = indices.reduce((s, i) => s + i * i, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

  // 2. 预测 1 分钟后的队列深度（1 个采样间隔后）
  const predictedDepth = Math.max(0, Math.round(current.queueDepth + slope * 1))

  // 3. 判断风险
  const spikeBuffer = recent.slice(-10)
  const recentMax = Math.max(...spikeBuffer.map(p => p.queueDepth), 1)
  const growthRate = current.queueDepth > 0 ? predictedDepth / current.queueDepth : 1

  let riskOfSpike: LoadPrediction['riskOfSpike'] = 'none'
  const recommendedActions: string[] = []

  if (predictedDepth > recentMax * 2 && growthRate > 1.5) {
    riskOfSpike = 'high'
    recommendedActions.push('pre-warm workers', 'increase concurrency', 'enable batching')
  } else if (predictedDepth > recentMax * 1.3 || growthRate > 1.2) {
    riskOfSpike = 'medium'
    recommendedActions.push('increase concurrency')
  } else if (predictedDepth > recentMax * 1.1) {
    riskOfSpike = 'low'
  }

  return {
    predictedQueueLoad: predictedDepth,
    predictedWorkerUsage: Math.min(1, predictedDepth / 100),
    riskOfSpike,
    recommendedActions,
  }
}
