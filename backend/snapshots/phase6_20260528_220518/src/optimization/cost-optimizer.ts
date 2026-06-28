/**
 * optimization/cost-optimizer.ts — 成本优化引擎
 *
 * 根据使用模式、provider 定价、任务频率分布，
 * 自动推荐/执行成本优化策略。
 */

import { costIntelligence } from '../observability/cost-intelligence.js'
import { getProviderScore } from './router-learning.js'

interface CostOptimizationSuggestion {
  taskType: string
  currentProvider: string
  recommendedProvider: string
  costReductionPct: number
  latencyImpactPct: number
  scoreDiff: number
  confidence: 'high' | 'medium' | 'low'
}

// Provider 成本表（按任务类型，单位 $/次）
const PROVIDER_COST: Record<string, Record<string, number>> = {
  deepseek:    { llm: 0.0005, image: 0.005, tts: 0.001, video: 0.02 },
  siliconflow: { llm: 0.001,  image: 0.01,  tts: 0.002, video: 0.02 },
  openai:      { llm: 0.01,   image: 0.04,  tts: 0.015, video: 0.06 },
  volcengine:  { llm: 0.002,  image: 0.008, tts: 0.002, video: 0.05 },
  kling:       { llm: 0.005,  image: 0.02,  tts: 0.005, video: 0.08 },
}

export const costOptimizer = {
  /**
   * 获取成本优化建议（单任务类型的 provider 轮换）
   */
  getOptimizationSuggestions(taskType: string): CostOptimizationSuggestion[] {
    const providers = Object.keys(PROVIDER_COST)
      .filter(p => (PROVIDER_COST[p][taskType] || 0) > 0)
      .map(p => ({
        provider: p,
        cost: PROVIDER_COST[p][taskType] || 0,
        score: getProviderScore(p),
      }))
      .sort((a, b) => b.score - a.score)

    if (providers.length < 2) return []

    const best = providers[0]  // 当前评分最高的
    const cheapest = [...providers].sort((a, b) => a.cost - b.cost)[0]

    const suggestions: CostOptimizationSuggestion[] = []

    // 如果最便宜的不是评分最高的，看是否有优化空间
    if (cheapest.provider !== best.provider) {
      const costReduction = ((best.cost - cheapest.cost) / best.cost) * 100
      const scoreDiff = best.score - cheapest.score
      const latencyImpact = Math.max(0, (1 - cheapest.score / best.score) * 50)

      if (costReduction > 10) {  // 至少节省 10%
        suggestions.push({
          taskType,
          currentProvider: best.provider,
          recommendedProvider: cheapest.provider,
          costReductionPct: Math.round(costReduction),
          latencyImpactPct: Math.round(latencyImpact),
          scoreDiff: Math.round(scoreDiff * 100) / 100,
          confidence: costReduction > 30 ? 'high' : costReduction > 20 ? 'medium' : 'low',
        })
      }
    }

    // 检查是否有多个评分相近但成本差异大的
    for (let i = 1; i < Math.min(providers.length, 3); i++) {
      const alt = providers[i]
      if (alt.cost < best.cost * 0.7 && alt.score > best.score * 0.85) {
        // 成本低 30%+ 且评分只差 15% 以内，值得推荐
        const costReduction = ((best.cost - alt.cost) / best.cost) * 100
        suggestions.push({
          taskType,
          currentProvider: best.provider,
          recommendedProvider: alt.provider,
          costReductionPct: Math.round(costReduction),
          latencyImpactPct: Math.round((1 - alt.score / best.score) * 30),
          scoreDiff: Math.round((best.score - alt.score) * 100) / 100,
          confidence: 'medium',
        })
      }
    }

    return suggestions
  },

  /**
   * 根据用户等级选择最优成本策略
   */
  getProviderRankingForTier(tier: string, taskType: string): string[] {
    const providers = Object.keys(PROVIDER_COST)
      .filter(p => (PROVIDER_COST[p][taskType] || 0) > 0)
      .map(p => ({
        provider: p,
        cost: PROVIDER_COST[p][taskType] || Infinity,
        score: getProviderScore(p),
      }))

    if (tier === 'free' || tier === 'basic') {
      // 免费/基础用户：严格按成本排序
      return providers.sort((a, b) => a.cost - b.cost).map(p => p.provider)
    }

    if (tier === 'vip') {
      // VIP：平衡成本与质量
      return providers.sort((a, b) => (b.score - b.cost / 0.04 * 0.2) - (a.score - a.cost / 0.04 * 0.2)).map(p => p.provider)
    }

    if (tier === 'premium') {
      // Premium：优先质量
      return providers.sort((a, b) => b.score - a.score).map(p => p.provider)
    }

    // 默认：评分排序
    return providers.sort((a, b) => b.score - a.score).map(p => p.provider)
  },

  /**
   * 估算使用推荐后的成本节省
   */
  estimateSavings(taskType: string, monthlyCalls: number): {
    currentMonthlyCost: number
    optimizedMonthlyCost: number
    savingPct: number
  } {
    const providers = Object.keys(PROVIDER_COST)
      .filter(p => (PROVIDER_COST[p][taskType] || 0) > 0)
      .map(p => ({
        provider: p,
        cost: PROVIDER_COST[p][taskType] || 0,
        score: getProviderScore(p),
      }))

    if (providers.length === 0) return { currentMonthlyCost: 0, optimizedMonthlyCost: 0, savingPct: 0 }

    // 当前：使用评分最高的
    const best = providers.sort((a, b) => b.score - a.score)[0]
    const currentCost = best.cost * monthlyCalls

    // 优化后：使用最便宜且可接受的
    const cheapest = providers.sort((a, b) => a.cost - b.cost)[0]
    const optimizedCost = cheapest.cost * monthlyCalls

    return {
      currentMonthlyCost: Math.round(currentCost * 100) / 100,
      optimizedMonthlyCost: Math.round(optimizedCost * 100) / 100,
      savingPct: currentCost > 0 ? Math.round((1 - optimizedCost / currentCost) * 100) : 0,
    }
  },
}
