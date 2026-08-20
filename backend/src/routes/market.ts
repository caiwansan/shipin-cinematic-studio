// 茶票市场路由 — Tea Market Routes
// 链条：上架(on_sale) → 购买(sold) → 下架(cancelled)

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function marketRoutes(fastify: FastifyInstance) {
  // GET /api/market/list — 市场列表（分页 + 筛选）
  fastify.get('/api/market/list', async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string; itemType?: string; status?: string; sort?: string }
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)))
    const offset = Math.max(0, Number(query.offset || 0))
    const where: any = { status: query.status || 'on_sale' }
    if (query.itemType) where.itemType = query.itemType
    const orderBy: any = query.sort === 'price_asc' ? { priceCents: 'asc' } : query.sort === 'price_desc' ? { priceCents: 'desc' } : { createdAt: 'desc' }
    const [items, total] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM market_item WHERE status = $1${query.itemType ? ` AND item_type = '${query.itemType}'` : ''} ORDER BY ${orderBy.createdAt === 'desc' ? 'created_at DESC' : Array.isArray(orderBy.priceCents) ? `price_cents ${orderBy.priceCents[0]}` : 'created_at DESC'} LIMIT $2 OFFSET $3`, where.status, limit, offset),
      prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM market_item WHERE status = $1${query.itemType ? ` AND item_type = '${query.itemType}'` : ''}`, where.status)
    ])
    return { success: true, data: { items: items, total: Number(total) } }
  })

  // POST /api/market/sell — 上架商品
  fastify.post('/api/market/sell', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { itemType, title, description, priceCents, currency } = request.body as any
    if (!title || !priceCents) return reply.status(400).send({ success: false, error: 'title 和 priceCents 必填' })
    const sellerUid = request.user.id
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO market_item (seller_uid, item_type, title, description, price_cents, currency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      sellerUid, itemType || 'tea_ticket', title, description || '', priceCents, currency || 'CNY'
    )
    return { success: true, data: { id: (result as any)[0].id } }
  })

  // POST /api/market/buy — 购买商品
  fastify.post('/api/market/buy', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { itemId } = request.body as any
    if (!itemId) return reply.status(400).send({ success: false, error: 'itemId 必填' })
    const buyerUid = request.user.id
    const item = await prisma.$queryRawUnsafe(`SELECT * FROM market_item WHERE id = $1 AND status = 'on_sale' LIMIT 1`, itemId) as any[]
    if (!item.length) return reply.status(404).send({ success: false, error: '商品不存在或已售出' })
    if (item[0].seller_uid === buyerUid) return reply.status(400).send({ success: false, error: '不能购买自己的商品' })
    await prisma.$queryRawUnsafe(
      `UPDATE market_item SET status = 'sold', buyer_uid = $1, sold_at = NOW() WHERE id = $2`,
      buyerUid, itemId
    )
    return { success: true, data: { id: itemId, sellerUid: item[0].seller_uid, priceCents: item[0].price_cents } }
  })

  // POST /api/market/cancel — 下架商品
  fastify.post('/api/market/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { itemId } = request.body as any
    if (!itemId) return reply.status(400).send({ success: false, error: 'itemId 必填' })
    const sellerUid = request.user.id
    const item = await prisma.$queryRawUnsafe(`SELECT * FROM market_item WHERE id = $1 AND seller_uid = $2 AND status = 'on_sale'`, itemId, sellerUid) as any[]
    if (!item.length) return reply.status(404).send({ success: false, error: '商品不存在或无权操作' })
    await prisma.$queryRawUnsafe(`UPDATE market_item SET status = 'cancelled' WHERE id = $1`, itemId)
    return { success: true }
  })

  // GET /api/market/my-listings — 我的上架
  fastify.get('/api/market/my-listings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const sellerUid = request.user.id
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM market_item WHERE seller_uid = $1 ORDER BY created_at DESC LIMIT 50`, sellerUid
    )
    return { success: true, data: { items } }
  })

  // GET /api/market/history — 交易历史
  fastify.get('/api/market/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const uid = request.user.id
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM market_item WHERE seller_uid = $1 OR buyer_uid = $1 ORDER BY created_at DESC LIMIT 50`, uid
    )
    return { success: true, data: { items } }
  })
}
