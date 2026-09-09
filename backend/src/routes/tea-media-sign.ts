import { FastifyInstance } from 'fastify'

function validateMediaId(id: string): string {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : '';
}

import { prisma } from '../utils/index.js'
import { verify } from 'crypto'

// 昆仑茶馆 · 聊天图片签名链（发送/转发认证）
// 私钥永不出本地：桌面端本地 ECDSA 签名后把 sig+pubKey 传上来，服务端验签入库，供全员共享验真
function verifySig(pubKeyPem: string, payload: string, sigB64: string): boolean {
  try {
    return verify('sha256', Buffer.from(payload, 'utf8'), pubKeyPem, Buffer.from(sigB64, 'base64'))
  } catch { return false }
}

export default async function teaMediaSignRoutes(fastify: FastifyInstance) {
  // POST /api/tea/media-sign — 记录图片签名（kind=send 发送 / forward 转发）
  fastify.post('/api/tea/media-sign', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { url, kind, sig, pubKey } = (request.body as any) || {}
    const u = String(url || '')
    if (!u || !/^https?:\/\//.test(u)) return reply.status(400).send({ error: 'url 必填且为 http(s) 地址' })
    if (u.length > 500) return reply.status(400).send({ error: 'url 过长' })
    const k = kind === 'forward' ? 'forward' : 'send'
    if (!sig || !pubKey) return reply.status(400).send({ error: '缺少签名' })
    if (!verifySig(String(pubKey), u + '|' + k, String(sig))) return reply.status(400).send({ error: '签名验证失败' })
    await prisma.$executeRawUnsafe(
      `INSERT INTO tea_media_sign (url, uid, kind, sig, pub_key) VALUES ($1, $2, $3, $4, $5)`,
      u, String(userId), k, String(sig).slice(0, 500), String(pubKey).slice(0, 600),
    )
    return { success: true, data: { ok: true } }
  })

  // GET /api/tea/media-sig — 图片签名链（登录可见）
  fastify.get('/api/tea/media-sig', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const url = String((request.query as any).url || '')
    if (!url) return reply.status(400).send({ error: 'url 必填' })
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, url, uid, kind, sig, pub_key, created_at FROM tea_media_sign WHERE url = $1 ORDER BY created_at ASC, id ASC LIMIT 200`,
      url,
    )
    const uids = [...new Set(rows.map((r) => String(r.uid)))]
    const users = uids.length
      ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } })
      : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const chain = rows.map((r) => {
      let sigOk = false
      try { sigOk = verifySig(String(r.pub_key), String(r.url) + '|' + String(r.kind), String(r.sig)) } catch { /* ignore */ }
      return {
        id: String(r.id),
        uid: String(r.uid),
        nickname: umap.get(String(r.uid))?.nickname || umap.get(String(r.uid))?.username || String(r.uid).slice(0, 8),
        kind: r.kind,
        sig: String(r.sig || ''),
        pubKey: String(r.pub_key || ''),
        sigOk,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      }
    })
    return { success: true, data: { url, chain } }
  })
}
