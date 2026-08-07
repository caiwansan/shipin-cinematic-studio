import { prisma } from '../../utils/index.js'

/**
 * 社区帖子审核共享逻辑（COMMUNITY-MODERATOR-01）
 * 站长（AdminUser）与版主（CommunityModerator）共用同一套审核行为：
 * - approve：status=approved + reviewedBy/reviewedAt；首次通过才计分类计数 + 发放发帖奖励
 * - reject：status=rejected + 驳回原因；不扣已发放奖励（驳回场景 = 内容不合规，帖子不可见即可）
 */

export async function approvePost(postId: string, reviewedBy: string): Promise<{ ok: boolean; error?: string }> {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, category: true, userId: true, status: true },
  })
  if (!post) return { ok: false, error: '帖子不存在' }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { status: 'approved', reviewedBy, reviewedAt: new Date() },
  })
  // 首次通过才计入分类计数 + 发放钻石（驳回后重新通过的场景不重复计数/奖励）
  if (post.status !== 'approved') {
    try {
      await prisma.communityCategory.updateMany({
        where: { name: post.category },
        data: { postCount: { increment: 1 } },
      })
    } catch (e) {
      console.warn('[community-moderation] 更新分类计数失败:', e instanceof Error ? e.message : e)
    }
    try {
      const { rewardPostCreation } = await import('./community-reward.service.js')
      await rewardPostCreation(post.userId, post.id)
    } catch (e) {
      console.warn('[community-moderation] 发帖奖励失败:', e instanceof Error ? e.message : e)
    }
  }
  return { ok: true }
}

export async function rejectPost(
  postId: string,
  reviewedBy: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  })
  if (!post) return { ok: false, error: '帖子不存在' }

  await prisma.communityPost.update({
    where: { id: postId },
    data: {
      status: 'rejected',
      rejectReason: reason || null,
      reviewedBy,
      reviewedAt: new Date(),
    },
  })
  return { ok: true }
}

/**
 * 软删（版主删帖）：status=deleted，保留数据可追溯；与站长硬删（事务删除）区分
 */
export async function softDeletePost(postId: string, reviewedBy: string): Promise<{ ok: boolean; error?: string }> {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } })
  if (!post) return { ok: false, error: '帖子不存在' }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { status: 'deleted', reviewedBy, reviewedAt: new Date() },
  })
  return { ok: true }
}

/**
 * 版主身份校验（JWT 已通过 authenticate 之后调用）
 * @returns active 版主记录；非版主返回 null
 */
export async function getActiveModerator(userId: string) {
  const mod = await prisma.communityModerator.findUnique({ where: { userId } })
  if (!mod || mod.status !== 'active') return null
  return mod
}
