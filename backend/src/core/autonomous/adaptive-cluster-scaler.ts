/**
 * P7 — AdaptiveClusterScaler（自适应集群扩缩器）
 *
 * 根据负载自动调整集群节点数量。
 * 基于滑动窗口负载检测。
 *
 * ═══ 宪法 ═══
 * 扩缩操作必须是安全的（不中断正在执行的任务）。
 * 收缩必须在节点空闲时执行。
 */

import { nodeRegistry } from '../cluster/node-registry.js'
import { createNode } from '../cluster/cluster-node.js'

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_change'
  reason: string
  suggestedCapacity: number
  currentCapacity: number
  avgLoad: number
}

class AdaptiveClusterScaler {
  private loadHistory: number[] = []
  private maxHistory = 20
  private minNodes = 1
  private maxNodes = 10
  private targetLoad = 0.7 // 目标负载 70%

  constructor() {
    // 每 15 秒采集一次负载采样
    setInterval(() => this.sampleLoad(), 15000)
  }

  /**
   * 采集负载样本
   */
  private sampleLoad(): void {
    const alive = nodeRegistry.getAliveNodes()
    if (alive.length === 0) return

    const avgLoad = alive.reduce((s, n) => s + n.load, 0) / alive.length
    this.loadHistory.push(avgLoad)
    if (this.loadHistory.length > this.maxHistory) {
      this.loadHistory.shift()
    }
  }

  /**
   * 做出扩缩决策
   */
  decide(): ScalingDecision {
    if (this.loadHistory.length < 5) {
      return { action: 'no_change', reason: '采样数据不足', currentCapacity: this.getCurrentCapacity(), suggestedCapacity: this.getCurrentCapacity(), avgLoad: this.getAvgLoad() }
    }

    const recentLoad = this.loadHistory.slice(-5)
    const avgLoad = recentLoad.reduce((s, l) => s + l, 0) / recentLoad.length
    const currentCapacity = this.getCurrentCapacity()

    // 负载高于目标 → 扩容
    if (avgLoad > this.targetLoad + 0.15 && currentCapacity < this.maxNodes) {
      const suggested = Math.min(currentCapacity + 1, this.maxNodes)
      return {
        action: 'scale_up',
        reason: `负载 ${(avgLoad * 100).toFixed(0)}% > 目标 ${(this.targetLoad * 100).toFixed(0)}%`,
        currentCapacity,
        suggestedCapacity: suggested,
        avgLoad,
      }
    }

    // 负载低于目标 → 缩容
    if (avgLoad < this.targetLoad - 0.3 && currentCapacity > this.minNodes) {
      const suggested = Math.max(currentCapacity - 1, this.minNodes)
      return {
        action: 'scale_down',
        reason: `负载 ${(avgLoad * 100).toFixed(0)}% < 目标 ${(this.targetLoad * 100).toFixed(0)}% - 30%`,
        currentCapacity,
        suggestedCapacity: suggested,
        avgLoad,
      }
    }

    return {
      action: 'no_change',
      reason: `负载 ${(avgLoad * 100).toFixed(0)}% 在正常范围`,
      currentCapacity,
      suggestedCapacity: currentCapacity,
      avgLoad,
    }
  }

  /**
   * 获取当前节点数
   */
  private getCurrentCapacity(): number {
    return nodeRegistry.getAliveNodes().length
  }

  /**
   * 获取平均负载
   */
  private getAvgLoad(): number {
    if (this.loadHistory.length === 0) return 0
    return this.loadHistory.slice(-5).reduce((s, l) => s + l, 0) / Math.min(5, this.loadHistory.length)
  }

  /**
   * 获取负载历史
   */
  getLoadHistory(): number[] {
    return [...this.loadHistory]
  }
}

export const adaptiveClusterScaler = new AdaptiveClusterScaler()
