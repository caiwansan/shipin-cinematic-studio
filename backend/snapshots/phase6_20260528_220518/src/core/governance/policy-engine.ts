/**
 * P7-GOV — PolicyEngine（策略引擎）
 *
 * 定义系统进化的安全边界。
 * 所有自优化行为必须在此边界内。
 *
 * ═══ 宪法 ═══
 * 策略是系统进化的宪法。
 * 任何偏离策略的进化行为必须被拒绝。
 */

export interface SystemPolicy {
  /** 最大延迟退化倍数（1.2 = 允许退化 20%）*/
  maxLatencyRegression: number
  /** 最大成本增长倍数 */
  maxCostIncrease: number
  /** 最低成功率阈值 */
  minSuccessRate: number
  /** 单次权重最大变动 */
  maxWeightChange: number
  /** 最大集群节点数 */
  maxClusterNodes: number
  /** 最大负载阈值（超过此值强制扩容） */
  maxLoadThreshold: number
}

export interface PolicyViolation {
  rule: string
  expected: string
  actual: string
  severity: 'warning' | 'critical'
}

class PolicyEngine {
  private policy: SystemPolicy = {
    maxLatencyRegression: 1.2,
    maxCostIncrease: 1.1,
    minSuccessRate: 0.85,
    maxWeightChange: 0.15,
    maxClusterNodes: 10,
    maxLoadThreshold: 0.9,
  }

  /**
   * 更新策略
   */
  updatePolicy(partial: Partial<SystemPolicy>): void {
    this.policy = { ...this.policy, ...partial }
    console.log('[PolicyEngine] 📜 策略已更新:', JSON.stringify(partial))
  }

  /**
   * 获取当前策略
   */
  getPolicy(): SystemPolicy {
    return { ...this.policy }
  }

  /**
   * 检查延迟退化是否允许
   */
  checkLatencyRegression(previousLatency: number, currentLatency: number): PolicyViolation | null {
    if (previousLatency <= 0) return null
    const ratio = currentLatency / previousLatency
    if (ratio > this.policy.maxLatencyRegression) {
      return {
        rule: 'maxLatencyRegression',
        expected: `≤ ${this.policy.maxLatencyRegression}x`,
        actual: `${ratio.toFixed(2)}x`,
        severity: 'critical',
      }
    }
    return null
  }

  /**
   * 检查成本增长是否允许
   */
  checkCostIncrease(previousCost: number, currentCost: number): PolicyViolation | null {
    if (previousCost <= 0) return null
    const ratio = currentCost / previousCost
    if (ratio > this.policy.maxCostIncrease) {
      return {
        rule: 'maxCostIncrease',
        expected: `≤ ${this.policy.maxCostIncrease}x`,
        actual: `${ratio.toFixed(2)}x`,
        severity: 'critical',
      }
    }
    return null
  }

  /**
   * 检查权重变动是否允许
   */
  checkWeightChange(previousWeight: number, newWeight: number, weightName: string): PolicyViolation | null {
    const change = Math.abs(newWeight - previousWeight)
    if (change > this.policy.maxWeightChange) {
      return {
        rule: 'maxWeightChange',
        expected: `≤ ${this.policy.maxWeightChange}`,
        actual: `${change.toFixed(3)} (${weightName})`,
        severity: 'warning',
      }
    }
    return null
  }

  /**
   * 检查成功率
   */
  checkSuccessRate(successRate: number): PolicyViolation | null {
    if (successRate < this.policy.minSuccessRate) {
      return {
        rule: 'minSuccessRate',
        expected: `≥ ${this.policy.minSuccessRate}`,
        actual: `${(successRate * 100).toFixed(1)}%`,
        severity: 'critical',
      }
    }
    return null
  }
}

export const policyEngine = new PolicyEngine()
