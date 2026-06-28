/**
 * P7-GOV — StabilityController（稳定性控制器）
 *
 * 实时监控系统健康状态，输出 STABLE / DEGRADED / CRITICAL 等级。
 *
 * ═══ 宪法 ═══
 * 稳定性等级是系统自优化的最高优先级输入。
 * CRITICAL 状态下所有进化行为必须暂停。
 */

import { driftDetector } from './drift-detector.js'
import { policyEngine } from './policy-engine.js'
import { nodeRegistry } from '../cluster/node-registry.js'

export type StabilityLevel = 'STABLE' | 'DEGRADED' | 'CRITICAL'

export interface StabilityReport {
  level: StabilityLevel
  latency: { current: number; baseline: number; status: 'normal' | 'elevated' | 'critical' }
  errorRate: { current: number; threshold: number; status: 'normal' | 'elevated' | 'critical' }
  cost: { current: number; status: 'normal' | 'elevated' }
  cluster: { alive: number; total: number; status: 'normal' | 'degraded' | 'critical' }
  evolution: { canEvolve: boolean }
  timestamp: number
}

class StabilityController {
  /**
   * 生成稳定性报告
   */
  report(): StabilityReport {
    const clusterSummary = nodeRegistry.getSummary()
    const driftAlerts = driftDetector.getAlerts()
    const recentDrift = driftAlerts.filter(a => Date.now() - a.timestamp < 60000)
    const criticalAlerts = recentDrift.filter(a => a.severity === 'critical')
    const warningAlerts = recentDrift.filter(a => a.severity === 'warning')

    // 集群状态
    let clusterStatus: 'normal' | 'degraded' | 'critical' = 'normal'
    if (clusterSummary.total > 0 && clusterSummary.dead > clusterSummary.total * 0.5) {
      clusterStatus = 'critical'
    } else if (clusterSummary.degraded > 0 || clusterSummary.dead > 0) {
      clusterStatus = 'degraded'
    }

    // 延迟状态
    let latencyStatus: 'normal' | 'elevated' | 'critical' = 'normal'
    const latencyCritical = criticalAlerts.find(a => a.type === 'latency_spike')
    if (latencyCritical) latencyStatus = 'critical'
    else if (warningAlerts.find(a => a.type === 'latency_spike')) latencyStatus = 'elevated'

    // 错误率状态
    let errorStatus: 'normal' | 'elevated' | 'critical' = 'normal'
    const errorCritical = criticalAlerts.find(a => a.type === 'error_rate_spike')
    if (errorCritical) errorStatus = 'critical'
    else if (warningAlerts.find(a => a.type === 'error_rate_spike')) errorStatus = 'elevated'

    // 综合等级
    let level: StabilityLevel = 'STABLE'
    if (criticalAlerts.length > 0 || clusterStatus === 'critical') level = 'CRITICAL'
    else if (warningAlerts.length > 0 || clusterStatus === 'degraded') level = 'DEGRADED'

    return {
      level,
      latency: { current: 0, baseline: 0, status: latencyStatus },
      errorRate: { current: 0, threshold: 0.1, status: errorStatus },
      cost: { current: 0, status: warningAlerts.find(a => a.type === 'cost_spike') ? 'elevated' : 'normal' },
      cluster: { alive: clusterSummary.alive, total: clusterSummary.total, status: clusterStatus },
      evolution: { canEvolve: level !== 'CRITICAL' },
      timestamp: Date.now(),
    }
  }

  /**
   * 是否允许进化
   */
  canEvolve(): boolean {
    return this.report().evolution.canEvolve
  }
}

export const stabilityController = new StabilityController()
