/**
 * PSC-1 A/B Router — 流量分流器
 *
 * 将 tts/voice 请求分为两组：
 *   A: Legacy path（旧代码直接调用 provider）
 *   B: Bridge path（走 executionCutover）
 *
 * 默认 A=90% B=10%，根据成功率自动调增。
 *
 * ═══ 宪法 ═══
 * B 路由永远不承担 100% 流量，除非人工确认。
 * 自动最大上限: 75%
 */

export interface AbRouterConfig {
  /** B 路由流量百分比 0-100 */
  bridgeTrafficPercent: number
  /** 自动调增开关 */
  autoRamp: boolean
  /** 自动回滚开关 */
  autoRollback: boolean
  /** 最大自动调增上限 */
  maxAutoPercent: number
}

class AbRouter {
  private config: AbRouterConfig = {
    bridgeTrafficPercent: 10,    // 初始 10%
    autoRamp: true,
    autoRollback: true,
    maxAutoPercent: 75,          // 自动上限 75%
  }

  private stats = {
    totalCalls: 0,
    legacyCalls: 0,
    bridgeCalls: 0,
    legacyErrors: 0,
    bridgeErrors: 0,
    bridgeSuccessRate: 1.0,
  }

  /**
   * 设置配置
   */
  setConfig(cfg: Partial<AbRouterConfig>): void {
    Object.assign(this.config, cfg)
    console.log(`[AbRouter] 🔄 配置更新: bridgeTraffic=${this.config.bridgeTrafficPercent}%`)
  }

  /**
   * 获取配置
   */
  getConfig(): AbRouterConfig {
    return { ...this.config }
  }

  /**
   * 决定本次请求走哪条路径
   * true = bridge path (B), false = legacy path (A)
   */
  decide(): boolean {
    this.stats.totalCalls++
    const isBridge = Math.random() * 100 < this.config.bridgeTrafficPercent
    if (isBridge) this.stats.bridgeCalls++
    else this.stats.legacyCalls++
    return isBridge
  }

  /**
   * 上报执行结果，用于自动调增
   */
  report(path: 'legacy' | 'bridge', success: boolean): void {
    if (path === 'bridge') {
      if (!success) this.stats.bridgeErrors++
      // 动态调增（每 100 次检查一次）
      if (this.config.autoRamp && this.stats.bridgeCalls % 100 === 0 && this.stats.bridgeCalls > 0) {
        const successRate = 1 - (this.stats.bridgeErrors / this.stats.bridgeCalls)
        this.stats.bridgeSuccessRate = successRate

        if (successRate > 0.99 && this.config.bridgeTrafficPercent < this.config.maxAutoPercent) {
          // 成功率 > 99%，提高流量
          const increment = Math.min(5, this.config.maxAutoPercent - this.config.bridgeTrafficPercent)
          if (increment > 0) {
            this.config.bridgeTrafficPercent += increment
            console.log(`[AbRouter] 📈 成功率 ${(successRate * 100).toFixed(1)}%，提升至 ${this.config.bridgeTrafficPercent}%`)
          }
        } else if (successRate < 0.95 && this.config.autoRollback && this.config.bridgeTrafficPercent > 5) {
          // 成功率 < 95%，自动降低
          this.config.bridgeTrafficPercent = Math.max(5, this.config.bridgeTrafficPercent - 10)
          console.log(`[AbRouter] 📉 成功率 ${(successRate * 100).toFixed(1)}%，降低至 ${this.config.bridgeTrafficPercent}%`)
        }
      }
    } else {
      if (!success) this.stats.legacyErrors++
    }
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      config: this.config,
      totalCalls: this.stats.totalCalls,
      legacyCalls: this.stats.legacyCalls,
      bridgeCalls: this.stats.bridgeCalls,
      bridgeSuccessRate: this.stats.bridgeSuccessRate,
      legacyErrorRate: this.stats.legacyCalls > 0 ? this.stats.legacyErrors / this.stats.legacyCalls : 0,
      bridgeErrorRate: this.stats.bridgeCalls > 0 ? this.stats.bridgeErrors / this.stats.bridgeCalls : 0,
    }
  }

  /**
   * 设置流量百分比
   */
  setTraffic(percent: number): void {
    this.config.bridgeTrafficPercent = Math.max(0, Math.min(100, percent))
    console.log(`[AbRouter] 🚦 手动设置 bridge 流量: ${this.config.bridgeTrafficPercent}%`)
  }
}

export const abRouter = new AbRouter()
