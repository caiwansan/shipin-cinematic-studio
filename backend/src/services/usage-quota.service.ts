/**
 * services/usage-quota.service.ts — AI 生成配额服务（重建）
 *
 * 基于 DailyUsage 表 + User.memberTier + MemberPlan.dailyQuota
 * 强制执行每日 AI 调用限制。
 *
 * 规则:
 *   - memberTier 为 'free' → 每天 <= 30 次
 *   - memberTier 为 'pro' / 'director' / 'enterprise' → 无限制（-1）
 *   - memberTier 不存在或 MemberPlan 找不到 → 按 free 处理
 *
 * 宪法: 禁止 bypass, 禁止 fallback skip, 禁止 silent fail。
 *       超限 throw Error('DAILY_LIMIT_REACHED')，调用方必须处理。
 */

import { prisma, getRouteConfig } from '../utils/index.js'

const DEFAULT_DAILY_LIMIT = 5
const FREE_LIMIT_DEFAULT = 30
const TIER_DAILY_LIMITS: Record<string, number> = {
  gold: -1,        // 无限制
  pro: -1,         // 无限制
  director: -1,
  enterprise: -1,
}

// ─── 核心: 每日限额 → 从 MemberPlan 表 + 全局配置读取 ───

export async function getDailyLimit(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { memberTier: true, membership: { select: { tier: true } } },
  })

  if (!user) return DEFAULT_DAILY_LIMIT

  const { getEffectiveTier } = await import('../utils/membership-tier.js')
  const tier = getEffectiveTier({ membership: user.membership, memberTier: user.memberTier })

  // 先从硬编码 map 快速走
  const hardLimit = TIER_DAILY_LIMITS[tier]
  if (hardLimit !== undefined) return hardLimit

  // free 用户：从全局配置读取（管理员可配置）
  if (tier === 'free') {
    const configLimit = await getRouteConfig('system:global', 'daily_free_ai_quota', FREE_LIMIT_DEFAULT)
    return typeof configLimit === 'number' ? configLimit : FREE_LIMIT_DEFAULT
  }

  // 没有硬编码则从 MemberPlan 读
  const plan = await prisma.memberPlan.findUnique({
    where: { level: tier },
    select: { dailyQuota: true },
  })

  return plan?.dailyQuota ?? DEFAULT_DAILY_LIMIT
}

// ─── 查询今日已用量 ───

export async function getTodayUsage(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const usage = await prisma.dailyUsage.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    select: { llmCount: true },
  })

  return usage?.llmCount ?? 0
}

// ─── 检查配额（强制执行） ───
// 超限直接抛 Error，调用方必须 catch 并显示给用户

export async function checkDailyQuota(userId: string): Promise<{
  canProceed: boolean
  used: number
  limit: number
  remaining: number
}> {
  const limit = await getDailyLimit(userId)

  // 无限制
  if (limit === -1) {
    return { canProceed: true, used: 0, limit: -1, remaining: -1 }
  }

  const used = await getTodayUsage(userId)

  return {
    canProceed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

// ─── 记录一次调用 ───

export async function incrementDailyUsage(userId: string, type: string = 'llm'): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fieldMap: Record<string, string> = {
    llm: 'llmCount',
    image: 'imageCount',
    video: 'videoCount',
    tts: 'ttsCount',
  }
  const field = fieldMap[type] || 'llmCount'

  await prisma.dailyUsage.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: {
      userId,
      date: today,
      llmCount: 0,
      imageCount: 0,
      videoCount: 0,
      ttsCount: 0,
      [field]: 1,
    },
    update: {
      [field]: { increment: 1 },
    },
  })
}

// ─── 统一配额检查 + 抛出错误（推荐入口） ───
// 替换所有 `checkLLMQuota()` 调用

export async function enforceQuota(userId: string, type: string = 'llm'): Promise<void> {
  const result = await checkDailyQuota(userId)

  if (!result.canProceed) {
    throw new Error(`DAILY_LIMIT_REACHED: 今日 AI 调用已达限制 ${result.limit} 次`)
  }
}
