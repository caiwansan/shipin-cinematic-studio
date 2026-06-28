/**
 * P7 — PatternLearner（模式学习器）
 *
 * 从历史执行模式中学习最优调度策略。
 * 基于加权滑动窗口算法，自动调整 routing 权重。
 *
 * ═══ 宪法 ═══
 * 学习器不能破坏运行时稳定。
 * 学习结果通过调节权重生效，不直接修改路由代码。
 */

import { ExecutionPattern } from './execution-pattern.js'
import { Capability } from '../runtime/capabilities.js'

export interface LearnedWeights {
  latencyWeight: number
  costWeight: number
  loadWeight: number
  confidence: number  // 0-1, 置信度
  samples: number
  lastUpdated: number
}

export interface LearningInsight {
  capability: string
  bestRegion: string
  avgLatency: number
  avgCost: number
  successRate: number
  weights: LearnedWeights
}

class PatternLearner {
  private patterns: ExecutionPattern[] = []
  private maxPatterns = 1000

  /**
   * 记录执行模式
   */
  record(pattern: ExecutionPattern): void {
    this.patterns.push(pattern)
    if (this.patterns.length > this.maxPatterns) {
      this.patterns.shift()
    }
  }

  /**
   * 学习最优权重
   */
  learnWeights(capability: Capability): LearnedWeights {
    const relevant = this.patterns.filter(p => p.capability === capability)

    if (relevant.length < 10) {
      return {
        latencyWeight: 0.4,
        costWeight: 0.3,
        loadWeight: 0.3,
        confidence: relevant.length / 10,
        samples: relevant.length,
        lastUpdated: Date.now(),
      }
    }

    // 计算最近 50 个样本的分布
    const recent = relevant.slice(-50)
    const successRate = recent.filter(r => r.success).length / recent.length
    const avgLatency = recent.reduce((s, r) => s + r.actualLatency, 0) / recent.length
    const avgCost = recent.reduce((s, r) => s + r.actualCost, 0) / recent.length

    // 自适应权重：延迟高则提高延迟权重，成本高则提高成本权重
    const latencyFactor = 1 + (avgLatency / 200) // 基准 200ms
    const costAvoidance = 1 - avgCost

    return {
      latencyWeight: Math.min(0.4 * latencyFactor, 0.8),
      costWeight: Math.min(0.3 * (1 + costAvoidance), 0.6),
      loadWeight: 1 - Math.min(0.4 * latencyFactor, 0.8) - Math.min(0.3 * (1 + costAvoidance), 0.6),
      confidence: Math.min(successRate, 1),
      samples: relevant.length,
      lastUpdated: Date.now(),
    }
  }

  /**
   * 获取学习洞察
   */
  getInsights(): LearningInsight[] {
    const capabilities = [...new Set(this.patterns.map(p => p.capability))]
    return capabilities.map(cap => {
      const patterns = this.patterns.filter(p => p.capability === cap)
      const weights = this.learnWeights(cap as Capability)

      // 找最佳区域
      const regions = [...new Set(patterns.map(p => p.selectedRegion))]
      let bestRegion = regions[0]
      let bestLatency = Infinity
      for (const region of regions) {
        const avg = patterns.filter(p => p.selectedRegion === region).reduce((s, r) => s + r.actualLatency, 0) /
          patterns.filter(p => p.selectedRegion === region).length
        if (avg < bestLatency) {
          bestLatency = avg
          bestRegion = region
        }
      }

      return {
        capability: cap,
        bestRegion,
        avgLatency: patterns.reduce((s, r) => s + r.actualLatency, 0) / patterns.length,
        avgCost: patterns.reduce((s, r) => s + r.actualCost, 0) / patterns.length,
        successRate: patterns.filter(r => r.success).length / patterns.length,
        weights,
      }
    })
  }

  /**
   * 获取所有原始模式（用于分析）
   */
  getPatterns(): ExecutionPattern[] {
    return [...this.patterns]
  }
}

export const patternLearner = new PatternLearner()
