/**
 * core/backpressure.ts — 系统背压控制
 *
 * 监控队列、worker、provider 状态，
 * 动态调整任务入队速率和并发度。
 *
 * 状态：NORMAL → DEGRADED → CRITICAL
 */

import { getQueueStats } from '../services/task-queue.service.js'
import { getAllCircuitBreakerStatus } from './circuit-breaker.js'

// 系统模式
export type SystemMode = 'NORMAL' | 'DEGRADED' | 'CRITICAL'

interface BackpressureState {
  mode: SystemMode
  enteredAt: number
  queueDepth: number
  queueCapacityRatio: number   // 0~1
  workerLoad: number           // 0~1
  openProviderCount: number
  enqueueDelay: number         // 入队延迟（ms）
}

let state: BackpressureState = {
  mode: 'NORMAL',
  enteredAt: Date.now(),
  queueDepth: 0,
  queueCapacityRatio: 0,
  workerLoad: 0,
  openProviderCount: 0,
  enqueueDelay: 0,
}

// 阈值
const THRESHOLDS = {
  queueHigh: 0.70,       // 队列 70% 容量 → DEGRADED
  queueCritical: 0.90,   // 队列 90% → CRITICAL
  workerHigh: 0.80,      // worker 80% 负载 → DEGRADED
  workerCritical: 0.90,  // worker 90% → CRITICAL
  providerHigh: 2,       // 2+ 熔断器 OPEN → DEGRADED
  providerCritical: 4,   // 4+ 熔断器 OPEN → CRITICAL
  checkInterval: 10_000, // 每 10s 检查一次
}

let lastCheck = 0

/**
 * 评估系统状态
 */
export async function evaluateSystemState(): Promise<{
  mode: SystemMode
  state: BackpressureState
}> {
  const now = Date.now()
  if (now - lastCheck < THRESHOLDS.checkInterval) {
    return { mode: state.mode, state: { ...state } }
  }
  lastCheck = now

  // 1. 队列状态
  let queueTotal = 0
  let queueCapRatio = 0
  try {
    const stats = await getQueueStats()
    if (stats) {
      queueTotal = stats.queues.reduce((sum: number, q: any) => sum + q.waiting + q.active, 0)
      queueCapRatio = Math.min(1, queueTotal / 200)  // 假设队列最大容量 200
    }
  } catch {}

  // 2. Circuit Breaker 状态
  const cbStatus = getAllCircuitBreakerStatus()
  const openCount = Object.values(cbStatus).filter(s => s.state === 'OPEN').length

  // 3. 判断模式
  let newMode: SystemMode = 'NORMAL'

  if (queueCapRatio >= THRESHOLDS.queueCritical || openCount >= THRESHOLDS.providerCritical) {
    newMode = 'CRITICAL'
  } else if (
    queueCapRatio >= THRESHOLDS.queueHigh ||
    openCount >= THRESHOLDS.providerHigh
  ) {
    newMode = 'DEGRADED'
  }

  // 计算推荐入队延迟
  let enqueueDelay = 0
  if (newMode === 'CRITICAL') {
    enqueueDelay = 5000   // 5s 延迟入队
  } else if (newMode === 'DEGRADED') {
    enqueueDelay = 1000   // 1s 延迟
  }

  state = {
    mode: newMode,
    enteredAt: newMode !== state.mode ? now : state.enteredAt,
    queueDepth: queueTotal,
    queueCapacityRatio: queueCapRatio,
    workerLoad: queueCapRatio,  // 近似
    openProviderCount: openCount,
    enqueueDelay,
  }

  if (newMode !== 'NORMAL') {
    console.warn(`[Backpressure] ⚠️ System: ${newMode} (queue=${(queueCapRatio * 100).toFixed(0)}%, openProviders=${openCount})`)
  }

  return { mode: newMode, state: { ...state } }
}

/**
 * 获取当前系统模式
 */
export function getSystemMode(): SystemMode {
  return state.mode
}

/**
 * 检查是否可以入队新任务
 * 返回 { allowed, delayMs }
 */
export async function canEnqueueTask(priority: number, isVip: boolean): Promise<{
  allowed: boolean
  delayMs: number
}> {
  const { mode } = await evaluateSystemState()

  switch (mode) {
    case 'NORMAL':
      return { allowed: true, delayMs: 0 }

    case 'DEGRADED':
      if (isVip) {
        // VIP 用户：允许，但加延迟
        return { allowed: true, delayMs: Math.max(0, 500 - priority * 200) }
      }
      // free 用户：延迟入队
      return { allowed: true, delayMs: 2000 }

    case 'CRITICAL':
      if (isVip) {
        return { allowed: true, delayMs: 3000 }
      }
      // free 用户：拒绝非关键任务
      return { allowed: false, delayMs: -1 }
  }
}

/**
 * 获取系统健康状态（用于监控 API）
 */
export function getSystemHealth() {
  const cbStatus = getAllCircuitBreakerStatus()
  const providerIssues = Object.entries(cbStatus)
    .filter(([_, s]) => s.state !== 'HEALTHY')
    .map(([name, s]) => ({ provider: name, state: s.state }))

  return {
    mode: state.mode,
    queueDepth: state.queueDepth,
    queueCapacityRatio: state.queueCapacityRatio,
    openProviderCount: state.openProviderCount,
    enqueueDelay: state.enqueueDelay,
    providerIssues,
    health: providerIssues.length === 0 && state.mode === 'NORMAL'
      ? 'healthy' : state.mode === 'CRITICAL' ? 'critical' : 'degraded',
  }
}
