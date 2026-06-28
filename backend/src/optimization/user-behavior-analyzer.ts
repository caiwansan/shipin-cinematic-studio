/**
 * optimization/user-behavior-analyzer.ts — 用户行为分析器
 *
 * 分析用户请求模式，推荐个性化限流策略和路由优先级
 */

import { prisma } from '../utils/index.js'

export type UserType = 'heavy_creator' | 'normal' | 'burst_user' | 'inactive'

interface UserProfile {
  userId: string
  userType: UserType
  requestCount24h: number
  cost24h: number
  failureRate: number
  avgTaskComplexity: 'low' | 'medium' | 'high'
  recommendedRateLimit: number
  routingPriority: number
  suggestion: string
}

/**
 * 分析单用户画像
 */
export async function analyzeUser(userId: string, tier: string): Promise<UserProfile> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 3600_000)

  const [taskCount, failedCount, costResult] = await Promise.all([
    prisma.videoTask.count({
      where: { creatorId: userId, createdAt: { gte: oneDayAgo } } as any,
    }),
    prisma.videoTask.count({
      where: { creatorId: userId, createdAt: { gte: oneDayAgo }, status: 'failed' } as any,
    }),
    prisma.usageLog.aggregate({
      where: { userId, createdAt: { gte: oneDayAgo } },
      _sum: { cost: true },
    }),
  ])

  const cost24h = Math.round((costResult._sum.cost || 0) * 1000) / 1000
  const failureRate = taskCount > 0 ? failedCount / taskCount : 0

  let userType: UserType = 'normal'
  let recommendedRateLimit = tier === 'premium' ? 20 : tier === 'vip' ? 10 : tier === 'basic' ? 5 : 3
  let routingPriority = tier === 'premium' ? 5 : tier === 'vip' ? 4 : tier === 'basic' ? 2 : 1
  let suggestion = ''

  if (taskCount === 0) {
    userType = 'inactive'
  } else if (taskCount > 50) {
    userType = 'heavy_creator'
    recommendedRateLimit = Math.min(recommendedRateLimit * 2, 30)
    routingPriority = Math.min(routingPriority + 1, 5)
    suggestion = 'High volume creator — consider upgrading to premium'
  } else if (taskCount > 10) {
    const burstCount = await prisma.videoTask.count({
      where: { creatorId: userId, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } } as any,
    })
    if (burstCount > taskCount * 0.5) {
      userType = 'burst_user'
      recommendedRateLimit = Math.max(recommendedRateLimit, tier === 'premium' ? 15 : 8)
      suggestion = 'Burst pattern detected — rate limit adjusted'
    }
  }

  if (failureRate > 0.3) {
    routingPriority = Math.max(routingPriority - 1, 1)
  }

  const avgTaskComplexity: UserProfile['avgTaskComplexity'] =
    taskCount > 20 ? 'high' : taskCount > 5 ? 'medium' : 'low'

  return {
    userId: userId.substring(0, 12) + '...',
    userType,
    requestCount24h: taskCount,
    cost24h,
    failureRate: Math.round(failureRate * 100) / 100,
    avgTaskComplexity,
    recommendedRateLimit,
    routingPriority,
    suggestion,
  }
}

/**
 * 批量分析活跃用户
 */
export async function analyzeAllActiveUsers(limit: number = 50): Promise<UserProfile[]> {
  const usersRaw = await (prisma.videoTask as any).groupBy({
    by: ['creatorId'],
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  })

  const profiles: UserProfile[] = []
  for (const user of usersRaw) {
    try {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.creatorId },
        select: { memberTier: true },
      })
      const profile = await analyzeUser(user.creatorId, userRecord?.memberTier || 'free')
      profiles.push(profile)
    } catch {}
  }

  return profiles
}
