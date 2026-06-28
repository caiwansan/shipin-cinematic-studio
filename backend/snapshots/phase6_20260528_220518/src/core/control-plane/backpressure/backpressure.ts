/**
 * P2 — Backpressure（限流系统）
 *
 * 三层限流：
 *   1. 用户级 — maxConcurrentPerUser
 *   2. Capability 级 — QPS
 *   3. Provider 级 — QPS
 *
 * ═══ 宪法 ═══
 * 任何 AI 调用必须经过 backpressure 检查。
 * 超限返回 429（backpressure blocked），禁止绕过。
 */

import { Capability } from '../../runtime/capabilities.js'

interface CheckOptions {
  userId: string
  capability: Capability
  requestId: string
}

interface CheckResult {
  allowed: boolean
  reason?: string
}

// 用户并发追踪
const userConcurrency = new Map<string, Set<string>>()

// Capability QPS 限制
const CAPABILITY_LIMITS: Record<string, number> = {
  [Capability.SCRIPT_ANALYSIS]: 200,
  [Capability.PROMPT_OPTIMIZATION]: 200,
  [Capability.IMAGE_GENERATION]: 50,
  [Capability.VIDEO_GENERATION]: 10,
  [Capability.VOICE_GENERATION]: 30,
  [Capability.DIRECTOR_REASONING]: 100,
  [Capability.STORY_EXPANSION]: 100,
  [Capability.CINEMATIC_PROMPT]: 100,
}

export class Backpressure {
  private maxConcurrentPerUser = 3
  private capabilitySlidingWindows = new Map<string, number[]>()  // capability → [timestamps]

  /**
   * 三层限流检查
   */
  check(options: CheckOptions): CheckResult {
    const { userId, capability, requestId } = options

    // 1️⃣ 用户级限制
    const userTasks = userConcurrency.get(userId) || new Set()
    if (userTasks.size >= this.maxConcurrentPerUser) {
      return { allowed: false, reason: `user ${userId.substring(0, 8)} 并发超限 (${userTasks.size}/${this.maxConcurrentPerUser})` }
    }
    userTasks.add(requestId)
    userConcurrency.set(userId, userTasks)

    // 2️⃣ Capability 级限流（滑动窗口 QPS）
    const qpsLimit = CAPABILITY_LIMITS[capability]
    if (qpsLimit) {
      const now = Date.now()
      const window = 1000  // 1 秒窗口
      const timestamps = this.capabilitySlidingWindows.get(capability) || []
      const recent = timestamps.filter(t => now - t < window)
      if (recent.length >= qpsLimit) {
        userTasks.delete(requestId)
        return { allowed: false, reason: `capability="${capability}" QPS 超限 (${recent.length}/${qpsLimit})` }
      }
      recent.push(now)
      this.capabilitySlidingWindows.set(capability, recent)
    }

    // 3️⃣ Provider 级限流（TODO: 动态 Provider 负载追踪）

    return { allowed: true }
  }

  /**
   * 任务完成后释放用户槽位
   */
  release(userId: string, requestId: string): void {
    const userTasks = userConcurrency.get(userId)
    if (userTasks) {
      userTasks.delete(requestId)
      if (userTasks.size === 0) {
        userConcurrency.delete(userId)
      }
    }
  }
}
