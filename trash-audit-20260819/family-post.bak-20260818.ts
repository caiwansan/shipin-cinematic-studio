import { prisma } from '../utils/index.js'

// 宗亲社区帖子（云端共享：桌面/手机通用；仅家族成员可见——对齐城市会员制）
async function isFamilyMember(uid: string, groupId: string): Promise<boolean> {
  try {
    const m = await prisma.imChannelMember.findFirst({
      where: { channelId: 'grp_' + groupId, channelType: 4, uid },
      select: { id: true },
    })
    return !!m
  } catch { return false }
}

export default async function familyPostRoutes(fastify: any) {
  // GET /api/tea/family/posts — 某宗亲群帖子流（仅群成员可见）
  fastify.get('/api/tea/family/posts', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const q = request.query as { groupId?: string; limit?: string }
    const gid = String(q.groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(request.user.id, gid))) return reply.status(403).send({ error: '仅家族成员可见' })
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)))
    const posts = await prisma.familyPost.findMany({
      where: { groupId: gid },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const uids = [...new Set(posts.map((p) => p.uid))]
    const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, nickname: true, username: true, avatarUrl: true } }) : []
    const umap = new Map(users.map((u) => [u.id, u]))
    const out = posts.map((p) => {
      let images: string[] = []
      try { images = JSON.parse(p.images || '[]') } catch { }
      let likes: string[] = []
      try { likes = JSON.parse(p.likes || '[]') } catch { }
      let comments: any[] = []
      try { comments = JSON.parse(p.comments || '[]') } catch { }
      return {
        id: String(p.id), uid: p.uid, groupId: p.groupId, sig: p.sig || '', pubKey: p.pubKey || '',
        nickname: umap.get(p.uid)?.nickname || umap.get(p.uid)?.username || String(p.uid).slice(0, 8),
        avatar: umap.get(p.uid)?.avatarUrl || '',
        content: p.content, images,
        likes: likes.length, liked: false, comments: comments.length, commentsArr: comments,
        gifts: p.gifts || 0,
        createdAt: Math.floor(new Date(p.createdAt).getTime() / 1000),
      }
    })
    return { success: true, data: { posts: out } }
  })

  // POST /api/tea/family/posts — 发帖（仅群成员）
  fastify.post('/api/tea/family/posts', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { groupId, content, images, sig = '', pubKey = '' } = (request.body as any) || {}
    const gid = String(groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(userId, gid))) return reply.status(403).send({ error: '仅家族成员可发帖' })
    let text = String(content || '').trim().slice(0, 2000)
    text = text.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;|&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\uFFFD/g, '')
    if (!text) return reply.status(400).send({ error: '内容不能为空' })
    const imgs = Array.isArray(images) ? images.filter((x: any) => typeof x === 'string' && /^https?:/.test(x)).slice(0, 9) : []
    const post = await prisma.familyPost.create({ data: { groupId: gid, uid: userId, content: text, images: JSON.stringify(imgs), sig: String(sig || '').slice(0, 500), pubKey: String(pubKey || '').slice(0, 500) } })
    return { success: true, data: { id: String(post.id) } }
  })

  // POST /api/tea/family/posts/like — 点赞/取消（仅群成员）
  fastify.post('/api/tea/family/posts/like', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { postId } = (request.body as any) || {}
    const post = await prisma.familyPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await isFamilyMember(userId, post.groupId))) return reply.status(403).send({ error: '仅家族成员可见' })
    let likes: string[] = []
    try { likes = JSON.parse(post.likes || '[]') } catch { }
    const idx = likes.indexOf(userId)
    if (idx >= 0) likes.splice(idx, 1); else likes.push(userId)
    await prisma.familyPost.update({ where: { id: post.id }, data: { likes: JSON.stringify(likes) } })
    return { success: true, data: { liked: idx < 0, likes: likes.length } }
  })

  // POST /api/tea/family/posts/comment — 评论（仅群成员）
  fastify.post('/api/tea/family/posts/comment', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { postId, text } = (request.body as any) || {}
    const post = await prisma.familyPost.findUnique({ where: { id: String(postId || '') } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    if (!(await isFamilyMember(userId, post.groupId))) return reply.status(403).send({ error: '仅家族成员可见' })
    const t = String(text || '').trim().slice(0, 500)
    if (!t) return reply.status(400).send({ error: '评论不能为空' })
    const comments: any[] = []
    try { comments.push(...JSON.parse(post.comments || '[]')) } catch { }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, username: true, avatarUrl: true } })
    comments.push({ uid: userId, nickname: u?.nickname || u?.username || String(userId).slice(0, 8), avatar: u?.avatarUrl || '', text: t, ts: Date.now() })
    await prisma.familyPost.update({ where: { id: post.id }, data: { comments: JSON.stringify(comments.slice(-200)) } })
    return { success: true, data: { ok: true } }
  })

  // GET /api/tea/family/groups — 获取用户加入的宗亲群列表
  fastify.get('/api/tea/family/groups', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    try {
      // 查找用户加入的所有群（channelType=4 表示群聊）
      const memberships = await prisma.imChannelMember.findMany({
        where: { uid, channelType: 4 },
        select: { channelId: true },
      })
      const groupIds = memberships.map((m: any) => String(m.channelId).replace(/^grp_/, ''))
      if (!groupIds.length) return { success: true, data: { groups: [] } }

      // 获取群名称（从 familyPost 第一条帖子提取，或使用群ID）
      const groups = groupIds.map((gid: string) => ({
        id: gid,
        name: gid, // 群名称需要从其他地方获取，暂时用ID
        memberCount: 0,
      }))

      // 尝试从 imChannelMember 统计群成员数
      for (const g of groups) {
        const count = await prisma.imChannelMember.count({
          where: { channelId: 'grp_' + g.id, channelType: 4 },
        })
        g.memberCount = count
      }

      return { success: true, data: { groups } }
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || '获取宗亲群失败' })
    }
  })

}
