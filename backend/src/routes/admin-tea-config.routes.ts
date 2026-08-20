import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// ═══ 后台：昆仑茶馆设置（API 密钥 / 社区管理员） ═══
const TEA_CFG_SCOPE = 'tea'
const TEA_CFG_KEY = 'config'

export default async function adminTeaConfigRoutes(fastify: any) {
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
}

