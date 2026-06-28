// ============================================================================
// 盘古斧 AI OS — Phase 8.2b: Circuit Breaker (SLA 感知熔断器)
//
// 职责：
//   1. 每个 SLA tier 独立熔断器 (CLOSED → OPEN → HALF_OPEN)
//   2. 基于失败率 + 连续失败数决策
//   3. 自动恢复 (HALF_OPEN → 试探 → CLOSED 或 OPEN)
//   4. 提供 degrade() 决策 + shouldPreempt() 抢占判断
//   5. 不依赖外部状态，纯内存状态机
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'
export type SLATier = 'SLA_A' | 'SLA_B' | 'SLA_C' | 'SLA_D'
export type DegradationMode = 'FULL_DAG' | 'SIMPLIFIED_DAG' | 'ASYNC_BATCH' | 'QUEUE_ONLY' | 'REJECT'

/** 熔断器配置 */
export interface BreakerConfig {
  /** 连续失败阈值 (达到此值 OPEN) */
  failureThreshold: number
  /** 半开试探成功次数 (达到此值 CLOSED) */
  halfOpenSuccessThreshold: number
  /** OPEN → HALF_OPEN 等待时间 (ms) */
  resetTimeoutMs: number
  /** 滑动窗口大小 (用于失败率计算) */
  windowSize: number
  /** 窗口内最小请求数 (低于此值不触发熔断) */
  minRequestCount: number
  /** 窗口内失败率阈值 (超过此值触发熔断) */
  failureRateThreshold: number // 0.0 ~ 1.0
}

/** 每条 SLA tier 的熔断器配置 */
export const DEFAULT_BREAKER_CONFIGS: Record<SLATier, BreakerConfig> = {
  SLA_A: {
    failureThreshold: 8,
    halfOpenSuccessThreshold: 3,
    resetTimeoutMs: 15_000,
    windowSize: 100,
    minRequestCount: 10,
    failureRateThreshold: 0.15, // 15% 失败率熔断
  },
  SLA_B: {
    failureThreshold: 6,
    halfOpenSuccessThreshold: 2,
    resetTimeoutMs: 20_000,
    windowSize: 80,
    minRequestCount: 8,
    failureRateThreshold: 0.20,
  },
  SLA_C: {
    failureThreshold: 5,
    halfOpenSuccessThreshold: 2,
    resetTimeoutMs: 30_000,
    windowSize: 60,
    minRequestCount: 6,
    failureRateThreshold: 0.25,
  },
  SLA_D: {
    failureThreshold: 4,
    halfOpenSuccessThreshold: 1,
    resetTimeoutMs: 60_000,
    windowSize: 40,
    minRequestCount: 4,
    failureRateThreshold: 0.35,
  },
}

/** 滑动窗口中的单条记录 */
interface WindowEntry {
  success: boolean
  timestamp: number
}

/**
 * SLA 感知电路熔断器
 * 
 * 状态机:
 *   CLOSED (正常运行)
 *     → 连续失败 ≥ threshold 或 失败率 > threshold → OPEN
 *   OPEN (拒绝请求)
 *     → resetTimeout 到期 → HALF_OPEN
 *   HALF_OPEN (试探状态)
 *     → 成功达到 threshold → CLOSED
 *     → 任何一次失败 → OPEN
 */
export class CircuitBreaker {
  readonly tier: SLATier
  private config: BreakerConfig
  private state: CircuitState = 'CLOSED'
  private consecutiveFailures = 0
  private consecutiveSuccesses = 0
  private lastOpenAt: number = 0
  private window: WindowEntry[] = []

  /** 抢占计数器 (用于 metrics) */
  preemptionCount = 0
  /** 降级计数器 */
  degradationCount = 0

  constructor(tier: SLATier, config?: Partial<BreakerConfig>) {
    this.tier = tier
    this.config = { ...DEFAULT_BREAKER_CONFIGS[tier], ...config }
  }

  getState(): CircuitState { return this.state }
  getConsecutiveFailures(): number { return this.consecutiveFailures }
  getConsecutiveSuccesses(): number { return this.consecutiveSuccesses }

  /** 记录成功 */
  recordSuccess(): void {
    this.window.push({ success: true, timestamp: Date.now() })
    this.pruneWindow()

    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++
      if (this.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.reset()
      }
    } else if (this.state === 'CLOSED') {
      // 连续成功清除连续失败计数（避免旧失败堆积）
      this.consecutiveFailures = 0
    }
  }

  /** 记录失败 */
  recordFailure(): void {
    this.window.push({ success: false, timestamp: Date.now() })
    this.pruneWindow()
    this.consecutiveFailures++

    if (this.state === 'CLOSED') {
      // 判断是否需要熔断
      const shouldTrip = this.evaluateTrip()
      if (shouldTrip) {
        this.trip()
      }
    } else if (this.state === 'HALF_OPEN') {
      // 半开状态下任何失败 → 重新 OPEN
      this.state = 'OPEN'
      this.lastOpenAt = Date.now()
      this.consecutiveSuccesses = 0

      // 重置恢复定时器
      setTimeout(() => {
        if (this.state === 'OPEN') {
          this.state = 'HALF_OPEN'
          this.consecutiveSuccesses = 0
        }
      }, this.config.resetTimeoutMs)
    }
  }

  /** 是否可以执行 */
  canExecute(): boolean {
    if (this.state === 'OPEN') {
      // 检查是否到了恢复时间
      if (Date.now() - this.lastOpenAt >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        this.consecutiveSuccesses = 0
        return true
      }
      return false
    }
    return true
  }

  /** 
   * 降级决策 — 当熔断发生时，决定当前请求应如何执行
   * 
   * SLA_A: 即使熔断也尽力执行 (SIMPLIFIED_DAG)
   * SLA_B: 降级为简化 
   * SLA_C: 异步
   * SLA_D: 排队/拒绝
   */
  degrade(): DegradationMode {
    this.degradationCount++
    if (this.state === 'OPEN') {
      switch (this.tier) {
        case 'SLA_A': return 'SIMPLIFIED_DAG'
        case 'SLA_B': return 'ASYNC_BATCH'
        case 'SLA_C': return 'QUEUE_ONLY'
        case 'SLA_D': return 'REJECT'
      }
    }
    return 'FULL_DAG'
  }

  /**
   * 熔断器自身健康状态 (用于 metrics)
   */
  getHealth(): { state: CircuitState; degradationMode: DegradationMode; failureRate: number } {
    const failureRate = this.computeFailureRate()
    return {
      state: this.state,
      degradationMode: this.degrade(),
      failureRate,
    }
  }

  /** 重置为初始状态 */
  private reset(): void {
    this.state = 'CLOSED'
    this.consecutiveFailures = 0
    this.consecutiveSuccesses = 0
    this.window = []
  }

  /** 触发熔断 */
  private trip(): void {
    this.state = 'OPEN'
    this.lastOpenAt = Date.now()
    this.consecutiveSuccesses = 0

    // 设置自动恢复定时器
    setTimeout(() => {
      if (this.state === 'OPEN') {
        this.state = 'HALF_OPEN'
        this.consecutiveSuccesses = 0
      }
    }, this.config.resetTimeoutMs)
  }

  /** 评估是否应该触发熔断 */
  private evaluateTrip(): boolean {
    // 1. 连续失败阈值
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      return true
    }

    // 2. 滑动窗口失败率
    const failureRate = this.computeFailureRate()
    if (this.window.length >= this.config.minRequestCount && failureRate > this.config.failureRateThreshold) {
      return true
    }

    return false
  }

  /** 滑动窗口失败率 */
  private computeFailureRate(): number {
    if (this.window.length === 0) return 0
    const failures = this.window.filter(e => !e.success).length
    return failures / this.window.length
  }

  /** 裁剪过期的窗口条目 */
  private pruneWindow(): void {
    while (this.window.length > this.config.windowSize) {
      this.window.shift()
    }
  }
}

/** SLA tier → Breaker 映射 */
const breakers: Partial<Record<SLATier, CircuitBreaker>> = {}

/** 获取或创建指定 tier 的熔断器 */
export function getBreaker(tier: SLATier): CircuitBreaker {
  if (!breakers[tier]) {
    breakers[tier] = new CircuitBreaker(tier)
  }
  return breakers[tier]!
}

/**
 * 获取所有熔断器状态
 */
export function getAllBreakerHealth(): Record<SLATier, {
  state: CircuitState
  degradationMode: DegradationMode
  failureRate: number
  preemptionCount: number
  degradationCount: number
}> {
  const tiers: SLATier[] = ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']
  const result: any = {}
  for (const tier of tiers) {
    const b = getBreaker(tier)
    result[tier] = {
      ...b.getHealth(),
      preemptionCount: b.preemptionCount,
      degradationCount: b.degradationCount,
    }
  }
  return result
}

// ============================================================================
// 抢占调度 (Preemption)
// ============================================================================

const PRIORITY_MAP: Record<SLATier, number> = {
  SLA_A: 4,
  SLA_B: 3,
  SLA_C: 2,
  SLA_D: 1,
}

/**
 * 判断是否应该抢占
 * 
 * 规则:
 *   1. incoming priority > current priority → 抢占
 *   2. 同 priority → 不抢占 (FIFO)
 *   3. incoming 熔断器为 OPEN → 不允许抢占 (熔断的服务不应抢占资源)
 */
export function shouldPreempt(currentTier: SLATier, incomingTier: SLATier): boolean {
  const currentPri = PRIORITY_MAP[currentTier]
  const incomingPri = PRIORITY_MAP[incomingTier]

  if (incomingPri <= currentPri) return false

  // 检查 incoming 熔断器状态
  const incomingBreaker = getBreaker(incomingTier)
  if (incomingBreaker.getState() === 'OPEN') return false

  return true
}
