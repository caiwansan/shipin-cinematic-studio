// 联邦银行路由 — Federal Bank Routes
// 功能：存款、取款、贷款、还款、交易流水

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// 获取或创建银行账户
async function getOrCreateAccount(userUid: string) {
  let account = await prisma.$queryRawUnsafe(`SELECT * FROM bank_account WHERE user_uid = $1`, userUid) as any[]
  if (!account.length) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO bank_account (user_uid) VALUES ($1)`, userUid
    )
    account = await prisma.$queryRawUnsafe(`SELECT * FROM bank_account WHERE user_uid = $1`, userUid) as any[]
  }
  return account[0]
}

export default async function bankRoutes(fastify: FastifyInstance) {
  // GET /api/bank/status — 账户状态
  fastify.get('/api/bank/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    return { success: true, data: account }
  })

  // POST /api/bank/deposit — 存款
  fastify.post('/api/bank/deposit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { amountCents } = request.body as any
    if (!amountCents || amountCents <= 0) return reply.status(400).send({ success: false, error: 'amountCents 必须大于 0' })
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    await prisma.$queryRawUnsafe(
      `UPDATE bank_account SET balance_cents = balance_cents + $1 WHERE id = $2`,
      amountCents, account.id
    )
    await prisma.$queryRawUnsafe(
      `INSERT INTO bank_transaction (account_id, tx_type, amount_cents, description) VALUES ($1, 'deposit', $2, '存款')`,
      account.id, amountCents
    )
    return { success: true, data: { amountCents } }
  })

  // POST /api/bank/withdraw — 取款
  fastify.post('/api/bank/withdraw', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { amountCents } = request.body as any
    if (!amountCents || amountCents <= 0) return reply.status(400).send({ success: false, error: 'amountCents 必须大于 0' })
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    if (Number(account.balance_cents) < amountCents) return reply.status(400).send({ success: false, error: '余额不足' })
    await prisma.$queryRawUnsafe(
      `UPDATE bank_account SET balance_cents = balance_cents - $1 WHERE id = $2`,
      amountCents, account.id
    )
    await prisma.$queryRawUnsafe(
      `INSERT INTO bank_transaction (account_id, tx_type, amount_cents, description) VALUES ($1, 'withdraw', $2, '取款')`,
      account.id, amountCents
    )
    return { success: true, data: { amountCents } }
  })

  // POST /api/bank/loan — 贷款
  fastify.post('/api/bank/loan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { amountCents, dueDays } = request.body as any
    if (!amountCents || amountCents <= 0) return reply.status(400).send({ success: false, error: 'amountCents 必须大于 0' })
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    if (Number(account.loan_balance_cents) > 0) return reply.status(400).send({ success: false, error: '已有未还贷款' })
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (dueDays || 30))
    await prisma.$queryRawUnsafe(
      `UPDATE bank_account SET loan_balance_cents = $1, loan_due_date = $2, balance_cents = balance_cents + $1 WHERE id = $3`,
      amountCents, dueDate.toISOString(), account.id
    )
    await prisma.$queryRawUnsafe(
      `INSERT INTO bank_transaction (account_id, tx_type, amount_cents, description) VALUES ($1, 'loan', $2, '贷款')`,
      account.id, amountCents
    )
    return { success: true, data: { amountCents, dueDate: dueDate.toISOString() } }
  })

  // POST /api/bank/loan/repay — 还款
  fastify.post('/api/bank/loan/repay', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    const loanBalance = Number(account.loan_balance_cents)
    if (loanBalance <= 0) return reply.status(400).send({ success: false, error: '无未还贷款' })
    if (Number(account.balance_cents) < loanBalance) return reply.status(400).send({ success: false, error: '余额不足还款' })
    await prisma.$queryRawUnsafe(
      `UPDATE bank_account SET balance_cents = balance_cents - $1, loan_balance_cents = 0, loan_due_date = NULL WHERE id = $2`,
      loanBalance, account.id
    )
    await prisma.$queryRawUnsafe(
      `INSERT INTO bank_transaction (account_id, tx_type, amount_cents, description) VALUES ($1, 'repay', $2, '还款')`,
      account.id, loanBalance
    )
    return { success: true, data: { repaidCents: loanBalance } }
  })

  // GET /api/bank/transactions — 交易流水
  fastify.get('/api/bank/transactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const account = await getOrCreateAccount(userUid)
    const txs = await prisma.$queryRawUnsafe(
      `SELECT * FROM bank_transaction WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
      account.id
    )
    return { success: true, data: { transactions: txs } }
  })
}
