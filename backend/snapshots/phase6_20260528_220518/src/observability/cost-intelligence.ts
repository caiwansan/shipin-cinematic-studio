/**
 * observability/cost-intelligence.ts — 成本智能引擎
 *
 * 功能：
 * - 每个请求的成本估算
 * - 按用户/项目/provider/功能聚合
 * - 成本热力图
 * - 成本趋势
 */

import { prisma } from '../utils/index.js'

// 各 provider 按任务类型的单位成本 ($)
const UNIT_COST: Record<string, Record<string, number>> = {
  deepseek:    { llm: 0.0005, image: 0, tts: 0, video: 0 },
  openai:      { llm: 0.01, image: 0.04, tts: 0.015, video: 0 },
  siliconflow: { llm: 0.001, image: 0.01, tts: 0.002, video: 0 },
  volcengine:  { llm: 0, image: 0.008, tts: 0, video: 0.05 },
  kling:       { llm: 0, image: 0, tts: 0, video: 0.08 },
  replicate:   { llm: 0, image: 0.02, tts: 0, video: 0 },
  aliyun:      { llm: 0, image: 0, tts: 0.003, video: 0 },
}

// 是否平台 key
function isPlatformProvider(provider: string): boolean {
  return !provider.startsWith('user:')
}

export const costIntelligence = {
  /**
   * 估算单次调用成本
   */
  estimateCost(provider: string, taskType: string, tokens?: { input: number; output: number }): number {
    const providerCosts = UNIT_COST[provider]
    if (!providerCosts) return 0.001  // 未知 provider 默认

    const baseCost = providerCosts[taskType] || 0.001

    // 如果有 token 数，基于 token 算
    if (tokens) {
      return (tokens.input / 1000) * (baseCost * 0.3) + (tokens.output / 1000) * (baseCost * 0.7)
    }

    return baseCost
  },

  /**
   * 记录一次成本
   */
  async recordCost(params: {
    userId: string
    projectId?: string
    taskId?: string
    provider: string
    taskType: string
    isPlatformKey: boolean
    latency?: number
    tokens?: { input: number; output: number }
  }): Promise<number> {
    const { userId, projectId, provider, taskType, isPlatformKey, tokens } = params
    const cost = this.estimateCost(provider, taskType, tokens)

    // 只记录平台 key 的成本
    if (!isPlatformKey) return 0

    try {
      // 写入 DB（异步，不阻塞）
      await prisma.usageLog.create({
        data: {
          userId,
          projectId,
          cost,
          taskType,
          provider,
          tokens: tokens ? JSON.stringify(tokens) : null,
          isPlatform: true,
        },
      }).catch(() => {}) // 静默失败，不中断业务
    } catch {}

    return cost
  },

  /**
   * 获取用户成本排名
   */
  async getUserCostRanking(days: number = 7, limit: number = 10): Promise<{
    userId: string
    totalCost: number
    requestCount: number
    avgCostPerRequest: number
  }[]> {
    const since = new Date(Date.now() - days * 86400_000)
    const results = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { cost: true },
      _count: { id: true },
      orderBy: { _sum: { cost: 'desc' } },
      take: limit,
    })

    return results.map(r => ({
      userId: r.userId.substring(0, 12) + '...',
      totalCost: Math.round((r._sum.cost || 0) * 1000) / 1000,
      requestCount: r._count.id,
      avgCostPerRequest: r._count.id > 0
        ? Math.round(((r._sum.cost || 0) / r._count.id) * 10000) / 10000
        : 0,
    }))
  },

  /**
   * 获取按功能分类的成本
   */
  async getCostByFeature(days: number = 7): Promise<Record<string, number>> {
    const since = new Date(Date.now() - days * 86400_000)
    const results = await prisma.usageLog.groupBy({
      by: ['taskType'],
      where: { createdAt: { gte: since } },
      _sum: { cost: true },
    })

    const map: Record<string, number> = {}
    for (const r of results) {
      map[r.taskType] = Math.round((r._sum.cost || 0) * 1000) / 1000
    }
    return map
  },

  /**
   * 获取按 provider 分类的成本
   */
  async getCostByProvider(days: number = 7): Promise<Record<string, number>> {
    const since = new Date(Date.now() - days * 86400_000)
    const results = await prisma.usageLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since } },
      _sum: { cost: true },
    })

    const map: Record<string, number> = {}
    for (const r of results) {
      map[r.provider] = Math.round((r._sum.cost || 0) * 1000) / 1000
    }
    return map
  },
}
