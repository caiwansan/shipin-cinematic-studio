import { prisma } from '../../utils/index.js'

/**
 * 社区发帖奖励（钻石）— 掌柜 2026-08-07 12:48 定调：
 * 每天前 N 篇发帖有奖励（N = community_daily_post_limit，默认 20），之后发帖无奖励；发帖数量不限制。
 *
 * - 奖励 = SystemConfig `community_post_reward_diamonds`（默认 2 钻石/篇，后台可改）
 * - 判定按「发帖名次」而非审核顺序：统计该用户当天创建且不晚于本贴的帖子数 = 本贴当日名次，
 *   名次 <= 上限 → 奖励；否则跳过（帖子正常审核通过，只是无奖励）
 * - 非当日发帖（如昨天的帖子今天审核）不参与当天奖励
 * - 奖励写入 Membership.credits（= 用户钻石余额真源）+ CoinLog 流水 + CommunityPost.rewardCoins / CommunityReward 明细
 * 注意：User 模型无 coins 字段，旧实现写 user.coins 会抛错被 catch 吞掉（从未生效）
 */

const REWARD_REMARK = '社区发帖奖励'
const REGISTER_REWARD_REMARK = '注册奖励'

function clampPositive(v: unknown, fallback: number): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : fallback
}

/**
 * 注册赠送钻石（COMMUNITY-REGISTER-REWARD-01，掌柜 2026-08-07：注册送 10 钻石）
 * - 金额 = SystemConfig `community_register_reward_diamonds`（默认 10，后台可改；0 = 关闭）
 * - 写入 Membership.credits（钻石余额真源）+ CoinLog 流水（amount=实际赠送数，remark=注册奖励）
 * - 只在注册/自动建号流程内调用一次（天然幂等）
 */
export async function grantRegisterReward(userId: string): Promise<{ rewarded: boolean; diamonds: number }> {
  const row = await prisma.systemConfig.findUnique({ where: { key: 'community_register_reward_diamonds' } })
  const configured = Number(row?.value)
  const diamonds = Number.isFinite(configured) && configured >= 0 ? Math.floor(Math.min(configured, 1000)) : 10
  if (diamonds <= 0) {
    return { rewarded: false, diamonds: 0 }
  }
  await prisma.membership.upsert({
    where: { userId },
    update: {},
    create: { userId, tier: 'free' },
  })
  await prisma.membership.update({
    where: { userId },
    data: { credits: { increment: diamonds } },
  })
  await prisma.coinLog.create({
    data: { userId, amount: diamonds, type: 'reward', remark: REGISTER_REWARD_REMARK },
  }).catch(() => {})
  return { rewarded: true, diamonds }
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
 * 判定规则：仅当天发帖序列中前 dailyLimit 篇有奖励（按发帖名次，与审核顺序无关）
 * @param userId 发帖人
 * @param postId 帖子 id（必传；用于名次判定与明细落库）
 */
export async function rewardPostCreation(
  userId: string,
  postId: string
): Promise<{ rewarded: boolean; diamonds?: number; remaining?: number; reason?: string }> {
  const { rewardDiamonds, dailyLimit } = await getCommunityRewardConfig()

  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post) {
    return { rewarded: false, reason: '帖子不存在' }
  }

  // 当天窗口（服务器本地时区 = Asia/Shanghai 零点）
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  // 非当日发帖（昨天的帖子今天审核）不参与当天奖励
  if (post.createdAt < startOfDay || post.createdAt >= endOfDay) {
    return { rewarded: false, reason: '非当日发帖' }
  }

  // 名次判定：当天创建且不晚于本贴的帖子数（含本贴）= 本贴当天发帖名次
  const rank = await prisma.communityPost.count({
    where: {
      userId: post.userId,
      createdAt: { gte: startOfDay, lt: endOfDay, lte: post.createdAt },
    },
  })
  if (rank > dailyLimit) {
    return { rewarded: false, reason: `超出当日奖励名额（前 ${dailyLimit} 篇有奖）` }
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

  return { rewarded: true, diamonds: rewardDiamonds, remaining: Math.max(0, dailyLimit - rank) }
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
