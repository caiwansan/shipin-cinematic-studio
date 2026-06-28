/**
 * P7 — SelfOptimizingScheduler（自优化调度器）
 *
 * 基于 PatternLearner 的权重自动调整路由策略。
 * 结合 RegionRouter 做自适应调度。
 *
 * ═══ 宪法 ═══
 * 优化必须是渐进的（每次调整不超过 10%）。
 * 禁止在置信度过低时大幅修改路由策略。
 */

import { Capability } from '../runtime/capabilities.js'
import { patternLearner, LearnedWeights } from './pattern-learner.js'
import { ExecutionPattern } from './execution-pattern.js'
import { regionRouter, RouteRequest } from '../global/region-router.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'

class SelfOptimizingScheduler {
  private scheduledCount = 0
  private totalLatency = 0
  private totalCost = 0
  private failures = 0

  /**
   * 执行自优化调度
   */
  async schedule(capability: Capability, payload: any, userId: string): Promise<any> {
    this.scheduledCount++
    const startTime = Date.now()

    // 1. 获取当前学习权重
    const weights = patternLearner.learnWeights(capability)

    // 2. 构建路由请求（使用自适应权重）
    const routeRequest: RouteRequest = {
      capability,
      userId,
      preferLowLatency: weights.latencyWeight > 0.5,
      preferLowCost: weights.costWeight > 0.5,
    }

    // 3. 路由
    const decision = regionRouter.selectRegion(routeRequest)

    // 4. 执行
    let success = true
    let error: string | undefined
    let result: any

    try {
      result = await executionCutover.execute({ capability, userId, payload })
    } catch (err: any) {
      success = false
      error = err.message
      this.failures++
    }

    // 5. 记录模式
    const actualLatency = Date.now() - startTime
    this.totalLatency += actualLatency
    this.totalCost += decision.factors.cost

    const pattern: ExecutionPattern = {
      executionId: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      capability,
      selectedRegion: decision.regionId,
      selectedNode: decision.regionName,
      decisionScore: decision.score,
      actualLatency,
      actualCost: decision.factors.cost,
      success,
      error,
      timestamp: Date.now(),
    }

    patternLearner.record(pattern)

    return result
  }

  /**
   * 获取自优化统计
   */
  getStats() {
    const avgLatency = this.scheduledCount > 0 ? this.totalLatency / this.scheduledCount : 0
    const avgCost = this.scheduledCount > 0 ? this.totalCost / this.scheduledCount : 0
    const successRate = this.scheduledCount > 0 ? 1 - this.failures / this.scheduledCount : 1

    return {
      totalScheduled: this.scheduledCount,
      avgLatency: Math.round(avgLatency),
      avgCost: Math.round(avgCost * 100) / 100,
      successRate: Math.round(successRate * 10000) / 100,
    }
  }
}

export const selfOptimizingScheduler = new SelfOptimizingScheduler()
