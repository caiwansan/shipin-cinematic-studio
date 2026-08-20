// user-block.ts — 好友拉黑/黑名单（用户级）
// 表: user_block (blocker_uid, blocked_uid)
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function userBlockRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }
  async function ensure() {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_block (
      id BIGSERIAL PRIMARY KEY,
      blocker_uid TEXT NOT NULL,
      blocked_uid TEXT NOT NULL,
      created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
      UNIQUE (blocker_uid, blocked_uid)
    )`)
  }

  // POST /api/user/block {targetId} — 拉黑
  fastify.post('/api/user/block', auth, async (request: any, reply: any) => {
    await ensure()
    const uid = request.user.id
    const { targetId } = (request.body as any) || {}
    if (!targetId || !uuidRe.test(String(targetId))) return reply.status(400).send({ success: false, error: 'targetId 必填' })
    if (String(targetId) === uid) return reply.status(400).send({ success: false, error: '不能拉黑自己' })
    const t = await prisma.user.findUnique({ where: { id: String(targetId) }, select: { id: true } })
    if (!t) return reply.status(404).send({ success: false, error: '用户不存在' })
    await prisma.$executeRawUnsafe(`INSERT INTO user_block (blocker_uid, blocked_uid) VALUES ($1,$2) ON CONFLICT (blocker_uid, blocked_uid) DO NOTHING`, uid, String(targetId))
    return { success: true, data: { blocked: true, blockedUid: String(targetId) } }
  })

  // DELETE /api/user/block/:targetId — 取消拉黑
  fastify.delete('/api/user/block/:targetId', auth, async (request: any) => {
    await ensure()
    const uid = request.user.id
    const targetId = String((request.params as any).targetId || '')
    await prisma.$executeRawUnsafe(`DELETE FROM user_block WHERE blocker_uid=$1 AND blocked_uid=$2`, uid, targetId)
    return { success: true, data: { blocked: false } }
  })

  // GET /api/user/block/list — 我的黑名单
  fastify.get('/api/user/block/list', auth, async (request: any) => {
    await ensure()
    const uid = request.user.id
    const rows: any = await prisma.$queryRawUnsafe(`SELECT blocked_uid, created_at FROM user_block WHERE blocker_uid=$1 ORDER BY created_at DESC`, uid)
    const uids = (rows || []).map((r: any) => String(r.blocked_uid))
    const users: any = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u: any) => [String(u.id), u]))
    return { success: true, data: { blocked: (rows || []).map((r: any) => ({ uid: String(r.blocked_uid), name: umap.get(String(r.blocked_uid))?.username || umap.get(String(r.blocked_uid))?.nickname || String(r.blocked_uid).slice(0, 8), blockedAt: Number(r.created_at || 0) })) } }
  })

  // GET /api/user/block/check?targetId= — 是否已拉黑
  fastify.get('/api/user/block/check', auth, async (request: any) => {
    await ensure()
    const uid = request.user.id
    const targetId = String((request.query as any).targetId || '')
    const row: any = await prisma.$queryRawUnsafe(`SELECT 1 FROM user_block WHERE blocker_uid=$1 AND blocked_uid=$2`, uid, targetId)
    return { success: true, data: { blocked: row.length > 0 } }
  })
}
