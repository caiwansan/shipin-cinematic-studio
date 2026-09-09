#!/usr/bin/env python3
import io
path = '/root/shipin-cinematic-studio/backend/src/routes/im-groups.ts'
patch = r'''
  // ── 移交群主（仅群主本人；掌柜 2026-08-26 需求）──
  fastify.post('/api/im/groups/:id/transfer', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    if (group.ownerUid !== userId) return reply.status(403).send({ success: false, error: '仅群主可移交群主' })
    const targetUid = String((request.body as any)?.targetUid || '').trim()
    if (!targetUid || targetUid === userId) return reply.status(400).send({ success: false, error: '移交对象无效' })
    if (targetUid === BOT_UID) return reply.status(400).send({ success: false, error: '小管家不能当群主' })
    const targetRole = await groupRoleOf(group.id, targetUid)
    if (targetRole < GROUP_ROLE_MEMBER) return reply.status(404).send({ success: false, error: '对方不是群成员' })
    // 原群主降为管理员，目标升为群主
    await prisma.imChannelMember.updateMany({
      where: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: userId },
      data: { role: GROUP_ROLE_ADMIN },
    })
    await prisma.imChannelMember.upsert({
      where: { channelId_channelType_uid: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: targetUid } },
      update: { role: GROUP_ROLE_OWNER },
      create: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: targetUid, role: GROUP_ROLE_OWNER },
    })
    await prisma.imGroup.update({ where: { id: group.id }, data: { ownerUid: targetUid } })
    const op = await displayOf(userId)
    const target = await displayOf(targetUid)
    await groupSystemSend(group.id, `👑 ${op.name} 已将群主移交给 ${target.name}`)
    return { success: true, data: { ownerUid: targetUid } }
  })

  // ── 全员禁言 / 解除（群主/管理员；掌柜 2026-08-26 需求）──
  fastify.post('/api/im/groups/:id/mute-all', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可全员禁言' })
    const muted = Boolean((request.body as any)?.muted)
    const members = await prisma.imChannelMember.findMany({
      where: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE },
      select: { uid: true, role: true },
    })
    let count = 0
    for (const m of members) {
      if (m.role >= GROUP_ROLE_ADMIN) continue // 群主/管理员不禁
      try { await wkApi('/channel/member/update', { channel_id: groupChannelId(group.id), channel_type: GROUP_CHANNEL_TYPE, uid: m.uid, muted: muted ? 1 : 0 }) } catch (e) { /* 忽略单个失败 */ }
      count++
    }
    await groupSystemSend(group.id, muted ? `🔇 全员禁言已开启（${count} 名成员）` : '🔊 全员禁言已解除')
    return { success: true, data: { muted, count } }
  })

  // ── 群邀请码（确定性 6 位文本码 + 链接；掌柜 2026-08-26 需求）──
  fastify.get('/api/im/groups/:id/invite', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_MEMBER) return reply.status(403).send({ success: false, error: '仅群成员可获取邀请码' })
    let seed = 0
    const s = String(group.id)
    for (let i = 0; i < s.length; i++) { seed = (seed * 31 + s.charCodeAt(i)) >>> 0 }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    let n = seed
    for (let i = 0; i < 6; i++) { code += chars[n % chars.length]; n = Math.floor(n / chars.length) }
    const url = `https://aigc.fushtn.com/mobile-app?joinGroup=${group.id}&code=${code}`
    return { success: true, data: { code, url, groupId: group.id, name: group.name } }
  })
'''
src = io.open(path, encoding='utf-8').read()
if 'api/im/groups/:id/transfer' in src:
    print('ALREADY_INJECTED'); raise SystemExit(0)
idx = src.rstrip().rfind('\n}')
if idx == -1:
    idx = src.rfind('}')  # 最后 register 闭括号
tail = src[idx:]
head = src[:idx]
open(path, 'w', encoding='utf-8').write(head + '\n' + patch + tail)
print('INJECTED')
