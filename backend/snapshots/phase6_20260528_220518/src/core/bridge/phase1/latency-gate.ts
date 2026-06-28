/**
 * PSC-1 Latency Gate — 延迟闸门
 *
 * 比较 bridge path 和 legacy path 的延迟。
 * 如果 bridge 延迟超过 legacy 的 1.3 倍，拒绝 bridge 结果，fallback 到 legacy。
 *
 * 作用：防止 bridge 变慢导致 audio/tts jitter 和 streaming delay。
 */

export interface LatencyGateConfig {
  /** bridge 延迟允许的最大倍数（相对 legacy） */
  maxLatencyRatio: number
  /** 采样窗口大小 */
  windowSize: number
  /** 是否启用 */
  enabled: boolean
}

class LatencyGate {
  private config: LatencyGateConfig = {
    maxLatencyRatio: 1.3,
    windowSize: 50,
    enabled: true,
  }

  /** legacy 延迟历史（滑动窗口） */
  private legacyLatencies: number[] = []
  /** bridge 延迟历史 */
  private bridgeLatencies: number[] = []

  /**
   * 设置配置
   */
  setConfig(cfg: Partial<LatencyGateConfig>): void {
    Object.assign(this.config, cfg)
  }

  /**
   * 获取配置
   */
  getConfig(): LatencyGateConfig {
    return { ...this.config }
  }

  /**
   * 记录一个执行延迟
   */
  record(path: 'legacy' | 'bridge', latencyMs: number): void {
    const bucket = path === 'legacy' ? this.legacyLatencies : this.bridgeLatencies
    bucket.push(latencyMs)
    if (bucket.length > this.config.windowSize) {
      bucket.shift()
    }
  }

  /**
   * 获取当前平均延迟
   */
  getAverageLatency(path: 'legacy' | 'bridge'): number {
    const bucket = path === 'legacy' ? this.legacyLatencies : this.bridgeLatencies
    if (bucket.length === 0) return 0
    return bucket.reduce((a, b) => a + b, 0) / bucket.length
  }

  /**
   * 验证 bridge 路径是否通过闸门检查
   *
   * 条件: bridgeLatency ≤ legacyLatency × maxLatencyRatio
   *
   * 如果历史数据不足（<5个样本），默认通过（信任期）
   */
  validate(currentLatency: number): { pass: boolean; reason?: string } {
    if (!this.config.enabled) return { pass: true }

    const avgLegacy = this.getAverageLatency('legacy')

    // 信任期：历史数据不足
    if (this.legacyLatencies.length < 5) {
      return { pass: true }
    }

    const threshold = avgLegacy * this.config.maxLatencyRatio
    if (currentLatency > threshold) {
      return {
        pass: false,
        reason: `bridge 延迟 ${currentLatency.toFixed(0)}ms > legacy ${avgLegacy.toFixed(0)}ms × ${this.config.maxLatencyRatio}`,
      }
    }

    return { pass: true }
  }

  /**
   * 重置
   */
  reset(): void {
    this.legacyLatencies = []
    this.bridgeLatencies = []
  }
}

export const latencyGate = new LatencyGate()
