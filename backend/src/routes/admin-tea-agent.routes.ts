import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// ═══ 后台：城市代理申请管理 ═══
export default async function adminTeaAgentRoutes(fastify: FastifyInstance) {
  // 申请列表
  fastify.get('/api/admin/tea-agent/applies', { preHandler: [requireAdmin] }, async () => {
    const rows = await prisma.cityAgentApply.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 })
    const uids = [...new Set(rows.map((r) => r.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { applies: rows.map((r) => ({ id: String(r.id), uid: r.uid, nickname: umap.get(r.uid)?.nickname || umap.get(r.uid)?.username || r.uid, companyName: r.companyName, companyLoc: r.companyLoc, companyScale: r.companyScale, cityName: r.cityName, contactName: r.contactName, contactPhone: r.contactPhone, status: r.status, note: r.note, createdAt: r.createdAt })) } }
  })
  // 审批
  fastify.post('/api/admin/tea-agent/applies/:id/status', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { status, note } = (request.body as any) || {}
    const st = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
    const app = await prisma.cityAgentApply.findUnique({ where: { id: request.params.id as string } })
    if (!app) return reply.status(404).send({ error: '申请不存在' })
    await prisma.cityAgentApply.update({ where: { id: app.id }, data: { status: st, note: String(note || '').slice(0, 200) } })
    return { success: true, data: { ok: true } }
  })
}

