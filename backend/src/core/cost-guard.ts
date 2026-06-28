/**
 * core/cost-guard.ts — 成本控制守卫
 *
 * 防止平台 API 成本失控：
 * - 单用户成本跟踪
 * - 单 provider 成本跟踪
 * - 成本阈值告警
 * - 自动限流降级
 */

import { prisma } from '../utils/index.js'

// 各 provider 的估算成本（每请求，美元）
const PROVIDER_COST_ESTIMATE: Record<string, Record<string, number>> = {
  image: {
    volcengine: 0.008,
    openai: 0.04,
    siliconflow: 0.01,
    replicate: 0.02,
  },
  tts: {
    siliconflow: 0.002,
    openai: 0.015,
  },
  video: {
    volcengine: 0.05,
    kling: 0.08,
  },
  llm: {
    deepseek: 0.001,
    openai: 0.01,
    siliconflow: 0.002,
  },
}

// 默认成本（未知 provider）
const DEFAULT_COST = 0.01

/**
 * 日成本上限
 */
const DAILY_COST_LIMITS: Record<string, number> = {
  free: 0.05,        // free 用户每天上限 $0.05
  basic: 0.20,       // basic 用户每天上限 $0.20
  vip: 2.00,         // vip 每天上限 $2.00（软上限，可超）
  premium: 5.00,     // premium 每天上限 $5.00
}

export const costGuard = {
  /**
   * 估算一次请求的成本
   */
  estimateCost(taskType: string, provider: string): number {
    const providerCosts = PROVIDER_COST_ESTIMATE[taskType]
    if (!providerCosts) return DEFAULT_COST
    return providerCosts[provider] || DEFAULT_COST
  },

  /**
   * 记录一次成本消耗
   */
  async recordCost(params: {
    userId: string
    projectId?: string
    taskType: string
    provider: string
    isPlatformKey: boolean
    latencyMs?: number
  }): Promise<{ 
    dailyCost: number
    overLimit: boolean 
    limit: number
  }> {
    const { userId, projectId, taskType, provider, isPlatformKey } = params
    const cost = this.estimateCost(taskType, provider)

    // 只跟踪平台 key 的成本（用户 BYO 不消耗平台资金）
    if (!isPlatformKey) {
      return { dailyCost: 0, overLimit: false, limit: Infinity }
    }

    // 获取用户等级
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true, membership: { select: { tier: true } } },
    })
    const { getEffectiveTier } = await import('../utils/membership-tier.js')
    const tier = getEffectiveTier({ membership: user?.membership, memberTier: user?.memberTier })
    const dailyLimit = DAILY_COST_LIMITS[tier] || DAILY_COST_LIMITS.free

    // 记录到数据库
    const today = getTodayUTC()
    const usage = await prisma.dailyUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        imageCount: { increment: taskType === 'image' ? 1 : 0 },
        ttsCount: { increment: taskType === 'tts' ? 1 : 0 },
        llmCount: { increment: taskType === 'llm' ? 1 : 0 },
        videoCount: { increment: taskType === 'video' ? 1 : 0 },
      },
      create: {
        userId,
        date: today,
        imageCount: taskType === 'image' ? 1 : 0,
        ttsCount: taskType === 'tts' ? 1 : 0,
        llmCount: taskType === 'llm' ? 1 : 0,
        videoCount: taskType === 'video' ? 1 : 0,
      },
    })

    // 估算总成本（按各类型计费）
    const totalCost = 
      (usage.imageCount || 0) * this.estimateCost('image', provider) +
      (usage.ttsCount || 0) * this.estimateCost('tts', provider) +
      (usage.llmCount || 0) * this.estimateCost('llm', provider) +
      (usage.videoCount || 0) * this.estimateCost('video', provider)

    // 软上限（VIP）：超过后告警但不阻止
    // 硬上限（free/basic）：超过后阻止
    const isHardLimit = tier === 'free' || tier === 'basic'
    const overLimit = isHardLimit && totalCost > dailyLimit

    console.log(`[CostGuard] ${tier} user ${userId.substring(0,8)}: $${totalCost.toFixed(4)} / $${dailyLimit.toFixed(2)} (${provider}, ${overLimit ? 'OVER' : 'ok'})`)

    return { dailyCost: totalCost, overLimit, limit: dailyLimit }
  },

  /**
   * 获取用户当前成本统计
   */
  async getUserCost(userId: string): Promise<{
    todayCost: number
    dailyLimit: number
    tier: string
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true, membership: { select: { tier: true } } },
    })
    const { getEffectiveTier } = await import('../utils/membership-tier.js')
    const tier = getEffectiveTier({ membership: user?.membership, memberTier: user?.memberTier })
    const dailyLimit = DAILY_COST_LIMITS[tier] || DAILY_COST_LIMITS.free

    const today = getTodayUTC()
    const usage = await prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (!usage) return { todayCost: 0, dailyLimit, tier }

    // 用最近一次使用的 provider 估算（为简化按平均值）
    const avgCost = 0.01
    const totalCost = 
      (usage.imageCount || 0) * (PROVIDER_COST_ESTIMATE.image?.volcengine || avgCost) +
      (usage.ttsCount || 0) * (PROVIDER_COST_ESTIMATE.tts?.siliconflow || avgCost) +
      (usage.llmCount || 0) * (PROVIDER_COST_ESTIMATE.llm?.deepseek || avgCost) +
      (usage.videoCount || 0) * (PROVIDER_COST_ESTIMATE.video?.volcengine || avgCost)

    return { todayCost: totalCost, dailyLimit, tier }
  },
}

function getTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
