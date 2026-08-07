import { prisma } from '../../utils/index.js'

/**
 * 社区发帖奖励（钻石）— 掌柜 2026-08-07 定调：每日限发 20 篇，每篇奖励 2 钻石
 *
 * - 奖励 = SystemConfig `community_post_reward_diamonds`（默认 2 钻石/篇，后台可改）
 * - 每日上限 = SystemConfig `community_daily_post_limit`（默认 20 篇/人/天，后台可改）
 *   发帖入口（POST /api/community/posts）硬限制当日创建数；此处再兜底：当日已奖励次数
 *   达到上限则跳过 —— 防止「昨天发的帖今天批量审核通过」突破每日奖励上限
 * - 奖励写入 Membership.credits（= 用户钻石余额真源）+ CoinLog 流水 + CommunityPost.rewardCoins / CommunityReward 明细
 * 注意：User 模型无 coins 字段，旧实现写 user.coins 会抛错被 catch 吞掉（从未生效）
 */

const REWARD_REMARK = '社区发帖奖励'

function clampPositive(v: unknown, fallback: number): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : fallback
}

async function getCommunityRewardConfig(): Promise<{ rewardDiamonds: number; dailyLimit: number }> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ['community_post_reward_diamonds', 'community_daily_post_limit'] } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    rewardDiamonds: clampPositive(map.community_post_reward_diamonds, 2),
    dailyLimit: clampPositive(map.community_daily_post_limit, 20),
  }
}

/**
 * 发帖奖励：审核通过时发放（默认 +2 钻石，写入 Membership.credits）
 * @param userId 发帖人
 * @param postId 帖子 id（可选；传入则同步记录 rewardCoins 与 CommunityReward 明细）
 */
export async function rewardPostCreation(
  userId: string,
  postId?: string
): Promise<{ rewarded: boolean; diamonds?: number; remaining?: number }> {
  const { rewardDiamonds, dailyLimit } = await getCommunityRewardConfig()

  // 每日奖励兜底：当天已发放的「发帖奖励」次数 >= 上限 → 跳过（防批量审核突破每日上限）
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayRewards = await prisma.coinLog.count({
    where: { userId, type: 'reward', remark: REWARD_REMARK, createdAt: { gte: startOfDay } },
  })
  if (todayRewards >= dailyLimit) {
    console.warn(`[community-reward] 用户 ${userId} 今日发帖奖励已达上限（${dailyLimit} 篇），跳过本次奖励`)
    return { rewarded: false }
  }

  // 确保 Membership 存在（与 upload 逻辑一致）
  await prisma.membership.upsert({
    where: { userId },
    update: {},
    create: { userId, tier: 'free' },
  })
  await prisma.membership.update({
    where: { userId },
    data: { credits: { increment: rewardDiamonds } },
  })
  await prisma.coinLog.create({
    data: { userId, amount: rewardDiamonds, type: 'reward', remark: REWARD_REMARK, relatedId: postId || null },
  }).catch(() => {})

  // 明细落库（失败不影响主流程）
  if (postId) {
    await prisma.communityPost.update({
      where: { id: postId },
      data: { rewardCoins: rewardDiamonds },
    }).catch(() => {})
    await prisma.communityReward.create({
      data: { postId, userId, coins: rewardDiamonds, remark: REWARD_REMARK },
    }).catch(() => {})
  }

  return { rewarded: true, diamonds: rewardDiamonds, remaining: dailyLimit - todayRewards - 1 }
}

/**
 * 评论奖励：+1 钻石
 */
export async function rewardComment(userId: string): Promise<void> {
  await prisma.membership.upsert({
    where: { userId },
    update: {},
    create: { userId, tier: 'free' },
  })
  await prisma.membership.update({
    where: { userId },
    data: { credits: { increment: 1 } },
  })
  await prisma.coinLog.create({
    data: {
      userId,
      amount: 1,
      type: 'reward',
      remark: '社区评论奖励',
    },
  }).catch(() => {})
}
