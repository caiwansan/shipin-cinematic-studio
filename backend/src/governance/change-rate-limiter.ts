/**
 * governance/change-rate-limiter.ts — 变更频率限制器（防止振荡）
 *
 * 跟踪各类型变更的频率，超过阈值则冻结对应类型的变更。
 */

interface ChangeTracker {
  action: string
  changes: number[]
  frozen: boolean
  frozenUntil: number
}

const trackers = new Map<string, ChangeTracker>()

// 变更频率阈值
const THRESHOLDS: Record<string, { maxChangesPerMin: number; freezeDurationMs: number }> = {
  'router_update':        { maxChangesPerMin: 6,   freezeDurationMs: 120_000 },
  'cost_strategy_update': { maxChangesPerMin: 3,   freezeDurationMs: 120_000 },
  'queue_policy_update':  { maxChangesPerMin: 2,   freezeDurationMs: 300_000 },
  'provider_score':       { maxChangesPerMin: 10,  freezeDurationMs: 60_000 },
  'self-healing':         { maxChangesPerMin: 5,   freezeDurationMs: 60_000 },
}

/**
 * 检查是否允许执行变更
 */
export function checkChangeRateLimit(action: string): {
  allowed: boolean
  reason?: string
  retryAfterMs?: number
} {
  const threshold = THRESHOLDS[action]
  if (!threshold) return { allowed: true } // 未知类型不受限

  if (!trackers.has(action)) {
    trackers.set(action, { action, changes: [], frozen: false, frozenUntil: 0 })
  }

  const tracker = trackers.get(action)!

  // 检查是否冻结
  if (tracker.frozen) {
    if (Date.now() < tracker.frozenUntil) {
      return { allowed: false, reason: `Action "${action}" frozen for ${Math.round((tracker.frozenUntil - Date.now()) / 1000)}s`, retryAfterMs: tracker.frozenUntil - Date.now() }
    }
    tracker.frozen = false
  }

  const now = Date.now()
  const oneMinAgo = now - 60_000

  // 清理过期记录
  tracker.changes = tracker.changes.filter(t => t > oneMinAgo)

  // 检查是否超过阈值
  if (tracker.changes.length >= threshold.maxChangesPerMin) {
    tracker.frozen = true
    tracker.frozenUntil = now + threshold.freezeDurationMs
    console.warn(`[RateLimiter] ⛔ Action "${action}" frozen for ${threshold.freezeDurationMs / 1000}s (${tracker.changes.length} changes in last min)`)
    return { allowed: false, reason: `Too many changes (${tracker.changes.length}/${threshold.maxChangesPerMin} per min), frozen for ${threshold.freezeDurationMs / 1000}s`, retryAfterMs: threshold.freezeDurationMs }
  }

  return { allowed: true }
}

/**
 * 记录一次变更
 */
export function recordChange(action: string) {
  const threshold = THRESHOLDS[action]
  if (!threshold) return

  if (!trackers.has(action)) {
    trackers.set(action, { action, changes: [], frozen: false, frozenUntil: 0 })
  }

  const tracker = trackers.get(action)!
  tracker.changes.push(Date.now())
}

/**
 * 获取所有跟踪器状态
 */
export function getChangeRateState() {
  const result: Record<string, any> = {}
  for (const [action, tracker] of trackers) {
    const threshold = THRESHOLDS[action]
    result[action] = {
      changesLastMin: tracker.changes.filter(t => t > Date.now() - 60_000).length,
      maxChangesPerMin: threshold?.maxChangesPerMin || 'unlimited',
      frozen: tracker.frozen,
      freezeRemaining: tracker.frozen ? Math.max(0, tracker.frozenUntil - Date.now()) : 0,
    }
  }
  return result
}
