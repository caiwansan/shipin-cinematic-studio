// admin-wallet.ts — 后台钱包管理/提现审核 API
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin, extractAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'

export default async function adminWalletRoutes(fastify: FastifyInstance) {
  // GET /api/admin/wallet/withdraws — 提现列表
  fastify.get('/api/admin/wallet/withdraws', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    try {
      const { status, page = 1, pageSize = 20 } = request.query as any
      const skip = (Number(page) - 1) * Number(pageSize)
      const limit = Number(pageSize)

      const where: any = { amount: { gt: 0 } }
      if (status && status !== 'all') where.status = status

      const [items, total] = await Promise.all([
        prisma.agentWithdraw.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.agentWithdraw.count({ where }),
      ])

      // 批量补充用户信息（AgentWithdraw 无 user relation，单独查）
      const userIds = [...new Set(items.map((w: any) => w.userId))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true, phone: true },
      })
      const userMap = new Map(users.map((u: any) => [u.id, u]))
      const list = items.map((w: any) => {
        const u = userMap.get(w.userId)
        return { ...w, user: u ? { username: u.username, email: u.email, phone: u.phone } : null }
      })

      return { success: true, data: { items: list, total: Number(total), page: Number(page), pageSize: Number(pageSize) } }
    } catch (err: any) {
      console.error('[admin-wallet] list error:', err?.message || err)
      return { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 } }
    }
  })

  // POST /api/admin/wallet/withdraw/:id/approve — 审核通过
  fastify.post('/api/admin/wallet/withdraw/:id/approve', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const admin = extractAdmin(request)
      const adminName = admin?.username || '未知'

      const record = await prisma.agentWithdraw.findUnique({ where: { id } })
      if (!record) return reply.status(404).send({ error: '提现记录不存在' })
      if (record.status !== 'pending') return reply.status(400).send({ error: '该提现已处理' })

      await prisma.agentWithdraw.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date(), remark: `审核人: ${adminName}` },
      })

      return { success: true }
    } catch (err: any) {
      console.error('[admin-wallet] approve error:', err?.message || err)
      return reply.status(500).send({ error: err?.message || '审核通过失败' })
    }
  })

  // POST /api/admin/wallet/withdraw/:id/reject — 审核拒绝（退回余额）
  fastify.post('/api/admin/wallet/withdraw/:id/reject', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any || {}
      const remark = body.remark || '审核拒绝'
      const admin = extractAdmin(request)
      const adminName = admin?.username || '未知'

      const record = await prisma.agentWithdraw.findUnique({ where: { id } })
      if (!record) return reply.status(404).send({ error: '提现记录不存在' })
      if (record.status !== 'pending') return reply.status(400).send({ error: '该提现已处理' })

      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          `UPDATE "User" SET "walletBalance" = COALESCE("walletBalance", 0) + $1 WHERE id = $2`,
          record.amount, record.userId
        ),
        prisma.agentWithdraw.update({
          where: { id },
          data: { status: 'rejected', approvedAt: new Date(), remark: `审核人: ${adminName} - ${remark}` },
        }),
      ])

      return { success: true }
    } catch (err: any) {
      console.error('[admin-wallet] reject error:', err?.message || err)
      return reply.status(500).send({ error: err?.message || '审核拒绝失败' })
    }
  })
}
