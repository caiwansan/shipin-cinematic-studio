/**
 * LLM Semaphore Pool — 全局 LLM 并发控制 + Circuit Breaker
 *
 * 所有 LLM 调用必须通过此 pool，禁止 direct call。
 * 当并发超过限制时排队等待，超时自动 fallback。
 */

const MAX_CONCURRENT = 5
const QUEUE_TIMEOUT_MS = 15000

interface QueuedCall {
  resolve: (token: number) => void
  reject: (err: Error) => void
  enqueuedAt: number
}

export class LLMPool {
  private active = 0
  private queue: QueuedCall[] = []
  private circuitOpen = false
  private circuitCooldownUntil = 0
  private recentErrors: number[] = []  // timestamps within 1min
  private recentTotal: number[] = []

  /** 获取一个 LLM 调用 slot，超时返回 false */
  async acquire(timeoutMs = QUEUE_TIMEOUT_MS): Promise<boolean> {
    // Circuit breaker check
    if (this.circuitOpen) {
      if (Date.now() > this.circuitCooldownUntil) {
        this.circuitOpen = false
        this.recentErrors = []
        this.recentTotal = []
      } else {
        return false  // circuit open, reject
      }
    }

    if (this.active < MAX_CONCURRENT) {
      this.active++
      return true
    }

    // Queue
    return new Promise<boolean>((resolve, reject) => {
      const entry: QueuedCall = {
        resolve: () => {
          this.active++
          resolve(true)
        },
        reject: (err) => reject(err),
        enqueuedAt: Date.now(),
      }
      this.queue.push(entry)

      // Timeout
      setTimeout(() => {
        const idx = this.queue.indexOf(entry)
        if (idx >= 0) {
          this.queue.splice(idx, 1)
          resolve(false)  // timeout → fallback
        }
      }, timeoutMs)
    })
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
    // 如果有排队，放行下一个
    if (this.queue.length > 0 && this.active < MAX_CONCURRENT) {
      const next = this.queue.shift()
      next?.resolve(Date.now())
    }
  }

  /** 记录一次 LLM 调用结果（用于 circuit breaker） */
  recordCall(success: boolean): void {
    const now = Date.now()
    this.recentTotal.push(now)
    if (!success) this.recentErrors.push(now)

    // 清理 1min 前的记录
    const cutoff = now - 60000
    this.recentErrors = this.recentErrors.filter(t => t > cutoff)
    this.recentTotal = this.recentTotal.filter(t => t > cutoff)

    // Check circuit breaker
    if (this.recentTotal.length >= 3) {
      const errorRate = this.recentErrors.length / this.recentTotal.length
      if (errorRate > 0.3) {
        this.circuitOpen = true
        this.circuitCooldownUntil = now + 60000  // 1min cooldown
        console.warn(`[LLMPool] Circuit breaker OPEN (error rate: ${(errorRate * 100).toFixed(0)}%)`)
      }
    }
  }

  getLoad(): number {
    return this.active / MAX_CONCURRENT
  }

  isCircuitOpen(): boolean {
    if (this.circuitOpen && Date.now() > this.circuitCooldownUntil) {
      this.circuitOpen = false
      this.recentErrors = []
      this.recentTotal = []
    }
    return this.circuitOpen
  }

  getQueueSize(): number {
    return this.queue.length
  }

  getStatus(): { llmLoad: number; queueSize: number; circuitOpen: boolean } {
    return {
      llmLoad: this.getLoad(),
      queueSize: this.getQueueSize(),
      circuitOpen: this.isCircuitOpen(),
    }
  }
}

export const llmPool = new LLMPool()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

