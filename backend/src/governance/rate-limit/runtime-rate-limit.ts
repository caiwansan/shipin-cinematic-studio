/**
 * governance/rate-limit/runtime-rate-limit.ts — 运行时频率限制（NON-BLOCKING）
 *
 * Phase 5 Hotfix: 频率限制仅记录 warning，不抛异常
 */

const runtimeBuckets = new Map<string, number[]>()

/** 每分钟允许的最大请求数 */
const RATE_LIMIT_PER_MINUTE = 10
/** 窗口大小（ms） */
const WINDOW_MS = 60_000

export interface RateLimitResult {
  allowed: boolean
  currentCount: number
  limit: number
}

export function assertRateLimit(runtime: { userId?: string }): void {
  const userId = runtime.userId
  if (!userId) return

  // self-test 放行
  if (userId.startsWith('__self_test__') || userId.startsWith('__boot_test__')) {
    return
  }

  const now = Date.now()
  const bucket = runtimeBuckets.get(userId) || []
  const recent = bucket.filter(t => now - t < WINDOW_MS)

  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    // NON-BLOCKING: 仅 log warning，不抛异常
    console.warn(
      `[governance/rate-limit] ⚠️ 频率超限: userId=${userId.substring(0, 8)}, ` +
      `count=${recent.length}/min, limit=${RATE_LIMIT_PER_MINUTE}/min — execution continues`
    )
    return // 不阻断
  }

  recent.push(now)
  runtimeBuckets.set(userId, recent)
}

/** 重置 rate limit（用于测试） */
export function resetRateLimit(userId?: string): void {
  if (userId) {
    runtimeBuckets.delete(userId)
  } else {
    runtimeBuckets.clear()
  }
}
