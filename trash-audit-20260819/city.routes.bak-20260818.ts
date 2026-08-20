import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { wkApi, serverSend } from './im.js'
import { createHash, randomBytes } from 'crypto'

// 昆仑茶馆 · 城市空间（P1+P2：开通/申请/审核/详情 + 私域聊天室/治理）
export function cityPubChannel(cityId: string) {
  return `city_${cityId}_pub`
}
export function cityRoomChannel(cityId: string, roomId: string) {
  return `city_${cityId}_room_${roomId}`
}

async function cityRole(cityId: string, uid: string) {
  const c = await prisma.city.findUnique({ where: { id: cityId } })
  if (!c || c.status === 'closed') return 'none'
  if (c.agentUid === uid) return 'agent'
  const adm = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId, uid } } })
  if (adm && adm.status === 'active') return 'admin'
  const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId, uid } } })
  if (!mem) return 'none'
  return mem.status === 'active' ? 'member' : 'pending'
}

export default async function cityRoutes(fastify: FastifyInstance) {
  // ── 开通 / 列表 / 申请 / 审核 / 详情（P1）──
  fastify.post('/api/city/open', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { name, banner = '', admins = [] } = (request.body as any) || {}
    const cname = String(name || '').trim()
    if (!cname || cname.length > 30) return reply.status(400).send({ error: '城市名称必填且不超过 30 字' })
    const adminUids = [...new Set(admins.filter((x: any) => typeof x === 'string' && x !== uid))].slice(0, 20)
    if (adminUids.length < 3) return reply.status(400).send({ error: '至少指定 3 名管理员' })
    const city = await prisma.city.create({ data: { name: cname, banner: String(banner || '').slice(0, 500), agentUid: uid } })
    for (const a of adminUids) await prisma.cityAdmin.create({ data: { cityId: city.id, uid: a } }).catch(() => {})
    await prisma.cityMember.create({ data: { cityId: city.id, uid, status: 'active', hash: '' } }).catch(() => {})
    for (const a of adminUids) await prisma.cityMember.create({ data: { cityId: city.id, uid: a, status: 'active', hash: '' } }).catch(() => {})
    try {
      await wkApi('/channel', { channel_id: cityPubChannel(city.id), channel_type: 4, channel_name: `${cname}·公共聊天室`, channel_remark: '城市空间公共聊天室' })
      await wkApi('/channel/subscriber_add', { channel_id: cityPubChannel(city.id), channel_type: 4, subscribers: [uid, ...adminUids] })
    } catch (e: any) { console.log('[城市] 频道创建失败:', (e as Error).message.slice(0, 60)) }
    return { success: true, data: { city: { id: city.id, name: city.name, banner: city.banner, agentUid: city.agentUid, status: city.status } } }
  })

  fastify.get('/api/city/list', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const mine = await prisma.cityMember.findMany({ where: { uid }, select: { cityId: true, status: true } })
    const myMap = new Map(mine.map((m) => [m.cityId, m.status]))
    const cities = await prisma.city.findMany({ where: { status: { not: 'closed' } }, orderBy: { createdAt: 'desc' } })
    const out = []
    for (const c of cities) {
      const adminCount = await prisma.cityAdmin.count({ where: { cityId: c.id, status: 'active' } })
      const memberCount = await prisma.cityMember.count({ where: { cityId: c.id, status: 'active' } })
      const myRole = await cityRole(c.id, uid)
      out.push({ id: c.id, name: c.name, banner: c.banner, agentUid: c.agentUid, status: c.status, adminCount, memberCount, myStatus: myMap.get(c.id) || null, myRole })
    }
    return { success: true, data: { cities: out } }
  })

  fastify.post('/api/city/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, note = '' } = (request.body as any) || {}
    const c = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
    if (!c || c.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
    const exist = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: c.id, uid } } })
    if (exist) return reply.status(400).send({ error: exist.status === 'active' ? '你已是该城市会员' : '申请已提交，等待审核' })
    await prisma.cityMember.create({ data: { cityId: c.id, uid, status: 'pending', hash: '', inviterHash: '', inviteHash: '' } })
    return { success: true, data: { pending: true } }
  })

  fastify.get('/api/city/applies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const rows = await prisma.cityMember.findMany({ where: { cityId, status: 'pending' }, orderBy: { createdAt: 'asc' } })
    const uids = rows.map((r) => r.uid)
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { applies: rows.map((r) => ({ uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid, avatar: umap.get(r.uid)?.avatarUrl || '', createdAt: r.createdAt })) } }
  })

  fastify.post('/api/city/applies/:uid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: adminUid } = (request as any).user
    const { uid: targetUid } = request.params as any
    const { cityId, approve } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), adminUid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid: targetUid } } })
    if (!mem || mem.status !== 'pending') return reply.status(404).send({ error: '申请不存在' })
    if (approve) {
      await prisma.cityMember.update({ where: { id: mem.id }, data: { status: 'active', lastActiveAt: new Date() } })
      try { await wkApi('/channel/subscriber_add', { channel_id: cityPubChannel(String(cityId)), channel_type: 4, subscribers: [targetUid] }) } catch (e: any) {}
    } else {
      await prisma.cityMember.update({ where: { id: mem.id }, data: { status: 'rejected' } })
    }
    // 审核结果通知（悟空单聊系统消息，用户即时收到并可刷新状态）
    try {
      const cityInfo = await prisma.city.findUnique({ where: { id: String(cityId) }, select: { name: true } })
      const cname = cityInfo?.name || '城市'
      await serverSend(String(targetUid), 1, 'sys', 1, { text: approve ? ('✅ 恭喜！你已通过「' + cname + '」入城审核，成为城市会员，可进入城市空间参与社区与治理。') : ('❌ 很遗憾，「' + cname + '」入城申请未通过，可联系管理员或重新申请。') })
    } catch (e: any) { console.log('[城市] 审核通知发送失败:', (e as Error).message.slice(0, 60)) }
    return { success: true, data: { approved: !!approve } }
  })

  fastify.get('/api/city/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const c = await prisma.city.findUnique({ where: { id: request.params.id as string } })
    if (!c) return reply.status(404).send({ error: '城市不存在' })
    const admins = await prisma.cityAdmin.findMany({ where: { cityId: c.id, status: 'active' } })
    const adminUids = admins.map((a) => a.uid)
    const users = adminUids.length ? await prisma.user.findMany({ where: { id: { in: adminUids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const memberCount = await prisma.cityMember.count({ where: { cityId: c.id, status: 'active' } })
    return { success: true, data: { city: { id: c.id, name: c.name, banner: c.banner, agentUid: c.agentUid, status: c.status, createdAt: c.createdAt }, myRole: await cityRole(c.id, uid), memberCount, admins: admins.map((a) => ({ uid: a.uid, nickname: umap.get(a.uid)?.nickname || umap.get(a.uid)?.username || a.uid, pubKey: a.pubKey || '' })), pubChannel: cityPubChannel(c.id) } }
  })

  // ═══ P2：私域聊天室 ═══
  // 创建私域聊天室（管理员）
  fastify.post('/api/city/room/create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, name } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可创建私域聊天室' })
    const rname = String(name || '').trim()
    if (!rname || rname.length > 20) return reply.status(400).send({ error: '聊天室名称必填且不超过 20 字' })
    const room = await prisma.cityRoom.create({ data: { cityId: String(cityId), name: rname, ownerUid: uid, channelId: '' } })
    const chId = cityRoomChannel(String(cityId), room.id)
    await prisma.cityRoom.update({ where: { id: room.id }, data: { channelId: chId } })
    try {
      await wkApi('/channel', { channel_id: chId, channel_type: 4, channel_name: rname, channel_remark: '私域聊天室（邀请制）' })
      await wkApi('/channel/subscriber_add', { channel_id: chId, channel_type: 4, subscribers: [uid] })
    } catch (e: any) { console.log('[城市] 私域频道创建失败:', (e as Error).message.slice(0, 60)) }
    await prisma.cityRoomMember.create({ data: { roomId: room.id, uid, status: 'active' } }).catch(() => {})
    return { success: true, data: { room: { id: room.id, name: room.name, channelId: chId } } }
  })

  // 私域聊天室列表（含我的状态）
  fastify.get('/api/city/rooms', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const rooms = await prisma.cityRoom.findMany({ where: { cityId, status: 'active' }, orderBy: { createdAt: 'desc' } })
    const out = []
    for (const r of rooms) {
      const my = await prisma.cityRoomMember.findUnique({ where: { roomId_uid: { roomId: r.id, uid } } })
      const memberCount = await prisma.cityRoomMember.count({ where: { roomId: r.id, status: 'active' } })
      out.push({ id: r.id, name: r.name, channelId: r.channelId, myStatus: my ? my.status : null, muted: my ? my.muted : false, memberCount, allowImage: r.allowImage, allowVideo: r.allowVideo, allowFile: r.allowFile, allMuted: r.allMuted })
    }
    return { success: true, data: { rooms: out, myRole: role } }
  })

  // 申请加入私域聊天室
  fastify.post('/api/city/room/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { roomId } = (request.body as any) || {}
    const room = await prisma.cityRoom.findUnique({ where: { id: String(roomId || '') } })
    if (!room) return reply.status(404).send({ error: '聊天室不存在' })
    const role = await cityRole(room.cityId, uid)
    if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可申请' })
    const exist = await prisma.cityRoomMember.findUnique({ where: { roomId_uid: { roomId: room.id, uid } } })
    if (exist) return reply.status(400).send({ error: exist.status === 'active' ? '你已在聊天室中' : '申请已提交，等待审核' })
    await prisma.cityRoomMember.create({ data: { roomId: room.id, uid, status: 'pending' } })
    return { success: true, data: { pending: true } }
  })

  // 私域聊天室申请列表（管理员）
  fastify.get('/api/city/room/applies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const roomId = String((request.query as any).roomId || '')
    const room = await prisma.cityRoom.findUnique({ where: { id: roomId } })
    if (!room) return reply.status(404).send({ error: '聊天室不存在' })
    const role = await cityRole(room.cityId, uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const rows = await prisma.cityRoomMember.findMany({ where: { roomId, status: 'pending' }, orderBy: { createdAt: 'asc' } })
    const uids = rows.map((r) => r.uid)
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { applies: rows.map((r) => ({ uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid })) } }
  })

  // 审核私域申请（通过 → 订阅频道）
  fastify.post('/api/city/room/applies/:uid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: adminUid } = (request as any).user
    const { uid: targetUid } = request.params as any
    const { roomId, approve } = (request.body as any) || {}
    const room = await prisma.cityRoom.findUnique({ where: { id: String(roomId || '') } })
    if (!room) return reply.status(404).send({ error: '聊天室不存在' })
    const role = await cityRole(room.cityId, adminUid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const mem = await prisma.cityRoomMember.findUnique({ where: { roomId_uid: { roomId: room.id, uid: targetUid } } })
    if (!mem || mem.status !== 'pending') return reply.status(404).send({ error: '申请不存在' })
    if (approve) {
      await prisma.cityRoomMember.update({ where: { id: mem.id }, data: { status: 'active' } })
      try { await wkApi('/channel/subscriber_add', { channel_id: room.channelId, channel_type: 4, subscribers: [targetUid] }) } catch (e: any) {}
    } else {
      await prisma.cityRoomMember.update({ where: { id: mem.id }, data: { status: 'rejected' } })
    }
    return { success: true, data: { approved: !!approve } }
  })

  // ═══ P2：聊天室治理（管理员）═══
  async function roomAdminCheck(roomId: string, uid: string) {
    const room = await prisma.cityRoom.findUnique({ where: { id: roomId } })
    if (!room) return { room: null, ok: false }
    const role = await cityRole(room.cityId, uid)
    return { room, ok: role === 'agent' || role === 'admin' }
  }

  // 全员禁言 / 媒体开关
  fastify.post('/api/city/room/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { allMuted, allowImage, allowVideo, allowFile } = (request.body as any) || {}
    const { room, ok } = await roomAdminCheck(request.params.id as string, uid)
    if (!ok) return reply.status(403).send({ error: '仅管理员可设置' })
    const data: any = {}
    if (allMuted !== undefined) data.allMuted = !!allMuted
    if (allowImage !== undefined) data.allowImage = !!allowImage
    if (allowVideo !== undefined) data.allowVideo = !!allowVideo
    if (allowFile !== undefined) data.allowFile = !!allowFile
    await prisma.cityRoom.update({ where: { id: room!.id }, data })
    return { success: true, data: { room: { id: room!.id, allMuted: data.allMuted ?? room!.allMuted, allowImage: data.allowImage ?? room!.allowImage, allowVideo: data.allowVideo ?? room!.allowVideo, allowFile: data.allowFile ?? room!.allowFile } } }
  })

  // 个人禁言 / 解禁
  fastify.post('/api/city/room/:id/ban', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { targetUid, muted } = (request.body as any) || {}
    const { room, ok } = await roomAdminCheck(request.params.id as string, uid)
    if (!ok) return reply.status(403).send({ error: '仅管理员可禁言' })
    if (!targetUid) return reply.status(400).send({ error: '缺少目标用户' })
    await prisma.cityRoomMember.updateMany({ where: { roomId: room!.id, uid: targetUid }, data: { muted: !!muted } })
    return { success: true, data: { muted: !!muted } }
  })

  // 踢人（取消频道订阅 + 移除成员）
  fastify.post('/api/city/room/:id/kick', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { targetUid } = (request.body as any) || {}
    const { room, ok } = await roomAdminCheck(request.params.id as string, uid)
    if (!ok) return reply.status(403).send({ error: '仅管理员可踢人' })
    if (!targetUid) return reply.status(400).send({ error: '缺少目标用户' })
    try { await wkApi('/channel/subscriber_remove', { channel_id: room!.channelId, channel_type: 4, subscribers: [targetUid] }) } catch (e: any) {}
    await prisma.cityRoomMember.deleteMany({ where: { roomId: room!.id, uid: targetUid } })
    return { success: true, data: { kicked: true } }
  })
// ═══ P3：城市社区 ═══（追加到 city.routes.ts 的 cityRoutes 函数末尾，return 前）
  // 发帖（普通 200 字 / VIP 5000 字）
  fastify.post('/api/city/post', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, content, title = '', images = [], sig = '', pubKey = '' } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可发帖' })
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { memberTier: true, membership: { select: { tier: true, expiresAt: true } } } })
    const tier = String((u as any)?.memberTier || (u as any)?.membership?.tier || 'free')
    const isVip = tier !== 'free' && tier !== 'basic'
    let text = String(content || '').trim()
    text = text.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;|&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\uFFFD/g, '')
    if (!text) return reply.status(400).send({ error: '内容不能为空' })
    if (text.length > (isVip ? 5000 : 200)) return reply.status(400).send({ error: isVip ? '内容超过 5000 字' : '普通会员限 200 字，开通 VIP 可发长文' })
    const post = await prisma.cityPost.create({
      data: { cityId: String(cityId), uid, content: text, title: String(title || '').trim().slice(0, 60), images: JSON.stringify((images || []).slice(0, 9).filter((x: any) => typeof x === 'string')), sig: String(sig || '').slice(0, 500), pubKey: String(pubKey || '').slice(0, 500) },
    })
    return { success: true, data: { id: String(post.id) } }
  })

  // 帖子列表（置顶优先 + 加精标记）
  fastify.get('/api/city/posts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const rows = await prisma.cityPost.findMany({ where: { cityId, status: 'active' }, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: 100 })
    const uids = [...new Set(rows.map((r) => r.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const out = rows.map((r) => ({
      id: String(r.id),
      uid: r.uid,
      nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid,
      avatar: umap.get(r.uid)?.avatarUrl || '',
      content: r.content,
      title: r.title,
      images: JSON.parse(r.images || '[]'),
      pinned: r.pinned,
      featured: r.featured,
      boldTitle: r.boldTitle,
      pushed: r.pushed,
      sig: r.sig || '',
      pubKey: r.pubKey || '',
      createdAt: r.createdAt,
      likes: JSON.parse(r.likes || '[]'),
      comments: JSON.parse(r.comments || '[]'),
    }))
    return { success: true, data: { posts: out, myRole: role } }
  })

  // 点赞 / 取消
  fastify.post('/api/city/post/:id/like', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const likes = JSON.parse(post.likes || '[]')
    const i = likes.indexOf(uid)
    if (i >= 0) likes.splice(i, 1); else likes.push(uid)
    await prisma.cityPost.update({ where: { id: post.id }, data: { likes: JSON.stringify(likes) } })
    return { success: true, data: { liked: i < 0 } }
  })

  // 评论
  fastify.post('/api/city/post/:id/comment', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { text } = (request.body as any) || {}
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const t = String(text || '').trim().slice(0, 300)
    if (!t) return reply.status(400).send({ error: '评论不能为空' })
    const comments = JSON.parse(post.comments || '[]')
    comments.push({ uid, text: t, ts: Date.now() })
    await prisma.cityPost.update({ where: { id: post.id }, data: { comments: JSON.stringify(comments.slice(-100)) } })
    return { success: true, data: { ok: true } }
  })

  // ── 管理员：置顶（最多 3）/ 加精 / 加粗 / 删帖 / 推送公共社区 ──
  async function postAdminCheck(cityId: string, uid: string) {
    const role = await cityRole(cityId, uid)
    return role === 'agent' || role === 'admin'
  }

  fastify.post('/api/city/post/:id/pin', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await postAdminCheck(post.cityId, uid))) return reply.status(403).send({ error: '仅管理员可置顶' })
    const pinned = post.pinned ? 0 : 1
    if (pinned) {
      const cnt = await prisma.cityPost.count({ where: { cityId: post.cityId, status: 'active', pinned: { gt: 0 } } })
      if (cnt >= 3) return reply.status(400).send({ error: '最多置顶 3 帖' })
    }
    await prisma.cityPost.update({ where: { id: post.id }, data: { pinned } })
    return { success: true, data: { pinned } }
  })

  fastify.post('/api/city/post/:id/feature', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await postAdminCheck(post.cityId, uid))) return reply.status(403).send({ error: '仅管理员可加精' })
    await prisma.cityPost.update({ where: { id: post.id }, data: { featured: !post.featured } })
    return { success: true, data: { featured: !post.featured } }
  })

  fastify.post('/api/city/post/:id/bold', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await postAdminCheck(post.cityId, uid))) return reply.status(403).send({ error: '仅管理员可加粗标题' })
    await prisma.cityPost.update({ where: { id: post.id }, data: { boldTitle: !post.boldTitle } })
    return { success: true, data: { boldTitle: !post.boldTitle } }
  })

  fastify.post('/api/city/post/:id/delete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const isAdmin = await postAdminCheck(post.cityId, uid)
    if (!isAdmin && post.uid !== uid) return reply.status(403).send({ error: '仅管理员或作者可删除' })
    await prisma.cityPost.update({ where: { id: post.id }, data: { status: 'deleted' } })
    return { success: true, data: { deleted: true } }
  })

  // 推送公共社区（管理员）→ 写入 tea_post 表
  fastify.post('/api/city/post/:id/push', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const post = await prisma.cityPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await postAdminCheck(post.cityId, uid))) return reply.status(403).send({ error: '仅管理员可推送' })
    if (post.pushed) return reply.status(400).send({ error: '已推送过' })
    await prisma.teaPost.create({ data: { uid: post.uid, content: post.content, images: post.images, sig: '', pubKey: '' } })
    await prisma.cityPost.update({ where: { id: post.id }, data: { pushed: true } })
    return { success: true, data: { pushed: true } }
  })
// ═══ P4：邀请哈希链 ═══（追加到 cityRoutes 末尾 return 前）
  // 生成邀请码（会员以上；哈希终身锁定）
  fastify.post('/api/city/invite', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可生成邀请码' })
    // 每个会员每城一个邀请哈希（终身锁定）
    let inv = await prisma.cityInvite.findFirst({ where: { cityId: String(cityId), inviterUid: uid } })
    if (!inv) {
      const h = createHash('sha256').update(String(cityId) + ':' + uid + ':' + Math.random().toString(36).slice(2) + ':' + Date.now()).digest('hex')
      const code = randomBytes(4).toString('hex').toUpperCase()
      inv = await prisma.cityInvite.create({ data: { cityId: String(cityId), inviterUid: uid, hash: h, code } })
    }
    return { success: true, data: { code: inv.code, hash: inv.hash, url: 'https://aigc.fushtn.com/register?city=' + String(cityId) + '&invite=' + inv.code } }
  })

  // 我的城市身份（哈希/邀请人哈希）
  fastify.get('/api/city/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId, uid } } })
    if (!mem) return reply.status(404).send({ error: '非城市会员' })
    const inv = await prisma.cityInvite.findFirst({ where: { cityId, inviterUid: uid } })
    return { success: true, data: { member: { hash: mem.hash || '', inviterHash: mem.inviterHash || '', inviteHash: inv ? inv.hash : '', inviteCode: inv ? inv.code : '' } } }
  })

  // 我的伙伴（一级 + 二级：通过邀请哈希关联）
  fastify.get('/api/city/partners', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const inv = await prisma.cityInvite.findFirst({ where: { cityId, inviterUid: uid } })
    if (!inv) return { success: true, data: { level1: [], level2: [] } }
    // 一级：inviterHash = 我的邀请哈希 的会员
    const l1 = await prisma.cityMember.findMany({ where: { cityId, inviterHash: inv.hash, status: 'active' } })
    const l1uid = l1.map((m) => m.uid)
    const users1 = l1uid.length ? await prisma.user.findMany({ where: { id: { in: l1uid } }, select: { id: true, nickname: true, username: true } }) : []
    const um1 = new Map(users1.map((u) => [u.id, u]))
    // 二级：一级会员的邀请哈希 → 再邀请的会员
    const l1Invites = l1uid.length ? await prisma.cityInvite.findMany({ where: { cityId, inviterUid: { in: l1uid } } }) : []
    const l1HashSet = l1Invites.map((i) => i.hash)
    const l2 = l1HashSet.length ? await prisma.cityMember.findMany({ where: { cityId, inviterHash: { in: l1HashSet }, status: 'active' } }) : []
    const l2uid = l2.map((m) => m.uid)
    const users2 = l2uid.length ? await prisma.user.findMany({ where: { id: { in: l2uid } }, select: { id: true, nickname: true, username: true } }) : []
    const um2 = new Map(users2.map((u) => [u.id, u]))
    return {
      success: true,
      data: {
        level1: l1.map((m) => ({ uid: m.uid, nickname: um1.get(m.uid)?.nickname || um1.get(m.uid)?.username || m.uid, hash: m.hash || '', inviterHash: m.inviterHash })),
        level2: l2.map((m) => ({ uid: m.uid, nickname: um2.get(m.uid)?.nickname || um2.get(m.uid)?.username || m.uid, hash: m.hash || '' })),
      },
    }
  })

  // 申请入城（可选带邀请码 → 绑定邀请人哈希）
  fastify.post('/api/city/applyv2', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, inviteCode = '' } = (request.body as any) || {}
    const c = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
    if (!c || c.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
    const exist = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: c.id, uid } } })
    if (exist) return reply.status(400).send({ error: exist.status === 'active' ? '你已是该城市会员' : '申请已提交，等待审核' })
    let inviterHash = ''
    if (inviteCode) {
      const inv = await prisma.cityInvite.findFirst({ where: { cityId: c.id, code: String(inviteCode).trim().toUpperCase() } })
      if (inv) {
        if (inv.inviterUid === uid) return reply.status(400).send({ error: '不能使用自己的邀请码' })
        inviterHash = inv.hash
      } else {
        return reply.status(400).send({ error: '邀请码无效' })
      }
    }
    await prisma.cityMember.create({ data: { cityId: c.id, uid, status: 'pending', hash: '', inviterHash, inviteHash: '' } })
    return { success: true, data: { pending: true, inviterHash } }
  })
// ═══ P5：城市攻略（商家认证/服务帖/热度榜）═══（追加到 cityRoutes 末尾 return 前）
  // 商家认证申请（会员：场地+执照照片）
  fastify.post('/api/city/biz/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, licensePic, venuePic } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'member') return reply.status(403).send({ error: '仅会员可申请城市商家' })
    if (!licensePic || !venuePic) return reply.status(400).send({ error: '请上传营业执照和场地照片' })
    const exist = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid } } })
    if (exist) return reply.status(400).send({ error: exist.status === 'pending' ? '认证申请审核中' : exist.status === 'active' ? '你已是城市商家' : '申请被拒，可重新申请' })
    await prisma.cityBiz.create({ data: { cityId: String(cityId), uid, licensePic: String(licensePic).slice(0, 500), venuePic: String(venuePic).slice(0, 500), shopName: String((request.body as any).shopName || '').slice(0, 60), banner: String((request.body as any).banner || '').slice(0, 500), lat: Number((request.body as any).lat) || 0, lng: Number((request.body as any).lng) || 0, address: String((request.body as any).address || '').slice(0, 200), bizDesc: String((request.body as any).bizDesc || '').slice(0, 500), status: 'pending' } })
    return { success: true, data: { pending: true } }
  })

  // 商家认证申请列表（管理员）
  fastify.get('/api/city/biz/applies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const rows = await prisma.cityBiz.findMany({ where: { cityId, status: 'pending' }, orderBy: { createdAt: 'asc' } })
    const uids = rows.map((r) => r.uid)
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { applies: rows.map((r) => ({ uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid, licensePic: r.licensePic, venuePic: r.venuePic, createdAt: r.createdAt })) } }
  })

  // 审核商家认证
  fastify.post('/api/city/biz/applies/:uid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: adminUid } = (request as any).user
    const { uid: targetUid } = request.params as any
    const { cityId, approve } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), adminUid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可审核' })
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid: targetUid } } })
    if (!biz || biz.status !== 'pending') return reply.status(404).send({ error: '申请不存在' })
    await prisma.cityBiz.update({ where: { id: biz.id }, data: { status: approve ? 'active' : 'rejected' } })
    return { success: true, data: { approved: !!approve } }
  })

  // 我的商家状态
  fastify.get('/api/city/biz/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId, uid } } })
    return { success: true, data: { biz: biz ? { status: biz.status, downgraded: biz.downgraded, heat: biz.heat } : null } }
  })

  // 商家发服务帖
  fastify.post('/api/city/biz/post', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, content, images = [] } = (request.body as any) || {}
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid } } })
    if (!biz || biz.status !== 'active') return reply.status(403).send({ error: '仅认证城市商家可发布服务信息' })
    if (biz.downgraded) return reply.status(403).send({ error: '商家已被降权，无法发布' })
    const text = String(content || '').trim()
    if (!text) return reply.status(400).send({ error: '内容不能为空' })
    const post = await prisma.cityBizPost.create({ data: { bizId: biz.id, content: text.slice(0, 2000), images: JSON.stringify((images || []).slice(0, 9).filter((x: any) => typeof x === 'string')) } })
    return { success: true, data: { id: String(post.id) } }
  })

  // 攻略热度榜（降权商家不入榜）
  fastify.get('/api/city/biz/posts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const bizs = await prisma.cityBiz.findMany({ where: { cityId, status: 'active' } })
    const bizMap = new Map(bizs.map((b) => [b.id, b]))
    const posts = await prisma.cityBizPost.findMany({ where: { status: 'active', bizId: { in: bizs.map((b) => b.id) } }, orderBy: { createdAt: 'desc' }, take: 200 })
    const bizUids = [...new Set(bizs.map((b) => b.uid))]
    const users = bizUids.length ? await prisma.user.findMany({ where: { id: { in: bizUids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    // 热度分（商家维度，衰减）
    const now = Date.now()
    const LAMBDA = 0.05
    const list = []
    for (const p of posts) {
      const b = bizMap.get(p.bizId)
      if (!b || b.downgraded) continue
      const reviews = await prisma.cityReview.findMany({ where: { bizId: b.id } })
      let score = 0
      for (const r of reviews) {
        const days = (now - new Date(r.createdAt).getTime()) / 86400000
        const w = r.type === 'good' ? 10 : r.type === 'bad' ? -20 : r.type === 'comment' ? 2 : r.type === 'repost' ? 5 : r.type === 'fav' ? 3 : r.type === 'like' ? 1 : 0
        score += w * Math.exp(-LAMBDA * days)
      }
      list.push({
        id: String(p.id), bizId: b.id, uid: b.uid,
        nickname: umap.get(b.uid)?.nickname || umap.get(b.uid)?.username || b.uid,
        avatar: umap.get(b.uid)?.avatarUrl || '',
        content: p.content,
        images: JSON.parse(p.images || '[]'),
        heat: Math.round(score * 100) / 100,
        createdAt: p.createdAt,
      })
    }
    list.sort((a, b) => b.heat - a.heat || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    return { success: true, data: { posts: list, myRole: role } }
  })

  // 评价/互动（好评/差评/点评/转发/收藏/点赞——同用户同商家同类型 1 次）
  fastify.post('/api/city/biz/post/:id/review', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { type, text = '' } = (request.body as any) || {}
    const t = ['good', 'bad', 'comment', 'repost', 'fav', 'like'].includes(type) ? type : null
    if (!t) return reply.status(400).send({ error: '无效的操作类型' })
    const post = await prisma.cityBizPost.findUnique({ where: { id: request.params.id as string } })
    if (!post) return reply.status(404).send({ error: '服务帖不存在' })
    const biz = await prisma.cityBiz.findUnique({ where: { id: post.bizId } })
    if (!biz) return reply.status(404).send({ error: '商家不存在' })
    const dup = await prisma.cityReview.findUnique({ where: { bizId_uid_type: { bizId: biz.id, uid, type: t } } })
    if (dup) return reply.status(400).send({ error: '你已执行过该操作' })
    await prisma.cityReview.create({ data: { bizId: biz.id, uid, type: t, content: String(text || '').slice(0, 300) } })
    return { success: true, data: { ok: true, type: t } }
  })

  // 管理员降权/恢复（造假或差评过多）
  fastify.post('/api/city/biz/:id/downgrade', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const biz = await prisma.cityBiz.findUnique({ where: { id: request.params.id as string } })
    if (!biz) return reply.status(404).send({ error: '商家不存在' })
    const role = await cityRole(biz.cityId, uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可降权' })
    await prisma.cityBiz.update({ where: { id: biz.id }, data: { downgraded: !biz.downgraded } })
    return { success: true, data: { downgraded: !biz.downgraded } }
  })


  // ═══ 店铺信息更新（店名/门头/定位/地址/简介——线下实体店必填定位）
  fastify.post('/api/city/biz/shop/update', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, shopName, banner, lat, lng, address, bizDesc } = (request.body as any) || {}
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId || ''), uid } } })
    if (!biz || biz.status !== 'active') return reply.status(403).send({ error: '仅认证商家可管理店铺' })
    await prisma.cityBiz.update({ where: { id: biz.id }, data: {
      shopName: shopName !== undefined ? String(shopName).slice(0, 60) : biz.shopName,
      banner: banner !== undefined ? String(banner).slice(0, 500) : biz.banner,
      lat: lat !== undefined ? Number(lat) || 0 : biz.lat,
      lng: lng !== undefined ? Number(lng) || 0 : biz.lng,
      address: address !== undefined ? String(address).slice(0, 200) : biz.address,
      bizDesc: bizDesc !== undefined ? String(bizDesc).slice(0, 500) : biz.bizDesc,
    } })
    return { success: true, data: { ok: true } }
  })
  // 商品上架
  fastify.post('/api/city/biz/product/add', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, name, cover = '', prodDesc = '', priceTea, stock } = (request.body as any) || {}
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId || ''), uid } } })
    if (!biz || biz.status !== 'active') return reply.status(403).send({ error: '仅认证商家可上架商品' })
    if (biz.downgraded) return reply.status(403).send({ error: '商家已被降权' })
    const nm = String(name || '').trim()
    const price = Math.floor(Number(priceTea) || 0)
    const stk = Math.floor(Number(stock) || 0)
    if (!nm) return reply.status(400).send({ error: '商品名称必填' })
    if (price < 1) return reply.status(400).send({ error: '茶票价格至少 1' })
    const p = await prisma.cityBizProduct.create({ data: { bizId: biz.id, name: nm.slice(0, 60), cover: String(cover).slice(0, 500), prodDesc: String(prodDesc).slice(0, 500), priceTea: price, stock: stk } })
    return { success: true, data: { id: String(p.id), name: p.name, priceTea: p.priceTea } }
  })
  // 商品更新（改价/库存/上下架）
  fastify.post('/api/city/biz/product/update', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { productId, name, cover, prodDesc, priceTea, stock, status } = (request.body as any) || {}
    const p = await prisma.cityBizProduct.findUnique({ where: { id: String(productId || '') } })
    if (!p) return reply.status(404).send({ error: '商品不存在' })
    const biz = await prisma.cityBiz.findUnique({ where: { id: p.bizId } })
    if (!biz || biz.uid !== uid) return reply.status(403).send({ error: '仅商家本人可管理' })
    await prisma.cityBizProduct.update({ where: { id: p.id }, data: {
      name: name !== undefined ? String(name).slice(0, 60) : p.name,
      cover: cover !== undefined ? String(cover).slice(0, 500) : p.cover,
      prodDesc: prodDesc !== undefined ? String(prodDesc).slice(0, 500) : p.prodDesc,
      priceTea: priceTea !== undefined ? Math.max(1, Math.floor(Number(priceTea) || 1)) : p.priceTea,
      stock: stock !== undefined ? Math.max(0, Math.floor(Number(stock) || 0)) : p.stock,
      status: status !== undefined ? (status === 'active' || status === 'off' ? status : p.status) : p.status,
    } })
    return { success: true, data: { ok: true } }
  })
  // 商品删除
  fastify.post('/api/city/biz/product/delete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { productId } = (request.body as any) || {}
    const p = await prisma.cityBizProduct.findUnique({ where: { id: String(productId || '') } })
    if (!p) return reply.status(404).send({ error: '商品不存在' })
    const biz = await prisma.cityBiz.findUnique({ where: { id: p.bizId } })
    if (!biz || biz.uid !== uid) return reply.status(403).send({ error: '仅商家本人可管理' })
    await prisma.cityBizProduct.delete({ where: { id: p.id } })
    return { success: true, data: { ok: true } }
  })
  // 我的店铺（店铺信息 + 商品管理列表）
  fastify.get('/api/city/biz/shop/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId, uid } } })
    if (!biz || biz.status !== 'active') return { success: true, data: { shop: null } }
    const products = await prisma.cityBizProduct.findMany({ where: { bizId: biz.id }, orderBy: { createdAt: 'desc' } })
    return { success: true, data: { shop: { id: biz.id, shopName: biz.shopName, banner: biz.banner, lat: biz.lat, lng: biz.lng, address: biz.address, bizDesc: biz.bizDesc, status: biz.status, downgraded: biz.downgraded }, products: products.map((p) => ({ id: String(p.id), name: p.name, cover: p.cover, prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock, status: p.status })) } }
  })
  // 城市店铺列表（门头卡：店名+门头横图+定位+商品数）
  fastify.get('/api/city/biz/shops', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const bizs = await prisma.cityBiz.findMany({ where: { cityId, status: 'active' } })
    const uids = bizs.map((b) => b.uid)
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const list = []
    for (const b of bizs) {
      if (b.downgraded) continue
      const cnt = await prisma.cityBizProduct.count({ where: { bizId: b.id, status: 'active' } })
      list.push({ id: b.id, uid: b.uid, shopName: b.shopName || (umap.get(b.uid)?.nickname || umap.get(b.uid)?.username || '未命名店铺'), banner: b.banner, lat: b.lat, lng: b.lng, address: b.address, productCount: cnt, heat: Math.round(b.heat * 100) / 100 })
    }
    list.sort((a, b) => b.heat - a.heat)
    return { success: true, data: { shops: list, myRole: role } }
  })
  // 店铺详情（门头 + 定位 + 商品列表）
  fastify.get('/api/city/biz/shop/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const biz = await prisma.cityBiz.findUnique({ where: { id: request.params.id as string } })
    if (!biz || biz.status !== 'active') return reply.status(404).send({ error: '店铺不存在' })
    const role = await cityRole(biz.cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const owner = await prisma.user.findUnique({ where: { id: biz.uid }, select: { nickname: true, username: true, avatarUrl: true } })
    const products = await prisma.cityBizProduct.findMany({ where: { bizId: biz.id, status: 'active' }, orderBy: { createdAt: 'desc' } })
    const reviews = await prisma.cityReview.findMany({ where: { bizId: biz.id } })
    const good = reviews.filter((r) => r.type === 'good').length
    const bad = reviews.filter((r) => r.type === 'bad').length
    return { success: true, data: { shop: { id: biz.id, uid: biz.uid, shopName: biz.shopName || owner?.nickname || owner?.username || '未命名店铺', banner: biz.banner, lat: biz.lat, lng: biz.lng, address: biz.address, bizDesc: biz.bizDesc, ownerName: owner?.nickname || owner?.username || '', heat: Math.round(biz.heat * 100) / 100, good, bad }, products: products.map((p) => ({ id: String(p.id), name: p.name, cover: p.cover, prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock })) } }
  })

  // ═══ P6：治理（罢免投票 + 多签关闭）═══
  // 管理员公钥上报（桌面 IDENT 公钥）
  fastify.post('/api/city/admin/pubkey', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, pubKey } = (request.body as any) || {}
    const adm = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid } } })
    if (!adm) return reply.status(403).send({ error: '仅管理员可上报公钥' })
    await prisma.cityAdmin.update({ where: { id: adm.id }, data: { pubKey: String(pubKey || '').slice(0, 500) } })
    return { success: true, data: { ok: true } }
  })

  // 管理员数量与关闭阈值
  function closeThreshold(n: number) {
    return n <= 5 ? 3 : Math.ceil((n * 2) / 3)
  }

  // 发起关闭提案（管理员）
  fastify.post('/api/city/close/propose', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可发起关闭' })
    const open = await prisma.cityCloseVote.findFirst({ where: { cityId: String(cityId), status: 'open' } })
    if (open) return reply.status(400).send({ error: '已有进行中的关闭提案' })
    const vote = await prisma.cityCloseVote.create({ data: { cityId: String(cityId), initiator: uid } })
    return { success: true, data: { voteId: String(vote.id) } }
  })

  // 管理员私钥签名确认关闭
  fastify.post('/api/city/close/sign', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { voteId, signature } = (request.body as any) || {}
    const vote = await prisma.cityCloseVote.findUnique({ where: { id: String(voteId || '') } })
    if (!vote || vote.status !== 'open') return reply.status(404).send({ error: '提案不存在或已结束' })
    const cObj = await prisma.city.findUnique({ where: { id: vote.cityId } })
    const isAgent = cObj && cObj.agentUid === uid
    const adm = isAgent ? null : await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: vote.cityId, uid } } })
    if (!isAgent && (!adm || adm.status !== 'active')) return reply.status(403).send({ error: '仅管理员可签名' })
    const sigs = JSON.parse(vote.signatures || '[]')
    if (sigs.includes(uid)) return reply.status(400).send({ error: '你已签名' })
    // 校验签名（IDENT 公钥验签；无公钥则仅记录——桌面端用私钥签名 cityId）
    if (!isAgent && adm.pubKey && signature) {
      const crypto = await import('node:crypto')
      try {
        const v = crypto.createVerify('SHA256')
        v.update(vote.cityId)
        if (!v.verify(adm.pubKey, Buffer.from(String(signature), 'base64'))) return reply.status(400).send({ error: '签名校验失败' })
      } catch (e: any) { return reply.status(400).send({ error: '签名校验异常: ' + e.message }) }
    }
    sigs.push(uid)
    const admins = await prisma.cityAdmin.count({ where: { cityId: vote.cityId, status: 'active' } })
    const need = closeThreshold(admins)
    if (sigs.length >= need) {
      await prisma.cityCloseVote.update({ where: { id: vote.id }, data: { status: 'closed', signatures: JSON.stringify(sigs) } })
      await prisma.city.update({ where: { id: vote.cityId }, data: { status: 'closed' } })
      return { success: true, data: { closed: true, need, signed: sigs.length } }
    }
    await prisma.cityCloseVote.update({ where: { id: vote.id }, data: { signatures: JSON.stringify(sigs) } })
    return { success: true, data: { closed: false, need, signed: sigs.length } }
  })

  // 关闭提案状态
  fastify.get('/api/city/close/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const cityId = String((request.query as any).cityId || '')
    const vote = await prisma.cityCloseVote.findFirst({ where: { cityId, status: 'open' }, orderBy: { createdAt: 'desc' } })
    if (!vote) return { success: true, data: { vote: null } }
    const admins = await prisma.cityAdmin.count({ where: { cityId, status: 'active' } })
    const sigs = JSON.parse(vote.signatures || '[]')
    return { success: true, data: { vote: { id: String(vote.id), initiator: vote.initiator, signed: sigs, need: closeThreshold(admins), admins } } }
  })

  // 发起罢免管理员投票（普通会员；期间管理员禁止踢发起人）
  fastify.post('/api/city/vote/remove-admin', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, targetAdminUid } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'member') return reply.status(403).send({ error: '仅普通会员可发起罢免' })
    const target = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: String(cityId), uid: String(targetAdminUid || '') } } })
    if (!target || target.status !== 'active') return reply.status(404).send({ error: '目标管理员不存在' })
    const open = await prisma.cityVote.findFirst({ where: { cityId: String(cityId), type: 'remove_admin', subject: String(targetAdminUid), status: 'open' } })
    if (open) return reply.status(400).send({ error: '已有针对该管理员的进行中投票' })
    const vote = await prisma.cityVote.create({ data: { cityId: String(cityId), type: 'remove_admin', subject: String(targetAdminUid), initiator: uid } })
    return { success: true, data: { voteId: String(vote.id) } }
  })

  // 投票（一票一哈希：30 天活跃会员；2/5 通过）
  fastify.post('/api/city/vote/:id/ballot', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { option = 'yes' } = (request.body as any) || {}
    const vote = await prisma.cityVote.findUnique({ where: { id: request.params.id as string } })
    if (!vote || vote.status !== 'open') return reply.status(404).send({ error: '投票不存在或已结束' })
    const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: vote.cityId, uid } } })
    if (!mem || mem.status !== 'active') return reply.status(403).send({ error: '仅城市会员可投票' })
    const dup = await prisma.cityBallot.findUnique({ where: { voteId_uid: { voteId: vote.id, uid } } })
    if (dup) return reply.status(400).send({ error: '你已投过票' })
    await prisma.cityBallot.create({ data: { voteId: vote.id, uid, option: option === 'no' ? 'no' : 'yes', hash: mem.hash || '' } })
    // 统计：30 天活跃会员
    const cutoff = new Date(Date.now() - 30 * 86400000)
    const activeCount = await prisma.cityMember.count({ where: { cityId: vote.cityId, status: 'active', lastActiveAt: { gte: cutoff } } })
    const yesCount = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'yes' } })
    const need = Math.ceil((activeCount * 2) / 5)
    if (yesCount >= need && need > 0) {
      await prisma.cityVote.update({ where: { id: vote.id }, data: { status: 'closed' } })
      // 自动罢免
      await prisma.cityAdmin.updateMany({ where: { cityId: vote.cityId, uid: vote.subject }, data: { status: 'removed' } })
      return { success: true, data: { passed: true, yes: yesCount, need, active: activeCount } }
    }
    return { success: true, data: { passed: false, yes: yesCount, need, active: activeCount } }
  })

  // 投票状态
  fastify.get('/api/city/vote/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const vote = await prisma.cityVote.findUnique({ where: { id: request.params.id as string } })
    if (!vote) return reply.status(404).send({ error: '投票不存在' })
    const yesCount = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'yes' } })
    const cutoff = new Date(Date.now() - 30 * 86400000)
    const activeCount = await prisma.cityMember.count({ where: { cityId: vote.cityId, status: 'active', lastActiveAt: { gte: cutoff } } })
    const need = Math.ceil((activeCount * 2) / 5)
    const me = await prisma.cityBallot.findUnique({ where: { voteId_uid: { voteId: vote.id, uid: (request as any).user.id } } })
    return { success: true, data: { vote: { id: String(vote.id), type: vote.type, subject: vote.subject, initiator: vote.initiator, status: vote.status, yes: yesCount, need, active: activeCount, voted: !!me } } }
  })
// 投票列表（进行中的罢免投票）
  fastify.get('/api/city/detail-votes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const votes = await prisma.cityVote.findMany({ where: { cityId, type: 'remove_admin', status: 'open' }, orderBy: { createdAt: 'desc' }, take: 20 })
    const out = []
    for (const v of votes) {
      const yesCount = await prisma.cityBallot.count({ where: { voteId: v.id, option: 'yes' } })
      const cutoff = new Date(Date.now() - 30 * 86400000)
      const activeCount = await prisma.cityMember.count({ where: { cityId, status: 'active', lastActiveAt: { gte: cutoff } } })
      const need = Math.ceil((activeCount * 2) / 5)
      const me = await prisma.cityBallot.findUnique({ where: { voteId_uid: { voteId: v.id, uid } } })
      out.push({ id: String(v.id), subject: v.subject, initiator: v.initiator, yes: yesCount, need, active: activeCount, voted: !!me, createdAt: v.createdAt })
    }
    return { success: true, data: { votes: out } }
  })

  // ═══ P7：城市选举自治（创始人发起 · 会员报名 · 初选 100 支持 · 拉票 · 最高票当选管理员）═══
  const ELEC_PRIMARY_SUPPORT = 100   // 初选门槛：一周内获得 100 以上会员支持
  const ELEC_PRIMARY_DAYS = 7
  const ELEC_VOTE_DAYS = 7
  // 惰性结算：时间到自动推进阶段（primary→voting→done）
  async function electionSettle(ele) {
    const now = Date.now()
    if (ele.status === 'primary' && ele.primaryEndAt && now > new Date(ele.primaryEndAt).getTime()) {
      const cands = await prisma.cityElectionCandidate.findMany({ where: { electionId: ele.id } })
      const qualified = cands.filter((c) => c.supportCount >= ELEC_PRIMARY_SUPPORT)
      if (!qualified.length) {
        await prisma.cityElection.update({ where: { id: ele.id }, data: { status: 'canceled' } })
        return { status: 'canceled' }
      }
      await prisma.cityElectionCandidate.updateMany({ where: { electionId: ele.id, uid: { in: qualified.map((c) => c.uid) } }, data: { status: 'qualified' } })
      await prisma.cityElection.update({ where: { id: ele.id }, data: { status: 'voting', voteEndAt: new Date(now + ELEC_VOTE_DAYS * 86400000) } })
      return { status: 'voting' }
    }
    if (ele.status === 'voting' && ele.voteEndAt && now > new Date(ele.voteEndAt).getTime()) {
      const cands = await prisma.cityElectionCandidate.findMany({ where: { electionId: ele.id, status: 'qualified' } })
      let winner = null
      for (const c of cands) {
        const v = await prisma.cityElectionSupport.count({ where: { electionId: ele.id, candidateUid: c.uid, type: 'vote' } })
        if (!winner || v > winner.votes) winner = { uid: c.uid, votes: v }
      }
      if (winner) {
        await prisma.cityElectionCandidate.update({ where: { electionId_uid: { electionId: ele.id, uid: winner.uid } }, data: { status: 'elected' } })
        await prisma.cityElection.update({ where: { id: ele.id }, data: { status: 'done', winnerUid: winner.uid } })
        // 当选 → 管理员
        const adm = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: ele.cityId, uid: winner.uid } } })
        if (adm) await prisma.cityAdmin.update({ where: { id: adm.id }, data: { status: 'active' } })
        else await prisma.cityAdmin.create({ data: { cityId: ele.cityId, uid: winner.uid, status: 'active' } }).catch(() => {})
        try { await wkApi('/channel/subscriber_add', { channel_id: cityPubChannel(ele.cityId), channel_type: 4, subscribers: [winner.uid] }) } catch (e: any) {}
      } else {
        await prisma.cityElection.update({ where: { id: ele.id }, data: { status: 'canceled' } })
      }
      return { status: 'done', winner: winner ? winner.uid : '' }
    }
    return { status: ele.status }
  }
  // 发起选举（创始人：每年一次 / 管理员被罢免后补选）
  fastify.post('/api/city/election/create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, type = 'annual', targetAdminUid = '' } = (request.body as any) || {}
    const c = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
    if (!c) return reply.status(404).send({ error: '城市不存在' })
    if (c.agentUid !== uid) return reply.status(403).send({ error: '仅城市创始人可发起选举' })
    const t = type === 'by' ? 'by' : 'annual'
    if (t === 'annual') {
      const year = new Date().getFullYear()
      const start = new Date(year, 0, 1)
      const exist = await prisma.cityElection.findFirst({ where: { cityId: c.id, type: 'annual', createdAt: { gte: start }, status: { in: ['primary', 'voting'] } } })
      if (exist) return reply.status(400).send({ error: '本年已有进行中的年度选举' })
    } else {
      const exist = await prisma.cityElection.findFirst({ where: { cityId: c.id, type: 'by', status: { in: ['primary', 'voting'] } } })
      if (exist) return reply.status(400).send({ error: '已有进行中的补选' })
      if (!targetAdminUid) return reply.status(400).send({ error: '补选需指定被罢免管理员位置' })
    }
    const ele = await prisma.cityElection.create({ data: { cityId: c.id, type: t, creatorUid: uid, status: 'primary', targetAdminUid: t === 'by' ? String(targetAdminUid) : '', primaryEndAt: new Date(Date.now() + ELEC_PRIMARY_DAYS * 86400000) } })
    return { success: true, data: { election: { id: String(ele.id), type: ele.type, status: ele.status, primaryEndAt: ele.primaryEndAt } } }
  })
  // 报名参选（会员）
  fastify.post('/api/city/election/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { electionId } = (request.body as any) || {}
    const ele = await prisma.cityElection.findUnique({ where: { id: String(electionId || '') } })
    if (!ele) return reply.status(404).send({ error: '选举不存在' })
    const role = await cityRole(ele.cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可报名参选' })
    if (ele.status !== 'primary') return reply.status(400).send({ error: '当前不在报名/初选阶段' })
    const dup = await prisma.cityElectionCandidate.findUnique({ where: { electionId_uid: { electionId: ele.id, uid } } })
    if (dup) return reply.status(400).send({ error: '你已报名' })
    await prisma.cityElectionCandidate.create({ data: { electionId: ele.id, uid } })
    return { success: true, data: { ok: true } }
  })
  // 初选支持（会员给参选人背书，可支持多人；每人每候选 1 次）
  fastify.post('/api/city/election/support', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { electionId, candidateUid } = (request.body as any) || {}
    const ele = await prisma.cityElection.findUnique({ where: { id: String(electionId || '') } })
    if (!ele || ele.status !== 'primary') return reply.status(400).send({ error: '初选已结束' })
    const cand = await prisma.cityElectionCandidate.findUnique({ where: { electionId_uid: { electionId: ele.id, uid: String(candidateUid || '') } } })
    if (!cand) return reply.status(404).send({ error: '参选人不存在' })
    const dup = await prisma.cityElectionSupport.findUnique({ where: { electionId_uid_type_candidateUid: { electionId: ele.id, uid, type: 'primary', candidateUid: String(candidateUid) } } })
    if (dup) return reply.status(400).send({ error: '你已支持该参选人' })
    await prisma.cityElectionSupport.create({ data: { electionId: ele.id, candidateUid: String(candidateUid), uid, type: 'primary' } })
    await prisma.cityElectionCandidate.update({ where: { id: cand.id }, data: { supportCount: { increment: 1 } } })
    return { success: true, data: { supportCount: cand.supportCount + 1 } }
  })
  // 正式投票（获参选资格者；每人 1 票）
  fastify.post('/api/city/election/vote', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { electionId, candidateUid } = (request.body as any) || {}
    const ele = await prisma.cityElection.findUnique({ where: { id: String(electionId || '') } })
    if (!ele || ele.status !== 'voting') return reply.status(400).send({ error: '当前不在投票阶段' })
    const cand = await prisma.cityElectionCandidate.findUnique({ where: { electionId_uid: { electionId: ele.id, uid: String(candidateUid || '') } } })
    if (!cand || cand.status !== 'qualified') return reply.status(404).send({ error: '参选人未获参选资格' })
    const dup = await prisma.cityElectionSupport.findUnique({ where: { electionId_uid_type_candidateUid: { electionId: ele.id, uid, type: 'vote', candidateUid: String(candidateUid) } } })
    if (dup) return reply.status(400).send({ error: '你已投过票' })
    await prisma.cityElectionSupport.create({ data: { electionId: ele.id, candidateUid: String(candidateUid), uid, type: 'vote' } })
    await prisma.cityElectionCandidate.update({ where: { id: cand.id }, data: { votes: { increment: 1 } } })
    return { success: true, data: { ok: true } }
  })
  // 选举状态（含惰性结算推进 + 候选人 + 我的状态）
  fastify.get('/api/city/election/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const ele = await prisma.cityElection.findFirst({ where: { cityId, status: { in: ['primary', 'voting'] } }, orderBy: { createdAt: 'desc' } })
    const done = await prisma.cityElection.findFirst({ where: { cityId, status: 'done' }, orderBy: { createdAt: 'desc' } })
    if (!ele && !done) return { success: true, data: { election: null } }
    const target = ele || done!
    const settled = await electionSettle(target)
    const fresh = ele ? await prisma.cityElection.findUnique({ where: { id: ele.id } }) : target
    const cands = await prisma.cityElectionCandidate.findMany({ where: { electionId: fresh!.id }, orderBy: { supportCount: 'desc' } })
    const uids = [...new Set(cands.map((c) => c.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const myCand = cands.find((c) => c.uid === uid)
    const mySupports = await prisma.cityElectionSupport.findMany({ where: { electionId: fresh!.id, uid } })
    const candidates = cands.map((c) => ({ uid: c.uid, name: umap.get(c.uid)?.nickname || umap.get(c.uid)?.username || c.uid, avatar: umap.get(c.uid)?.avatarUrl || '', status: c.status, supportCount: c.supportCount, votes: c.votes }))
    return { success: true, data: { election: { id: String(fresh!.id), type: fresh!.type, status: fresh!.status, primaryEndAt: fresh!.primaryEndAt, voteEndAt: fresh!.voteEndAt, winnerUid: fresh!.winnerUid, primarySupport: ELEC_PRIMARY_SUPPORT }, candidates, me: { applied: !!myCand, myCandidateUid: myCand ? myCand.uid : '', supported: mySupports.filter((s) => s.type === 'primary').map((s) => s.candidateUid), voted: mySupports.filter((s) => s.type === 'vote').map((s) => s.candidateUid), role: await cityRole(cityId, uid) } } }
  })


  // 城市会员列表（城市社区可见：昵称/头像/角色/加入时间）
  fastify.get('/api/city/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const cityId = String((request.query as any).cityId || '')
    const role = await cityRole(cityId, uid)
    if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
    const members = await prisma.cityMember.findMany({ where: { cityId, status: 'active' }, orderBy: { createdAt: 'asc' } })
    const uids = members.map((m) => m.uid)
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const admins = await prisma.cityAdmin.findMany({ where: { cityId, status: 'active' } })
    const adminSet = new Set(admins.map((a) => a.uid))
    const agent = await prisma.city.findUnique({ where: { id: cityId }, select: { agentUid: true } })
    const agentUid = agent?.agentUid
    return { success: true, data: { members: members.map((m) => ({ uid: m.uid, name: umap.get(m.uid)?.nickname || umap.get(m.uid)?.username || m.uid, avatar: umap.get(m.uid)?.avatarUrl || '', role: m.uid === agentUid ? 'agent' : adminSet.has(m.uid) ? 'admin' : 'member', joinedAt: m.createdAt })) } }
  })

// ═══ 打磨：公共聊天室治理（城市级）+ 横图上传 ═══
  // 公共聊天室治理设置（管理员）
  fastify.post('/api/city/pub/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, allMuted, allowImage, allowVideo, allowFile } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可设置' })
    const data: any = {}
    if (allMuted !== undefined) data.pubAllMuted = !!allMuted
    if (allowImage !== undefined) data.pubAllowImage = !!allowImage
    if (allowVideo !== undefined) data.pubAllowVideo = !!allowVideo
    if (allowFile !== undefined) data.pubAllowFile = !!allowFile
    await prisma.city.update({ where: { id: String(cityId) }, data })
    return { success: true, data: { ok: true } }
  })

  // 公共聊天室个人禁言/解禁（管理员）
  fastify.post('/api/city/pub/ban', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, targetUid, muted } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可禁言' })
    await prisma.cityMember.updateMany({ where: { cityId: String(cityId), uid: String(targetUid || '') }, data: { muted: !!muted } })
    return { success: true, data: { muted: !!muted } }
  })

  // 公共聊天室踢人（移除订阅 + 冻结会员）
  fastify.post('/api/city/pub/kick', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { cityId, targetUid } = (request.body as any) || {}
    const role = await cityRole(String(cityId || ''), uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可踢人' })
    try { await wkApi('/channel/subscriber_remove', { channel_id: cityPubChannel(String(cityId)), channel_type: 4, subscribers: [String(targetUid || '')] }) } catch (e: any) {}
    await prisma.cityMember.updateMany({ where: { cityId: String(cityId), uid: String(targetUid || '') }, data: { status: 'kicked' } })
    return { success: true, data: { kicked: true } }
  })

  // 上传/更新城市横图（管理员）
  fastify.post('/api/city/:id/banner', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: uid } = (request as any).user
    const { banner } = (request.body as any) || {}
    const c = await prisma.city.findUnique({ where: { id: request.params.id as string } })
    if (!c) return reply.status(404).send({ error: '城市不存在' })
    const role = await cityRole(c.id, uid)
    if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅管理员可上传横图' })
    if (!banner) return reply.status(400).send({ error: '缺少横图 URL' })
    await prisma.city.update({ where: { id: c.id }, data: { banner: String(banner).slice(0, 500) } })
    return { success: true, data: { banner: String(banner).slice(0, 500) } }
  })
}
