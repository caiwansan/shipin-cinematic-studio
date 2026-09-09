// tea-storage.ts — 云端数据备份找回 + 助记词体系（对齐桌面 /api/local/storage/*，云端化）
// 助记词：12 英文词（BIP39 词库），sha256 存储验证；备份用 AES-256-GCM（密钥=sha256(助记词)）
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let WORDLIST: string[] = []
const WL_CANDIDATES = [
  path.join(__dirname, 'bip39-english.txt'),
  path.join(process.cwd(), 'src', 'bip39-english.txt'),
  path.join(process.cwd(), 'bip39-english.txt'),
]
for (const fp of WL_CANDIDATES) {
  try { WORDLIST = readFileSync(fp, 'utf8').trim().split(/\s+/).filter(Boolean); if (WORDLIST.length) break } catch (e) {}
}

const h = (s: string) => createHash('sha256').update('tea-recovery|' + s).digest('hex')
function deriveKey(mnemonic: string): Buffer { return createHash('sha256').update('tea-backup-key|' + mnemonic).digest() }
function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}
function decrypt(payload: string, key: Buffer): string {
  const [ivB, tagB, ctB] = payload.split('.')
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'))
  d.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([d.update(Buffer.from(ctB, 'base64')), d.final()]).toString('utf8')
}
async function getRec(userId: string) {
  const r: any = await prisma.$queryRawUnsafe(`SELECT mnemonic_hash AS "mh", enc_key AS "ek", backup_data AS "bd", backup_at AS "ba" FROM user_asset_recovery WHERE user_id=$1`, userId)
  return r.length ? r[0] : null
}
async function buildBackupObject(userId: string) {
  // 资料 + 通证 + 设置 快照
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, nickname: true, email: true, memberTier: true } })
  const w: any = await prisma.$queryRawUnsafe(`SELECT gongfen, chapiao FROM tea_wallet WHERE uid=$1`, userId).catch(() => [])
  const wallet = w.length ? { gongfen: Number(w[0].gongfen || 0), chapiao: Number(w[0].chapiao || 0) } : {}
  const prof = await prisma.$queryRawUnsafe(`SELECT profile_data FROM user_setting WHERE user_uid=$1`, userId).catch(() => [])
  let profile = {}
  try { profile = prof.length && prof[0].profile_data ? JSON.parse(prof[0].profile_data) : {} } catch (e) { profile = {} }

  // 个人空间媒体清单（影像空间/我的视频/我的文件）—— 仅记录元数据+url，供助记词找回时还原索引
  let spaceMedia: any[] = []
  try {
    spaceMedia = await prisma.$queryRawUnsafe(
      `SELECT id, kind, name, url, ext, size, dist_ref, created_at FROM tea_space_media WHERE user_id=$1 ORDER BY created_at`, userId)
      .then((rs: any) => rs.map((it: any) => ({ id: it.id, kind: it.kind, name: it.name, url: it.url, ext: it.ext, size: Number(it.size || 0), distRef: it.dist_ref, createdAt: Number(it.created_at || 0) })))
      .catch(() => [])
  } catch (e) { spaceMedia = [] }

  return { uid: userId, user: u ? { username: u.username, nickname: u.nickname, email: u.email, memberTier: u.memberTier } : {}, wallet, profile, spaceMedia, backupAt: new Date().toISOString() }
}

export default async function teaStorageRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }

  // GET /api/tea/storage/status
  fastify.get('/api/tea/storage/status', auth, async (request: any) => {
    const userId = request.user.id
    const rec = await getRec(userId)
    return {
      success: true, data: {
        mnemonicSet: !!(rec?.mh),
        encKeySet: !!rec?.ek,
        backupCount: rec?.bd ? 1 : 0,
        hasBackup: !!rec?.bd,
        lastBackup: rec?.ba ? new Date(Number(rec.ba) * 1000).toISOString() : null,
      },
    }
  })

  // POST /api/tea/storage/mnemonic — 生成助记词（返回明文仅一次）
  fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      // 幂等：已存在则绝不覆盖/不回显明文
      const __rec: any = await prisma.$queryRawUnsafe(`SELECT enc_key, mnemonic_hash, backup_at FROM user_asset_recovery WHERE user_id = $1`, userId)
      if (__rec[0] && (__rec[0].enc_key || __rec[0].mnemonic_hash)) {
        return { success: true, data: { already: true, hasMnemonic: true, backupAt: __rec[0].backup_at || 0 } }
      }
      if (!WORDLIST.length) return { success: false, error: '词库加载失败' }
      const words: string[] = []
      for (let i = 0; i < 12; i++) words.push(WORDLIST[Math.floor(Math.random() * WORDLIST.length)])
      const mnemonic = words.join(' ')
      const key = deriveKey(mnemonic)
      const ts = new Date()
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_asset_recovery (user_id, mnemonic_hash, enc_key, updated_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET mnemonic_hash=$2, enc_key=$3, updated_at=$4`,
        userId, h(mnemonic), key.toString('hex'), ts)
      return { success: true, data: { mnemonic, words, already: false } }
    } catch (e: any) {
      console.error('[mnemonic] error:', e.message)
      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  })

  // POST /api/tea/storage/mnemonic/reset — 重置助记词（作废旧）
  fastify.post('/api/tea/storage/mnemonic/reset', auth, async (request: any) => {
    const userId = request.user.id
    await prisma.$queryRawUnsafe(`UPDATE user_asset_recovery SET mnemonic_hash='', enc_key='', backup_data='', backup_at=0, updated_at=$1 WHERE user_id=$2`,
      new Date(), userId)
    return { success: true, data: { message: '已重置，请重新生成助记词并抄好' } }
  })

  // POST /api/tea/storage/backup — 备份当前数据（加密快照）
  fastify.post('/api/tea/storage/backup', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    const rec = await getRec(userId)
    if (!rec?.ek) return reply.status(400).send({ success: false, error: '请先生成助记词（数据备份需助记词加密）' })
    const obj = await buildBackupObject(userId)
    const enc = encrypt(JSON.stringify(obj), Buffer.from(rec.ek, 'hex'))
    const ts = new Date()
    await prisma.$queryRawUnsafe(
      `INSERT INTO user_asset_recovery (user_id, backup_data, backup_at, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET backup_data=$2, backup_at=$3, updated_at=$4`,
      userId, enc, ts, ts)
    return { success: true, data: { message: '备份完成（加密快照已存云端）' } }
  })

  // GET /api/tea/storage/backups — 备份概览（时间/内容摘要，不返回明文）
  fastify.get('/api/tea/storage/backups', auth, async (request: any) => {
    const userId = request.user.id
    const rec = await getRec(userId)
    if (!rec?.bd) return { success: true, data: { backups: [] } }
    return {
      success: true, data: {
        backups: [{ file: 'snapshot-' + Number(rec.ba) + '.json', backupAt: new Date(Number(rec.ba) * 1000).toISOString(), encrypted: true, size: rec.bd.length }],
      },
    }
  })

  // POST /api/tea/storage/restore — 输入助记词找回恢复
  fastify.post('/api/tea/storage/restore', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    const { mnemonic } = (request.body as any) || {}
    if (!mnemonic || !String(mnemonic).trim()) return reply.status(400).send({ success: false, error: '请输入助记词' })
    const rec = await getRec(userId)
    if (!rec?.mh || h(String(mnemonic).trim().toLowerCase()) !== rec.mh) {
      return reply.status(403).send({ success: false, error: '助记词校验失败（请检查拼写）' })
    }
    if (!rec.bd) return { success: true, data: { restored: true, data: null, message: '助记词正确，暂无备份数据' } }
    try {
      const json = JSON.parse(decrypt(rec.bd, Buffer.from(rec.ek, 'hex')))
      return { success: true, data: { restored: true, data: json, message: '备份已恢复' } }
    } catch (e) {
      return reply.status(500).send({ success: false, error: '备份解密失败（密钥不匹配）' })
    }
  })
}