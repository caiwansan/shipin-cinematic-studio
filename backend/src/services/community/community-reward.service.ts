import { prisma } from '../../utils/index.js'

/**
 * 发帖奖励：+5 积分
 */
export async function rewardPostCreation(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: 5 } },
    }),
    prisma.coinLog.create({
      data: {
        userId,
        amount: 5,
        type: 'reward',
        remark: '社区发帖奖励',
      },
    }),
  ])
}

/**
 * 评论奖励：+1 积分
 */
export async function rewardComment(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: 1 } },
    }),
    prisma.coinLog.create({
      data: {
        userId,
        amount: 1,
        type: 'reward',
        remark: '社区评论奖励',
      },
    }),
  ])
}
