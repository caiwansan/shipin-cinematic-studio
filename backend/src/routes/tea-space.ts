// tea-space.ts — 手机版「我的个人空间」媒体存储（影像空间 / 我的视频 / 我的文件）
// 仅用户本人可见：上传/列表/读取/删除全部按 userId 强校验，文件经鉴权接口流式返回（不暴露公开静态 URL）
// 存储：服务端文件系统(本地持久) + DB 元数据(tea_space_media) + 助记词备份快照(恢复找回
import { FastifyInstance } from 'fastify'

function validateMediaId(id: string): string {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : '';
}
function validateUid(uid: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(uid) || uid.length <= 64;
}

import { prisma } from '../utils/index.js'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'

const SPACE_KINDS = ['image', 'video', 'file']

function spaceDir(kind: string, userId: string): string {
  return path.join(process.cwd(), 'public/uploads/tea/space', userId, kind)
}

async function ensureTable() {
  await prisma.$queryRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tea_space_media (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      kind text NOT NULL,
      name text NOT NULL,
      url text NOT NULL,
      ext text NOT NULL DEFAULT '',
      mime text NOT NULL DEFAULT '',
      size bigint NOT NULL DEFAULT 0,
      dist_ref text NOT NULL DEFAULT '',
      created_at bigint NOT NULL DEFAULT 0
    )
  `).catch(() => {})
}

export default async function teaSpaceRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }

  // 鉴权：优先 Bearer 头，其次 ?token= 查询参数（供 <img>/<video>/<iframe> 等无法加头的场景）
  async function verifyAuth(request: any): Promise<any | null> {
    let token = ''
    const h = (request.headers as any).authorization || ''
    if (h.startsWith('Bearer ')) token = h.slice(7)
    if (!token) token = String((request.query as any).token || '')
    if (!token) return null
    try {
      const decoded = await fastify.jwt.verify(token)
      if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
        const dbUser = await prisma.user.findUnique({ where: { id: decoded.id }, select: { tokenVersion: true } })
        if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) return null
      }
      return decoded
    } catch (e) { return null }
  }

  // POST /api/tea/space/upload?kind=image|video|file
  fastify.post('/api/tea/space/upload', auth, async (request: any, reply: any) => {
    await ensureTable()
    const user = request.user as any
    const userId = user.id || user.userId
    const { kind } = request.query as any
    const k = SPACE_KINDS.includes(kind) ? kind : 'file'

    let data: any
    try { data = await request.file() } catch (e: any) { return reply.status(400).send({ success: false, error: '无文件数据' }) }
    if (!data) return reply.status(400).send({ success: false, error: '无文件' })

    const ext = (path.extname(data.filename || '').toLowerCase() || '.bin')
    let mime = String(data.mimetype || 'application/octet-stream')

    // 文件类型兜底判定（kind=video 时按扩展名保证是视频）
    let realKind = k
    if (k === 'file') {
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) realKind = 'image'
      else if (['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) realKind = 'video'
    }

    const dir = spaceDir(realKind, userId)
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {}
    const id = randomUUID()
    const fileName = id + ext
    const filePath = path.join(dir, fileName)
    try {
      await pipeline(data.file, fs.createWriteStream(filePath))
    } catch (e: any) { return reply.status(500).send({ success: false, error: '写入失败' }) }

    const size = fs.statSync(filePath).size
    const ts = Math.floor(Date.now() / 1000)
    // url 使用鉴权读取端点（/api/tea/space/raw/:id），不暴露公开静态路径
    const url = '/api/tea/space/raw/' + id
    const distRef = 'sha256:' + id // 分布式内容引用(占位；服务端文件即持久副本)

    await prisma.$queryRawUnsafe(
      `INSERT INTO tea_space_media (id, user_id, kind, name, url, ext, mime, size, dist_ref, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      id, userId, realKind, String(data.filename || '文件'), url, ext, mime, size, distRef, ts)

    return { success: true, data: { id, kind: realKind, name: String(data.filename || '文件'), url, ext, mime, size, distRef, createdAt: ts } }
  })

  // GET /api/tea/space/list?kind=image|video|file  — 仅本人
  fastify.get('/api/tea/space/list', auth, async (request: any) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const { kind } = request.query as any
    const where = kind && SPACE_KINDS.includes(kind) ? ` AND kind='${kind}'` : ''
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, kind, name, url, ext, mime, size, dist_ref, created_at FROM tea_space_media WHERE user_id=$1${where} ORDER BY created_at DESC`,
      userId).catch(() => [])
    return { success: true, data: { items: rows.map(r => ({ id: r.id, kind: r.kind, name: r.name, url: r.url, ext: r.ext, mime: r.mime, size: Number(r.size || 0), distRef: r.dist_ref, createdAt: Number(r.created_at || 0) })) } }
  })

  // GET /api/tea/space/raw/:id — 鉴权流式读取（仅本人），支持视频 Range（头或 ?token=）
  fastify.get('/api/tea/space/raw/:id', async (request: any, reply: any) => {
    const user = await verifyAuth(request)
    if (!user) return reply.status(401).send({ error: '未授权', message: 'token 无效或已过期，请重新登录' })
    const userId = user.id
    const id = String((request.params as any).id || '')
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT user_id, kind, name, ext FROM tea_space_media WHERE id=$1`, id).catch(() => [])
    if (!rows.length) return reply.status(404).send({ success: false, error: '文件不存在' })
    if (rows[0].user_id !== userId) return reply.status(403).send({ success: false, error: '仅本人可见' })

    const fp = path.join(spaceDir(rows[0].kind, userId), id + (rows[0].ext || ''))
    if (!fs.existsSync(fp)) return reply.status(404).send({ success: false, error: '文件已删除' })

    const mime = { image: 'image/jpeg', video: 'video/mp4', file: 'application/octet-stream' }[rows[0].kind] || 'application/octet-stream'
    const stat = fs.statSync(fp)

    // Range 支持（视频拖动播放）
    const rangeHeader = (request.headers as any).range
    if (rangeHeader) {
      const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
      if (m) {
        let start = m[1] ? parseInt(m[1], 10) : 0
        let end = m[2] ? parseInt(m[2], 10) : stat.size - 1
        if (isNaN(start) || start < 0) start = 0
        if (isNaN(end) || end >= stat.size) end = stat.size - 1
        if (start > end) return reply.status(416).send({})
        const chunkSize = end - start + 1
        reply.raw.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
          'Content-Disposition': 'inline',
        })
        fs.createReadStream(fp, { start, end }).pipe(reply.raw)
        return reply
      }
    }
    reply.raw.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline; filename="' + encodeURIComponent(rows[0].name || 'file') + '"',
    })
    fs.createReadStream(fp).pipe(reply.raw)
    return reply
  })

  // GET /api/tea/space/download/:id — 下载（仅本人，附件方式；头或 ?token=）
  fastify.get('/api/tea/space/download/:id', async (request: any, reply: any) => {
    const user = await verifyAuth(request)
    if (!user) return reply.status(401).send({ error: '未授权', message: 'token 无效或已过期，请重新登录' })
    const userId = user.id
    const id = String((request.params as any).id || '')
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT user_id, kind, name, ext FROM tea_space_media WHERE id=$1`, id).catch(() => [])
    if (!rows.length) return reply.status(404).send({ success: false, error: '文件不存在' })
    if (rows[0].user_id !== userId) return reply.status(403).send({ success: false, error: '仅本人可见' })

    const fp = path.join(spaceDir(rows[0].kind, userId), id + (rows[0].ext || ''))
    if (!fs.existsSync(fp)) return reply.status(404).send({ success: false, error: '文件已删除' })
    const stat = fs.statSync(fp)
    const safeName = encodeURIComponent(rows[0].name || 'file')
    reply.raw.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + safeName,
    })
    fs.createReadStream(fp).pipe(reply.raw)
    return reply
  })

  // DELETE /api/tea/space/item/:id — 删除（仅本人）
  fastify.delete('/api/tea/space/item/:id', auth, async (request: any, reply: any) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const id = String((request.params as any).id || '')
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT user_id, kind, ext FROM tea_space_media WHERE id=$1`, id).catch(() => [])
    if (!rows.length) return reply.status(404).send({ success: false, error: '文件不存在' })
    if (rows[0].user_id !== userId) return reply.status(403).send({ success: false, error: '仅本人可见' })
    await prisma.$queryRawUnsafe(`DELETE FROM tea_space_media WHERE id=$1`, id)
    try { const fp = path.join(spaceDir(rows[0].kind, userId), id + (rows[0].ext || '')); if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch (e) {}
    return { success: true, data: { deleted: true } }
  })
}
