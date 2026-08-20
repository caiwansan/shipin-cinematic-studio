// admin-identity.routes.ts — 会员密钥/助记词加密管理（监管合规）
// 仅 admin 可见；需 admin 监管私钥签名解锁；用户生成身份时同步监管备份（私钥明文+助记词）
import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin, extractAdmin } from '../middleware/require-admin.js'
import crypto from 'crypto'

const SCOPE = 'tea'
const KEY = 'admin_identity_key'

const unlockSessions = new Map<string, { userId: string; expire: number }>()

async function getGuardPub(): Promise<string> {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: SCOPE, key: KEY } } })
  const v: any = row?.value || {}
  return v.publicKey || ''
}

export default async function adminIdentityRoutes(fastify: FastifyInstance) {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS identity_regulatory (
    user_id TEXT PRIMARY KEY,
    plain_priv TEXT DEFAULT '',
    mnemonic TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)

  // 0. 监管公钥配置（admin 首次生成密钥对后录入公钥）
  fastify.put('/api/admin/identity/guard-key', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { publicKey } = request.body || {}
    if (!publicKey || !String(publicKey).includes('BEGIN PUBLIC KEY')) {
      return reply.code(400).send({ success: false, error: '公钥格式不合法' })
    }
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: SCOPE, key: KEY } },
      update: { value: { publicKey: String(publicKey) }, label: '昆仑茶馆监管私钥', isActive: true },
      create: { scope: SCOPE, key: KEY, value: { publicKey: String(publicKey) }, label: '昆仑茶馆监管私钥', isActive: true },
    })
    return { success: true, data: { saved: true } }
  })
  fastify.get('/api/admin/identity/guard-key', { preHandler: [requireAdmin] }, async () => {
    const pub = await getGuardPub()
    return { success: true, data: { hasKey: !!pub, keyMasked: pub ? String(pub).slice(27, 31) + '***' : '' } }
  })

  // 1. 挑战
  fastify.post('/api/admin/identity/challenge', { preHandler: [requireAdmin] }, async (request: any) => {
    const nonce = crypto.randomBytes(32).toString('hex')
    ;(request.server as any).adminChallenges = (request.server as any).adminChallenges || new Map()
    ;(request.server as any).adminChallenges.set(nonce, Date.now() + 10 * 60 * 1000)
    return { success: true, data: { challenge: nonce } }
  })

  // 2. 解锁（私钥签名验签 → 30 分钟会话）
  fastify.post('/api/admin/identity/unlock', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const adminId = extractAdmin(request)?.username || 'admin'
    const { challenge, signature } = request.body || {}
    if (!challenge || !signature) return reply.code(400).send({ success: false, error: 'challenge/signature 必填' })
    const pool: Map<string, number> = (request.server as any).adminChallenges || new Map()
    const exp = pool.get(String(challenge))
    if (!exp || exp < Date.now()) return reply.code(400).send({ success: false, error: '挑战无效或已过期' })
    pool.delete(String(challenge))
    const pub = await getGuardPub()
    if (!pub) return reply.code(400).send({ success: false, error: '未配置监管公钥，请先录入（首次生成管理员密钥对）' })
    let ok = false
    try { ok = crypto.verify('sha256', Buffer.from(String(challenge), 'utf8'), pub, Buffer.from(String(signature), 'base64')) }
    catch (e) { ok = false }
    if (!ok) return reply.code(403).send({ success: false, error: '签名验证失败（非监管私钥持有者）' })
    const token = crypto.randomBytes(24).toString('hex')
    unlockSessions.set(token, { userId: adminId, expire: Date.now() + 30 * 60 * 1000 })
    return { success: true, data: { unlockToken: token, expireAt: Date.now() + 30 * 60 * 1000 } }
  })

  // 3. 查询用户监管信息（需解锁令牌）
  fastify.get('/api/admin/identity/user', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const ut = String((request.query as any)?.unlockToken || '')
    const sess = unlockSessions.get(ut)
    if (!sess || sess.expire < Date.now()) return reply.code(403).send({ success: false, error: '未解锁或会话过期（需监管私钥签名解锁）' })
    const q = String((request.query as any)?.q || '').trim()
    if (!q) return reply.code(400).send({ success: false, error: '请输入用户标识' })
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, username, phone, email, "public_key", "known_ips", "active_ip", "createdAt", "lastActiveAt"
       FROM "User" WHERE username = $1 OR phone = $1 OR id::text = $1 OR "public_key" LIKE '%' || $1 || '%' LIMIT 1`,
      q
    )
    const u = rows?.[0]
    if (!u) return reply.code(404).send({ success: false, error: '未找到用户' })
    const esc: any = await prisma.$queryRawUnsafe(`SELECT enc_key FROM identity_challenges_meta WHERE user_id = $1`, u.id)
    let ips: any[] = []
    try { ips = JSON.parse(u.known_ips || '[]') } catch (e) { ips = [] }
    const reg: any = await prisma.$queryRawUnsafe(`SELECT plain_priv, mnemonic FROM identity_regulatory WHERE user_id = $1`, u.id)
    return {
      success: true,
      data: {
        id: u.id,
        username: u.username,
        phone: u.phone || '',
        email: u.email || '',
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        activeIp: u.active_ip || '',
        knownIps: ips.slice(-200),
        identity: {
          publicKey: u.public_key || '',
          pubFingerprint: u.public_key ? crypto.createHash('sha256').update(String(u.public_key)).digest('hex').slice(0, 16) : '',
          encKey: esc?.[0]?.enc_key || '',
          plainPriv: reg?.[0]?.plain_priv || '',   // 监管备份：私钥明文
          mnemonic: reg?.[0]?.mnemonic || '',      // 监管备份：助记词明文
        },
      },
    }
  })

  // 3.5 用户列表（解锁后下拉选择）
  fastify.get('/api/admin/identity/users', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const ut = String((request.query as any)?.unlockToken || '')
    const sess = unlockSessions.get(ut)
    if (!sess || sess.expire < Date.now()) return reply.code(403).send({ success: false, error: '未解锁或会话过期' })
    const search = String((request.query as any)?.search || '').trim()
    let rows: any[] = []
    if (search) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, username, phone, email FROM "User" WHERE username ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' ORDER BY "createdAt" DESC LIMIT 100`,
        search
      )
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, username, phone, email FROM "User" ORDER BY "createdAt" DESC LIMIT 100`
      )
    }
    return {
      success: true,
      data: { users: rows.map((u: any) => ({ id: u.id, username: u.username, phone: u.phone || '', email: u.email || '' })) },
    }
  })

  // 4. 备份分片索引
  fastify.get('/api/admin/identity/backups', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const ut = String((request.query as any)?.unlockToken || '')
    const sess = unlockSessions.get(ut)
    if (!sess || sess.expire < Date.now()) return reply.code(403).send({ success: false, error: '未解锁或会话过期' })
    const q = String((request.query as any)?.q || '').trim()
    const u: any = await prisma.$queryRawUnsafe(
      `SELECT id FROM "User" WHERE username = $1 OR phone = $1 OR id::text = $1 LIMIT 1`, q
    ).then((r: any) => r?.[0])
    if (!u) return reply.code(404).send({ success: false, error: '未找到用户' })
    let refs: any[] = []
    try {
      const r = await fetch('http://127.0.0.1:9460/pkgs?ownerUid=' + encodeURIComponent('user_' + String(u.id).slice(0, 8)), { signal: AbortSignal.timeout(8000) })
      const j: any = await r.json()
      refs = (j.refs || []).slice(-20)
    } catch (e) { /* 中心不可达 */ }
    return { success: true, data: { ownerKey: 'user_' + String(u.id).slice(0, 8), shards: refs } }
  })

  // 5. 用户侧监管备份同步接口（本地茶馆生成密钥/助记词时调用）
  fastify.put('/api/auth/identity/regulatory', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { plainPriv, mnemonic } = (request.body || {}) as any
    if (!plainPriv || !mnemonic) return reply.code(400).send({ success: false, error: 'plainPriv/mnemonic 必填' })
    await prisma.$executeRawUnsafe(
      `INSERT INTO identity_regulatory (user_id, plain_priv, mnemonic, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET plain_priv = $2, mnemonic = $3, updated_at = now()`,
      userId, String(plainPriv), String(mnemonic)
    )
    return { success: true, data: { synced: true } }
  })
}
