import type { FastifyInstance } from 'fastify'
// admin-tea-clan.routes.ts — 后台：宗亲群聊开通申请管理
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { wkApi } from './im.js'

// ═══ 后台：宗亲群申请管理（通过时建群+标clan+入谱族长）═══
export default async function adminTeaClanRoutes(fastify: FastifyInstance) {
  // 申请列表
  fastify.get('/api/admin/tea-clan/applies', { preHandler: [requireAdmin] }, async () => {
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM family_clan_apply ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`)
    const uids = [...new Set((rows || []).map((r: any) => String(r.uid)))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { applies: (rows || []).map((r: any) => ({ id: String(r.id), uid: String(r.uid), nickname: umap.get(String(r.uid))?.nickname || umap.get(String(r.uid))?.username || String(r.uid), groupName: r.group_name, status: r.status, note: r.note || '', createdAt: Number(r.created_at || 0) })) } }
  })

  // 审批（通过→建宗亲群+标clan+申请人入谱族长）
  fastify.post('/api/admin/tea-clan/applies/:id/status', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { status, note } = (request.body as any) || {}
    const st = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM family_clan_apply WHERE id=$1`, String(request.params.id))
    if (!rows.length) return reply.status(404).send({ error: '申请不存在' })
    const app = rows[0]
    if (st === 'approved' && app.status !== 'approved') {
      // 建宗亲群
      const me = await prisma.user.findUnique({ where: { id: String(app.uid) }, select: { nickname: true, username: true } })
      const nm = String(me?.nickname || me?.username || app.uid).slice(0, 20)
      const ign = String(app.group_name || '').slice(0, 30)
      const group = await prisma.imGroup.create({ data: { name: ign, intro: '宗亲群聊', avatarUrl: '', ownerUid: String(app.uid) } })
      const chId = 'grp_' + group.id
      try { await wkApi('/channel', { channel_id: chId, channel_type: 4, channel_name: ign, channel_remark: '宗亲群聊' }) } catch (e: any) {}
      try {
        await prisma.$executeRawUnsafe(`INSERT INTO im_channel_members (channel_id, channel_type, uid, role, name, avatar, joined_at) VALUES ($1,4,$2,2,$3,'',now()) ON CONFLICT (channel_id,channel_type,uid) DO UPDATE SET role=2`, chId, String(app.uid), nm)
      } catch (e: any) { /* ignore */ }
      // 标 clan + 族长入谱
      await prisma.$executeRawUnsafe(`UPDATE im_group SET kind='clan' WHERE id=$1`, group.id)
      const ts = Math.floor(Date.now() / 1000)
      try { await prisma.$queryRawUnsafe(`INSERT INTO family_member (group_id, uid, name, generation, clan_role, lit, created_at) VALUES ($1,$2,$3,1,'族长',true,$4)`, group.id, String(app.uid), nm, ts) } catch (e: any) { /* ignore */ }
    }
    await prisma.$queryRawUnsafe(`UPDATE family_clan_apply SET status=$2, note=$3 WHERE id=$1`, String(app.id), st, String(note || '').slice(0, 200))
    return { success: true, data: { ok: true } }
  })
  // 已开通宗亲群列表（后台群管理）
  fastify.get('/api/admin/tea-clan/groups', { preHandler: [requireAdmin] }, async () => {
    const rows: any = await prisma.$queryRawUnsafe(`SELECT id, name, owner_uid, kind, status, created_at FROM im_group WHERE kind='clan' ORDER BY created_at DESC LIMIT 200`)
    const owners = [...new Set((rows || []).map((r: any) => String(r.owner_uid)))]
    const users = owners.length ? await prisma.user.findMany({ where: { id: { in: owners } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const out: any[] = []
    for (const g of (rows || [])) {
      const cnt: any = await prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM im_channel_members WHERE channel_id=$1 AND channel_type=4`, 'grp_' + String(g.id))
      out.push({ id: String(g.id), name: g.name, ownerUid: String(g.owner_uid), ownerName: umap.get(String(g.owner_uid))?.nickname || umap.get(String(g.owner_uid))?.username || String(g.owner_uid).slice(0, 8), status: g.status, memberCount: cnt[0]?.c || 0, createdAt: Number(g.created_at || 0) })
    }
    return { success: true, data: { groups: out } }
  })

  // 后台解散宗亲群
  fastify.post('/api/admin/tea-clan/groups/:id/dissolve', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const gid = String(request.params.id)
    const grp: any = await prisma.$queryRawUnsafe(`SELECT id, name, status FROM im_group WHERE id=$1`, gid)
    if (!grp.length) return reply.status(404).send({ error: '群不存在' })
    const g = grp[0]
    if (g.status === 'dissolved') return reply.status(400).send({ error: '群已解散' })
    await prisma.$queryRawUnsafe(`UPDATE im_group SET status='dissolved', kind='normal' WHERE id=$1`, gid)
    try { await prisma.$queryRawUnsafe(`DELETE FROM im_channel_members WHERE channel_id=$1 AND channel_type=4`, 'grp_' + gid) } catch (e: any) { /* ignore */ }
    try { await prisma.$queryRawUnsafe(`DELETE FROM family_member WHERE group_id=$1`, gid) } catch (e: any) { /* ignore */ }
    try { await prisma.$queryRawUnsafe(`DELETE FROM family_archive WHERE group_id=$1`, gid) } catch (e: any) { /* ignore */ }
    try { await prisma.$queryRawUnsafe(`DELETE FROM family_post WHERE group_id=$1`, gid) } catch (e: any) { /* ignore */ }
    try { await wkApi('/channel/delete', { channel_id: 'grp_' + gid, channel_type: 4 }) } catch (e: any) { /* ignore */ }
    return { success: true, data: { dissolved: true } }
  })

}
