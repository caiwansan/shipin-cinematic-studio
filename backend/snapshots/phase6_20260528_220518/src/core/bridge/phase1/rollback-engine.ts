/**
 * PSC-1 Rollback Engine — 自动回滚引擎
 *
 * 监控 bridge 路径的健康状况，在以下条件触发时自动回滚：
 *   1. 错误率 > 2%
 *   2. 延迟飙升 > 30%
 *   3. diff_score > 0.1
 *
 * 回滚行为：
 *   → 全部流量切回 Legacy (A = 100%)
 *   → 冻结 bridge 部署
 *   → 发送告警到 EPVH
 */

export interface RollbackEvent {
  timestamp: number
  reason: string
  metrics: {
    bridgeErrorRate: number
    bridgeLatencyRatio: number
    bridgeDiffScore: number
  }
  resolvedAt?: number
}

export interface RollbackConfig {
  /** 最大允许错误率 */
  maxErrorRate: number
  /** 最大允许延迟比 */
  maxLatencyRatio: number
  /** 最大允许差异分数 */
  maxDiffScore: number
  /** 如果 autoRollback=true，自动回滚 */
  autoRollback: boolean
  /** 回滚后冻结时间（ms）*/
  freezeDurationMs: number
}

class RollbackEngine {
  private config: RollbackConfig = {
    maxErrorRate: 0.02,
    maxLatencyRatio: 1.3,
    maxDiffScore: 0.1,
    autoRollback: true,
    freezeDurationMs: 5 * 60 * 1000, // 5 分钟
  }

  private events: RollbackEvent[] = []
  private frozen = false
  private frozenAt = 0
  private frozenBy: string | null = null

  /**
   * 设置配置
   */
  setConfig(cfg: Partial<RollbackConfig>): void {
    Object.assign(this.config, cfg)
  }

  /**
   * 获取配置
   */
  getConfig(): RollbackConfig {
    return { ...this.config }
  }

  /**
   * 检查是否应触发回滚
   *
   * @returns 是否需要回滚
   */
  evaluate(metrics: {
    bridgeErrorRate: number
    bridgeLatencyRatio: number
    bridgeDiffScore: number
  }): { shouldRollback: boolean; reason?: string } {
    // 如果已冻结且冻结未过期，拒绝
    if (this.frozen && Date.now() - this.frozenAt < this.config.freezeDurationMs) {
      return { shouldRollback: false, reason: 'bridge 已冻结' }
    }

    // 清除过期冻结
    if (this.frozen) {
      this.frozen = false
    }

    const reasons: string[] = []
    let shouldRollback = false

    if (metrics.bridgeErrorRate > this.config.maxErrorRate) {
      reasons.push(`错误率 ${(metrics.bridgeErrorRate * 100).toFixed(1)}% > ${(this.config.maxErrorRate * 100).toFixed(0)}%`)
      shouldRollback = true
    }

    if (metrics.bridgeLatencyRatio > this.config.maxLatencyRatio) {
      reasons.push(`延迟比 ${metrics.bridgeLatencyRatio.toFixed(2)}x > ${this.config.maxLatencyRatio}x`)
      shouldRollback = true
    }

    if (metrics.bridgeDiffScore > this.config.maxDiffScore) {
      reasons.push(`差异分数 ${metrics.bridgeDiffScore.toFixed(3)} > ${this.config.maxDiffScore}`)
      shouldRollback = true
    }

    if (shouldRollback && this.config.autoRollback) {
      this.frozen = true
      this.frozenAt = Date.now()
      this.events.push({
        timestamp: Date.now(),
        reason: reasons.join('; '),
        metrics,
      })
      return { shouldRollback: true, reason: reasons.join('; ') }
    }

    return { shouldRollback: false }
  }

  /**
   * 手动冻结 bridge
   */
  freeze(reason: string): void {
    this.frozen = true
    this.frozenAt = Date.now()
    this.frozenBy = reason
    this.events.push({
      timestamp: Date.now(),
      reason: `手动冻结: ${reason}`,
      metrics: { bridgeErrorRate: 0, bridgeLatencyRatio: 0, bridgeDiffScore: 0 },
    })
    console.log(`[RollbackEngine] 🧊 手动冻结: ${reason}`)
  }

  /**
   * 手动解冻
   */
  unfreeze(): void {
    this.frozen = false
    this.frozenAt = 0
    this.frozenBy = null
    console.log('[RollbackEngine] 🔓 手动解冻')
  }

  /**
   * 是否冻结
   */
  isFrozen(): boolean {
    if (this.frozen && Date.now() - this.frozenAt > this.config.freezeDurationMs) {
      // 自动过期
      const event = this.events[this.events.length - 1]
      if (event) event.resolvedAt = Date.now()
      this.frozen = false
      this.frozenAt = 0
      console.log('[RollbackEngine] 🔓 冻结自动过期')
    }
    return this.frozen
  }

  /**
   * 获取事件历史
   */
  getEvents(): RollbackEvent[] {
    return [...this.events]
  }
}

export const rollbackEngine = new RollbackEngine()
