/**
 * Adaptive Execution Engine
 * Phase 7 — Execution Intelligence Layer
 *
 * 自适应执行引擎：根据成本模型动态调度执行计划。
 *
 * 核心能力：
 *   1. schedule: 根据预估成本计算优先级，生成排序后的执行计划
 *   2. adapt: 根据实时反馈（失败/耗时/成本）调整后续调度策略
 *   3. fallback: 在某些节点失败时降级执行方案
 */

import { CostModel, ExecutionCost } from './cost-model'

export interface ScheduleItem {
  id: string
  priority: number
  estimatedCost: ExecutionCost
  dependsOn: string[]
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
}

export interface AdaptationResult {
  adjustedMode: 'SPEED' | 'RELIABILITY' | 'BALANCED'
  reason: string
}

export class AdaptiveExecutor {
  private costModel = new CostModel()
  private failureCount = 0
  private totalLatency = 0
  private totalRuns = 0

  /**
   * 从 DAG blueprint 生成执行计划（按优先级排序）
   */
  schedule(blueprint: any): ScheduleItem[] {
    const raw = blueprint?.data ?? blueprint
    const items: ScheduleItem[] = []

    for (const scene of raw.scenes || []) {
      const cost = this.costModel.estimate(scene)
      items.push({
        id: scene.id,
        priority: cost.latency * 100 + cost.renderTime,
        estimatedCost: cost,
        dependsOn: this.findDependencies(scene, raw.scenes || []),
        status: 'PENDING',
      })

      for (const shot of scene.shots || []) {
        const shotCost = this.costModel.estimate(shot)
        items.push({
          id: shot.id,
          priority: shotCost.latency * 100 + shotCost.renderTime,
          estimatedCost: shotCost,
          dependsOn: [scene.id],
          status: 'PENDING',
        })
      }
    }

    // 按优先级排序（低数值 = 高优先级）
    items.sort((a, b) => a.priority - b.priority)

    return items
  }

  /**
   * 根据实时执行反馈调整执行模式
   */
  adapt(feedback: {
    failedItems: number
    totalItems: number
    avgLatency: number
    costOverThreshold: boolean
  }): AdaptationResult {
    this.failureCount += feedback.failedItems
    this.totalLatency += feedback.avgLatency
    this.totalRuns += feedback.totalItems

    // 失败率高 → 可靠性优先
    if (this.totalRuns > 0 && this.failureCount / this.totalRuns > 0.1) {
      return {
        adjustedMode: 'RELIABILITY',
        reason: `失败率 ${(this.failureCount / this.totalRuns * 100).toFixed(1)}%，切换到可靠性优先模式`,
      }
    }

    // 延迟过高 → 速度优先
    if (feedback.avgLatency > 3) {
      return {
        adjustedMode: 'SPEED',
        reason: `平均延迟 ${feedback.avgLatency.toFixed(1)}，切换到速度优先模式`,
      }
    }

    // 成本超标 → 均衡
    if (feedback.costOverThreshold) {
      return {
        adjustedMode: 'BALANCED',
        reason: '成本超阈值，切换到成本均衡模式',
      }
    }

    return { adjustedMode: 'BALANCED', reason: '运行正常，保持当前模式' }
  }

  /**
   * 在某个节点失败时提供降级方案
   */
  fallback(failedNodeId: string, blueprint: any): { action: 'SKIP_AND_CONTINUE' | 'RETRY' | 'ABORT'; reason: string } {
    const raw = blueprint?.data ?? blueprint

    // 判断是否是关键节点
    for (const scene of raw.scenes || []) {
      if (scene.id === failedNodeId) {
        // SCENE 失败 → 重试
        return { action: 'RETRY', reason: `场景 ${failedNodeId} 是关键节点，需重试` }
      }
      for (const shot of scene.shots || []) {
        if (shot.id === failedNodeId) {
          // SHOT 失败 → 跳过并继续（可取巧替代）
          return { action: 'SKIP_AND_CONTINUE', reason: `镜头 ${failedNodeId} 非关键节点，跳过继续` }
        }
      }
    }

    return { action: 'SKIP_AND_CONTINUE', reason: `节点 ${failedNodeId} 未知，跳过继续` }
  }

  /**
   * 查找场景间的依赖关系（基于场景顺序）
   */
  private findDependencies(scene: any, allScenes: any[]): string[] {
    const idx = allScenes.indexOf(scene)
    if (idx <= 0) return []
    return [allScenes[idx - 1].id]
  }
}
