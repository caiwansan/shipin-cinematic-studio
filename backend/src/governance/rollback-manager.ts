/**
 * governance/rollback-manager.ts — 全局回滚管理
 *
 * 存储系统状态快照，检测到不稳定性时回滚到最近稳定状态。
 */

import { getAllProviderStates } from '../optimization/router-learning.js'
import { getAllCircuitBreakerStatus, resetCircuitBreaker } from '../core/circuit-breaker.js'
import { auditLog } from './audit-log.js'
import { getSystemHealthScore } from './system-health.js'

interface SystemSnapshot {
  timestamp: number
  id: string
  routerScores: Record<string, number>
  circuitBreakers: Record<string, any>
  healthScore: number
}

const MAX_SNAPSHOTS = 10
const snapshots: SystemSnapshot[] = []
let snapshotCounter = 0

// 上次健康评分（用于检测退化）
let lastHealthScores: number[] = []
const HEALTH_HISTORY_SIZE = 5

/**
 * 创建系统状态快照（定期调用）
 */
export function takeSnapshot() {
  snapshotCounter++
  const states = getAllProviderStates()
  const cbs = getAllCircuitBreakerStatus()
  const health = getSystemHealthScore()

  const routerScores: Record<string, number> = {}
  for (const s of states) {
    routerScores[s.provider] = s.score
  }

  const snapshot: SystemSnapshot = {
    timestamp: Date.now(),
    id: `snap_${snapshotCounter}`,
    routerScores,
    circuitBreakers: cbs,
    healthScore: health.score,
  }

  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()

  // 记录健康评分历史
  lastHealthScores.push(health.score)
  if (lastHealthScores.length > HEALTH_HISTORY_SIZE) lastHealthScores.shift()
}

/**
 * 检测系统是否不稳定
 */
export function detectInstability(): {
  unstable: boolean
  reason?: string
  scoreDrop: number
} {
  if (lastHealthScores.length < 3) return { unstable: false, scoreDrop: 0 }

  const recent = lastHealthScores.slice(-3)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const drop = first - last

  if (drop > 15) {
    return { unstable: true, reason: `Health score dropped ${drop}pts over last ${HEALTH_HISTORY_SIZE} checks`, scoreDrop: drop }
  }

  return { unstable: false, scoreDrop: drop }
}

/**
 * 执行回滚到最近稳定快照
 */
export function rollbackToLastStable(): {
  rolledBack: boolean
  snapshot?: SystemSnapshot
  reason?: string
} {
  const health = getSystemHealthScore()
  const instability = detectInstability()

  if (!instability.unstable && snapshots.length < 2) {
    return { rolledBack: false, reason: 'No instability detected or insufficient snapshots' }
  }

  // 找到最后一个健康评分 > 50 的快照
  const stable = [...snapshots].reverse().find(s => s.healthScore > 50)
  if (!stable) {
    console.error('[Rollback] ❌ No stable snapshot found!')
    auditLog('rollback-manager', 'error', 'ROLLBACK_FAILED',
      'No stable snapshot available', { currentHealth: health })
    return { rolledBack: false, reason: 'No stable snapshot available' }
  }

  console.warn(`[Rollback] 🔄 Rolling back to snapshot ${stable.id} (score: ${stable.healthScore})`)

  // 执行回滚：重置所有熔断器
  for (const provider of Object.keys(stable.circuitBreakers)) {
    try {
      resetCircuitBreaker(provider)
    } catch {}
  }

  auditLog('rollback-manager', 'system', 'ROLLBACK',
    `Rolled back to snapshot ${stable.id} (health: ${health.score} → ${stable.healthScore})`, {
      fromHealth: health.score,
      toHealth: stable.healthScore,
      snapshotsAvailable: snapshots.length,
    })

  return { rolledBack: true, snapshot: stable }
}

/**
 * 获取快照历史
 */
export function getSnapshots(limit: number = 10) {
  return snapshots.slice(-limit).reverse()
}
