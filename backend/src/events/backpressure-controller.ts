// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Backpressure Controller
// SSE 背压控制：按负载等级动态调节事件发射频率
// ============================================================================

export type LoadTier = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SATURATION'

interface BackpressureConfig {
  maxBufferSize: number
  overflowStrategy: 'drop_oldest' | 'batch_compress' | 'throttle'
  throttleIntervalMs: number  // 最小发射间隔
  batchWindowMs: number       // 批处理窗口
}

const TIER_CONFIGS: Record<LoadTier, BackpressureConfig> = {
  LIGHT: {
    maxBufferSize: 1000,
    overflowStrategy: 'drop_oldest',
    throttleIntervalMs: 0,
    batchWindowMs: 0
  },
  MODERATE: {
    maxBufferSize: 500,
    overflowStrategy: 'batch_compress',
    throttleIntervalMs: 50,
    batchWindowMs: 100
  },
  HEAVY: {
    maxBufferSize: 200,
    overflowStrategy: 'throttle',
    throttleIntervalMs: 200,
    batchWindowMs: 300
  },
  SATURATION: {
    maxBufferSize: 50,
    overflowStrategy: 'throttle',
    throttleIntervalMs: 1000,
    batchWindowMs: 0
  }
}

// ── 背压控制器 ──────────────────────────────────────────────────────────

export class BackpressureController {
  private queue: any[] = []
  private lastEmitTime = 0
  private currentTier: LoadTier = 'LIGHT'
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private onBatchReady: ((batch: any[]) => void) | null = null
  private _droppedCount = 0
  private _batchCount = 0

  get droppedCount(): number { return this._droppedCount }
  get batchCount(): number { return this._batchCount }
  get queueLength(): number { return this.queue.length }
  get tier(): LoadTier { return this.currentTier }

  constructor() {
    this.setTier('LIGHT')
  }

  /** 设置当前负载等级（动态调节背压） */
  setTier(tier: LoadTier): void {
    this.currentTier = tier
    const config = this.getConfig()
    if (this.queue.length > config.maxBufferSize) {
      this.shrink()
    }
  }

  /** 入队并应用背压策略 */
  push(event: any): { accepted: boolean; reason?: string } {
    const config = this.getConfig()

    // SATURATION: 限流，除非是关键事件
    if (this.currentTier === 'SATURATION') {
      const criticalEvents = ['system.warning', 'dag.error', 'replay.drift']
      if (!criticalEvents.includes(event.type)) {
        const now = Date.now()
        if (now - this.lastEmitTime < config.throttleIntervalMs) {
          this._droppedCount++
          return { accepted: false, reason: 'SATURATION_THROTTLE' }
        }
      }
    }

    // 缓冲区满 → 按策略处理
    if (this.queue.length >= config.maxBufferSize) {
      switch (config.overflowStrategy) {
        case 'drop_oldest':
          this.queue.shift()
          this._droppedCount++
          break
        case 'throttle':
          this._droppedCount++
          return { accepted: false, reason: 'BUFFER_FULL_THROTTLE' }
        case 'batch_compress':
          // MODERATE: 合并同类事件
          if (this.shouldBatch(event)) {
            this._batchCount++
            return { accepted: false, reason: 'BATCHED' }
          }
          break
      }
    }

    this.queue.push(event)
    return { accepted: true }
  }

  /** 消费缓冲区（返回当前批次） */
  flush(): any[] {
    const batch = [...this.queue]
    this.queue = []
    this.lastEmitTime = Date.now()
    return batch
  }

  /** 注册批处理器（MODERATE 模式定时触发） */
  onBatch(callback: (batch: any[]) => void): void {
    this.onBatchReady = callback
    this.startBatchTimer()
  }

  /** 获取当前配置 */
  getConfig(): BackpressureConfig {
    return TIER_CONFIGS[this.currentTier]
  }

  /** 重置 */
  reset(): void {
    this.queue = []
    this._droppedCount = 0
    this._batchCount = 0
    this.lastEmitTime = 0
    this.setTier('LIGHT')
  }

  getStatus(): Record<string, unknown> {
    const config = this.getConfig()
    return {
      tier: this.currentTier,
      bufferSize: this.queue.length,
      maxBuffer: config.maxBufferSize,
      overflowStrategy: config.overflowStrategy,
      droppedCount: this._droppedCount,
      batchedCount: this._batchCount,
      throttleIntervalMs: config.throttleIntervalMs
    }
  }

  // ── private ──────────────────────────────────────────────────────────

  private shrink(): void {
    const config = this.getConfig()
    while (this.queue.length > config.maxBufferSize) {
      this.queue.shift()
      this._droppedCount++
    }
  }

  private shouldBatch(event: any): boolean {
    // 将同类事件合并（相同 type 的连续事件只保留最新）
    const lastEvent = this.queue[this.queue.length - 1]
    return lastEvent && lastEvent.type === event.type
  }

  private startBatchTimer(): void {
    const config = this.getConfig()
    if (config.batchWindowMs <= 0) return
    if (this.batchTimer) clearInterval(this.batchTimer)
    this.batchTimer = setInterval(() => {
      if (this.queue.length > 0 && this.onBatchReady) {
        this.onBatchReady(this.flush())
      }
    }, config.batchWindowMs)
  }
}

export const backpressureController = new BackpressureController()
