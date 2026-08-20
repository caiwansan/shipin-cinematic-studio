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
      // 宗亲群 = 标记为 clan 的群（im_group.kind='clan'），普通群不入列
      const clanGroups = await prisma.$queryRawUnsafe(`SELECT id FROM im_group WHERE kind='clan' AND status='active'`) as any[]
      const clanIds = new Set((clanGroups || []).map((g: any) => String(g.id)))
      if (!clanIds.size) return { success: true, data: { groups: [] } }

      const memberships = await prisma.imChannelMember.findMany({
        where: { uid, channelType: 4, channelId: { startsWith: 'grp_' } },
        select: { channelId: true, role: true },
      })
      // 只保留标记为 clan 的群
      const groupIds = [...new Set(memberships
        .map((m: any) => String(m.channelId).replace(/^grp_/, ''))
        .filter((gid: string) => clanIds.has(gid)) )]
      if (!groupIds.length) return { success: true, data: { groups: [] } }

      // 群名 + 群主(im_group)
      const igs = await prisma.imGroup.findMany({ where: { id: { in: groupIds }, status: 'active' } })
      const igMap = new Map(igs.map((g: any) => [String(g.id), g]))
      const groups: any[] = []
      for (const gid of groupIds) {
        const ig = igMap.get(gid)
        const count = await prisma.imChannelMember.count({ where: { channelId: 'grp_' + gid, channelType: 4 } })
        const myRole = memberships.find((m: any) => String(m.channelId).replace(/^grp_/, '') === gid)?.role || 0
        groups.push({ id: gid, name: ig?.name || gid.slice(0, 8), intro: ig?.intro || '', memberCount: count, ownerUid: ig?.ownerUid || '', myRole })
      }
      return { success: true, data: { groups } }
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || '获取宗亲群失败' })
    }
  })

  // ── 族谱（宗亲树）──
  fastify.get('/api/tea/family/tree', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const gid = String((request.query as any).groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(request.user.id, gid))) return reply.status(403).send({ error: '仅家族成员可见' })
    // 🔄 自动同步: 把群内 IM 成员镜像进 family_member(族谱) — 桌面/手机成员变动经 IM 云同步后, 族谱自愈一致
    try {
      const imMems: any[] = await prisma.$queryRawUnsafe(`SELECT uid, name, role FROM im_channel_members WHERE channel_id='grp_'||$1::text AND channel_type=4`, gid)
      for (const mm of (imMems || [])) {
        if (String(mm.uid).startsWith('kunlun_tea_bot')) continue
        const nm = String(mm.name || '').slice(0, 20) || String(mm.uid).slice(0, 8)
        const ex: any = await prisma.$queryRawUnsafe(`SELECT id FROM family_member WHERE group_id=$1 AND uid=$2`, gid, String(mm.uid))
        if (!ex.length) {
          await prisma.$queryRawUnsafe(`INSERT INTO family_member (group_id, uid, name, generation, clan_role, lit, created_at) VALUES ($1,$2,$3,1,'',true,$4)`,
            gid, String(mm.uid), nm, Math.floor(Date.now() / 1000))
        }
      }
    } catch (e) { /* 非致命: 同步失败不阻塞读族谱 */ }
    try {
      const rows: any = await prisma.$queryRawUnsafe(`SELECT uid, name, generation, clan_role, lit FROM family_member WHERE group_id=$1 ORDER BY generation DESC, name ASC`, gid)
      const nodes = (rows || []).map((r: any) => ({ uid: r.uid, name: r.name, generation: Number(r.generation || 0), clanRole: r.clan_role || '', leafLit: !!r.lit }))
      return { success: true, data: { nodes } }
    } catch (e: any) { return reply.status(500).send({ error: e.message.slice(0, 80) }) }
  })

  // 入谱/更新辈分（成员报辈分，带姓名；族谱树用）
  fastify.post('/api/tea/family/member/join', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { groupId, generation, name, clanRole } = (request.body as any) || {}
    const gid = String(groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(uid, gid))) return reply.status(403).send({ error: '仅家族成员可入谱' })
    const gen = Math.max(1, Math.min(99, Number(generation) || 1))
    const nm = String(name || '').trim().slice(0, 20)
    const role = String(clanRole || '').trim().slice(0, 20)
    const ts = Math.floor(Date.now() / 1000)
    const exists: any = await prisma.$queryRawUnsafe(`SELECT id FROM family_member WHERE group_id=$1 AND uid=$2`, gid, uid)
    if (exists.length) {
      await prisma.$queryRawUnsafe(`UPDATE family_member SET name=$3, generation=$4, clan_role=$5 WHERE group_id=$1 AND uid=$2`, gid, uid, nm, gen, role)
    } else {
      await prisma.$queryRawUnsafe(`INSERT INTO family_member (group_id, uid, name, generation, clan_role, lit, created_at) VALUES ($1,$2,$3,$4,$5,true,$6)`, gid, uid, nm, gen, role, ts)
    }
    return { success: true, data: { ok: true, generation: gen } }
  })

  // ── 源流（数字宗祠/家族文化馆）──
  fastify.get('/api/tea/family/archive', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const gid = String((request.query as any).groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(request.user.id, gid))) return reply.status(403).send({ error: '仅家族成员可见' })
    try {
      const rows: any = await prisma.$queryRawUnsafe(`SELECT id, type, title, content, uid FROM family_archive WHERE group_id=$1 ORDER BY created_at ASC`, gid)
      return { success: true, data: { archives: (rows || []).map((r: any) => ({ id: r.id, type: r.type, title: r.title, content: r.content, mine: String(r.uid) === String(request.user.id) })) } }
    } catch (e: any) { return reply.status(500).send({ error: e.message.slice(0, 80) }) }
  })

  // 补录源流档案（族长 role>=1 或创建者）
  fastify.post('/api/tea/family/archive/add', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { groupId, type, title, content } = (request.body as any) || {}
    const gid = String(groupId || '')
    if (!gid) return reply.status(400).send({ error: 'groupId 必填' })
    if (!(await isFamilyMember(uid, gid))) return reply.status(403).send({ error: '仅家族成员可操作' })
    const isAdmin = await prisma.imChannelMember.findFirst({ where: { channelId: 'grp_' + gid, channelType: 4, uid, role: { gte: 1 } }, select: { id: true } })
    if (!isAdmin) return reply.status(403).send({ error: '仅族长可补录源流' })
    const tt = String(title || '').trim().slice(0, 60)
    const ct = String(content || '').trim().slice(0, 3000)
    const ty = ['surname_history', 'clan_history', 'county', 'hall'].includes(String(type)) ? String(type) : 'clan_history'
    if (!tt) return reply.status(400).send({ error: '标题必填' })
    const ts = Math.floor(Date.now() / 1000)
    const ins: any = await prisma.$queryRawUnsafe(`INSERT INTO family_archive (group_id, type, title, content, uid, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, gid, ty, tt, ct, uid, ts)
    return { success: true, data: { id: ins[0]?.id || '' } }
  })
  // 申请开通宗亲群聊（提交申请，后台管理员审核通过后建群+标记clan+申请人入谱族长）
  fastify.post('/api/tea/family/group/apply', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: uid } = request.user
    const { groupName } = (request.body as any) || {}
    const nm = String(groupName || '').trim().slice(0, 30)
    if (!nm) return reply.status(400).send({ error: '群名称必填' })
    const dup: any = await prisma.$queryRawUnsafe(`SELECT id FROM family_clan_apply WHERE uid=$1 AND status='pending'`, uid)
    if (dup.length) return reply.status(400).send({ error: '已有待审核的开群申请' })
    const ts = Math.floor(Date.now() / 1000)
    const ins: any = await prisma.$queryRawUnsafe(`INSERT INTO family_clan_apply (uid, group_name, status, created_at) VALUES ($1,$2,'pending',$3) RETURNING id`, uid, nm, ts)
    return { success: true, data: { id: ins[0]?.id || '' } }
  })

}
