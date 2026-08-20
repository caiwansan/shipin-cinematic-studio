// im-typing.service.ts — 输入状态（对方正在输入...）
import { prisma } from '../utils/index.js'

/**
 * 设置输入状态
 * @param uid 用户ID
 * @param channelId 频道ID（null表示不在输入）
 */
export async function setTyping(uid: string, channelId: string | null): Promise<void> {
  try {
    await prisma.imUserPresence.update({
      where: { uid },
      data: {
        typingInChannel: channelId,
        typingUpdatedAt: channelId ? new Date() : null,
      },
    })
  } catch (e) {
    // 不存在则忽略（用户可能没有 presence 记录）
  }
}

/**
 * 获取频道内正在输入的用户
 */
export async function getTypingUsers(channelId: string, excludeUid?: string): Promise<string[]> {
  try {
    const rows = await prisma.imUserPresence.findMany({
      where: {
        typingInChannel: channelId,
        online: true,
        typingUpdatedAt: { gte: new Date(Date.now() - 10_000) }, // 10s 内活跃
        ...(excludeUid ? { uid: { not: excludeUid } } : {}),
      },
      select: { uid: true },
    })
    return rows.map(r => r.uid)
  } catch {
    return []
  }
}

/**
 * 清理过期输入状态（定时任务调用）
 */
export async function cleanupTyping(): Promise<number> {
  try {
    const result = await prisma.imUserPresence.updateMany({
      where: {
        typingUpdatedAt: { lt: new Date(Date.now() - 15_000) },
        typingInChannel: { not: null },
      },
      data: { typingInChannel: null, typingUpdatedAt: null },
    })
    return result.count
  } catch {
    return 0
  }
}
