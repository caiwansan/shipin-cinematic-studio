import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// ═══ 后台：昆仑茶馆设置（API 密钥 / 社区管理员） ═══
const TEA_CFG_SCOPE = 'tea'
const TEA_CFG_KEY = 'config'

export default async function adminTeaConfigRoutes(fastify: FastifyInstance) {
  // 读取配置（API 密钥等）
  fastify.get('/api/admin/tea/config', { preHandler: [requireAdmin] }, async () => {
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } } })
    const v: any = row?.value || {}
    return { success: true, data: {
      amapKey: v.amapKey || '',
      amapSecurityJsCode: v.amapSecurityJsCode || '',
      amapWebKey: v.amapWebKey || '',
      amapWebSecret: v.amapWebSecret || '',
      hasAmapKey: !!v.amapKey,
      hasAmapWebKey: !!v.amapWebKey,
      qqAppId: v.qqAppId || '',
      qqKey: v.qqKey || '',
      qqRedirectUri: v.qqRedirectUri || '',
      hasQqAppSecret: !!v.qqAppSecret,
      latestVersion: v.latestVersion || '',
      apkUrl: v.apkUrl || '',
    } }
  })
  // 保存配置（密钥留空表示不修改）
  fastify.put('/api/admin/tea/config', { preHandler: [requireAdmin] }, async (request: any) => {
    const body = (request.body as any) || {}
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } } })
    const cur: any = row?.value || {}
    const next = {
      amapKey: body.amapKey ? String(body.amapKey).trim() : (cur.amapKey || ''),
      amapSecurityJsCode: body.amapSecurityJsCode ? String(body.amapSecurityJsCode).trim() : (cur.amapSecurityJsCode || ''),
      amapWebKey: body.amapWebKey ? String(body.amapWebKey).trim() : (cur.amapWebKey || ''),
      amapWebSecret: body.amapWebSecret ? String(body.amapWebSecret).trim() : (cur.amapWebSecret || ''),
      qqAppId: body.qqAppId ? String(body.qqAppId).trim() : (cur.qqAppId || ''),
      qqKey: body.qqKey ? String(body.qqKey).trim() : (cur.qqKey || ''),
      qqAppSecret: body.qqAppSecret ? String(body.qqAppSecret).trim() : (cur.qqAppSecret || ''),
      qqRedirectUri: body.qqRedirectUri ? String(body.qqRedirectUri).trim() : (cur.qqRedirectUri || ''),
      latestVersion: body.latestVersion ? String(body.latestVersion).trim() : (cur.latestVersion || ''),
      apkUrl: body.apkUrl ? String(body.apkUrl).trim() : (cur.apkUrl || ''),
    }
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } },
      update: { value: next, label: '昆仑茶馆配置', isActive: true },
      create: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY, label: '昆仑茶馆配置', value: next, isActive: true },
    })
    return { success: true, data: { ok: true } }
  })

  // 社区管理员列表
  fastify.get('/api/admin/tea/admins', { preHandler: [requireAdmin] }, async () => {
    const rows = await prisma.teaAdmin.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    const uids = [...new Set(rows.map((r) => r.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, phone: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { admins: rows.map((r) => ({ uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid, phone: umap.get(r.uid)?.phone || '', by: r.by, createdAt: r.createdAt })) } }
  })
  // 添加社区管理员
  fastify.post('/api/admin/tea/admins/add', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { id: uid } = (request as any).user
    const { targetUid } = (request.body as any) || {}
    if (!targetUid) return reply.status(400).send({ error: 'targetUid 必填' })
    await prisma.teaAdmin.upsert({ where: { uid: String(targetUid) }, update: { by: uid }, create: { uid: String(targetUid), by: uid } })
    return { success: true, data: { ok: true } }
  })
  // 移除社区管理员
  fastify.post('/api/admin/tea/admins/remove', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { targetUid } = (request.body as any) || {}
    if (!targetUid) return reply.status(400).send({ error: 'targetUid 必填' })
    await prisma.teaAdmin.deleteMany({ where: { uid: String(targetUid) } })
    return { success: true, data: { ok: true } }
  })

// ── 薪资管理（P0-06 城市社区角色工资）──
// 读取薪资配置
fastify.get('/api/admin/tea/salary/config', { preHandler: [requireAdmin] }, async () => {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } } })
  const v: any = row?.value || {}
  return { success: true, data: {
    founderAmount: v.salaryFounderAmount ?? 200,
    adminAmount: v.salaryAdminAmount ?? 100,
    mpAmount: v.salaryMpAmount ?? 50,
    onlineRequiredSeconds: v.salaryOnlineRequiredSeconds ?? 7200,
  } }
})
// 保存薪资配置
fastify.put('/api/admin/tea/salary/config', { preHandler: [requireAdmin] }, async (request: any) => {
  const body = (request.body as any) || {}
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } } })
  const cur: any = row?.value || {}
  const next = {
    amapKey: cur.amapKey || '',
    amapSecurityJsCode: cur.amapSecurityJsCode || '',
    amapWebKey: cur.amapWebKey || '',
    amapWebSecret: cur.amapWebSecret || '',
    qqAppId: cur.qqAppId || '',
    qqKey: cur.qqKey || '',
    qqAppSecret: cur.qqAppSecret || '',
    qqRedirectUri: cur.qqRedirectUri || '',
    latestVersion: cur.latestVersion || '',
    apkUrl: cur.apkUrl || '',
    salaryFounderAmount: Number(body.founderAmount) || 0,
    salaryAdminAmount: Number(body.adminAmount) || 0,
    salaryMpAmount: Number(body.mpAmount) || 0,
    salaryOnlineRequiredSeconds: Number(body.onlineRequiredSeconds) || 7200,
  }
  await prisma.routeConfig.upsert({
    where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } },
    update: { value: next, label: '昆仑茶馆配置', isActive: true },
    create: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY, label: '昆仑茶馆配置', value: next, isActive: true },
  })
  return { success: true, data: { ok: true } }
})
// 城市成员列表（带角色，用于薪资发放）
fastify.get('/api/admin/tea/salary/members', { preHandler: [requireAdmin] }, async (request: any) => {
  const cityId = (request.query as any)?.cityId || ''
  // 创始人
  const city: any = cityId ? await prisma.city.findUnique({ where: { id: cityId } }) : null
  const members: any[] = []
  if (city) {
    members.push({ uid: city.agentUid, role: 'founder', cityId: city.id, cityName: city.name })
  }
  const admins = cityId ? await prisma.cityAdmin.findMany({ where: { cityId, status: 'active' } }) : []
  for (const a of admins) members.push({ uid: a.uid, role: 'admin', cityId, cityName: city?.name || '' })
  const reps = cityId ? await prisma.cityRep.findMany({ where: { cityId, status: 'active' } }) : []
  for (const r of reps) members.push({ uid: r.uid, role: 'mp', cityId, cityName: city?.name || '' })
  // 查用户信息
  const uids = [...new Set(members.map((m) => m.uid))]
  const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
  const umap = new Map(users.map((u) => [u.id, u]))
  // 查钱包余额
  const wallets = uids.length ? await prisma.$queryRawUnsafe(`SELECT uid, gongfen, chapiao FROM tea_wallet WHERE uid = ANY($1::text[])`, uids) : []
  const wmap = new Map((wallets || []).map((w: any) => [w.uid, w]))
  return { success: true, data: { members: members.map((m) => ({
    ...m,
    nickname: umap.get(m.uid)?.nickname || umap.get(m.uid)?.username || m.uid,
    gongfen: Number(wmap.get(m.uid)?.gongfen || 0),
    chapiao: Number(wmap.get(m.uid)?.chapiao || 0),
  })), cities: await prisma.city.findMany({ where: { status: 'active' }, select: { id: true, name: true } }) } }
})
// 手动发放薪资（对单人）
fastify.post('/api/admin/tea/salary/grant', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
  const { uid, cityId } = (request.body as any) || {}
  if (!uid || !cityId) return reply.status(400).send({ error: 'uid 和 cityId 必填' })
  const city = await prisma.city.findUnique({ where: { id: cityId } })
  if (!city) return reply.status(404).send({ error: '城市不存在' })
  // 判定角色
  let role = ''
  if (city.agentUid === uid) role = 'founder'
  else {
    const adm = await prisma.cityAdmin.findUnique({ where: { cityId_uid: { cityId, uid } } })
    if (adm && adm.status === 'active') role = 'admin'
    else {
      const rep = await prisma.cityRep.findUnique({ where: { cityId_uid: { cityId, uid } } })
      if (rep && rep.status === 'active') role = 'mp'
      else return reply.status(403).send({ error: '该用户不是本市社区的创始人/管理员/议员' })
    }
  }
  // 读取薪资配置
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: TEA_CFG_SCOPE, key: TEA_CFG_KEY } } })
  const cfg: any = row?.value || {}
  const amount = role === 'founder' ? (cfg.salaryFounderAmount || 200) : role === 'admin' ? (cfg.salaryAdminAmount || 100) : (cfg.salaryMpAmount || 50)
  // 发放：mint gongfen
  const FOUNDER_UID = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d'
  let w: any = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  if (!w.length) {
    await prisma.$queryRawUnsafe(`INSERT INTO tea_wallet (uid, gongfen, chapiao, updated_at) VALUES ($1,0,0,$2)`, uid, Math.floor(Date.now()/1000))
    w = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  }
  const curG = BigInt(w[0].gongfen || 0)
  const after = curG + BigInt(amount)
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET gongfen=$1, updated_at=$2 WHERE uid=$3`, Number(after), Math.floor(Date.now()/1000), uid)
  // 流水
  const prev: any = await prisma.$queryRawUnsafe(`SELECT hash FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT 1`, uid)
  const prevHash = prev.length ? prev[0].hash : 'genesis'
  const ts = Math.floor(Date.now()/1000)
  const payload = { prev_hash: prevHash, uid, token_type: 'gongfen', amount, tx_type: 'mint', from_uid: FOUNDER_UID, to_uid: uid, remark: role + '薪资', created_at: ts, balance_after: Number(after) }
  const hash = createHash('sha256').update(`${payload.prev_hash}|${payload.uid}|${payload.token_type}|${payload.amount}|${payload.tx_type}|${payload.from_uid}|${payload.to_uid}|${payload.remark}|${payload.created_at}`).digest('hex')
  await prisma.$queryRawUnsafe(
    `INSERT INTO tea_wallet_tx (uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, prev_hash, hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    uid, 'gongfen', amount, Number(after), 'mint', FOUNDER_UID, uid, role + '薪资', prevHash, hash, ts
  )
  return { success: true, data: { uid, role, amount, balance: Number(after) } }
})}



