import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import crypto from 'node:crypto'

// 昆仑茶馆公共社区帖子（云共享：免审核即时可见，桌面/手机通用；带身份密钥签名）
const TEA_CATEGORY = '茶馆'

// 身份签名验证：ECDSA-SHA256(pubKey, content) vs sig(base64)。返回 true/false/null(缺字段)
function verifyPostSig(pubKey: string, content: string, sig: string): boolean | null {
  if (!pubKey || !sig || !pubKey.includes('PUBLIC KEY')) return null
  try {
    return crypto.verify('sha256', Buffer.from(content, 'utf8'), pubKey, Buffer.from(sig, 'base64'))
  } catch { return false }
}
// 指纹：KT-XXXX-XXXX-XXXX（基于签名哈希，确定性强）
function postFingerprint(sig: string): string {
  if (!sig) return ''
  const h = crypto.createHash('sha256').update(sig).digest('hex').toUpperCase()
  return 'KT-' + h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12)
}

export default async function teaPostRoutes(fastify: FastifyInstance) {
  // GET /api/tea/posts — 茶馆公共帖子流（含签名信息）
  fastify.get('/api/tea/posts', async (request, reply) => {
    const query = request.query as { limit?: string; scope?: string }
    const limit = Math.min(50, Math.max(1, Number(query.limit || 30)))
    const scope = query.scope === 'friend' ? 'friend' : 'public'
    let uidFilter: any = {}
    if (scope === 'friend') {
      try { await request.jwtVerify() } catch (e: any) { return reply.status(401).send({ error: '朋友圈需登录' }) }
      // 好友世界 = 自己 + 我关注的人（粉丝可见：关注者能看到被关注者的好友帖）
      const me = (request as any).user.id as string
      const follows = await prisma.userFollow.findMany({ where: { followerId: me }, select: { followingId: true } })
      const uids = [me, ...follows.map((f: any) => f.followingId)]
      uidFilter = { uid: { in: uids } }
    }
    const bans = await prisma.teaBan.findMany({ select: { uid: true } })
    const banSet = new Set(bans.map((b) => b.uid))
    const posts = await prisma.teaPost.findMany({
      where: { scope, deleted: false, uid: { notIn: [...banSet] }, ...uidFilter },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const uids = [...new Set(posts.map((p) => p.uid))]
    const users = uids.length
      ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true, memberTier: true, memberExpiresAt: true } })
      : []
    const umap = new Map(users.map((u) => [u.id, u]))
    // 互动数据（likes/comments/tips 列，raw SQL 免 regenerate）
    const interact = new Map<string, any>()
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT id, likes, comments, tips FROM tea_post`) as any[]
      rows.forEach((r) => interact.set(String(r.id), r))
    } catch { /* ignore */ }
    let me = ''
    try { await request.jwtVerify(); me = ((request as any).user && (request as any).user.id) || '' } catch { }
    const out = posts.map((p) => {
      let images: string[] = []
      try { images = JSON.parse(p.images || '[]') } catch { /* ignore */ }
      const inter = interact.get(String(p.id)) || {}
      let ilikes: string[] = []; try { ilikes = JSON.parse(inter.likes || '[]') } catch { }
      let icomments: any[] = []; try { icomments = JSON.parse(inter.comments || '[]') } catch { }
      const sig = p.sig || ''
      const pubKey = p.pubKey || ''
      return {
        id: String(p.id),
        uid: p.uid,
        nickname: umap.get(p.uid)?.nickname || umap.get(p.uid)?.username || String(p.uid).slice(0, 8),
        avatar: umap.get(p.uid)?.avatarUrl || '',
        content: p.content,
        images,
        sig,
        pubKey,
        sigOk: verifyPostSig(pubKey, p.content, sig),
        fingerprint: postFingerprint(sig),
        created_at: Math.floor(new Date(p.createdAt).getTime() / 1000),
        likes: ilikes.length,
        liked: !!me && ilikes.includes(me),
        comments: icomments.length,
        commentsArr: icomments,
        tips: Number(inter.tips || 0),
      }
    })
    let isAdmin = false
    try { await request.jwtVerify(); const au = (request as any).user; if (au && au.id) { const a = await prisma.teaAdmin.findUnique({ where: { uid: au.id } }); isAdmin = !!a } } catch (e) {}
    return { success: true, data: { posts: out, isAdmin } }
  })

  // POST /api/tea/posts — 茶馆发帖（免审核即时可见；可选带 sig/pubKey 身份签名）
  fastify.post('/api/tea/posts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { content, images, sig, pubKey, scope } = (request.body as any) || {}
    let text = String(content || '').trim().slice(0, 5000)
    text = text.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;|&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\uFFFD/g, '')
    if (!text) return reply.status(400).send({ error: '内容不能为空' })
    const postScope = scope === 'friend' ? 'friend' : 'public'
    const imgs = Array.isArray(images)
      ? images.filter((x: any) => typeof x === 'string' && /^https?:/.test(x)).slice(0, 9)
      : []
    const banned = await prisma.teaBan.findUnique({ where: { uid: userId } })
    if (banned) return reply.status(403).send({ error: '你已被禁止发帖：' + (banned.reason || '违规') })
    const post = await prisma.teaPost.create({
      data: {
        uid: userId,
        content: text,
        images: JSON.stringify(imgs),
        sig: String(sig || '').slice(0, 500),
        pubKey: String(pubKey || '').slice(0, 500),
        scope: postScope,
      },
    })
    return { success: true, data: { id: String(post.id) } }
  })


  // POST /api/tea/posts/like — 点赞/取消（云端共享互动）
  fastify.post('/api/tea/posts/like', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { postId } = (request.body as any) || {}
    const post = await prisma.teaPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    let likes: string[] = []
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT likes FROM tea_post WHERE id = $1`, String(postId)) as any[]
      likes = JSON.parse((rows[0] && rows[0].likes) || '[]')
    } catch { }
    const idx = likes.indexOf(userId)
    if (idx >= 0) likes.splice(idx, 1); else likes.push(userId)
    await prisma.$executeRawUnsafe(`UPDATE tea_post SET likes = $1 WHERE id = $2`, JSON.stringify(likes), String(postId))
    return { success: true, data: { liked: idx < 0, likes: likes.length } }
  })

  // POST /api/tea/posts/comment — 评论（云端共享互动）
  fastify.post('/api/tea/posts/comment', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { postId, text } = (request.body as any) || {}
    const post = await prisma.teaPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const t = String(text || '').trim().slice(0, 500)
    if (!t) return reply.status(400).send({ error: '评论不能为空' })
    const comments: any[] = []
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT comments FROM tea_post WHERE id = $1`, String(postId)) as any[]
      comments.push(...JSON.parse((rows[0] && rows[0].comments) || '[]'))
    } catch { }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, username: true, avatarUrl: true } })
    comments.push({ uid: userId, name: u?.nickname || u?.username || String(userId).slice(0, 8), avatar: u?.avatarUrl || '', text: t, ts: Date.now() })
    await prisma.$executeRawUnsafe(`UPDATE tea_post SET comments = $1 WHERE id = $2`, JSON.stringify(comments.slice(-200)), String(postId))
    return { success: true, data: { ok: true, count: comments.length } }
  })

  // POST /api/tea/posts/tip — 打赏计数（金币语义；结算按礼物走钻石）
  fastify.post('/api/tea/posts/tip', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { postId, coins } = (request.body as any) || {}
    const amount = Math.floor(Number(coins) || 0)
    if (amount < 1 || amount > 9999) return reply.status(400).send({ error: '打赏金额需在 1-9999 金币' })
    const post = await prisma.teaPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const rows = await prisma.$queryRawUnsafe(`SELECT tips FROM tea_post WHERE id = $1`, String(postId)) as any[]
    const cur = Number((rows[0] && rows[0].tips) || 0)
    await prisma.$executeRawUnsafe(`UPDATE tea_post SET tips = tips + $1 WHERE id = $2`, amount, String(postId))
    return { success: true, data: { tipCount: cur + amount } }
  })

  // 删除自己的帖子（或管理员删任意）
  fastify.post('/api/tea/posts/delete', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { postId } = (request.body as any) || {}
    const post = await prisma.teaPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const isAdmin = !!(await prisma.teaAdmin.findUnique({ where: { uid } }))
    if (post.uid !== uid && !isAdmin) return reply.status(403).send({ error: '只能删除自己的帖子' })
    await prisma.teaPost.update({ where: { id: post.id }, data: { deleted: true } })
    return { success: true, data: { ok: true } }
  })

  // ═══ 公共社区管理员（删帖/禁言） ═══
  async function teaIsAdmin(uid: string) {
    const a = await prisma.teaAdmin.findUnique({ where: { uid } })
    return !!a
  }
  // 删帖（管理员）
  fastify.post('/api/tea/admin/delete', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    if (!(await teaIsAdmin(uid))) return reply.status(403).send({ error: '仅社区管理员可删帖' })
    const { postId } = (request.body as any) || {}
    const post = await prisma.teaPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    await prisma.teaPost.update({ where: { id: post.id }, data: { deleted: true } })
    return { success: true, data: { ok: true } }
  })
  // 禁言用户（管理员）
  fastify.post('/api/tea/admin/ban', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    if (!(await teaIsAdmin(uid))) return reply.status(403).send({ error: '仅社区管理员可禁言' })
    const { targetUid, reason } = (request.body as any) || {}
    if (!targetUid) return reply.status(400).send({ error: 'targetUid 必填' })
    await prisma.teaBan.upsert({ where: { uid: String(targetUid) }, update: { reason: String(reason || '').slice(0, 100), by: uid }, create: { uid: String(targetUid), reason: String(reason || '').slice(0, 100), by: uid } })
    return { success: true, data: { banned: true } }
  })
  // 解除禁言（管理员）
  fastify.post('/api/tea/admin/unban', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    if (!(await teaIsAdmin(uid))) return reply.status(403).send({ error: '仅社区管理员可解禁' })
    const { targetUid } = (request.body as any) || {}
    if (!targetUid) return reply.status(400).send({ error: 'targetUid 必填' })
    await prisma.teaBan.deleteMany({ where: { uid: String(targetUid) } })
    return { success: true, data: { banned: false } }
  })
  // 禁言列表（管理员）
  fastify.get('/api/tea/admin/bans', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    if (!(await teaIsAdmin(uid))) return reply.status(403).send({ error: '仅社区管理员可见' })
    const bans = await prisma.teaBan.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    const uids = [...new Set(bans.map((b) => b.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    return { success: true, data: { bans: bans.map((b) => ({ uid: b.uid, nickname: umap.get(b.uid)?.nickname || umap.get(b.uid)?.username || b.uid, reason: b.reason, by: b.by, createdAt: b.createdAt })) } }
  })
  // 云端用户公开资料（点头像降级卡用：昵称/头像/签名）
  fastify.get('/api/tea/users/profile', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { uid: targetUid } = (request.query as any) || {}
    if (!targetUid) return reply.status(400).send({ error: 'uid 必填' })
    const u = await prisma.user.findUnique({ where: { id: String(targetUid) }, select: { id: true, nickname: true, username: true, avatarUrl: true, memberTier: true, memberExpiresAt: true } })
    if (!u) return { success: true, data: { user: null } }
    return { success: true, data: { user: { uid: u.id, nickname: u.nickname || u.username || u.id, avatar: u.avatarUrl || '', memberTier: u.memberTier || '', memberExpiresAt: u.memberExpiresAt || null } } }
  })

  // ── 我的帖子：聚合所有社区(公共/城市/宗亲)我的发帖，只显示一行标题 ──
  fastify.get('/api/tea/posts/mine', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const me = (request as any).user.id
    const out: any[] = []
    // 公共社区(tea_post, scope public+friend, 未删)
    try {
      const rows = await prisma.teaPost.findMany({ where: { uid: me, deleted: false }, orderBy: { createdAt: 'desc' }, take: 100 })
      for (const p of rows) {
        let imgs: string[] = []; try { imgs = JSON.parse(p.images || '[]') } catch {}
        out.push({ id: String(p.id), kind: 'public', title: p.content ? p.content.split('\n')[0] : '', content: p.content, images: imgs, time: Math.floor(new Date(p.createdAt).getTime() / 1000) })
      }
    } catch (e) { console.log('[mine] public err', (e as any).message) }
    // 城市社区(city_post, active)
    try {
      const rows = await prisma.cityPost.findMany({ where: { uid: me, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 100 })
      for (const p of rows) {
        let imgs: string[] = []; try { imgs = JSON.parse(p.images || '[]') } catch {}
        out.push({ id: String(p.id), kind: 'city', title: p.title || (p.content ? p.content.split('\n')[0] : ''), content: p.content, images: imgs, time: Math.floor(new Date(p.createdAt).getTime() / 1000) })
      }
    } catch (e) { console.log('[mine] city err', (e as any).message) }
    // 宗亲社区(FamilyPost)
    try {
      const rows = await prisma.familyPost.findMany({ where: { uid: me }, orderBy: { createdAt: 'desc' }, take: 100 })
      for (const p of rows) {
        let imgs: string[] = []; try { imgs = JSON.parse(p.images || '[]') } catch {}
        out.push({ id: String(p.id), kind: 'family', title: p.content ? p.content.split('\n')[0] : '', content: p.content, images: imgs, time: Math.floor(new Date(p.createdAt).getTime() / 1000) })
      }
    } catch (e) { console.log('[mine] family err', (e as any).message) }
    out.sort((a, b) => b.time - a.time)
    return { success: true, data: { posts: out } }
  })

}
