// identity.routes.ts — 用户身份密钥体系（ECDSA 身份锚）

// 场景：新机登录私钥验证 · 账号丢失私钥找回 · 加密私钥托管（助记词解密）

// 表：identity_challenges / identity_challenges_meta 运行时创建（不动 prisma schema）

import { FastifyInstance, FastifyReply } from 'fastify'

import { prisma } from '../utils/index.js'

import crypto from 'crypto'



let tableReady = false

async function ensureTable() {

  if (tableReady) return

  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS identity_challenges (

    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    nonce TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    used BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  )`)

  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS identity_challenges_meta (

    user_id TEXT PRIMARY KEY,

    enc_key TEXT NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  )`)

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "public_key" TEXT`)

  tableReady = true

}



export default async function identityRoutes(fastify: FastifyInstance) {

  await ensureTable()



  // 1. 绑定公钥（身份指纹）到昆仑镜账号 — 需挑战签名证明持钥（防任意覆盖）

  fastify.post('/api/auth/identity/bind', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {

    const userId = request.user.id as string

    const { publicKey, challenge, signature } = (request.body || {}) as any

    if (!publicKey || !String(publicKey).includes('BEGIN PUBLIC KEY')) {

      return reply.status(400).send({ success: false, error: '公钥格式不合法（需 SPKI PEM）' })

    }

    // 校验挑战签名：只有持有新私钥者能绑定新公钥

    if (challenge && signature) {

      const rows: any = await prisma.$queryRawUnsafe(

        `SELECT id, nonce FROM identity_challenges WHERE user_id = $1 AND nonce = $2 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,

        userId, String(challenge)

      )

      const row = rows?.[0]

      if (!row) return reply.status(400).send({ success: false, error: '挑战无效或已过期' })

      let ok = false

      try { ok = crypto.verify('sha256', Buffer.from(String(challenge), 'utf8'), String(publicKey), Buffer.from(String(signature), 'base64')) }

      catch (e) { ok = false }

      if (!ok) return reply.status(403).send({ success: false, error: '签名验证失败（仅密钥持有者可绑定公钥）' })

      await prisma.$executeRawUnsafe(`UPDATE identity_challenges SET used = true WHERE id = $1`, row.id)

    } else {

      // 兼容：已有公钥时的免签绑定仅允许"同一公钥"重复绑定（幂等）

      const cur: any = await prisma.$queryRawUnsafe(`SELECT "public_key" FROM "User" WHERE "id" = $1::uuid`, userId)

      if (cur?.[0]?.public_key && cur[0].public_key !== String(publicKey)) {

        return reply.status(403).send({ success: false, error: '账号已绑定其他公钥，需签名验证后更新' })

      }

    }

    await prisma.$executeRawUnsafe(`UPDATE "User" SET "public_key" = $1 WHERE "id" = $2::uuid`, String(publicKey), userId)

    return { success: true, data: { bound: true } }

  })



  // 2. 生成签名挑战（新机/找回时用）

  fastify.post('/api/auth/identity/challenge', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {

    const userId = request.user.id as string

    const nonce = crypto.randomBytes(32).toString('hex')

    const id = crypto.randomUUID()

    await prisma.$executeRawUnsafe(

      `INSERT INTO identity_challenges (id, user_id, nonce, expires_at) VALUES ($1, $2, $3, now() + interval '5 minutes')`,

      id, userId, nonce

    )

    return { success: true, data: { challenge: nonce, id } }
  })

  // 1.5 云端身份信息（供桌面同步：是否有托管密钥 + 已绑定公钥）
  fastify.get('/api/auth/identity/info', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    let encKey = null
    try {
      const m: any = await prisma.$queryRawUnsafe(`SELECT enc_key FROM identity_challenges_meta WHERE user_id=$1`, userId)
      if (m?.length && m[0].enc_key) encKey = m[0].enc_key
    } catch (e) { /* ignore */ }
    let pubKey = null
    try {
      const u: any = await prisma.$queryRawUnsafe(`SELECT "public_key" FROM "User" WHERE "id" = $1::uuid`, userId)
      if (u?.length && u[0].public_key) pubKey = u[0].public_key
    } catch (e) { /* ignore */ }
    return { success: true, data: { hasKey: !!encKey, bound: !!pubKey, encKey, pubKey } }
  })

  // 3. 验签确认身份（私钥持有者）

  fastify.post('/api/auth/identity/verify', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {

    const userId = request.user.id as string

    const { challenge, signature } = (request.body || {}) as any

    if (!challenge || !signature) return reply.status(400).send({ success: false, error: 'challenge/signature 必填' })

    const rows: any = await prisma.$queryRawUnsafe(

      `SELECT id, nonce FROM identity_challenges WHERE user_id = $1 AND nonce = $2 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,

      userId, String(challenge)

    )

    const row = rows?.[0]

    if (!row) return reply.status(400).send({ success: false, error: '挑战无效或已过期' })

    const pubRow: any = await prisma.$queryRawUnsafe(`SELECT "public_key" FROM "User" WHERE "id" = $1::uuid`, userId)

    const pubKey = pubRow?.[0]?.public_key

    if (!pubKey) return reply.status(400).send({ success: false, error: '账号未绑定身份公钥' })

    let ok = false

    try {

      const sig = Buffer.from(String(signature), 'base64')

      ok = crypto.verify('sha256', Buffer.from(String(challenge), 'utf8'), pubKey, sig)

    } catch (e) { ok = false }

    if (!ok) return reply.status(403).send({ success: false, error: '签名验证失败（私钥不匹配）' })

    await prisma.$executeRawUnsafe(`UPDATE identity_challenges SET used = true WHERE id = $1`, row.id)

    return { success: true, data: { verified: true, identityVerifiedAt: new Date().toISOString() } }

  })



  // 4. 托管加密私钥（AES 助记词加密，服务器只见密文）

  fastify.put('/api/auth/identity/key', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {

    const userId = request.user.id as string

    const { encKey } = (request.body || {}) as any

    if (!encKey || String(encKey).length > 20000) return reply.status(400).send({ success: false, error: 'encKey 不合法' })

    await prisma.$executeRawUnsafe(

      `INSERT INTO identity_challenges_meta (user_id, enc_key, updated_at) VALUES ($1, $2, now())

       ON CONFLICT (user_id) DO UPDATE SET enc_key = $2, updated_at = now()`,

      userId, String(encKey)

    )

    return { success: true, data: { stored: true } }

  })



  // 5. 取回加密私钥（新机恢复）

  fastify.get('/api/auth/identity/key', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {

    const userId = request.user.id as string

    const rows: any = await prisma.$queryRawUnsafe(`SELECT enc_key FROM identity_challenges_meta WHERE user_id = $1`, userId)

    if (!rows?.[0]?.enc_key) return { success: true, data: { encKey: null } }

    return { success: true, data: { encKey: rows[0].enc_key } }

  })

}

