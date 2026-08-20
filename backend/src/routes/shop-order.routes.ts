// shop-order.routes.ts — 城市易货订单（银票核销券）
// 用户用工分购商品 → 工分冻结平台托管(PLATFORM_ESCROW) → 得银票核销券(卡包)
// 商家核销银票 → 平台分润: 2%城市代理商 + 3%买家推荐人 + 95%商家(实收)
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { createHash, randomBytes } from 'crypto'

const ESCROW = 'PLATFORM_ESCROW' // 平台托管池(核销前工分在此)

function txHash(p: any): string {
  return createHash('sha256')
    .update(`${p.prev_hash || ''}|${p.uid}|${p.token_type}|${p.amount}|${p.tx_type}|${p.from_uid || ''}|${p.to_uid || ''}|${p.remark || ''}|${p.created_at}`)
    .digest('hex')
}
async function getWallet(uid: string) {
  let rows: any = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  if (!rows.length) {
    await prisma.$queryRawUnsafe(`INSERT INTO tea_wallet (uid, gongfen, chapiao, updated_at) VALUES ($1,0,0,$2)`, uid, Math.floor(Date.now() / 1000))
    rows = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  }
  return rows[0]
}
async function appendTx(uid: string, token_type: string, amount: number, tx_type: string, from_uid: string | null, to_uid: string | null, remark: string, balance_after: number) {
  const ts = Math.floor(Date.now() / 1000)
  const prev: any = await prisma.$queryRawUnsafe(`SELECT hash FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT 1`, uid)
  const prevHash = prev.length ? prev[0].hash : 'genesis'
  const hash = txHash({ prev_hash: prevHash, uid, token_type, amount, tx_type, from_uid, to_uid, remark, created_at: ts })
  await prisma.$queryRawUnsafe(
    `INSERT INTO tea_wallet_tx (uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, prev_hash, hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, prevHash, hash, ts
  )
  return hash
}
async function bumpWallet(uid: string, delta: number, tx_type: string, from: string | null, to: string | null, remark: string) {
  const w = await getWallet(uid)
  const after = Number(w.gongfen || 0) + delta
  if (after < 0) throw new Error('余额不足')
  const ns = Math.floor(Date.now() / 1000)
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET gongfen=$1, chapiao=$2, updated_at=$3 WHERE uid=$4`, after, Number(w.chapiao || 0), ns, uid)
  await appendTx(uid, 'gongfen', delta, tx_type, from, to, remark, after)
  return after
}

export default async function shopOrderRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }

  // 生成银票核销码（8 位）
  function genCode(): string {
    return randomBytes(4).toString('hex').toUpperCase()
  }

  // ── 下单：用户用工分购买城市商家商品 → 工分冻结平台托管 → 得银票核销券 ──
  fastify.post('/api/city/shop/order/create', auth, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { cityId, productId, ref } = (request.body as any) || {}
    const cid = String(cityId || '')
    const prod = await prisma.cityBizProduct.findUnique({ where: { id: String(productId || '') } })
    if (!prod || prod.status !== 'active') return reply.status(404).send({ error: '商品不存在或已下架' })
    const biz = await prisma.cityBiz.findUnique({ where: { id: prod.bizId } })
    if (!biz || (biz.status !== 'active' && biz.status !== 'approved')) return reply.status(404).send({ error: '商家不存在' })
    const city = await prisma.city.findUnique({ where: { id: cid } })
    if (!city || city.status === 'closed') return reply.status(404).send({ error: '城市不存在' })
    // 必须是城市会员
    const mem = await prisma.cityMember.findUnique({ where: { cityId_uid: { cityId: cid, uid } } })
    if (!mem || mem.status !== 'active') return reply.status(403).send({ error: '仅城市会员可兑换' })
    if (biz.uid === uid) return reply.status(400).send({ error: '不能购买自己店铺的商品' })
    const price = Math.floor(Number(prod.priceTea) || 0)
    if (price < 1) return reply.status(400).send({ error: '商品价格异常' })
    // 库存
    if (prod.stock > 0 && prod.stock <= 0) { /* 留待扣库存 */ }
    // 扣买家工分 → 冻结到平台托管
    const buyerWallet = await getWallet(uid)
    if (Number(buyerWallet.gongfen || 0) < price) return reply.status(400).send({ error: '工分不足' })
    const now = Math.floor(Date.now() / 1000)
    const txDeduct = await bumpWallet(uid, -price, 'shop_deduct', uid, ESCROW, `城市易货冻结:${prod.name}`)
    await bumpWallet(ESCROW, price, 'shop_escrow', uid, ESCROW, `托管-${prod.name}`)
    // 分润数据（核销时才打款）
    const agentUid = city.agentUid || ''
    // 推荐人：优先使用 ref（社区帖子分享链接），否则回退到 inviter_id
    let referrerUid = ''
    let customCommission = 0
    if (ref && String(ref) !== uid && String(ref) !== biz.uid) {
      // 检查 ref 是否为有效用户
      const refUser = await prisma.user.findUnique({ where: { id: String(ref) }, select: { id: true } })
      if (refUser) {
        referrerUid = String(ref)
        customCommission = Math.floor(price * (Number(prod.commissionRate) || 0) / 100)
      }
    }
    if (!referrerUid) {
      try { const br: any = await prisma.$queryRawUnsafe(`SELECT inviter_id FROM "User" WHERE id=$1`, uid); referrerUid = br.length && br[0].inviter_id ? String(br[0].inviter_id) : '' } catch { /* ignore */ }
    }
    const agentReward = Math.floor(price * 0.02)
    const referrerReward = customCommission > 0 ? customCommission : Math.floor(price * 0.03)
    const sellerReward = price - agentReward - referrerReward
    // 银票核销券
    const code = genCode()
    const order = await prisma.$queryRawUnsafe(
      `INSERT INTO city_biz_order (code, city_id, biz_id, product_id, product_name, cover, amount, status, buyer_uid, seller_uid, agent_uid, referrer_uid, agent_reward, referrer_reward, seller_reward, tx_deduct, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'earned',$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      code, cid, biz.id, prod.id, prod.name, prod.cover || '', price, uid, biz.uid, agentUid, referrerUid,
      agentReward, referrerReward, sellerReward, txDeduct, now
    )
    const orderId = order[0]?.id
    // 扣库存
    if (prod.stock > 0) {
      await prisma.$executeRawUnsafe(`UPDATE city_biz_product SET stock=$1 WHERE id=$2`, prod.stock - 1, prod.id).catch(() => {})
    }
    // 创建自定义佣金记录（来自社区帖子分享）
    if (customCommission > 0 && referrerUid) {
      await prisma.cityBizReferral.create({ data: { bizId: biz.id, productId: prod.id, referrerId: referrerUid, buyerId: uid, orderId: String(orderId), commission: customCommission, status: 'pending' } }).catch(() => {})
    }
    return { success: true, data: { orderId, code, status: 'earned', amount: price, productName: prod.name, agentReward, referrerReward, sellerReward } }
  })

  // ── 核销银票：商家扫码/输码确认收货 → 分润 2%代理商+3%推荐人+95%商家 ──
  fastify.post('/api/city/shop/order/redeem', auth, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { code } = (request.body as any) || {}
    const c = String(code || '').trim().toUpperCase()
    if (!c) return reply.status(400).send({ error: '缺少核销码' })
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM city_biz_order WHERE code=$1`, c)
    if (!rows.length) return reply.status(404).send({ error: '核销码无效或银票不存在，请核对' })
    const order = rows[0]
    if (order.status === 'redeemed') return reply.status(400).send({ error: '银票已核销' })
    if (order.status !== 'earned') return reply.status(400).send({ error: '银票状态异常' })
    // 仅商家本人可核销
    if (String(order.seller_uid) !== String(uid)) return reply.status(403).send({ error: '仅商家可核销该银票' })
    const now = Math.floor(Date.now() / 1000)
    // 分润（从平台托管扣出）
    const txSettle = ''
    if (order.agent_reward > 0 && order.agent_uid) { await bumpWallet(String(order.agent_uid), Number(order.agent_reward), 'shop_reward_agent', ESCROW, String(order.agent_uid), `城市易货代理商分润:${order.product_name}`) }
    if (order.referrer_reward > 0 && order.referrer_uid) { await bumpWallet(String(order.referrer_uid), Number(order.referrer_reward), 'shop_reward_referrer', ESCROW, String(order.referrer_uid), `城市易货推荐分润:${order.product_name}`) }
    if (order.seller_reward > 0) { await bumpWallet(String(order.seller_uid), Number(order.seller_reward), 'shop_reward_seller', ESCROW, String(order.seller_uid), `城市易货商家实收:${order.product_name}`) }
    // 托管池扣出（保持守恒）
    const totalOut = Number(order.agent_reward) + Number(order.referrer_reward) + Number(order.seller_reward)
    await bumpWallet(ESCROW, -totalOut, 'shop_settle', ESCROW, String(order.seller_uid), `托管结算-${order.product_name}`)
    await prisma.$executeRawUnsafe(`UPDATE city_biz_order SET status='redeemed', redeemed_at=$1 WHERE id=$2`, now, String(order.id))
    return { success: true, data: { status: 'redeemed', amount: Number(order.amount) } }
  })

  // ── 我的银票卡包 + 商家订单 ──
  fastify.get('/api/city/shop/orders', auth, async (request: any) => {
    const { id: uid } = request.user
    const bought: any = await prisma.$queryRawUnsafe(
      `SELECT id, code, product_name, cover, amount, status, created_at, redeemed_at FROM city_biz_order WHERE buyer_uid=$1 ORDER BY id DESC LIMIT 100`, uid)
    const sold: any = await prisma.$queryRawUnsafe(
      `SELECT id, code, product_name, cover, amount, status, buyer_uid, created_at, redeemed_at FROM city_biz_order WHERE seller_uid=$1 ORDER BY id DESC LIMIT 100`, uid)
    const norm = (rows: any[]) => rows.map((o) => ({ id: o.id, code: o.code, product_name: o.product_name, cover: o.cover, amount: Number(o.amount), status: o.status, buyer_uid: o.buyer_uid, created_at: Number(o.created_at), redeemed_at: Number(o.redeemed_at || 0) }))
    return { success: true, data: { bought: norm(bought), sold: norm(sold) } }
  })

  // ── 银票详情 ──
  fastify.get('/api/city/shop/order/:id', auth, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM city_biz_order WHERE id=$1`, String(request.params.id))
    if (!rows.length) return reply.status(404).send({ error: '银票不存在' })
    const o = rows[0]
    if (String(o.buyer_uid) !== String(uid) && String(o.seller_uid) !== String(uid)) return reply.status(403).send({ error: '无权查看' })
    for (const k of ['amount', 'agent_reward', 'referrer_reward', 'seller_reward', 'created_at', 'redeemed_at']) { if (o[k] !== undefined && o[k] !== null) o[k] = Number(o[k]) }
    return { success: true, data: { order: { ...o, amount: Number(o.amount), created_at: Number(o.created_at), redeemed_at: Number(o.redeemed_at || 0) } } }
  })
}
