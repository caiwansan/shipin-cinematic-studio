// im-groups.ts — 昆仑茶馆群聊生态（IM-CHA-R10，2026-08-06 掌柜指令）
// 覆盖：用户创建群 / 群列表 / 群聊收发（频道机制）/ 群管理（群主·管理员·成员三级权限）/
//      申请群管理（ChatGroupApply 申请流）/ R9 新群机器人自动入群（隐形管理员）
//
// 技术底座（与公共/私聊同模式，已验证全通）：
//   - 群频道 = grp_<groupId>，channel_type=4 显式私有频道 + subscriber_add
//   - 成员复用 imChannelMember（channelId=grp_<id>，role: 2=群主 1=管理员 0=成员）
//   - 群业务表 ImGroup（im_group）+ 申请流 ChatGroupApply（chat_group_apply）
import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { wkApi, serverSend, ensureMember, UUID_RE } from './im.js'
import { BOT_UID } from './im-moderation.routes.js'

const BOT_NAME = '昆仑镜小管家'
export const GROUP_CHANNEL_TYPE = 4
export const GROUP_ROLE_OWNER = 2
export const GROUP_ROLE_ADMIN = 1
export const GROUP_ROLE_MEMBER = 0

export function groupChannelId(groupId: string) {
  return `grp_${groupId}`
}

/** 我的角色：2 群主 / 1 管理员 / 0 成员 / -1 非成员 */
async function groupRoleOf(groupId: string, uid: string): Promise<number> {
  const row = await prisma.imChannelMember.findUnique({
    where: { channelId_channelType_uid: { channelId: groupChannelId(groupId), channelType: GROUP_CHANNEL_TYPE, uid } },
  })
  return row ? row.role : -1
}

async function getActiveGroup(groupId: string) {
  const g = await prisma.imGroup.findUnique({ where: { id: groupId } })
  if (!g || g.status !== 'active') return null
  return g
}

async function displayOf(uid: string): Promise<{ name: string; avatar: string }> {
  if (!UUID_RE.test(uid)) return { name: uid === BOT_UID ? BOT_NAME : uid, avatar: '' }
  const u = await prisma.user.findUnique({ where: { id: uid }, select: { username: true, nickname: true, email: true, avatarUrl: true } })
  if (!u) return { name: uid, avatar: '' }
  return { name: u.nickname || u.username || u.email.split('@')[0], avatar: u.avatarUrl || '' }
}

/** 代发群内系统消息（群创建/角色变更/审批结果等，bot 名义） */
async function groupSystemSend(groupId: string, text: string) {
  try {
    await serverSend(groupChannelId(groupId), GROUP_CHANNEL_TYPE, BOT_UID, 1, text)
  } catch (e) {
    console.warn(`[昆仑茶馆] 群系统消息代发失败 ${groupId}:`, (e as Error).message)
  }
}

/** 群成员 uids（含机器人） */
async function groupMemberUids(groupId: string): Promise<string[]> {
  const rows = await prisma.imChannelMember.findMany({
    where: { channelId: groupChannelId(groupId), channelType: GROUP_CHANNEL_TYPE },
    select: { uid: true },
  })
  return rows.map((r) => r.uid)
}

/** 启动时全量恢复所有 active 群订阅（WuKongIM 容器重启清空订阅表的自愈，对齐 restorePublicChannelSubscriptions） */
export async function restoreGroupSubscriptions() {
  try {
    const groups = await prisma.imGroup.findMany({ where: { status: 'active' }, select: { id: true } })
    for (const g of groups) {
      const chId = groupChannelId(g.id)
      await wkApi('/channel', {
        channel_id: chId,
        channel_type: GROUP_CHANNEL_TYPE,
        channel_name: g.id,
      })
      const uids = await groupMemberUids(g.id)
      for (let i = 0; i < uids.length; i += 500) {
        const batch = uids.slice(i, i + 500)
        await wkApi('/channel/subscriber_add', { channel_id: chId, channel_type: GROUP_CHANNEL_TYPE, subscribers: batch })
      }
    }
    console.log(`[昆仑茶馆] 启动恢复群订阅: ${groups.length} 个群`)
  } catch (e) {
    console.warn('[昆仑茶馆] 启动恢复群订阅失败（非致命）:', (e as Error).message)
  }
}

export default async function imGroupRoutes(fastify: FastifyInstance) {
  // ── 创建群（R10）：建群 + 建频道 + 群主入会 + 机器人自动入群（R9）+ 欢迎消息 ──
  fastify.post('/api/im/groups', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { name, intro = '', avatarUrl = '' } = (request.body as any) || {}
    const gname = String(name || '').trim()
    if (!gname || gname.length > 30) return reply.status(400).send({ success: false, error: '群名称必填且不超过 30 字' })
    if (String(intro).length > 200) return reply.status(400).send({ success: false, error: '群简介不超过 200 字' })

    const group = await prisma.imGroup.create({ data: { name: gname, intro: String(intro).trim(), avatarUrl: String(avatarUrl || ''), ownerUid: userId } })
    const chId = groupChannelId(group.id)
    const me = await displayOf(userId)

    // 建频道（幂等）+ 群主与机器人入会（R9 隐形管理员：不发言只监听，敏感词处置 webhook 全局生效）
    try {
      await wkApi('/channel', { channel_id: chId, channel_type: GROUP_CHANNEL_TYPE, channel_name: gname, channel_remark: intro })
      await wkApi('/channel/subscriber_add', {
        channel_id: chId,
        channel_type: GROUP_CHANNEL_TYPE,
        subscribers: [userId, BOT_UID],
      })
    } catch (e) {
      console.warn(`[昆仑茶馆] 建群频道失败 ${chId}:`, (e as Error).message)
    }
    await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid: userId, role: GROUP_ROLE_OWNER, name: me.name, avatar: me.avatar })
    await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid: BOT_UID, role: GROUP_ROLE_MEMBER, name: BOT_NAME, avatar: '' })

    await groupSystemSend(group.id, `🏮 群「${gname}」创建成功，小管家已入群隐身执勤（敏感词自动处置）`)
    return { success: true, data: { group: { id: group.id, channelId: chId, type: GROUP_CHANNEL_TYPE, name: gname, intro, avatarUrl, ownerUid: userId, groupRole: GROUP_ROLE_OWNER, memberCount: 2 } } }
  })

  // ── 我的群列表（与 /api/im/channels groups 同源；前端左栏直接消费 channels）──
  fastify.get('/api/im/groups', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const memberships = await prisma.imChannelMember.findMany({
      where: { uid: userId, channelId: { startsWith: 'grp_' } },
      orderBy: { joinedAt: 'desc' },
    })
    const ids = memberships.map((m) => m.channelId.slice(4))
    const rows = ids.length ? await prisma.imGroup.findMany({ where: { id: { in: ids }, status: 'active' } }) : []
    const map = new Map(rows.map((g) => [g.id, g]))
    const list = memberships
      .filter((m) => map.has(m.channelId.slice(4)))
      .map((m) => {
        const g = map.get(m.channelId.slice(4))!
        return { id: m.channelId, groupId: g.id, type: m.channelType, name: g.name, intro: g.intro, avatarUrl: g.avatarUrl, ownerUid: g.ownerUid, groupRole: m.role }
      })
    return { success: true, data: { groups: list } }
  })

  // ── 群详情（群信息 + 成员列表 + 我的角色）──
  fastify.get('/api/im/groups/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < 0) return reply.status(403).send({ success: false, error: '你不是该群成员' })

    const members = await prisma.imChannelMember.findMany({
      where: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    })
    const presences = await prisma.imUserPresence.findMany({ where: { uid: { in: members.map((m) => m.uid) } } })
    const presenceMap = new Map(presences.map((p) => [p.uid, p.online]))
    const uidsAll = members.map((m) => m.uid).filter((u) => UUID_RE.test(u))
    const avatarMap = new Map<string, string>()
    const nameMap = new Map<string, string>()
    if (uidsAll.length) {
      const users = await prisma.user.findMany({ where: { id: { in: uidsAll } }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
      for (const u of users) {
        avatarMap.set(u.id, u.avatarUrl || '')
        nameMap.set(u.id, u.nickname || u.username || u.email.split('@')[0])
      }
    }
    const memberList = members.map((m) => ({
      uid: m.uid,
      name: nameMap.get(m.uid) || m.name,
      avatar: avatarMap.get(m.uid) ?? m.avatar,
      role: m.role, // 2 群主 / 1 管理员 / 0 成员 / (bot 成员角色 0)
      isBot: m.uid === BOT_UID,
      online: !!presenceMap.get(m.uid),
      joinedAt: m.joinedAt,
    }))
    return { success: true, data: { group: { id: group.id, channelId: groupChannelId(group.id), type: GROUP_CHANNEL_TYPE, name: group.name, intro: group.intro, avatarUrl: group.avatarUrl, ownerUid: group.ownerUid, createdAt: group.createdAt }, myRole, members: memberList } }
  })

  // ── 修改群信息（群主/管理员）──
  fastify.patch('/api/im/groups/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可修改群信息' })

    const { name, intro, avatarUrl } = (request.body as any) || {}
    const data: any = {}
    if (name !== undefined) {
      const gname = String(name).trim()
      if (!gname || gname.length > 30) return reply.status(400).send({ success: false, error: '群名称必填且不超过 30 字' })
      data.name = gname
    }
    if (intro !== undefined) {
      if (String(intro).length > 200) return reply.status(400).send({ success: false, error: '群简介不超过 200 字' })
      data.intro = String(intro).trim()
    }
    if (avatarUrl !== undefined) data.avatarUrl = String(avatarUrl || '')
    const updated = await prisma.imGroup.update({ where: { id: group.id }, data })
    return { success: true, data: { group: updated } }
  })

  // ── 解散群（群主；删 WuKongIM 频道 + 清成员 + status=dissolved）──
  fastify.delete('/api/im/groups/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole !== GROUP_ROLE_OWNER || group.ownerUid !== userId) {
      return reply.status(403).send({ success: false, error: '仅群主可解散群' })
    }
    await prisma.imGroup.update({ where: { id: group.id }, data: { status: 'dissolved' } })
    await prisma.imChannelMember.deleteMany({ where: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE } })
    try {
      await wkApi('/channel/delete', { channel_id: groupChannelId(group.id), channel_type: GROUP_CHANNEL_TYPE })
    } catch (e) {
      console.warn(`[昆仑茶馆] 解散群删频道失败 ${group.id}:`, (e as Error).message)
    }
    return { success: true, data: { dissolved: true } }
  })

  // ── 邀请成员（群主/管理员；subscriber_add + 成员表；离线用户下次连接自动订阅）──
  fastify.post('/api/im/groups/:id/members', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可邀请成员' })

    const { uids } = (request.body as any) || {}
    if (!Array.isArray(uids) || !uids.length) return reply.status(400).send({ success: false, error: 'uids 必填' })
    const targets = [...new Set(uids.map((u: any) => String(u)).filter((u: string) => u && u !== BOT_UID))].slice(0, 50)
    if (!targets.length) return reply.status(400).send({ success: false, error: '没有可邀请的成员' })

    const chId = groupChannelId(group.id)
    try {
      await wkApi('/channel/subscriber_add', { channel_id: chId, channel_type: GROUP_CHANNEL_TYPE, subscribers: targets })
    } catch (e) {
      console.warn(`[昆仑茶馆] 群邀请订阅失败 ${chId}:`, (e as Error).message)
    }
    const invited = []
    for (const uid of targets) {
      const exist = await prisma.imChannelMember.findUnique({
        where: { channelId_channelType_uid: { channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid } },
      })
      if (exist) continue
      const disp = await displayOf(uid)
      await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid, role: GROUP_ROLE_MEMBER, name: disp.name, avatar: disp.avatar })
      invited.push(uid)
    }
    if (invited.length) {
      const op = await displayOf(userId)
      await groupSystemSend(group.id, `👋 ${op.name} 邀请了 ${invited.length} 位茶友进群`)
    }
    return { success: true, data: { invited } }
  })

  // ── 移出成员（群主/管理员；不能移群主/自己）──
  fastify.delete('/api/im/groups/:id/members/:uid', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可移出成员' })
    const targetUid = request.params.uid as string
    if (targetUid === userId) return reply.status(400).send({ success: false, error: '不能移出自己' })
    if (targetUid === BOT_UID) return reply.status(400).send({ success: false, error: '小管家是隐形管理员，不可移出' })
    if (targetUid === group.ownerUid) return reply.status(400).send({ success: false, error: '不能移出群主' })
    const targetRole = await groupRoleOf(group.id, targetUid)
    if (targetRole < 0) return reply.status(404).send({ success: false, error: '对方不是群成员' })
    // 管理员只能移普通成员；群主可移管理员
    if (myRole === GROUP_ROLE_ADMIN && targetRole >= GROUP_ROLE_ADMIN) {
      return reply.status(403).send({ success: false, error: '管理员不能移出管理员/群主' })
    }
    await prisma.imChannelMember.deleteMany({
      where: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: targetUid },
    })
    const op = await displayOf(userId)
    const target = await displayOf(targetUid)
    await groupSystemSend(group.id, `🚪 ${op.name} 将 ${target.name} 移出了群`)
    return { success: true, data: { removed: targetUid } }
  })

  // ── 设置成员角色（群主专属：设/撤管理员）──
  fastify.post('/api/im/groups/:id/members/:uid/role', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole !== GROUP_ROLE_OWNER || group.ownerUid !== userId) {
      return reply.status(403).send({ success: false, error: '仅群主可设置管理员' })
    }
    const targetUid = request.params.uid as string
    if (targetUid === BOT_UID) return reply.status(400).send({ success: false, error: '小管家隐身执勤，无需设置' })
    const role = Number((request.body as any)?.role)
    if (role !== GROUP_ROLE_ADMIN && role !== GROUP_ROLE_MEMBER) {
      return reply.status(400).send({ success: false, error: 'role 只能为 1(管理员) 或 0(成员)' })
    }
    const exist = await prisma.imChannelMember.findUnique({
      where: { channelId_channelType_uid: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: targetUid } },
    })
    if (!exist) return reply.status(404).send({ success: false, error: '对方不是群成员' })
    if (targetUid === group.ownerUid) return reply.status(400).send({ success: false, error: '群主角色不可变更' })
    await prisma.imChannelMember.update({ where: { id: exist.id }, data: { role } })
    const target = await displayOf(targetUid)
    await groupSystemSend(group.id, role === GROUP_ROLE_ADMIN ? `⭐ ${target.name} 被设为管理员` : `📉 ${target.name} 被取消管理员`)
    return { success: true, data: { uid: targetUid, role } }
  })

  // ── 申请群管理（成员自己；群主/管理员无需申请；防重复 pending）──
  fastify.post('/api/im/groups/:id/apply', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < 0) return reply.status(403).send({ success: false, error: '你不是该群成员' })
    if (myRole >= GROUP_ROLE_ADMIN) return reply.status(400).send({ success: false, error: '你已是群主/管理员' })

    const reason = String((request.body as any)?.reason || '').trim().slice(0, 200)
    const dup = await prisma.chatGroupApply.findFirst({
      where: { groupId: group.id, uid: userId, status: 'pending' },
    })
    if (dup) return reply.status(400).send({ success: false, error: '已有待审批的申请，请等待群主处理' })

    const apply = await prisma.chatGroupApply.create({ data: { groupId: group.id, uid: userId, type: 'admin', reason } })
    // 通知群主/管理员（bot 代发）
    const me = await displayOf(userId)
    await groupSystemSend(group.id, `🙋 ${me.name} 申请成为群管理员${reason ? `：${reason}` : ''}，群主可在群管理中审批`)
    return { success: true, data: { apply } }
  })

  // ── 申请列表（群主/管理员；pending 优先）──
  fastify.get('/api/im/groups/:id/applies', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可查看申请' })

    const applies = await prisma.chatGroupApply.findMany({
      where: { groupId: group.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })
    const uids = [...new Set(applies.map((a) => a.uid))]
    const userRows = await prisma.user.findMany({ where: { id: { in: uids.filter((u) => UUID_RE.test(u)) } }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
    const userMap = new Map(userRows.map((u) => [u.id, u]))
    const data = applies.map((a) => {
      const u = userMap.get(a.uid)
      return { id: a.id, uid: a.uid, name: u ? u.nickname || u.username || u.email.split('@')[0] : a.uid, avatar: u?.avatarUrl || '', type: a.type, status: a.status, reason: a.reason, handledBy: a.handledBy, createdAt: a.createdAt, handledAt: a.handledAt }
    })
    return { success: true, data: { applies: data } }
  })

  // ── 审批申请（群主/管理员；通过 → 升管理员 + 通知）──
  fastify.post('/api/im/groups/:id/applies/:applyId', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const group = await getActiveGroup(request.params.id as string)
    if (!group) return reply.status(404).send({ success: false, error: '群不存在或已解散' })
    const myRole = await groupRoleOf(group.id, userId)
    if (myRole < GROUP_ROLE_ADMIN) return reply.status(403).send({ success: false, error: '仅群主/管理员可审批' })

    const apply = await prisma.chatGroupApply.findUnique({ where: { id: request.params.applyId as string } })
    if (!apply || apply.groupId !== group.id) return reply.status(404).send({ success: false, error: '申请不存在' })
    if (apply.status !== 'pending') return reply.status(400).send({ success: false, error: '该申请已处理' })

    const approve = (request.body as any)?.approve === true
    await prisma.chatGroupApply.update({
      where: { id: apply.id },
      data: { status: approve ? 'approved' : 'rejected', handledBy: userId, handledAt: new Date() },
    })
    const applicant = await displayOf(apply.uid)
    if (approve) {
      const exist = await prisma.imChannelMember.findUnique({
        where: { channelId_channelType_uid: { channelId: groupChannelId(group.id), channelType: GROUP_CHANNEL_TYPE, uid: apply.uid } },
      })
      if (exist) await prisma.imChannelMember.update({ where: { id: exist.id }, data: { role: GROUP_ROLE_ADMIN } })
      await groupSystemSend(group.id, `⭐ 恭喜 ${applicant.name} 成为群管理员`)
    } else {
      await groupSystemSend(group.id, `😶 ${applicant.name} 的群管理申请未被通过`)
    }
    return { success: true, data: { applyId: apply.id, status: approve ? 'approved' : 'rejected' } }
  })
}
