// ===================================================
// RetryPolicy — RC2-2
// 策略对象模式：不写死到 Scheduler，可替换策略
// ===================================================

export interface RetryPolicy {
  /** 返回 true 表示应该重试 */
  shouldRetry(attempt: number, error: Error, config: RetryConfig): boolean
  /** 返回下一次重试的延迟时间 (ms) */
  nextDelay(attempt: number, config: RetryConfig): number
  /** 返回策略名称 */
  name: string
}

// RetryConfig（从 RC1 types.ts 扩展，或保持独立）
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
  useExponentialBackoff: boolean
}

/**
 * FixedRetryPolicy — 固定间隔重试
 * 每次等待相同的时间
 */
export class FixedRetryPolicy implements RetryPolicy {
  name = 'fixed'

  shouldRetry(attempt: number, _error: Error, config: RetryConfig): boolean {
    return attempt < config.maxRetries
  }

  nextDelay(_attempt: number, config: RetryConfig): number {
    return this.applyJitter(config.baseDelayMs, config)
  }

  private applyJitter(delay: number, config: RetryConfig): number {
    if (!config.jitter) return delay
    return delay * (0.5 + Math.random() * 0.5)  // ±25%
  }
}

/**
 * ExponentialBackoffRetryPolicy — 指数退避
 * delay = baseDelay * 2^attempt
 */
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  name = 'exponential_backoff'

  shouldRetry(attempt: number, _error: Error, config: RetryConfig): boolean {
    return attempt < config.maxRetries
  }

  nextDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.baseDelayMs * Math.pow(2, attempt),
      config.maxDelayMs,
    )
    return this.applyJitter(delay, config)
  }

  private applyJitter(delay: number, config: RetryConfig): number {
    if (!config.jitter) return delay
    // Full jitter: delay * (0.0 ~ 1.0) — AWS 推荐的均衡方案
    return delay * Math.random()
  }
}

/**
 * AdaptiveRetryPolicy — 自适应重试
 * 根据 Provider Health Service 调整延迟
 * 如果 Provider 健康度差，增加延迟
 */
export class AdaptiveRetryPolicy implements RetryPolicy {
  name = 'adaptive'

  constructor(private healthService: { getHealth(provider: string): Promise<{ errorRate: number }> }) {}

  shouldRetry(attempt: number, _error: Error, config: RetryConfig): boolean {
    return attempt < config.maxRetries
  }

  async nextDelay(attempt: number, config: RetryConfig): Promise<number> {
    let delay = Math.min(
      config.baseDelayMs * Math.pow(2, attempt),
      config.maxDelayMs,
    )
    // @beta-stub(rc2-3): 异步获取 health 调整延迟 — 暂未实现
    return this.applyJitter(delay, config)
  }

  private applyJitter(delay: number, config: RetryConfig): number {
    if (!config.jitter) return delay
    return delay * (0.5 + Math.random() * 0.5)
  }
}

// 工厂函数
export function createRetryPolicy(config: RetryConfig): RetryPolicy {
  if (config.useExponentialBackoff) {
    return new ExponentialBackoffRetryPolicy()
  }
  return new FixedRetryPolicy()
}
