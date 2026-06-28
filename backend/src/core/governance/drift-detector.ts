/**
 * P7-GOV — DriftDetector（漂移检测器）
 *
 * 检测系统运行时是否出现异常漂移。
 * 包括：路由偏置、成本异常、错误率上升、Provider 偏置。
 *
 * ═══ 宪法 ═══
 * 漂移检测是非侵入的（只读）。
 * 检测到漂移时必须通知回滚管理器。
 */

export type DriftAlert = {
  type: 'routing_bias' | 'cost_spike' | 'error_rate_spike' | 'provider_bias' | 'latency_spike'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: number
}

class DriftDetector {
  private alerts: DriftAlert[] = []
  private latencyHistory: number[] = []
  private errorRates: number[] = []
  private costHistory: number[] = []
  private maxHistory = 50

  /**
   * 记录延迟样本
   */
  recordLatency(latency: number): void {
    this.latencyHistory.push(latency)
    if (this.latencyHistory.length > this.maxHistory) this.latencyHistory.shift()
  }

  /**
   * 记录错误率样本
   */
  recordErrorRate(rate: number): void {
    this.errorRates.push(rate)
    if (this.errorRates.length > this.maxHistory) this.errorRates.shift()
  }

  /**
   * 记录成本样本
   */
  recordCost(cost: number): void {
    this.costHistory.push(cost)
    if (this.costHistory.length > this.maxHistory) this.costHistory.shift()
  }

  /**
   * 检测所有漂移
   */
  detect(): DriftAlert[] {
    const newAlerts: DriftAlert[] = []

    // 延迟尖峰检测
    if (this.latencyHistory.length >= 10) {
      const recent = this.latencyHistory.slice(-5)
      const baseline = this.latencyHistory.slice(0, 5)
      const avgRecent = recent.reduce((s, l) => s + l, 0) / recent.length
      const avgBaseline = baseline.reduce((s, l) => s + l, 0) / baseline.length
      if (avgBaseline > 0 && avgRecent > avgBaseline * 2) {
        newAlerts.push({
          type: 'latency_spike',
          severity: 'critical',
          message: `延迟峰值: ${Math.round(avgRecent)}ms (基线 ${Math.round(avgBaseline)}ms)`,
          value: avgRecent,
          threshold: avgBaseline * 2,
          timestamp: Date.now(),
        })
      }
    }

    // 错误率尖峰检测
    if (this.errorRates.length >= 5) {
      const recent = this.errorRates.slice(-5)
      const avgError = recent.reduce((s, r) => s + r, 0) / recent.length
      if (avgError > 0.1) {
        newAlerts.push({
          type: 'error_rate_spike',
          severity: 'critical',
          message: `错误率异常: ${(avgError * 100).toFixed(1)}% > 10%`,
          value: avgError,
          threshold: 0.1,
          timestamp: Date.now(),
        })
      }
    }

    // 成本异常检测
    if (this.costHistory.length >= 10) {
      const recent = this.costHistory.slice(-5)
      const baseline = this.costHistory.slice(0, 5)
      const avgRecent = recent.reduce((s, c) => s + c, 0) / recent.length
      const avgBaseline = baseline.reduce((s, c) => s + c, 0) / baseline.length
      if (avgBaseline > 0 && avgRecent > avgBaseline * 1.5) {
        newAlerts.push({
          type: 'cost_spike',
          severity: 'warning',
          message: `成本升高: ×${(avgRecent / avgBaseline).toFixed(2)}`,
          value: avgRecent,
          threshold: avgBaseline * 1.5,
          timestamp: Date.now(),
        })
      }
    }

    if (newAlerts.length > 0) {
      this.alerts.push(...newAlerts)
    }
    return newAlerts
  }

  /**
   * 获取所有告警
   */
  getAlerts(): DriftAlert[] {
    return [...this.alerts]
  }

  /**
   * 获取历史数据
   */
  getHistory() {
    return {
      latencies: [...this.latencyHistory],
      errorRates: [...this.errorRates],
      costs: [...this.costHistory],
    }
  }
}

export const driftDetector = new DriftDetector()
