import { prisma } from '../../utils/index.js'

/**
 * 发帖奖励：+5 积分（写入 Membership.credits —— 前端 coins/会员中心的积分体系）
 * 注意：User 模型无 coins 字段，旧实现写 user.coins 会抛错被 catch 吞掉（从未生效）
 */
export async function rewardPostCreation(userId: string): Promise<void> {
  // 确保 Membership 存在（与 upload 逻辑一致）
  await prisma.membership.upsert({
    where: { userId },
    update: {},
    create: { userId, tier: 'free' },
  })
  await prisma.membership.update({
    where: { userId },
    data: { credits: { increment: 5 } },
  })
  await prisma.coinLog.create({
    data: {
      userId,
      amount: 5,
      type: 'reward',
      remark: '社区发帖奖励',
    },
  }).catch(() => {})
}

/**
 * 评论奖励：+1 积分
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
