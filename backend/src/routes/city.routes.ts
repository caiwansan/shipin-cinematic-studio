import { FastifyInstance } from 'fastify'

import { prisma } from '../utils/index.js'

import { wkApi, serverSend } from './im.js'

import { createHash, randomBytes } from 'crypto'



// 高德 Web 服务签名（key 开启数字签名时必须带 sig；参数按字典序原始拼接 + 私钥 → md5）
function amapSignedUrl(path: string, params: Record<string, string>, key: string, sec: string): string {
  const all: Record<string, string> = { key, output: 'JSON', ...params }
  if (sec) {
    const raw = Object.keys(all).sort().map((k) => `${k}=${all[k]}`).join('&')
    all.sig = createHash('md5').update(raw + sec).digest('hex')
  }
  return `https://restapi.amap.com${path}?${new URLSearchParams(all).toString()}`
}

async function amapCfg(): Promise<{ key: string; sec: string }> {
  const cfg = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } }).catch(() => null)
  const v: any = cfg?.value || {}
  return { key: v.amapWebKey || v.amapKey || '', sec: v.amapWebSecret || '' }
}

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

// 城市创建时用高德 geocode 自动填经纬度（供 IP 定位距离排序）
let cityLat: number | null = null, cityLng: number | null = null
try {
const ac = await amapCfg()
if (ac.key) {
const gj: any = await (await fetch(amapSignedUrl('/v3/geocode/geo', { address: cname }, ac.key, ac.sec))).json()
const g = (gj.geocodes || [])[0]
if (g?.location) { const p = String(g.location).split(','); cityLng = Number(p[0]) || null; cityLat = Number(p[1]) || null }
}
} catch {}
const cityRows: any[] = await prisma.$queryRawUnsafe(
`INSERT INTO city (name, banner, agent_uid, lat, lng) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
cname, String(banner || '').slice(0, 500), uid, cityLat, cityLng
).catch(() => [])
const city: any = { id: (cityRows[0] as any)?.id || '' }

for (const a of adminUids) await prisma.cityAdmin.create({ data: { cityId: city.id, uid: a } }).catch(() => {})

await prisma.cityMember.create({ data: { cityId: city.id, uid, status: 'active', hash: '' } }).catch(() => {})

for (const a of adminUids) await prisma.cityMember.create({ data: { cityId: city.id, uid: a, status: 'active', hash: '' } }).catch(() => {})

try {

await wkApi('/channel', { channel_id: cityPubChannel(city.id), channel_type: 4, channel_name: `${cname}·公共聊天室`, channel_remark: '城市空间公共聊天室' })

await wkApi('/channel/subscriber_add', { channel_id: cityPubChannel(city.id), channel_type: 4, subscribers: [uid, ...adminUids] })

  // 议会群：城市自带，创始人+管理员入群

  try { await wkApi('/channel', { channel_id: 'city_'+city.id+'_parliament', channel_type: 4, channel_name: cname+'·议会', channel_remark: '城市社区议会议事群' }); await wkApi('/channel/subscriber_add', { channel_id: 'city_'+city.id+'_parliament', channel_type: 4, subscribers: [uid, ...adminUids] }) } catch (e: any) {}

  // 同步：创始人=总群群主(role2)，创始时管理员=总群管理者(role1)
  for (const a of [uid, ...adminUids]) {
    const gr = a === uid ? 2 : 1
    await prisma.imChannelMember.upsert({
      where: { channelId_channelType_uid: { channelId: cityPubChannel(city.id), channelType: 4, uid: a } },
      update: { role: gr },
      create: { channelId: cityPubChannel(city.id), channelType: 4, uid: a, role: gr },
    }).catch(() => {})
  }

} catch (e: any) { console.log('[城市] 频道创建失败:', (e as Error).message.slice(0, 60)) }

return { success: true, data: { city: { id: city.id, name: city.name, banner: city.banner, agentUid: city.agentUid, status: city.status } } }

})



fastify.get('/api/city/list', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const mine = await prisma.cityMember.findMany({ where: { uid }, select: { cityId: true, status: true } })

const myMap = new Map(mine.map((m) => [m.cityId, m.status]))

// 按用户IP定位距离排序（高德 /v3/ip；城市 lat/lng 来自 tradeConfig 代理申请 geocode；无坐标城市排最后）
let rows: any[] = await prisma.$queryRawUnsafe(
`SELECT id,name,banner,agent_uid as "agentUid",status,lat,lng FROM city WHERE status != 'closed'`
).catch(() => [])
let myLng = 0, myLat = 0
try {
let amapKey = ''
{
  const cfg2 = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } }).catch(() => null)
  const v2: any = cfg2?.value || {}
  amapKey = v2.amapWebKey || v2.amapKey || ''
  var amapSec = v2.amapWebSecret || ''
}
const ip = String(request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || request.ip || '')
if (amapKey && ip && ip !== '::1' && ip !== '127.0.0.1') {
const gj: any = await (await fetch(amapSignedUrl('/v3/ip', { ip }, amapKey, amapSec))).json()
if (String(gj.status) === '1' && gj.location) { const p = String(gj.location).split(','); myLng = Number(p[0]) || 0; myLat = Number(p[1]) || 0 }
}
} catch {}
const dist = (la: number, lo: number) => {
if (!myLat || !myLng || !la || !lo) return null
const R = 6371; const dLat = (la - myLat) * Math.PI / 180; const dLng = (lo - myLng) * Math.PI / 180
const a = Math.sin(dLat / 2) ** 2 + Math.cos(myLat * Math.PI / 180) * Math.cos(la * Math.PI / 180) * Math.sin(dLng / 2) ** 2
return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const cities = rows.map((c: any) => ({ ...c, _d: dist(c.lat, c.lng) }))
cities.sort((a: any, b: any) => { const da = a._d ?? 1e9; const db = b._d ?? 1e9; return da - db })

const out = []

for (const c of cities) {

const adminCount = await prisma.cityAdmin.count({ where: { cityId: c.id, status: 'active' } })

const memberCount = await prisma.cityMember.count({ where: { cityId: c.id, status: 'active' } })

const myRole = await cityRole(c.id, uid)

out.push({ id: c.id, name: c.name, banner: c.banner, agentUid: c.agentUid, status: c.status, lat: c.lat ?? null, lng: c.lng ?? null, distanceKm: c._d == null ? null : Math.round(c._d * 10) / 10, adminCount, memberCount, myStatus: myMap.get(c.id) || null, myRole })

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

return { success: true, data: { city: { id: c.id, name: c.name, banner: c.banner, agentUid: c.agentUid, status: c.status, createdAt: c.createdAt }, myRole: await cityRole(c.id, uid), memberCount, admins: admins.map((a) => ({ uid: a.uid, nickname: umap.get(a.uid)?.nickname || umap.get(a.uid)?.username || a.uid, pubKey: a.pubKey || '', adminType: a.adminType || 'culture' })), pubChannel: cityPubChannel(c.id), myAdminType: admins.find((ax) => ax.uid === uid)?.adminType || '' } }

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
const isOwner = room.ownerUid === uid
return { room, ok: role === 'agent' || role === 'admin' || isOwner }
}



// 全员禁言 / 媒体开关

fastify.post('/api/city/room/:id/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const { allMuted, allowImage, allowVideo, allowFile } = (request.body as any) || {}

const { room, ok } = await roomAdminCheck(request.params.id as string, uid)
if (!ok) return reply.status(403).send({ error: '无权限' })
if (!targetUid) return reply.status(400).send({ error: '缺少目标用户' })
const role = await cityRole(room!.cityId, uid)
if (role !== 'agent' && role !== 'admin' && uid !== room!.ownerUid) return reply.status(403).send({ error: '仅群主或总群管可踢人' })
try { await wkApi('/channel/subscriber_remove', { channel_id: room!.channelId, channel_type: 4, subscribers: [targetUid] }) } catch (e: any) {}

await prisma.cityRoomMember.deleteMany({ where: { roomId: room!.id, uid: targetUid } })

return { success: true, data: { kicked: true } }

})


// ═══ P2+: 城市会员申请开通私域群（申请人=群主，总群管审核并入群为管理员）═══
fastify.post('/api/city/room/claim', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const { cityId, name } = (request.body as any) || {}
const cid = String(cityId || '')
const role = await cityRole(cid, uid)
if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可申请开通私域群' })
const rname = String(name || '').trim()
if (!rname || rname.length > 20) return reply.status(400).send({ error: '群名称必填且不超过 20 字' })
const dup = await prisma.cityRoomClaim.findFirst({ where: { cityId: cid, uid, status: 'pending' } })
if (dup) return reply.status(400).send({ error: '已有待审核的开群申请' })
await prisma.cityRoomClaim.create({ data: { cityId: cid, name: rname, uid } })
return { success: true, data: { pending: true } }
})

fastify.get('/api/city/room/claims', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const cityId = String((request.query as any).cityId || '')
const role = await cityRole(cityId, uid)
if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅总群管理员可审核' })
const rows = await prisma.cityRoomClaim.findMany({ where: { cityId, status: 'pending' }, orderBy: { createdAt: 'asc' } })
const uids = rows.map((r) => r.uid)
const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
const umap = new Map(users.map((u) => [u.id, u]))
return { success: true, data: { claims: rows.map((r) => ({ id: r.id, name: r.name, uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid })) } }
})

fastify.post('/api/city/room/claims/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: adminUid } = (request as any).user
const { approve } = (request.body as any) || {}
const claim = await prisma.cityRoomClaim.findUnique({ where: { id: String(request.params.id as any) } })
if (!claim || claim.status !== 'pending') return reply.status(404).send({ error: '申请不存在' })
const role = await cityRole(claim.cityId, adminUid)
if (role !== 'agent' && role !== 'admin') return reply.status(403).send({ error: '仅总群管理员可审核' })
if (!approve) {
await prisma.cityRoomClaim.update({ where: { id: claim.id }, data: { status: 'rejected' } })
return { success: true, data: { approved: false } }
}
const room = await prisma.cityRoom.create({ data: { cityId: claim.cityId, name: claim.name, ownerUid: claim.uid, channelId: '' } })
const chId = cityRoomChannel(claim.cityId, room.id)
await prisma.cityRoom.update({ where: { id: room.id }, data: { channelId: chId } })
await prisma.cityRoomMember.create({ data: { roomId: room.id, uid: claim.uid, status: 'active' } }).catch(() => {})
const admins = await prisma.cityAdmin.findMany({ where: { cityId: claim.cityId, status: 'active' } })
const city = await prisma.city.findUnique({ where: { id: claim.cityId } })
const adminUids = [...new Set([...(city ? [city.agentUid] : []), ...admins.map((a) => a.uid)])]
for (const au of adminUids) {
await prisma.cityRoomMember.create({ data: { roomId: room.id, uid: au, status: 'active' } }).catch(() => {})
}
try {
await wkApi('/channel', { channel_id: chId, channel_type: 4, channel_name: claim.name, channel_remark: '私域群（群主申请制）' })
await wkApi('/channel/subscriber_add', { channel_id: chId, channel_type: 4, subscribers: [claim.uid, ...adminUids] })
} catch (e: any) { console.log('[城市] 私域群创建失败:', (e as Error).message.slice(0, 60)) }
await prisma.cityRoomClaim.update({ where: { id: claim.id }, data: { status: 'approved' } })
return { success: true, data: { approved: true, room: { id: room.id, name: room.name, channelId: chId, ownerUid: claim.uid } } }
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

likeUsers: [],
commentUsers: [],
}))

// 补评论者/点赞者昵称
const allUids = new Set<string>()
for (const p of out) {
const c = Array.isArray(p.comments) ? p.comments : []
for (const cm of c) if (cm && cm.uid) allUids.add(String(cm.uid))
const lk = Array.isArray(p.likes) ? p.likes : []
for (const lu of lk) if (lu) allUids.add(String(lu))
}
const cusers = allUids.size ? await prisma.user.findMany({ where: { id: { in: [...allUids] } }, select: { id: true, nickname: true, username: true } }) : []
const cumap = new Map(cusers.map((u) => [u.id, u.nickname || u.username || String(u.id)]))
for (const p of out) {
p.comments = (Array.isArray(p.comments) ? p.comments : []).map((cm: any) => ({ ...cm, nickname: cumap.get(String(cm.uid)) || String(cm.uid || '') }))
p.likeUsers = (Array.isArray(p.likes) ? p.likes : []).map((lu: any) => ({ uid: String(lu), nickname: cumap.get(String(lu)) || String(lu) }))
}

  // 补充参选帖投票信息（isCandidacy / 支持 / 不支持 / 我的选项）
  const postIds = out.map((p) => p.id)
  const cands = postIds.length ? await prisma.cityRepCandidacy.findMany({ where: { postId: { in: postIds } } }) : []
  const candByPost = new Map<string, any[]>()
  for (const cd of cands) { const a = candByPost.get(cd.postId) || []; a.push(cd); candByPost.set(cd.postId, a) }
  for (const p of out) {
    const cds = candByPost.get(p.id) || []
    if (cds.length) {
      const cd = cds[0]
      const yes = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'yes' } })
      const no = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'no' } })
      const my = await prisma.cityRepBallot.findUnique({ where: { candidacyId_uid: { candidacyId: cd.id, uid } } }).catch(() => null)
      p.isCandidacy = true; p.candidacyId = String(cd.id); p.candYes = yes; p.candNo = no; p.myCandOption = my?.option || ''
    }
  }

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
let inviterHash = ''

const c = await prisma.city.findUnique({ where: { id: String(cityId || '') } })

if (!c || c.status === 'closed') return reply.status(404).send({ error: '城市不存在' })

const exist = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: c.id, uid } } })

if (exist) return reply.status(400).send({ error: exist.status === 'active' ? '你已是该城市会员' : '申请已提交，等待审核' })


    if (!inviteCode) {
      return reply.status(400).send({ error: '加入需邀请码', needInvite: true })
    }
    const inv = await prisma.cityInvite.findFirst({ where: { cityId: c.id, code: String(inviteCode).trim().toUpperCase() } })
    if (inv) {
      if (inv.inviterUid === uid) return reply.status(400).send({ error: '不能使用自己的邀请码' })
      inviterHash = inv.hash
    } else {
      return reply.status(400).send({ error: '邀请码无效' })
    }


await prisma.cityMember.create({ data: { cityId: c.id, uid, status: 'active', hash: '', inviterHash, inviteHash: '' } }).catch(() => {})

// 邀请码加入 → 直接成为会员并加入城市总群
try { await wkApi('/channel/subscriber_add', { channel_id: cityPubChannel(c.id), channel_type: 4, subscribers: [uid] }) } catch (e: any) {}

return { success: true, data: { active: true, inviteHash: inv.hash } }

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

await prisma.cityBiz.create({ data: { cityId: String(cityId), uid, licensePic: String(licensePic).slice(0, 500), venuePic: String(venuePic).slice(0, 500), shopName: String((request.body as any).shopName || '').slice(0, 60), legalRep: String((request.body as any).legalRep || '').slice(0, 60), phone: String((request.body as any).phone || '').slice(0, 30), banner: String((request.body as any).banner || '').slice(0, 500), lat: Number((request.body as any).lat) || 0, lng: Number((request.body as any).lng) || 0, address: String((request.body as any).address || '').slice(0, 200), bizDesc: String((request.body as any).bizDesc || '').slice(0, 500), status: 'pending' } })

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

const { cityId, shopName, banner, lat, lng, address, bizDesc, phone, intro } = (request.body as any) || {}

const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId || ''), uid } } })

if (!biz || biz.status !== 'active') return reply.status(403).send({ error: '仅认证商家可管理店铺' })

await prisma.cityBiz.update({ where: { id: biz.id }, data: {

shopName: shopName !== undefined ? String(shopName).slice(0, 60) : biz.shopName,

banner: banner !== undefined ? String(banner).slice(0, 500) : biz.banner,

lat: lat !== undefined ? Number(lat) || 0 : biz.lat,

lng: lng !== undefined ? Number(lng) || 0 : biz.lng,

address: address !== undefined ? String(address).slice(0, 200) : biz.address,

bizDesc: bizDesc !== undefined ? String(bizDesc).slice(0, 500) : biz.bizDesc,

phone: phone !== undefined ? String(phone).slice(0, 20) : biz.phone,

intro: intro !== undefined ? String(intro).slice(0, 500) : biz.intro,

} })

return { success: true, data: { ok: true } }

})

// 商品上架

fastify.post('/api/city/biz/product/add', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const { cityId, name, cover = '', images = [], detailImages = [], prodDesc = '', priceTea, stock, standard = '', licenseNo = '', manufacturer = '', barcode = '', origin = '', netWeight = '', shelfLife = '', storage = '', commissionRate = 0 } = (request.body as any) || {}

const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId: String(cityId || ''), uid } } })

if (!biz || biz.status !== 'active') return reply.status(403).send({ error: '仅认证商家可上架商品' })

if (biz.downgraded) return reply.status(403).send({ error: '商家已被降权' })

const nm = String(name || '').trim()

const price = Math.floor(Number(priceTea) || 0)

const stk = Math.floor(Number(stock) || 0)

if (!nm) return reply.status(400).send({ error: '商品名称必填' })

if (price < 1) return reply.status(400).send({ error: '茶票价格至少 1' })

const imgs = (Array.isArray(images) ? images : []).filter((x: any) => typeof x === 'string').slice(0, 9)
const detailImgs = (Array.isArray(detailImages) ? detailImages : []).filter((x: any) => typeof x === 'string').slice(0, 20)

const p = await prisma.cityBizProduct.create({ data: { bizId: biz.id, name: nm.slice(0, 60), cover: String(cover).slice(0, 500), images: JSON.stringify(imgs), detailImages: JSON.stringify(detailImgs), prodDesc: String(prodDesc).slice(0, 500), priceTea: price, stock: stk, standard: String(standard).slice(0, 100), licenseNo: String(licenseNo).slice(0, 100), manufacturer: String(manufacturer).slice(0, 200), barcode: String(barcode).slice(0, 50), origin: String(origin).slice(0, 200), netWeight: String(netWeight).slice(0, 50), shelfLife: String(shelfLife).slice(0, 100), storage: String(storage).slice(0, 200), commissionRate: Math.min(100, Math.max(0, Math.floor(Number(commissionRate) || 0))) } })

return { success: true, data: { id: String(p.id), name: p.name, priceTea: p.priceTea } }

})

// 商品更新（改价/库存/上下架）

fastify.post('/api/city/biz/product/update', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const { productId, name, cover, images, detailImages, prodDesc, priceTea, stock, status, standard, licenseNo, manufacturer, barcode, origin, netWeight, shelfLife, storage, commissionRate } = (request.body as any) || {}

const p = await prisma.cityBizProduct.findUnique({ where: { id: String(productId || '') } })

if (!p) return reply.status(404).send({ error: '商品不存在' })

const biz = await prisma.cityBiz.findUnique({ where: { id: p.bizId } })

if (!biz || biz.uid !== uid) return reply.status(403).send({ error: '仅商家本人可管理' })

const data: any = {
name: name !== undefined ? String(name).slice(0, 60) : p.name,
cover: cover !== undefined ? String(cover).slice(0, 500) : p.cover,
prodDesc: prodDesc !== undefined ? String(prodDesc).slice(0, 500) : p.prodDesc,
priceTea: priceTea !== undefined ? Math.max(1, Math.floor(Number(priceTea) || 1)) : p.priceTea,
stock: stock !== undefined ? Math.max(0, Math.floor(Number(stock) || 0)) : p.stock,
status: status !== undefined ? (status === 'active' || status === 'off' ? status : p.status) : p.status,
standard: standard !== undefined ? String(standard).slice(0, 100) : p.standard,
licenseNo: licenseNo !== undefined ? String(licenseNo).slice(0, 100) : p.licenseNo,
manufacturer: manufacturer !== undefined ? String(manufacturer).slice(0, 200) : p.manufacturer,
barcode: barcode !== undefined ? String(barcode).slice(0, 50) : p.barcode,
origin: origin !== undefined ? String(origin).slice(0, 200) : p.origin,
netWeight: netWeight !== undefined ? String(netWeight).slice(0, 50) : p.netWeight,
shelfLife: shelfLife !== undefined ? String(shelfLife).slice(0, 100) : p.shelfLife,
storage: storage !== undefined ? String(storage).slice(0, 200) : p.storage,
commissionRate: commissionRate !== undefined ? Math.min(100, Math.max(0, Math.floor(Number(commissionRate) || 0))) : p.commissionRate,
}
if (images !== undefined) data.images = JSON.stringify((Array.isArray(images) ? images : []).filter((x: any) => typeof x === 'string').slice(0, 9))
if (detailImages !== undefined) data.detailImages = JSON.stringify((Array.isArray(detailImages) ? detailImages : []).filter((x: any) => typeof x === 'string').slice(0, 20))

await prisma.cityBizProduct.update({ where: { id: p.id }, data })

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

// ── 推荐佣金系统 ──

// 生成推荐链接（用户在社区发帖时插入店铺/产品链接用）
fastify.post('/api/city/biz/referral/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const { bizId, productId } = (request.body as any) || {}
if (!bizId && !productId) return reply.status(400).send({ error: '缺少店铺ID或产品ID' })
return { success: true, data: { referralCode: `ref_${uid.slice(0, 8)}_${Date.now().toString(36)}`, referrerId: uid } }
})

// 佣金记录列表
fastify.get('/api/city/biz/referral/list', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const referrals = await prisma.cityBizReferral.findMany({ where: { referrerId: uid }, orderBy: { createdAt: 'desc' } })
return { success: true, data: { referrals: referrals.map((r) => ({ id: String(r.id), bizId: r.bizId, productId: r.productId, commission: r.commission, status: r.status, createdAt: r.createdAt })) } }
})

// 商家核销确认（用户线下到店核销后，商家确认→推荐人获佣金）
fastify.post('/api/city/biz/referral/verify', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const { referralId } = (request.body as any) || {}
const ref = await prisma.cityBizReferral.findUnique({ where: { id: String(referralId || '') } })
if (!ref) return reply.status(404).send({ error: '佣金记录不存在' })
const biz = await prisma.cityBiz.findUnique({ where: { id: ref.bizId } })
if (!biz || biz.uid !== uid) return reply.status(403).send({ error: '仅商家可核销确认' })
if (ref.status !== 'pending') return reply.status(400).send({ error: '该记录已处理' })
await prisma.cityBizReferral.update({ where: { id: ref.id }, data: { status: 'confirmed', verifiedBy: uid, verifiedAt: new Date() } })
// 给推荐人发佣金
await prisma.user.update({ where: { id: ref.referrerId }, data: { teaCoins: { increment: ref.commission } } })
await prisma.coinLog.create({ data: { userId: ref.referrerId, amount: ref.commission, type: 'referral_commission', balance: 0, remark: `推荐佣金：${ref.commission}工分` } })
return { success: true, data: { ok: true, commission: ref.commission } }
})

// 我的店铺（店铺信息 + 商品管理列表）

fastify.get('/api/city/biz/shop/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const cityId = String((request.query as any).cityId || '')

const biz = await prisma.cityBiz.findUnique({ where: { cityId_uid: { cityId, uid } } })

if (!biz || biz.status !== 'active') return { success: true, data: { shop: null } }

const products = await prisma.cityBizProduct.findMany({ where: { bizId: biz.id }, orderBy: { createdAt: 'desc' } })

return { success: true, data: { shop: { id: biz.id, shopName: biz.shopName, banner: biz.banner, lat: biz.lat, lng: biz.lng, address: biz.address, phone: biz.phone, intro: biz.intro, bizDesc: biz.bizDesc, status: biz.status, downgraded: biz.downgraded }, products: products.map((p) => ({ id: String(p.id), name: p.name, cover: p.cover, images: JSON.parse(p.images || '[]'), detailImages: JSON.parse(p.detailImages || '[]'), prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock, status: p.status, standard: p.standard, licenseNo: p.licenseNo, manufacturer: p.manufacturer, barcode: p.barcode, origin: p.origin, netWeight: p.netWeight, shelfLife: p.shelfLife, storage: p.storage, commissionRate: p.commissionRate })) } }

})

// 城市店铺列表（门头卡：店名+门头横图+定位+商品数）


// 城市易货商品聚合列表（全部 active 商品 + 店铺名，网店网格用）
fastify.get('/api/city/biz/products', { preHandler: [fastify.authenticate] }, async (request, reply) => {
const { id: uid } = (request as any).user
const cityId = String((request.query as any).cityId || '')
const role = await cityRole(cityId, uid)
if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
const bizs = await prisma.cityBiz.findMany({ where: { cityId, status: { in: ['active', 'approved'] }, downgraded: false } })
const bizMap = new Map(bizs.map((b) => [b.id, b]))
if (!bizs.length) return { success: true, data: { products: [] } }
const prods = await prisma.cityBizProduct.findMany({ where: { bizId: { in: bizs.map((b) => b.id) }, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 300 })
const list = prods.map((p) => {
const b = bizMap.get(p.bizId)
return { id: p.id, name: p.name, cover: p.cover, images: JSON.parse(p.images || '[]'), detailImages: JSON.parse(p.detailImages || '[]'), prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock, shopName: b?.shopName || '店铺', shopId: b?.id, sellerUid: b?.uid, standard: p.standard, licenseNo: p.licenseNo, manufacturer: p.manufacturer, barcode: p.barcode, origin: p.origin, netWeight: p.netWeight, shelfLife: p.shelfLife, storage: p.storage, commissionRate: p.commissionRate }
})
return { success: true, data: { products: list } }
})

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

list.push({ id: b.id, uid: b.uid, shopName: b.shopName || (umap.get(b.uid)?.nickname || umap.get(b.uid)?.username || '未命名店铺'), banner: b.banner, lat: b.lat, lng: b.lng, address: b.address, phone: b.phone, intro: b.intro, productCount: cnt, heat: Math.round(b.heat * 100) / 100 })

}

list.sort((a, b) => b.heat - a.heat)

return { success: true, data: { shops: list, myRole: role } }

})

// 发现页「商家」栏目：所有入驻商家（跨城市，登录即可见，不需城市会员）

fastify.get('/api/city/biz/shops/all', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {

const bizs: any = await prisma.$queryRawUnsafe(`

SELECT b.id, b.uid, b.city_id AS "cityId", b.shop_name AS "shopName", b.banner, b.lat, b.lng, b.address, b.heat, c.name AS "cityName"

FROM city_biz b LEFT JOIN city c ON c.id = b.city_id

WHERE b.status = 'active' AND b.downgraded = false

ORDER BY b.heat DESC

`)

const rows: any[] = bizs || []

const uids = [...new Set(rows.map((b) => b.uid))]

const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []

const umap = new Map(users.map((u: any) => [u.id, u]))

// 按店家去重（同一 uid 多城市保留热度最高的一条）

const byUid = new Map<string, any>()

for (const b of rows) {
const cntRow: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM city_biz_product WHERE biz_id = $1 AND status = 'active'`, b.id)
const cnt = cntRow?.[0]?.cnt || 0
if (!byUid.has(b.uid) || b.heat > (byUid.get(b.uid)?.heat || 0)) {
byUid.set(b.uid, { id: b.id, uid: b.uid, shopName: b.shopName || (umap.get(b.uid)?.nickname || umap.get(b.uid)?.username || '未命名店铺'), banner: b.banner, address: b.address, cityName: b.cityName || '', heat: Math.round(b.heat * 100) / 100, productCount: cnt })
}
}

const list = [...byUid.values()].sort((a, b) => b.heat - a.heat).slice(0, 100)

return { success: true, data: { shops: list } }

})

// 发现页「商家」店铺详情（公开，不需城市会员）：门头 + 定位 + 商品 + 评价

fastify.get('/api/city/biz/shop/:id/public', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {

const biz: any = await prisma.cityBiz.findUnique({ where: { id: String(request.params.id) } })

if (!biz || biz.status !== 'active' || biz.downgraded) return reply.status(404).send({ error: '店铺不存在' })

const owner: any = await prisma.user.findUnique({ where: { id: biz.uid }, select: { nickname: true, username: true } })

const products: any = await prisma.cityBizProduct.findMany({ where: { bizId: biz.id, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 50 })

const cityInfo: any = await prisma.city.findUnique({ where: { id: biz.cityId }, select: { name: true } })

let good = 0, bad = 0

try {

const reviews: any = await prisma.cityReview.findMany({ where: { bizId: biz.id } })

good = reviews.filter((r: any) => r.type === 'good').length

bad = reviews.filter((r: any) => r.type === 'bad').length

} catch { /* 无评价表则忽略 */ }

return { success: true, data: {

shop: { id: biz.id, uid: biz.uid, shopName: biz.shopName || owner?.nickname || owner?.username || '未命名店铺', banner: biz.banner, lat: biz.lat, lng: biz.lng, address: biz.address, phone: biz.phone, intro: biz.intro, bizDesc: biz.bizDesc, ownerName: owner?.nickname || owner?.username || '', cityName: cityInfo?.name || '', heat: Math.round(biz.heat * 100) / 100, good, bad },

products: (products || []).map((p: any) => ({ id: String(p.id), name: p.name, cover: p.cover, images: JSON.parse(p.images || '[]'), detailImages: JSON.parse(p.detailImages || '[]'), prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock, standard: p.standard, licenseNo: p.licenseNo, manufacturer: p.manufacturer, barcode: p.barcode, origin: p.origin, netWeight: p.netWeight, shelfLife: p.shelfLife, storage: p.storage, commissionRate: p.commissionRate })),

} }

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

return { success: true, data: { shop: { id: biz.id, uid: biz.uid, shopName: biz.shopName || owner?.nickname || owner?.username || '未命名店铺', banner: biz.banner, lat: biz.lat, lng: biz.lng, address: biz.address, phone: biz.phone, intro: biz.intro, bizDesc: biz.bizDesc, ownerName: owner?.nickname || owner?.username || '', heat: Math.round(biz.heat * 100) / 100, good, bad }, products: products.map((p) => ({ id: String(p.id), name: p.name, cover: p.cover, prodDesc: p.prodDesc, priceTea: p.priceTea, stock: p.stock, commissionRate: p.commissionRate })) } }

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

// ═══ 解散社区投票（15天·全员·支持>不支持→次日自动解散）═══
const DISSOLVE_DAYS = 15
async function dissolveSettle(vote: any) {
  const now = Date.now()
  const ends = vote.endsAt ? new Date(vote.endsAt).getTime() : now
  if (vote.status !== 'open') return vote
  if (now < ends) return vote
  const yes = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'yes' } })
  const no = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'no' } })
  let closed = false
  if (yes > no && yes > 0) {
    await prisma.city.update({ where: { id: vote.cityId }, data: { status: 'closed' } }).catch(() => {})
    await wkApi('/channel/dissolve', { channel_id: cityPubChannel(vote.cityId), channel_type: 4 }).catch(() => {})
    closed = true
  }
  await prisma.cityVote.update({ where: { id: vote.id }, data: { status: 'closed' } }).catch(() => {})
  return { ...vote, _closed: closed }
}

fastify.post('/api/city/dissolve/propose', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const { cityId } = (request.body as any) || {}
  const c0 = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
  if (!c0 || c0.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
  if (c0.agentUid !== uid) return reply.status(403).send({ error: '仅城市社区创始人可发起解散投票' })
  const open = await prisma.cityVote.findFirst({ where: { cityId: c0.id, type: 'dissolve', status: 'open' } })
  if (open) return reply.status(400).send({ error: '已有进行中的解散投票' })
  const vote = await prisma.cityVote.create({ data: { cityId: c0.id, type: 'dissolve', subject: '解散该城市社区', initiator: uid, status: 'open', endsAt: new Date(Date.now() + DISSOLVE_DAYS * 86400000) } })
  const sysPayload = Buffer.from(JSON.stringify({ type: 9, content: { title: '解散社区投票', cityId: c0.id, voteId: String(vote.id), endsAt: vote.endsAt, subject: '是否解散该城市社区?' } })).toString('base64')
  await wkApi('/message/send', { channel_id: cityPubChannel(c0.id), channel_type: 4, from_uid: 'system', payload: sysPayload }).catch(() => {})
  return { success: true, data: { voteId: String(vote.id), endsAt: vote.endsAt } }
})

fastify.post('/api/city/dissolve/vote', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const { voteId, option } = (request.body as any) || {}
  const vote = await prisma.cityVote.findUnique({ where: { id: String(voteId || '') } })
  if (!vote || vote.type !== 'dissolve') return reply.status(404).send({ error: '投票不存在' })
  if (vote.status !== 'open') return reply.status(400).send({ error: '投票已结束' })
  if (vote.endsAt && Date.now() > new Date(vote.endsAt).getTime()) { await dissolveSettle(vote); return reply.status(400).send({ error: '投票已结束' }) }
  if (!['yes', 'no'].includes(String(option))) return reply.status(400).send({ error: '无效选项' })
  const role = await cityRole(vote.cityId, uid)
  if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市社区成员可投票' })
  const dup = await prisma.cityBallot.findUnique({ where: { voteId_uid: { voteId: vote.id, uid } } })
  if (dup) return reply.status(400).send({ error: '你已投过票' })
  await prisma.cityBallot.create({ data: { voteId: vote.id, uid, option: String(option) } }).catch(() => {})
  return { success: true }
})

fastify.get('/api/city/dissolve/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const cityId = String((request.query as any).cityId || '')
  const c0 = await prisma.city.findUnique({ where: { id: cityId }, select: { status: true, agentUid: true } })
  const isAgent = c0?.agentUid === uid
  const vote = await prisma.cityVote.findFirst({ where: { cityId, type: 'dissolve' }, orderBy: { createdAt: 'desc' } })
  if (!vote) return { success: true, data: { vote: null, isAgent, cityStatus: c0?.status } }
  await dissolveSettle(vote)
  const yes = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'yes' } })
  const no = await prisma.cityBallot.count({ where: { voteId: vote.id, option: 'no' } })
  const total = await prisma.cityMember.count({ where: { cityId, status: 'active' } })
  const my = await prisma.cityBallot.findUnique({ where: { voteId_uid: { voteId: vote.id, uid } } }).catch(() => null)
  return { success: true, data: { vote: { id: String(vote.id), subject: vote.subject, initiator: vote.initiator, status: vote.status, endsAt: vote.endsAt, yes, no, totalMembers: total, myOption: my?.option || '', isAgent, myInitiator: vote.initiator === uid, cityStatus: c0?.status } } }
})


// 创始人取消已发起的解散投票（仅发起人本人，未结束可取消）
fastify.post('/api/city/dissolve/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const { voteId } = (request.body as any) || {}
  const vote = await prisma.cityVote.findUnique({ where: { id: String(voteId || '') } })
  if (!vote || vote.type !== 'dissolve') return reply.status(404).send({ error: '投票不存在' })
  if (vote.initiator !== uid) return reply.status(403).send({ error: '仅发起人本人可取消该投票' })
  if (vote.status !== 'open') return reply.status(400).send({ error: '投票已结束，无法取消' })
  await prisma.cityVote.update({ where: { id: vote.id }, data: { status: 'cancelled' } }).catch(() => {})
  // 通知总群：投票已取消
  const sysPayload = Buffer.from(JSON.stringify({ type: 1, content: { text: '解散社区投票已由创始人取消' } })).toString('base64')
  await wkApi('/message/send', { channel_id: cityPubChannel(vote.cityId), channel_type: 4, from_uid: 'system', payload: sysPayload }).catch(() => {})
  return { success: true }
})

// 城市社区创始人上传城市地标/头图
fastify.post('/api/city/banner', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const { cityId, banner } = (request.body as any) || {}
  const c0 = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
  if (!c0 || c0.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
  if (c0.agentUid !== uid) return reply.status(403).send({ error: '仅城市社区创始人可上传地标图' })
  if (!banner) return reply.status(400).send({ error: '请选择地标图片' })
  await prisma.city.update({ where: { id: c0.id }, data: { banner: String(banner).slice(0, 500) } }).catch(() => {})
  return { success: true, data: { banner: String(banner).slice(0, 500) } }
})

fastify.post('/api/city/vote/remove-admin', { preHandler: [fastify.authenticate] }, async (request, reply) => {

const { id: uid } = (request as any).user

const { cityId, targetAdminUid } = (request.body as any) || {}

const role = await cityRole(String(cityId || ''), uid)

if (role !== 'member') return reply.status(403).send({ error: '仅普通会员可发起罢免，创始人与群管理不能在普通选举中罢免' })

// 仅已完成助记词身份验证的会员可发起罢免

if (!(await isMnemonicVerified(uid))) return reply.status(403).send({ error: '请先在我的空间完成助记词身份验证' })

// 普通会员一月一次罢免权利

const monthAgo = new Date(Date.now() - 30 * 86400000)

const recent = await prisma.cityVote.findFirst({ where: { initiator: uid, type: 'remove_admin', createdAt: { gte: monthAgo } } })

if (recent) return reply.status(429).send({ error: '你本月已使用过一次罢免权利' })

const cc0 = await prisma.city.findUnique({ where: { id: String(cityId || '') }, select: { agentUid: true } })

if (cc0 && cc0.agentUid === String(targetAdminUid || '')) return reply.status(400).send({ error: '创始人不能列入罢免' })

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
const adminTypeMap = new Map(admins.map((a) => [a.uid, a.adminType || 'culture']))

const agent = await prisma.city.findUnique({ where: { id: cityId }, select: { agentUid: true } })

const agentUid = agent?.agentUid

return { success: true, data: { members: members.map((m) => ({ uid: m.uid, name: umap.get(m.uid)?.nickname || umap.get(m.uid)?.username || m.uid, avatar: umap.get(m.uid)?.avatarUrl || '', role: m.uid === agentUid ? 'agent' : adminSet.has(m.uid) ? ('admin:' + (adminTypeMap.get(m.uid) || 'culture')) : 'member', joinedAt: m.createdAt })) } }

})
// 创始人任命/变更/移除群管理（文化/巡查/商事/活动）
fastify.post('/api/city/admin/set', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { id: uid } = (request as any).user
  const { cityId, targetUid, adminType = '', reason = '' } = (request.body as any) || {}
  const c0 = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
  if (!c0) return reply.status(404).send({ error: '城市不存在' })
  if (c0.agentUid !== uid) return reply.status(403).send({ error: '仅城市创始人可任免群管理' })
  if (!targetUid || targetUid === uid) return reply.status(400).send({ error: '目标无效' })
  const TYPES = ['culture', 'admin_patrol', 'admin_biz', 'admin_event']
  const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: c0.id, uid: targetUid } } })
  if (!mem || mem.status !== 'active') return reply.status(400).send({ error: '该用户不是本城会员' })
  if (adminType === '') {
    await prisma.cityAdmin.deleteMany({ where: { cityId: c0.id, uid: targetUid } })
    // 同步：移除社区管理员 → 总群管理人角色降回普通成员
    await prisma.imChannelMember.upsert({
      where: { channelId_channelType_uid: { channelId: cityPubChannel(c0.id), channelType: 4, uid: targetUid } },
      update: { role: 0 },
      create: { channelId: cityPubChannel(c0.id), channelType: 4, uid: targetUid, role: 0 },
    }).catch(() => {})
    return { success: true, data: { removed: true } }
  }
  if (!TYPES.includes(adminType)) return reply.status(400).send({ error: '无效的管理身份' })
  const exist = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: c0.id, uid: targetUid } } })
  if (exist) await prisma.cityAdmin.update({ where: { id: exist.id }, data: { adminType, status: 'active' } })
  else await prisma.cityAdmin.create({ data: { cityId: c0.id, uid: targetUid, adminType, status: 'active' } }).catch(() => {})
  // 同步：社区管理员同时也是总群管理者
  await prisma.imChannelMember.upsert({
    where: { channelId_channelType_uid: { channelId: cityPubChannel(c0.id), channelType: 4, uid: targetUid } },
    update: { role: 1 },
    create: { channelId: cityPubChannel(c0.id), channelType: 4, uid: targetUid, role: 1 },
  }).catch(() => {})
  return { success: true, data: { adminType } }
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


// ═══ P3 议会 + 私域群改名 ═══
const PARLIAMENT_CAP = 101
const REP_INACTIVE_DAYS = 30

async function isMnemonicVerified(uid: string) {
  try {
    const rows: any = await prisma.$queryRawUnsafe('SELECT mnemonic FROM identity_regulatory WHERE user_id = $1', uid)
    return !!(rows?.[0]?.mnemonic && String(rows[0].mnemonic).trim() !== '')
  } catch (e) { return false }
}
function parliamentChannel(cityId: string) { return `city_${cityId}_parliament` }

async function parliamentMinds(cityId: string) {
  const c0 = await prisma.city.findUnique({ where: { id: cityId }, select: { agentUid: true } })
  const admins = await prisma.cityAdmin.findMany({ where: { cityId, status: 'active' }, select: { uid: true } })
  const reps = await prisma.cityRep.findMany({ where: { cityId, status: 'active' }, select: { uid: true } })
  const s = new Set([c0?.agentUid, ...admins.map(a => a.uid), ...reps.map(x => x.uid)].filter(Boolean) as string[])
  return s
}
async function isParliamentMember(cityId: string, uid: string) {
  const s = await parliamentMinds(cityId); return s.has(uid)
}

fastify.post('/api/city/room/rename', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { roomId, name } = request.body as any || {}
  const room = await prisma.cityRoom.findUnique({ where: { id: String(roomId || '') } })
  if (!room) return reply.status(404).send({ error: '私域群不存在' })
  if (room.ownerUid !== uid) return reply.status(403).send({ error: '仅私域群主可修改群名称' })
  if (!name || !String(name).trim()) return reply.status(400).send({ error: '群名称不能为空' })
  const nm = String(name).trim().slice(0, 40)
  await prisma.cityRoom.update({ where: { id: room.id }, data: { name: nm } })
  await wkApi('/channel/update', { channel_id: room.channelId, channel_type: 4, channel_name: nm }).catch(() => {})
  return { success: true }
})

fastify.post('/api/city/parliament/candidacy', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { cityId, title, content } = request.body as any || {}
  const role = await cityRole(String(cityId || ''), uid)
  if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可参选' })
  if (!(await isMnemonicVerified(uid))) return reply.status(403).send({ error: '请先在我的空间完成助记词身份验证' })
  const c0 = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
  if (!c0 || c0.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
  // 识别身份：创始人/群管理天然是议会成员，不能发起参选
  if (c0.agentUid === uid) return reply.status(403).send({ error: '我是城市创始人，无需参选' })
  const isAdmin = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId: c0.id, uid } } })
  if (isAdmin && isAdmin.status === 'active') return reply.status(403).send({ error: '我是群管理，无需参选' })
  await removeInactiveReps(c0.id)
  const reps = await prisma.cityRep.count({ where: { cityId: c0.id, status: 'active' } })
  const admins = await prisma.cityAdmin.count({ where: { cityId: c0.id, status: 'active' } })
  if (reps + admins + 1 >= PARLIAMENT_CAP) return reply.status(400).send({ error: '议会议员已满 101 人' })
  if (!title || !String(title).trim()) return reply.status(400).send({ error: '参选标题必填' })
  // 发布参选帖到城市社区
  const body = String(content || '').trim() || String(title).trim()
  const post = await prisma.cityPost.create({ data: { cityId: c0.id, uid, content: body.slice(0, 2000), title: '🗳️ 参选议会代表：' + String(title).trim().slice(0, 50), images: '[]', sig: '', pubKey: '' } }).catch(() => null)
  const elec = await prisma.cityRepElection.findFirst({ where: { cityId: c0.id, status: 'open' } })
  const eid = elec?.id || (await prisma.cityRepElection.create({ data: { cityId: c0.id, status: 'open', endsAt: new Date(Date.now() + 15 * 86400000) } })).id
  const exist = await prisma.cityRepCandidacy.findUnique({ where: { electionId_uid: { electionId: eid, uid } } })
  if (exist) return reply.status(400).send({ error: '你已参选' })
  await prisma.cityRepCandidacy.create({ data: { electionId: eid, cityId: c0.id, uid, postId: post ? String(post.id) : '', title: String(title).trim().slice(0, 80) } })
  return { success: true, data: { electionId: eid, postId: post ? String(post.id) : '' } }
})

fastify.post('/api/city/parliament/rep-vote', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { candidacyId, option } = request.body as any || {}
  if (!['yes', 'no'].includes(String(option))) return reply.status(400).send({ error: '无效选项' })
  const cand = await prisma.cityRepCandidacy.findUnique({ where: { id: String(candidacyId || '') } })
  if (!cand) return reply.status(404).send({ error: '参选不存在' })
  const role = await cityRole(cand.cityId, uid)
  if (role !== 'member' && role !== 'admin' && role !== 'agent') return reply.status(403).send({ error: '仅城市会员可投票' })
  if (!(await isMnemonicVerified(uid))) return reply.status(403).send({ error: '请先完成助记词身份验证' })
  await prisma.cityRepBallot.create({ data: { candidacyId: cand.id, uid, option: String(option) } }).catch(() => reply.status(400).send({ error: '你已投过票' }))
  return { success: true }
})

async function removeInactiveReps(cityId: string) {
  const cutoff = new Date(Date.now() - REP_INACTIVE_DAYS * 86400000)
  const toRemove: string[] = []
  try {
    const inact: any = await prisma.$queryRawUnsafe(
      `SELECT uid::text AS uid FROM city_rep WHERE city_id=$1 AND status='active' AND (last_active_at IS NULL OR last_active_at < $2)`,
      cityId, cutoff
    )
    for (const row of inact) toRemove.push(String(row.uid))
  } catch (e) {}
  if (toRemove.length) {
    await prisma.cityRep.updateMany({ where: { cityId, uid: { in: toRemove } }, data: { status: 'removed' } })
    for (const u of toRemove) { try { await wkApi('/channel/subscriber_remove', { channel_id: parliamentChannel(cityId), channel_type: 4, subscribers: [u] }) } catch (e) {} }
  }
}

async function settleRepElection(cityId: string) {
  const c0 = await prisma.city.findUnique({ where: { id: cityId }, select: { agentUid: true } })
  if (!c0 || c0.status === 'closed') return
  await removeInactiveReps(cityId)
  const used = await prisma.cityRep.count({ where: { cityId, status: 'active' } }) + await prisma.cityAdmin.count({ where: { cityId, status: 'active' } }) + 1
  if (used >= PARLIAMENT_CAP) return
  const cands = await prisma.cityRepCandidacy.findMany({ where: { cityId } })
  const existing = await prisma.cityRep.findMany({ where: { cityId, status: 'active' }, select: { uid: true } })
  const existingSet = new Set(existing.map(x => x.uid))
  const qualified: { uid: string; yes: number }[] = []
  for (const cd of cands) {
    if (existingSet.has(cd.uid)) continue
    const yes = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'yes' } })
    const no = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'no' } })
    if (yes > no && yes > 0) qualified.push({ uid: cd.uid, yes })
  }
  qualified.sort((a, b) => b.yes - a.yes)
  let remain = PARLIAMENT_CAP - used
  for (const q of qualified) {
    if (remain <= 0) break
    await prisma.cityRep.upsert({ where: { cityId_uid: { cityId, uid: q.uid } }, update: { status: 'active', joinedAt: new Date() }, create: { cityId, uid: q.uid } }).catch(() => {})
    try { await wkApi('/channel/subscriber_add', { channel_id: parliamentChannel(cityId), channel_type: 4, subscribers: [q.uid] }) } catch (e) {}
    remain--
  }
}

fastify.get('/api/city/parliament/election', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const cityId = String((request.query as any).cityId || '')
  const role = await cityRole(cityId, uid)
  if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
  await settleRepElection(cityId)
  const cands = await prisma.cityRepCandidacy.findMany({ where: { cityId }, orderBy: { createdAt: 'desc' } })
  const uids = [...new Set(cands.map(x => x.uid))]
  const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
  const umap = new Map(users.map(u => [u.id, u]))
  const reps = await prisma.cityRep.findMany({ where: { cityId, status: 'active' }, select: { uid: true } })
  const repSet = new Set(reps.map(x => x.uid))
  const myCandIds = cands.map(x => x.id)
  const myBallots = myCandIds.length ? await prisma.cityRepBallot.findMany({ where: { uid, candidacyId: { in: myCandIds } } }) : []
  const myBallotMap = new Map(myBallots.map(b => [b.candidacyId, b.option]))
  const out: any[] = []
  for (const cd of cands) {
    const yes = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'yes' } })
    const no = await prisma.cityRepBallot.count({ where: { candidacyId: cd.id, option: 'no' } })
    out.push({ id: cd.id, uid: cd.uid, postId: cd.postId, title: cd.title,
      nickname: umap.get(cd.uid)?.nickname || umap.get(cd.uid)?.username || cd.uid,
      yes, no, isRep: repSet.has(cd.uid), myOption: myBallotMap.get(cd.id) || '', verified: await isMnemonicVerified(cd.uid) })
  }
  const c0 = await prisma.city.findUnique({ where: { id: cityId }, select: { agentUid: true } })
  const repsCount = await prisma.cityRep.count({ where: { cityId, status: 'active' } })
  const adminsCount = await prisma.cityAdmin.count({ where: { cityId, status: 'active' } })
  return { success: true, data: { candidates: out, myVerified: await isMnemonicVerified(uid), myRole: role, repCount: repsCount, adminCount: adminsCount, cap: PARLIAMENT_CAP, isAgent: c0?.agentUid === uid, repChannel: parliamentChannel(cityId) } }
})

fastify.get('/api/city/parliament/info', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const cityId = String((request.query as any).cityId || '')
  const role = await cityRole(cityId, uid)
  if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
  await settleRepElection(cityId)
  await removeInactiveReps(cityId)
  const inParl = await isParliamentMember(cityId, uid)
  const reps = await prisma.cityRep.findMany({ where: { cityId, status: 'active' }, orderBy: { joinedAt: 'asc' } })
  const uids = reps.map(x => x.uid)
  const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
  const umap = new Map(users.map(u => [u.id, u]))
  return { success: true, data: { inParliament: inParl, myRole: role, repChannel: parliamentChannel(cityId), reps: reps.map(x => ({ uid: x.uid, name: umap.get(x.uid)?.nickname || umap.get(x.uid)?.username || x.uid })), repCount: reps.length } }
})


// 取消参选（本人，未当选前可取消）
fastify.post('/api/city/parliament/candidacy/cancel', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { candidacyId } = request.body as any || {}
  const cd = await prisma.cityRepCandidacy.findUnique({ where: { id: String(candidacyId || '') } })
  if (!cd) return reply.status(404).send({ error: '参选不存在' })
  if (cd.uid !== uid) return reply.status(403).send({ error: '仅本人可取消参选' })
  const rep = await prisma.cityRep.findUnique({ where: { cityId_uid: { cityId: cd.cityId, uid } } })
  if (rep && rep.status === 'active') return reply.status(400).send({ error: '你已当选代表，无法取消参选' })
  await prisma.cityRepCandidacy.delete({ where: { id: cd.id } }).catch(() => {})
  await prisma.cityRepBallot.deleteMany({ where: { candidacyId: cd.id } }).catch(() => {})
  return { success: true }
})

fastify.post('/api/city/parliament/proposal', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { cityId, title, content } = request.body as any || {}
  const c0 = await prisma.city.findUnique({ where: { id: String(cityId || '') } })
  if (!c0 || c0.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
  const isRep = !!(await prisma.cityRep.findUnique({ where: { cityId_uid: { cityId: c0.id, uid } } }))
  if (!isRep) return reply.status(403).send({ error: '仅议员代表可发起提案' })
  if (!title || !String(title).trim()) return reply.status(400).send({ error: '提案标题必填' })
  const p = await prisma.cityProposal.create({ data: { cityId: c0.id, proposerUid: uid, title: String(title).trim().slice(0, 100), content: String(content || '').slice(0, 2000), status: 'open', endsAt: new Date(Date.now() + 7 * 86400000) } })
  const sysPayload = Buffer.from(JSON.stringify({ type: 1, content: { text: `🗳️ 新提案：${title}` } })).toString('base64')
  await wkApi('/message/send', { channel_id: parliamentChannel(c0.id), channel_type: 4, from_uid: 'system', payload: sysPayload }).catch(() => {})
  return { success: true, data: { id: String(p.id) } }
})

fastify.post('/api/city/parliament/proposal/:id/vote', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const { option } = request.body as any || {}
  if (!['yes', 'no', 'abstain'].includes(String(option))) return reply.status(400).send({ error: '无效选项' })
  const p = await prisma.cityProposal.findUnique({ where: { id: request.params.id as string } })
  if (!p) return reply.status(404).send({ error: '提案不存在' })
  if (p.status !== 'open') return reply.status(400).send({ error: '提案已结束' })
  if (!(await isParliamentMember(p.cityId, uid))) return reply.status(403).send({ error: '仅议会成员可投' })
  await prisma.cityProposalBallot.create({ data: { proposalId: p.id, uid, option: String(option) } }).catch(() => reply.status(400).send({ error: '你已投过票' }))
  return { success: true }
})

fastify.get('/api/city/parliament/proposals', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
  const { id: uid } = request.user
  const cityId = String((request.query as any).cityId || '')
  const role = await cityRole(cityId, uid)
  if (role === 'none' || role === 'pending') return reply.status(403).send({ error: '仅城市会员可见' })
  await settleProposals(cityId)
  const ps = await prisma.cityProposal.findMany({ where: { cityId }, orderBy: { createdAt: 'desc' } })
  const proposers = [...new Set(ps.map(x => x.proposerUid))]
  const users = proposers.length ? await prisma.user.findMany({ where: { id: { in: proposers } }, select: { id: true, nickname: true, username: true } }) : []
  const umap = new Map(users.map(u => [u.id, u]))
  const pts = ps.map(async (p) => {
    const yes = await prisma.cityProposalBallot.count({ where: { proposalId: p.id, option: 'yes' } })
    const no = await prisma.cityProposalBallot.count({ where: { proposalId: p.id, option: 'no' } })
    const abstain = await prisma.cityProposalBallot.count({ where: { proposalId: p.id, option: 'abstain' } })
    const my = await prisma.cityProposalBallot.findUnique({ where: { proposalId_uid: { proposalId: p.id, uid } } }).catch(() => null)
    return { id: String(p.id), title: p.title, content: p.content, status: p.status, passed: p.passed, yes, no, abstain, myOption: my?.option || '', proposer: umap.get(p.proposerUid)?.nickname || umap.get(p.proposerUid)?.username || p.proposerUid, endsAt: p.endsAt, createdAt: p.createdAt }
  })
  return { success: true, data: { proposals: await Promise.all(pts) } }
})

async function settleProposals(cityId: string) {
  const ps = await prisma.cityProposal.findMany({ where: { cityId, status: 'open' } })
  for (const p of ps) {
    if (p.endsAt && Date.now() > new Date(p.endsAt).getTime()) {
      const yes = await prisma.cityProposalBallot.count({ where: { proposalId: p.id, option: 'yes' } })
      const no = await prisma.cityProposalBallot.count({ where: { proposalId: p.id, option: 'no' } })
      const passed = yes > no && yes > 0
      await prisma.cityProposal.update({ where: { id: p.id }, data: { status: passed ? 'passed' : 'rejected', passed } })
      if (passed) {
        try { await prisma.cityPost.create({ data: { cityId: p.cityId, uid: p.proposerUid, content: `${p.title}\n\n${p.content}\n\n[提案已通过，公示]`, title: `🗳️ 提案通过：${p.title}`.slice(0, 60), images: '[]', sig: '', pubKey: '' } }) } catch (e) {}
      }
    }
  }
}


}
