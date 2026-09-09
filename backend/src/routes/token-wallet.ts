// token-wallet.ts — 昆仑茶馆 双通证（茶票 chapiao + 工分 gongfen）云端链式钱包
// 路由：/api/tea/token/* — 余额/转账/流水
//      /api/tea/wallet   — 双通证钱包总览
//      /api/tea/market/* — 茶票市场
//      /api/tea/bank/*   — 联邦银行质押贷款
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { createHash } from 'crypto'
import { requirePaypass } from '../utils/paypass-guard.js'

const FOUNDER_UID = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d'   // 南波万=掌柜=创始节点（线上UUID）
const CHAIN_TOTAL_SUPPLY = 1000000000n

// 联邦银行利率（对齐电脑桌面版）
const BANK_LOAN_PLANS: Record<number, { mult: number; rate: number }> = {
  30: { mult: 1.2, rate: 0.12 }, 60: { mult: 1.5, rate: 0.11 }, 90: { mult: 2.0, rate: 0.10 },
  180: { mult: 3.0, rate: 0.09 }, 360: { mult: 5.0, rate: 0.08 },
}
const BANK_DEPOSIT_PLANS: Record<number, number> = { 30: 0.06, 60: 0.07, 90: 0.08, 180: 0.09, 360: 0.10 }

// ── 支付密码校验已统一到 utils/paypass-guard.ts（全量强制）──

// 当日工分兑换茶票的市场汇率 = 全网工分存量 / 全网茶票存量（实时自动波动，一增一减；与交换台同源）
async function bankRate(): Promise<number> {
  try {
    const agg: any = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet`)
    const g = Number(agg[0].g || 0)
    const c = Number(agg[0].c || 0)
    if (c > 0) return Math.round((g / c) * 10000) / 10000
  } catch (e) { /* ignore */ }
  return 1
}

// ── 哈希链：计算一笔交易的 hash（prev_hash + uid + token + amount + type + ts）──
function txHash(p: any): string {
  return createHash('sha256')
    .update(`${p.prev_hash || ''}|${p.uid}|${p.token_type}|${p.amount}|${p.tx_type}|${p.from_uid||''}|${p.to_uid||''}|${p.remark||''}|${p.created_at}`)
    .digest('hex')
}

// ── 获取或初始化钱包 ──
async function getWallet(uid: string) {
  let rows: any = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  if (!rows.length) {
    await prisma.$queryRawUnsafe(`INSERT INTO tea_wallet (uid, gongfen, chapiao, updated_at) VALUES ($1,0,0,$2)`, uid, Math.floor(Date.now()/1000))
    rows = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, uid)
  }
  return rows[0]
}

// ── 追加链式流水（返回 hash）──
async function appendTx(uid: string, token_type: string, amount: bigint, tx_type: string, from_uid: string|null, to_uid: string|null, remark: string, balance_after: bigint) {
  const ts = Math.floor(Date.now()/1000)
  // 取该 uid 最后一条 tx 的 prev_hash
  const prev: any = await prisma.$queryRawUnsafe(`SELECT hash FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT 1`, uid)
  const prevHash = prev.length ? prev[0].hash : 'genesis'
  const payload = { prev_hash: prevHash, uid, token_type, amount: Number(amount), tx_type, from_uid, to_uid, remark, created_at: ts, balance_after: Number(balance_after) }
  const hash = txHash(payload)
  await prisma.$queryRawUnsafe(
    `INSERT INTO tea_wallet_tx (uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, prev_hash, hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    uid, token_type, Number(amount), Number(balance_after), tx_type, from_uid, to_uid, remark, prevHash, hash, ts
  )
  return hash
}

// ── 系统发行（仅工分，茶票只能兑换/市场产生）──
async function mint(uid: string, token_type: string, amount: bigint, remark: string) {
  const w = await getWallet(uid)
  const cur = token_type === 'gongfen' ? BigInt(w.gongfen||0) : BigInt(w.chapiao||0)
  const after = cur + amount
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET gongfen=$1, chapiao=$2, updated_at=$3 WHERE uid=$4`,
    token_type==='gongfen'?Number(after):Number(w.gongfen||0),
    token_type==='chapiao'?Number(after):Number(w.chapiao||0),
    Math.floor(Date.now()/1000), uid)
  await appendTx(uid, token_type, amount, 'mint', FOUNDER_UID, uid, remark, after)
  return { uid, token_type, amount: Number(amount), balance_after: Number(after) }
}

// ── 转账（from 扣 → to 加）──
async function transfer(from: string, to: string, token_type: string, amount: bigint, remark: string, internalForBank = false) {
  if (amount <= 0n) throw new Error('金额必须大于 0')
  // 除非银行质押冻结（茶票转创始节点），否则茶票禁止转账（仅工分可转）
  if (token_type !== 'gongfen' && !(internalForBank && to === FOUNDER_UID)) throw new Error('茶票为股权凭证，禁止转账；仅工分可转账')
  const wf = await getWallet(from)
  const curF = token_type === 'gongfen' ? BigInt(wf.gongfen||0) : BigInt(wf.chapiao||0)
  if (curF < amount) throw new Error(`${token_type==='gongfen'?'工分':'茶票'}余额不足`)
  const wt = await getWallet(to)
  const curT = token_type === 'gongfen' ? BigInt(wt.gongfen||0) : BigInt(wt.chapiao||0)
  const afterF = curF - amount
  const afterT = curT + amount
  // 条件更新防并发双花：余额不足以扣减时影响行数为 0
  const debited = await prisma.$executeRawUnsafe(
    token_type==='gongfen'
      ? `UPDATE tea_wallet SET gongfen=$1, updated_at=$2 WHERE uid=$3 AND gongfen >= $4`
      : `UPDATE tea_wallet SET chapiao=$1, updated_at=$2 WHERE uid=$3 AND chapiao >= $4`,
    Number(afterF), Math.floor(Date.now()/1000), from, Number(amount))
  if (debited < 1) throw new Error(`${token_type==='gongfen'?'工分':'茶票'}余额不足（并发冲突，请重试）`)
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET gongfen=$1, chapiao=$2, updated_at=$3 WHERE uid=$4`,
    token_type==='gongfen'?Number(afterT):Number(wt.gongfen||0),
    token_type==='chapiao'?Number(afterT):Number(wt.chapiao||0),
    Math.floor(Date.now()/1000), to)
  await appendTx(from, token_type, -amount, 'transfer', from, to, remark, afterF)
  await appendTx(to, token_type, amount, 'transfer', from, to, remark, afterT)
  return { ok: true }
}

// ── 银行赎回茶票：创始节点托管账扣减 → 用户增加（保持总量守恒，绕开茶票禁止普通转账）──
async function bankReturnChapiao(uid: string, amount: number, remark: string) {
  const amt = BigInt(amount)
  const wf = await getWallet(FOUNDER_UID)
  const wu = await getWallet(uid)
  const ts = Math.floor(Date.now() / 1000)
  const afterF = BigInt(wf.chapiao || 0) - amt
  const afterU = BigInt(wu.chapiao || 0) + amt
  if (afterF < 0n) throw new Error('创始节点托管账余额不足')
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET chapiao=$1, updated_at=$2 WHERE uid=$3`, Number(afterF), ts, FOUNDER_UID)
  await prisma.$queryRawUnsafe(`UPDATE tea_wallet SET chapiao=$1, updated_at=$2 WHERE uid=$3`, Number(afterU), ts, uid)
  await appendTx(FOUNDER_UID, 'chapiao', -amt, 'transfer', FOUNDER_UID, uid, remark, afterF)
  await appendTx(uid, 'chapiao', amt, 'transfer', FOUNDER_UID, uid, remark, afterU)
  return { ok: true }
}

export default async function tokenWalletRoutes(fastify: FastifyInstance) {
  // ── GET /api/tea/wallet — 双通证钱包总览 ──
  fastify.get('/api/tea/wallet', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const uid = request.user.id
    const w = await getWallet(uid)
    const txs: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT 50`, uid)
    const swap: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_bank_loan WHERE uid=$1 AND status='active' ORDER BY id DESC LIMIT 10`, uid)
    return {
      success: true,
      data: {
        gongfen: Number(w.gongfen || 0),
        chapiao: Number(w.chapiao || 0),
        founder: uid === FOUNDER_UID,
        totalSupply: Number(CHAIN_TOTAL_SUPPLY),
        txs: txs.map((t: any) => ({
          id: Number(t.id),
          token_type: t.token_type,
          amount: Number(t.amount),
          balance_after: Number(t.balance_after),
          tx_type: t.tx_type,
          from_uid: t.from_uid,
          to_uid: t.to_uid,
          remark: t.remark,
          hash: t.hash,
          created_at: Number(t.created_at),
        })),
        activeLoans: swap.map((l: any) => ({
          id: Number(l.id),
          pledge_chapiao: Number(l.pledge_chapiao),
          loan_gongfen: Number(l.loan_gongfen),
          days: l.days,
          status: l.status,
        })),
      },
    }
  })

  // ── GET /api/tea/wallet/txs — 全量流水分页 ──
  fastify.get('/api/tea/wallet/txs', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const uid = request.user.id
    const limit = Math.min(100, Math.max(1, Number((request.query as any).limit || 50)))
    const offset = Math.max(0, Number((request.query as any).offset || 0))
    const txs: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT $2 OFFSET $3`, uid, limit, offset)
    return { success: true, data: txs.map((t: any) => ({ id: Number(t.id), token_type: t.token_type, amount: Number(t.amount), tx_type: t.tx_type, from_uid: t.from_uid, to_uid: t.to_uid, remark: t.remark, created_at: Number(t.created_at), balance_after: Number(t.balance_after) })) }
  })

  // ── POST /api/tea/token/mint — 系统发放工分（仅创始节点/管理员）──
  fastify.post('/api/tea/token/mint', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    if (uid !== FOUNDER_UID) return reply.status(403).send({ error: '仅创始节点可发行' })
    const { to, amount, remark = '系统发放' } = (request.body as any) || {}
    if (!to || !amount || amount <= 0) return reply.status(400).send({ error: '参数错误' })
    const result = await mint(String(to), 'gongfen', BigInt(amount), String(remark))
    return { success: true, data: result }
  })

  // ── POST /api/tea/token/transfer — 通证转账 ──
  fastify.post('/api/tea/token/transfer', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { to, tokenType, amount, remark = '', paypass } = (request.body as any) || {}
    if (!to || !tokenType || !amount || amount <= 0) return reply.status(400).send({ error: '参数错误' })
    if (!Number.isInteger(Number(amount))) return reply.status(400).send({ error: '转账金额必须是整数工分' })
    if (tokenType !== 'gongfen') return reply.status(400).send({ error: '仅支持工分转账；茶票为股权凭证，禁止转账（可到飞升台兑换或茶票市场流通）' })
    if (String(to) === uid) return reply.status(400).send({ error: '不能转给自己' })
    try { await requirePaypass(uid, paypass) } catch (e: any) {
      if (e?.message === 'PAYPASS_NOT_SET') return reply.status(403).send({ error: '请先在「支付密码」页设置支付密码后再进行转账', code: 'PAYPASS_NOT_SET' })
      if (e?.message === 'NEED_PAYPASS') return reply.status(403).send({ error: '支付密码错误，请重新输入', code: 'NEED_PAYPASS' })
      throw e
    }
    try {
      await transfer(uid, String(to), tokenType, BigInt(amount), String(remark))
      return { success: true }
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || '转账失败' })
    }
  })

  // ═══ 茶票市场（工分买茶票） ═══
  // GET /api/tea/market/list — 挂售列表
  fastify.get('/api/tea/market/list', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const q = request.query as any
    const status = q.status || 'open'
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)))
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_market_order WHERE status=$1 ORDER BY id DESC LIMIT $2`, status, limit)
    return { success: true, data: rows.map((o: any) => ({ id: Number(o.id), seller_uid: o.seller_uid, amount: Number(o.amount), price: Number(o.price), status: o.status, buyer_uid: o.buyer_uid, created_at: Number(o.created_at) })) }
  })

  // POST /api/tea/market/sell — 挂售茶票（用茶票换工分）
  fastify.post('/api/tea/market/sell', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { amount, price } = (request.body as any) || {}
    if (!amount || !price || amount <= 0 || price <= 0) return reply.status(400).send({ error: '参数错误' })
    const w = await getWallet(uid)
    if (BigInt(w.chapiao||0) < BigInt(amount)) return reply.status(400).send({ error: '茶票不足' })
    // 挂售不扣余额，成交时再结算（简单方案：挂售后先冻结——这里简化为成交时校验）
    await prisma.$queryRawUnsafe(
      `INSERT INTO tea_market_order (seller_uid, amount, price, status, created_at) VALUES ($1,$2,$3,'open',$4) RETURNING id`,
      uid, Number(amount), Number(price), Math.floor(Date.now()/1000))
    return { success: true }
  })

  // POST /api/tea/market/buy — 成交（买家出工分，得茶票）
  fastify.post('/api/tea/market/buy', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { orderId } = (request.body as any) || {}
    if (!orderId) return reply.status(400).send({ error: 'orderId 必填' })
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_market_order WHERE id=$1 AND status='open'`, Number(orderId))
    if (!rows.length) return reply.status(404).send({ error: '订单不存在或已成交' })
    const o = rows[0]
    if (o.seller_uid === uid) return reply.status(400).send({ error: '不能买自己的挂单' })
    const cost = BigInt(o.amount) * BigInt(o.price)   // 总工分成本
    const w = await getWallet(uid)
    if (BigInt(w.gongfen||0) < cost) return reply.status(400).send({ error: '工分不足' })
    // 茶票 卖家→买家；工分 买家→卖家
    await transfer(o.seller_uid, uid, 'chapiao', BigInt(o.amount), '茶票市场成交')
    await transfer(uid, o.seller_uid, 'gongfen', cost, '茶票市场付款')
    await prisma.$queryRawUnsafe(`UPDATE tea_market_order SET status='sold', buyer_uid=$1, sold_at=$2 WHERE id=$3`, uid, Math.floor(Date.now()/1000), o.id)
    return { success: true, data: { cost: Number(cost) } }
  })

  // POST /api/tea/market/cancel — 下架
  fastify.post('/api/tea/market/cancel', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { orderId } = (request.body as any) || {}
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_market_order WHERE id=$1 AND seller_uid=$2 AND status='open'`, Number(orderId), uid)
    if (!rows.length) return reply.status(404).send({ error: '订单不存在或无权操作' })
    await prisma.$queryRawUnsafe(`UPDATE tea_market_order SET status='cancelled' WHERE id=$1`, Number(orderId))
    return { success: true }
  })

  // GET /api/tea/market/my — 我的订单
  fastify.get('/api/tea/market/my', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const uid = request.user.id
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_market_order WHERE seller_uid=$1 OR buyer_uid=$1 ORDER BY id DESC LIMIT 50`, uid)
    return { success: true, data: rows.map((o: any) => ({ id: Number(o.id), seller_uid: o.seller_uid, amount: Number(o.amount), price: Number(o.price), status: o.status, buyer_uid: o.buyer_uid, created_at: Number(o.created_at) })) }
  })

  // ═══ 联邦银行（质押茶票借工分 + 存款吃息，利率对齐桌面版） ═══
  // GET /api/tea/bank/status — 银行状态：利率计划 + 我的贷款/存款
  fastify.get('/api/tea/bank/status', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const uid = request.user.id
    const w = await getWallet(uid)
    const chapiao = Number(w.chapiao || 0)
    const rate = await bankRate()
    const loanPlans = Object.entries(BANK_LOAN_PLANS).map(([d, p]) => ({ days: Number(d), mult: p.mult, rate: p.rate, maxLoan: Math.floor(chapiao * rate * p.mult) }))
    const depPlans = Object.entries(BANK_DEPOSIT_PLANS).map(([d, r]) => ({ days: Number(d), rate: r }))
    const loans: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_bank_loan WHERE uid=$1 ORDER BY id DESC LIMIT 20`, uid)
    const dep: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_bank_deposit WHERE uid=$1 ORDER BY id DESC LIMIT 20`, uid)
    return {
      success: true, data: {
        rate, chapiao, gongfen: Number(w.gongfen || 0),
        loanPlans, depPlans,
        loans: loans.map((l: any) => ({ id: Number(l.id), pledgeChapiao: Number(l.pledge_chapiao), loanGongfen: Number(l.loan_gongfen), days: Number(l.days), mult: Number(l.mult || 1), annualRate: Number(l.annual_rate || 0), status: l.status, dueAt: Number(l.due_at || 0) })),
        deposits: dep.map((d: any) => ({ id: Number(d.id), amount: Number(d.amount), days: Number(d.days), annualRate: Number(d.annual_rate), status: d.status, dueAt: Number(d.due_at || 0), interest: Math.floor(Number(d.amount) * Number(d.annual_rate) * Number(d.days) / 365) })),
      },
    }
  })

  // POST /api/tea/bank/loan — 质押茶票借工分（贷款额度=质押×mult，按期限档位）
  fastify.post('/api/tea/bank/loan', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { pledgeChapiao, days } = (request.body as any) || {}
    const d = Number(days)
    const plan = BANK_LOAN_PLANS[d]
    if (!plan) return reply.status(400).send({ error: '贷款期限仅支持 30/60/90/180/360 天' })
    const amt = Math.floor(Number(pledgeChapiao) || 0)
    if (amt < 10) return reply.status(400).send({ error: '质押茶票至少 10 张' })
    const w = await getWallet(uid)
    if (Number(w.chapiao || 0) < amt) return reply.status(400).send({ error: '茶票不足' })
    const rate = await bankRate()
    const loan = Math.floor(amt * rate * plan.mult)  // 贷款额度 = 质押茶票 × 当日市场汇率 × 倍数（工分）
    if (loan < 1) return reply.status(400).send({ error: '贷款额度不足 1 工分' })
    const now = Math.floor(Date.now() / 1000)
    // 质押茶票 → 创始节点托管（内部银行允许茶票）
    await transfer(uid, FOUNDER_UID, 'chapiao', BigInt(amt), '银行质押(' + d + '天)', true)
    // 发放工分贷款
    await mint(uid, 'gongfen', BigInt(loan), '银行贷款(' + d + '天)')
    await prisma.$queryRawUnsafe(
      `INSERT INTO tea_bank_loan (uid, pledge_chapiao, loan_gongfen, days, mult, annual_rate, status, created_at, due_at) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8)`,
      uid, amt, loan, d, plan.mult, plan.rate, now, now + d * 86400)
    return { success: true, data: { loanId: 0, pledgeChapiao: amt, loanGongfen: loan, days: d, mult: plan.mult, annualRate: plan.rate, rate, dueAt: now + d * 86400 } }
  })

  // POST /api/tea/bank/repay — 到期偿还（本金+利息），混合结算：
  //   工分优先扣光 → 不足部分按当日兑换汇率用茶票折算抵偿 → 仍不足则工分/茶票全部自动扣光（违约没收质押，不赎回）
  fastify.post('/api/tea/bank/repay', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { loanId } = (request.body as any) || {}
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_bank_loan WHERE id=$1 AND uid=$2 AND status='active'`, Number(loanId), uid)
    if (!rows.length) return reply.status(404).send({ error: '贷款不存在或已结清' })
    const loan = rows[0]
    const now = Math.floor(Date.now() / 1000)
    const heldDays = Math.max(1, Math.ceil((now - Number(loan.created_at)) / 86400))
    const principal = Number(loan.loan_gongfen)
    const annualRate = Number(loan.annual_rate || 0)
    const interest = Math.floor(principal * annualRate * heldDays / 365)
    const total = principal + interest                       // 应还总额（工分）
    const rate = await bankRate()                            // 当日兑换汇率（1 茶票 = rate 工分）
    const w = await getWallet(uid)
    const gongfenBal = Number(w.gongfen || 0)
    const chapiaoBal = Number(w.chapiao || 0)

    // ① 工分优先：扣光工分（不超过应还总额）
    const gongfenPaid = Math.min(gongfenBal, total)
    let deficit = total - gongfenPaid
    let chapiaoUsed = 0
    let chapiaoGongfen = 0
    let short = 0

    // ② 工分不足 → 用茶票按当日汇率折算抵偿
    if (deficit > 0 && chapiaoBal > 0) {
      // 折算等值茶票：需要 ceil(deficit / rate) 张茶票（向上取整保证抵足）
      const neededChapiao = Math.ceil(deficit / (rate > 0 ? rate : 1))
      chapiaoUsed = Math.min(chapiaoBal, neededChapiao)
      chapiaoGongfen = Math.floor(chapiaoUsed * rate)        // 实际抵偿工分数
      deficit = total - gongfenPaid - chapiaoGongfen
    }

    short = Math.max(0, deficit)   // 仍欠部分

    // ── 执行扣款（若有）──
    if (gongfenPaid > 0) {
      await transfer(uid, FOUNDER_UID, 'gongfen', BigInt(gongfenPaid), '银行还款(' + loan.days + '天，工分抵扣)')
    }
    if (chapiaoUsed > 0) {
      await transfer(uid, FOUNDER_UID, 'chapiao', BigInt(chapiaoUsed), '银行还款(' + loan.days + '天，茶票折算抵扣)', true)
    }

    // ── 结算：是否足额还清 ──
    const settled = short <= 0
    if (settled) {
      // 足额还清：赎回质押茶票（创始节点托管账 → 用户，保持总量守恒）
      await bankReturnChapiao(uid, Number(loan.pledge_chapiao), '质押解押')
      await prisma.$queryRawUnsafe(`UPDATE tea_bank_loan SET status='repaid', repaid_at=$1 WHERE id=$2`, now, loan.id)
    } else {
      // 违约：工分/茶票已全部自动扣光，质押茶票没收（不赎回），标记逾期
      await prisma.$queryRawUnsafe(`UPDATE tea_bank_loan SET status='overdue', settled_at=$1, short_gongfen=$2 WHERE id=$3`, now, short, loan.id)
    }

    return {
      success: true, data: {
        principal, interest, total,
        gongfenPaid, chapiaoUsed, chapiaoGongfen, rate,
        short, settled,
        pledgeChapiao: Number(loan.pledge_chapiao),
        redeemed: settled ? Number(loan.pledge_chapiao) : 0,
      },
    }
  })

  // POST /api/tea/bank/deposit — 存款（存工分吃利息）
  fastify.post('/api/tea/bank/deposit', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { amount, days } = (request.body as any) || {}
    const d = Number(days)
    const rate = BANK_DEPOSIT_PLANS[d]
    if (!rate) return reply.status(400).send({ error: '存款期限仅支持 30/60/90/180/360 天' })
    const amt = Math.floor(Number(amount) || 0)
    if (amt < 10) return reply.status(400).send({ error: '存款至少 10 工分' })
    const w = await getWallet(uid)
    if (Number(w.gongfen || 0) < amt) return reply.status(400).send({ error: '工分不足' })
    const now = Math.floor(Date.now() / 1000)
    // 扣存工分（转入创始节点托管）
    await transfer(uid, FOUNDER_UID, 'gongfen', BigInt(amt), '银行存款(' + d + '天)', true)
    await prisma.$queryRawUnsafe(
      `INSERT INTO tea_bank_deposit (uid, amount, days, annual_rate, status, created_at, due_at) VALUES ($1,$2,$3,$4,'active',$5,$6)`,
      uid, amt, d, rate, now, now + d * 86400)
    return { success: true, data: { depositId: 0, amount: amt, days: d, annualRate: rate, dueAt: now + d * 86400, interest: Math.floor(amt * rate * d / 365) } }
  })

  // POST /api/tea/bank/deposit/withdraw — 取款（到期本息到账，未到期退回本金）
  fastify.post('/api/tea/bank/deposit/withdraw', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const uid = request.user.id
    const { depositId } = (request.body as any) || {}
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_bank_deposit WHERE id=$1 AND uid=$2 AND status='active'`, Number(depositId), uid)
    if (!rows.length) return reply.status(404).send({ error: '存款不存在或已取' })
    const dep = rows[0]
    const now = Math.floor(Date.now() / 1000)
    const matured = Number(dep.due_at) <= now
    const principal = Number(dep.amount)
    const interest = matured ? Math.floor(principal * Number(dep.annual_rate) * Number(dep.days) / 365) : 0
    const back = principal + interest
    // 创始节点返还本金+利息（发工分）
    await mint(uid, 'gongfen', BigInt(back), matured ? '存款到期本息' : '存款提前取出')
    await prisma.$queryRawUnsafe(`UPDATE tea_bank_deposit SET status='withdrawn', withdrawn_at=$1 WHERE id=$2`, now, dep.id)
    return { success: true, data: { principal, interest, total: back, matured } }
  })

  // ═══ 区块链浏览器 · 通证节点查询 ═══
  // ── GET /api/tea/chain — 链总览（区块高度/创世/最新哈希/链校验）──
  fastify.get('/api/tea/chain', { preHandler: [fastify.authenticate] }, async () => {
    const meta: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n, COALESCE(MAX(id),0)::int AS maxid FROM tea_wallet_tx`)
    const first: any = await prisma.$queryRawUnsafe(`SELECT hash FROM tea_wallet_tx ORDER BY id ASC LIMIT 1`)
    const last: any = await prisma.$queryRawUnsafe(`SELECT hash, created_at FROM tea_wallet_tx ORDER BY id DESC LIMIT 1`)
    return {
      success: true,
      data: {
        height: meta[0]?.n || 0,
        latestHeight: meta[0]?.maxid || 0,
        genesisHash: first.length ? first[0].hash : null,
        latestHash: last.length ? last[0].hash : null,
        latestTime: last.length ? Number(last[0].created_at) : null,
        totalSupply: Number(CHAIN_TOTAL_SUPPLY),
        chainOk: null, // 由 /verify 计算
      },
    }
  })

  // ── GET /api/tea/chain/verify — 全链哈希完整性校验（逐区块重算对比）──
  fastify.get('/api/tea/chain/verify', { preHandler: [fastify.authenticate] }, async () => {
    const rows: any = await prisma.$queryRawUnsafe(`SELECT id, uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, prev_hash, hash, created_at FROM tea_wallet_tx ORDER BY id ASC`)
    let ok = true
    let bad = 0
    const nodes = rows.map((t: any) => {
      const rec = { prev_hash: t.prev_hash, uid: t.uid, token_type: t.token_type, amount: Number(t.amount), tx_type: t.tx_type, from_uid: t.from_uid, to_uid: t.to_uid, remark: t.remark, created_at: Number(t.created_at) }
      const recomputed = txHash(rec)
      const valid = recomputed === t.hash
      if (!valid) { ok = false; bad++ }
      return { id: Number(t.id), hash: t.hash, prev_hash: t.prev_hash, isValid: valid }
    })
    return { success: true, data: { chainOk: ok, totalNodes: nodes.length, invalidNodes: bad, nodes } }
  })

  // ── GET /api/tea/chain/block?hash=xxx — 按哈希查区块详情（含重算校验）──
  fastify.get('/api/tea/chain/block', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const hash = ((request.query as any)?.hash || '').toString().trim()
    if (!hash) return reply.status(400).send({ error: 'hash 必填' })
    const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx WHERE hash=$1 ORDER BY id ASC`, hash)
    if (!rows.length) return reply.status(404).send({ error: '区块不存在' })
    const t = rows[0]
    const rec = { prev_hash: t.prev_hash, uid: t.uid, token_type: t.token_type, amount: Number(t.amount), tx_type: t.tx_type, from_uid: t.from_uid, to_uid: t.to_uid, remark: t.remark, created_at: Number(t.created_at) }
    // 该区块被谁引用为 prev（后代节点）
    const children: any = await prisma.$queryRawUnsafe(`SELECT id, hash FROM tea_wallet_tx WHERE prev_hash=$1 ORDER BY id ASC`, hash)
    // 按用户取余额变化（便于展示）
    return {
      success: true,
      data: {
        id: Number(t.id),
        height: Number(t.id),
        hash: t.hash,
        recomputedHash: txHash(rec),
        isValid: txHash(rec) === t.hash,
        prevHash: t.prev_hash,
        childCount: children.length,
        children: children.map((c: any) => ({ id: Number(c.id), hash: c.hash })),
        tx: {
          uid: t.uid,
          token_type: t.token_type,
          amount: Number(t.amount),
          balance_after: Number(t.balance_after),
          tx_type: t.tx_type,
          from_uid: t.from_uid,
          to_uid: t.to_uid,
          remark: t.remark,
          created_at: Number(t.created_at),
        },
      },
    }
  })

  // ── GET /api/tea/chain/blocks — 区块分页列表 ──
  fastify.get('/api/tea/chain/blocks', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const q = request.query as any
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)))
    const offset = Math.max(0, Number(q.offset || 0))
    const rows: any = await prisma.$queryRawUnsafe(`SELECT id, uid, token_type, amount, tx_type, from_uid, to_uid, remark, prev_hash, hash, created_at FROM tea_wallet_tx ORDER BY id DESC LIMIT $1 OFFSET $2`, limit, offset)
    const total: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM tea_wallet_tx`)
    return {
      success: true,
      data: {
        total: total[0]?.n || 0,
        blocks: rows.map((t: any) => ({
          id: Number(t.id),
          height: Number(t.id),
          hash: t.hash,
          prev_hash: t.prev_hash,
          token_type: t.token_type,
          amount: Number(t.amount),
          tx_type: t.tx_type,
          from_uid: t.from_uid,
          to_uid: t.to_uid,
          remark: t.remark,
          created_at: Number(t.created_at),
        })),
      },
    }
  })

  // ── GET /api/tea/chain/trace?hash=xxx — 从指定区块沿 prev_hash 回溯到创世的时间线 ──
  fastify.get('/api/tea/chain/trace', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    // 允许不传 hash：默认从最新区块回溯
    let hash = ((request.query as any)?.hash || '').toString().trim()
    let cur: any = null
    if (hash) {
      const r: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx WHERE hash=$1 ORDER BY id DESC LIMIT 1`, hash)
      if (!r.length) return reply.status(404).send({ error: '区块不存在' })
      cur = r[0]
    } else {
      const r: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx ORDER BY id DESC LIMIT 1`)
      cur = r.length ? r[0] : null
    }
    if (!cur) return { success: true, data: { trace: [], depth: 0, chainOk: true } }
    const trace: any[] = []
    let guard = 0
    let chainOk = true
    while (cur && guard < 5000) {
      const rec = { prev_hash: cur.prev_hash, uid: cur.uid, token_type: cur.token_type, amount: Number(cur.amount), tx_type: cur.tx_type, from_uid: cur.from_uid, to_uid: cur.to_uid, remark: cur.remark, created_at: Number(cur.created_at) }
      const valid = txHash(rec) === cur.hash
      if (!valid) chainOk = false
      trace.push({
        id: Number(cur.id),
        height: Number(cur.id),
        hash: cur.hash,
        prev_hash: cur.prev_hash,
        isValid: valid,
        isGenesis: !cur.prev_hash || cur.prev_hash === 'genesis',
        token_type: cur.token_type,
        amount: Number(cur.amount),
        tx_type: cur.tx_type,
        from_uid: cur.from_uid,
        to_uid: cur.to_uid,
        remark: cur.remark,
        created_at: Number(cur.created_at),
      })
      if (!cur.prev_hash || cur.prev_hash === 'genesis') break
      const p: any = await prisma.$queryRawUnsafe(`SELECT * FROM tea_wallet_tx WHERE hash=$1 ORDER BY id DESC LIMIT 1`, cur.prev_hash)
      if (!p.length) { chainOk = false; break }
      cur = p[0]
      guard++
    }
    return { success: true, data: { trace, depth: trace.length, chainOk, fromHash: hash || null } }
  })
}
