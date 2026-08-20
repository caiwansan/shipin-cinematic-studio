// im-message-status.service.ts — 消息状态追踪（已发送/已送达/已读）
import { prisma } from '../utils/index.js'

/**
 * 更新消息状态
 * @param messageId 消息ID
 * @param channelId 频道ID
 * @param status 0=sent 1=delivered 2=read
 * @param uid 操作人（送达=接收者，已读=阅读者）
 */
export async function updateMessageStatus(messageId: string, channelId: string, status: number, uid: string): Promise<void> {
  try {
    await prisma.imMessageStatus.upsert({
      where: { messageId_channelId: { messageId, channelId } },
      update: { status, updatedAt: new Date() },
      create: { messageId, channelId, senderUid: uid, status },
    })
  } catch (e) {
    console.warn('[消息状态] 更新失败（非致命）:', (e as Error).message)
  }
}

/**
 * 批量标记消息为已送达（收到消息时调用）
 */
export async function markDelivered(messageIds: string[], channelId: string, uid: string): Promise<void> {
  if (!messageIds.length) return
  try {
    const data = messageIds.map(msgId => ({
      messageId: msgId,
      channelId,
      channelType: 4,
      senderUid: uid,
      status: 1,
    }))
    await prisma.imMessageStatus.createMany({
      data,
      skipDuplicates: true,
    })
    // 更新状态为已送达
    await prisma.imMessageStatus.updateMany({
      where: { messageId: { in: messageIds }, channelId },
      data: { status: 1, updatedAt: new Date() },
    })
  } catch (e) {
    console.warn('[消息状态] 批量送达标记失败:', (e as Error).message)
  }
}

/**
 * 标记会话已读（打开聊天窗时调用）
 * @param uid 当前用户
 * @param channelId 频道ID
 * @param lastReadMessageId 最后已读消息ID
 */
export async function markConversationRead(uid: string, channelId: string, channelType: number, lastReadMessageId?: string): Promise<void> {
  try {
    await prisma.imConversationRead.upsert({
      where: { uid_channelId_channelType: { uid, channelId, channelType } },
      update: { lastReadMessageId, lastReadAt: new Date() },
      create: { uid, channelId, channelType, lastReadMessageId },
    })
    // 将该消息之前的所有消息标记为已读
    if (lastReadMessageId) {
      await prisma.imMessageStatus.updateMany({
        where: {
          channelId,
          senderUid: { not: uid },
          status: { lt: 2 },
        },
        data: { status: 2, updatedAt: new Date() },
      })
    }
  } catch (e) {
    console.warn('[消息状态] 会话已读标记失败:', (e as Error).message)
  }
}

/**
 * 获取消息状态（供前端查询）
 */
export async function getMessageStatus(messageIds: string[], channelId: string): Promise<Record<string, number>> {
  if (!messageIds.length) return {}
  try {
    const rows = await prisma.imMessageStatus.findMany({
      where: { messageId: { in: messageIds }, channelId },
      select: { messageId: true, status: true },
    })
    return rows.reduce((acc, r) => { acc[r.messageId] = r.status; return acc }, {} as Record<string, number>)
  } catch {
    return {}
  }
}

/**
 * 获取会话已读水位（当前用户在该会话读到哪里）
 */
export async function getConversationRead(uid: string, channelId: string, channelType: number): Promise<string | null> {
  try {
    const row = await prisma.imConversationRead.findUnique({
      where: { uid_channelId_channelType: { uid, channelId, channelType } },
      select: { lastReadMessageId: true },
    })
    return row?.lastReadMessageId || null
  } catch {
    return null
  }
}

/**
 * 获取群聊已读成员（群主/管理员查看）
 */
export async function getGroupReadMembers(channelId: string, messageId: string): Promise<string[]> {
  try {
    const rows = await prisma.imConversationRead.findMany({
      where: { channelId, lastReadMessageId: messageId },
      select: { uid: true },
    })
    return rows.map(r => r.uid)
  } catch {
    return []
  }
}
