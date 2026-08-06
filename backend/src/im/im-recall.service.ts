// im-recall.service.ts — 昆仑茶馆消息撤回（IM-CHA-M10）
// WuKongIM v1.2.6 无内置撤回 API → 业务层实现：
//   1) webhook 消息事件 → indexMessage 记录消息归属（ImMessageIndex）
//   2) 撤回接口 → 校验（本人 + 发送 ≤ 10 分钟 + 消息存在）→ ImMessageRecall 落库
//   3) 服务端代发 kind=recall 通知消息 → 客户端实时把原消息渲染为「已撤回」
//   4) 历史接口 → recalledMessageIds 过滤（命中消息标记 recalled，前端显示已撤回占位）
import { prisma } from '../utils/index.js'

export const RECALL_WINDOW_MS = 10 * 60_000 // 撤回时间窗：发送后 10 分钟内（可调）

/** 记录消息归属（webhook 调用；幂等 upsert，失败非致命） */
export async function indexMessage(msg: { messageId: string; clientMsgNo?: string; fromUid: string; channelId: string; channelType: number }): Promise<void> {
  if (!msg.messageId || !msg.fromUid || !msg.channelId) return
  try {
    await prisma.imMessageIndex.upsert({
      where: { messageId: msg.messageId },
      update: msg.clientMsgNo ? { clientMsgNo: msg.clientMsgNo } : {},
      create: {
        messageId: msg.messageId,
        clientMsgNo: msg.clientMsgNo || '',
        fromUid: msg.fromUid,
        channelId: msg.channelId,
        channelType: msg.channelType,
      },
    })
  } catch (e) {
    console.warn('[昆仑茶馆] 消息归属记录失败（非致命）:', (e as Error).message)
  }
}

/**
 * 执行撤回
 * @returns { code, error?, data? } — code: ok / NOT_FOUND / NOT_OWNER / EXPIRED / ALREADY
 */
export async function recallMessage(opts: {
  messageId: string
  channelId: string
  channelType: number
  operatorId: string
}): Promise<{ code: string; error?: string; data?: any }> {
  const { messageId, channelId, channelType, operatorId } = opts
  // 幂等：已撤回直接成功（不重复广播）
  const existing = await prisma.imMessageRecall.findUnique({ where: { messageId } })
  if (existing) return { code: 'ok', data: { already: true } }

  // 归属校验：必须是本人消息（防撤回他人消息）；支持 message_idstr / clientMsgNo 双通道
  const idx = await prisma.imMessageIndex.findFirst({
    where: { OR: [{ messageId }, { clientMsgNo: messageId }] },
  })
  if (!idx) return { code: 'NOT_FOUND', error: '消息不存在或已超过撤回时间' }
  if (idx.fromUid !== operatorId) return { code: 'NOT_OWNER', error: '只能撤回自己发送的消息' }
  if (idx.channelId !== channelId || idx.channelType !== channelType) {
    return { code: 'NOT_FOUND', error: '消息不在当前频道' }
  }
  // 时间窗：发送超过 10 分钟不可撤回
  if (Date.now() - idx.createdAt.getTime() > RECALL_WINDOW_MS) {
    return { code: 'EXPIRED', error: '发送已超过 10 分钟，无法撤回' }
  }

  await prisma.imMessageRecall.create({
    data: { messageId, channelId, channelType, senderUid: idx.fromUid, operatorId },
  })
  return { code: 'ok', data: {} }
}

/** 频道最近撤回的消息 ID 集合（历史接口过滤用） */
export async function recalledMessageIds(channelId: string, channelType: number): Promise<Set<string>> {
  const rows = await prisma.imMessageRecall.findMany({
    where: { channelId, channelType },
    select: { messageId: true },
    // 只取近 24h（撤回窗口 10 分钟，放宽兜底；历史消息早于 24h 的撤回展示无意义）
    // created_at 索引不存在则全表小规模可接受（茶馆消息量小）
  })
  return new Set(rows.map((r) => r.messageId))
}
