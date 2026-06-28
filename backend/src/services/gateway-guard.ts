/**
 * B2-4 Gateway Guard — 安全 + 速率控制
 *
 * 规则：
 *   - 每用户速率限制
 *   - 每项目并发限制
 *   - 超时执行
 *   - 重试策略（最多 2 次）
 */

export interface GuardConfig {
  maxRetries: number
  timeoutMs: number
  maxConcurrencyPerProject: number
  maxCallsPerMinutePerUser: number
}

export class GatewayGuard {
  private config: GuardConfig = {
    maxRetries: 2,
    timeoutMs: 30000,
    maxConcurrencyPerProject: 5,
    maxCallsPerMinutePerUser: 20,
  }

  // 简单内存计数器（生产环境用 Redis）
  private userCallCounts: Map<string, { count: number; resetAt: number }> = new Map()
  private projectConcurrency: Map<string, number> = new Map()

  configure(config: Partial<GuardConfig>) {
    Object.assign(this.config, config)
  }

  /**
   * 检查用户速率限制
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const entry = this.userCallCounts.get(userId)

    if (!entry || now > entry.resetAt) {
      this.userCallCounts.set(userId, { count: 1, resetAt: now + 60000 })
      return true
    }

    if (entry.count >= this.config.maxCallsPerMinutePerUser) {
      return false
    }

    entry.count++
    return true
  }

  /**
   * 检查项目并发限制
   */
  async checkConcurrency(projectId: string): Promise<boolean> {
    const current = this.projectConcurrency.get(projectId) || 0
    if (current >= this.config.maxConcurrencyPerProject) {
      return false
    }
    this.projectConcurrency.set(projectId, current + 1)
    return true
  }

  /**
   * 释放项目并发槽位
   */
  releaseConcurrency(projectId: string) {
    const current = this.projectConcurrency.get(projectId) || 0
    if (current > 0) {
      this.projectConcurrency.set(projectId, current - 1)
    }
  }

  getConfig(): GuardConfig {
    return { ...this.config }
  }

  /**
   * 超时包装：带超时的 Promise
   */
  withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const ms = timeoutMs || this.config.timeoutMs
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`AI 调用超时 (${ms}ms)`)), ms),
      ),
    ])
  }
}

export const gatewayGuard = new GatewayGuard()
