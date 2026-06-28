import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { checkDailyQuota, getTodayUsage } from '../services/usage-quota.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

export default async function userCenterRoutes(fastify: FastifyInstance) {
  // ============================================
  // 积分系统
  // ============================================

  // GET /api/user/credits/logs — 积分流水记录
  fastify.get('/api/user/credits/logs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '50', offset = '0' } = request.query as any

    const logs = await prisma.coinLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0,
    })

    const total = await prisma.coinLog.count({ where: { userId } })
    return toApiResponse({logs, total}) satisfies ApiResponse<unknown>;
  })

  // POST /api/user/credits/consume — 消耗积分
  fastify.post('/api/user/credits/consume', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { amount, type = 'consume', remark = '' } = request.body as any

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: '请输入有效的消耗积分数' })
    }

    const membership = await prisma.membership.findUnique({ where: { userId } })
    if (!membership || membership.credits < amount) {
      return reply.status(400).send({ error: `积分不足，当前 ${membership?.credits || 0}，需要 ${amount}` })
    }

    await prisma.membership.update({
      where: { userId },
      data: { credits: { decrement: amount } },
    })

    await prisma.coinLog.create({
      data: {
        userId,
        amount: -amount,
        type: type || 'consume',
        remark: remark || '积分消耗',
      },
    })

    return toApiResponse({success: true, credits: -amount, balance: (membership.credits || 0) - amount}) satisfies ApiResponse<unknown>;
  })

  // POST /api/user/credits/recharge — 创建充值订单（收款码模式）
  fastify.post('/api/user/credits/recharge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { amount, method = 'wechat' } = request.body as any

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: '请输入有效的充值金额' })
    }

    // 检查支付方式是否可用
    const payConfig = await prisma.paymentConfig.findUnique({ where: { method } })
    if (!payConfig || !payConfig.enabled) {
      return reply.status(400).send({ error: '该支付方式不可用' })
    }

    // 模拟汇率：1元 = 100积分
    const coins = amount * 100
    const orderNo = 'R' + Date.now().toString(36) + userId.slice(0, 4)

    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo,
        type: 'credit',
        amount,
        coins,
        method,
        status: 'pending',
        planType: 'recharge',
      },
    })

    return toApiResponse({orderId: order.id,
      orderNo: order.orderNo,
      amount,
      coins,
      qrCodeUrl: payConfig.qrCodeUrl || '',
      account: payConfig.account || '',
      method: payConfig.method,}) satisfies ApiResponse<unknown>;
  })

  // ============================================
  // 作品库
  // ============================================

  // GET /api/user/library — 用户作品列表（分页）
  fastify.get('/api/user/library', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '50', offset = '0' } = request.query as any

    const assets = await prisma.userAsset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0,
    })

    const total = await prisma.userAsset.count({ where: { userId } })
    return toApiResponse({assets, total}) satisfies ApiResponse<unknown>;
  })

  // GET /api/user/library/:id — 作品详情
  fastify.get('/api/user/library/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any

    const asset = await prisma.userAsset.findUnique({
      where: { id },
      include: {
        likes: { select: { userId: true } },
        comments: { select: { content: true, createdAt: true, userId: true } },
      },
    })

    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    if (asset.userId !== userId) return reply.status(403).send({ error: '无权查看' })

    return toApiResponse({asset}) satisfies ApiResponse<unknown>;
  })

  // POST /api/user/regenerate-thumbnails — 为所有没有缩略图的视频生成第一帧缩略图
  fastify.post('/api/user/regenerate-thumbnails', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const videos = await prisma.userAsset.findMany({
      where: { userId, type: 'video', thumbnail: null },
      take: 50,
    })

    const results: { id: string; title: string; thumbnail: string | null; error?: string }[] = []

    for (const video of videos) {
      try {
        const thumbPath = `/tmp/thumb_${video.id}.jpg`
        const { execSync } = require('child_process')
        execSync(`ffmpeg -y -i "${video.url}" -ss 0.5 -vframes 1 -q:v 3 "${thumbPath}" 2>/dev/null`, { timeout: 30000 })
        const fs = require('fs')
        const stat = fs.statSync(thumbPath)
        if (stat.size > 0 && stat.size < 5 * 1024 * 1024) {
          const base64 = fs.readFileSync(thumbPath, { encoding: 'base64' })
          const dataUri = `data:image/jpeg;base64,${base64}`
          await prisma.userAsset.update({ where: { id: video.id }, data: { thumbnail: dataUri } })
          results.push({ id: video.id, title: video.title, thumbnail: dataUri })
          fs.unlinkSync(thumbPath)
        } else {
          results.push({ id: video.id, title: video.title, thumbnail: null, error: '文件大小异常' })
        }
      } catch (e: any) {
        results.push({ id: video.id, title: video.title, thumbnail: null, error: e.message })
      }
    }

    return toApiResponse({generated: results.filter(r => r.thumbnail).length, total: videos.length, results}) satisfies ApiResponse<unknown>;
  })

  // DELETE /api/user/library/:id — 删除作品
  fastify.delete('/api/user/library/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any

    const asset = await prisma.userAsset.findUnique({ where: { id } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    if (asset.userId !== userId) return reply.status(403).send({ error: '无权删除' })

    // 扣减已用空间
    await prisma.membership.update({
      where: { userId },
      data: { storageUsed: { decrement: asset.fileSize || 0 } },
    })

    await prisma.userAsset.delete({ where: { id } })
    return toApiResponse({success: true}) satisfies ApiResponse<unknown>;
  })

  // ============================================
  // 作品宇宙（公开作品展示）
  // ============================================

  // GET /api/universe/works — 公开作品列表（分页，无需登录）
  fastify.get('/api/universe/works', async (request, reply) => {
    const { limit = '20', offset = '0', type = 'all', sort = 'latest', clusterId } = request.query as any

    const where: any = {}
    if (type === 'image' || type === 'video') where.type = type
    if (clusterId) where.universeClusterId = clusterId

    // 排序
    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'trending' || sort === 'hot') orderBy = { universeScore: 'desc' }
    if (sort === 'cinematic') orderBy = { cinematicScore: 'desc' }

    const [works, total] = await Promise.all([
      prisma.userAsset.findMany({
        where,
        orderBy,
        take: Math.min(Number(limit) || 20, 100),
        skip: Number(offset) || 0,
      }),
      prisma.userAsset.count({ where }),
    ])

    // 附带点赞数、评论数和作者信息
    const enriched = await Promise.all(works.map(async (asset) => {
      const [likeCount, commentCount, user, cluster] = await Promise.all([
        prisma.assetLike.count({ where: { assetId: asset.id } }),
        prisma.assetComment.count({ where: { assetId: asset.id } }),
        prisma.user.findUnique({ where: { id: asset.userId }, select: { username: true, email: true } }),
        asset.universeClusterId ? prisma.universeCluster.findUnique({ where: { id: asset.universeClusterId } }) : null,
      ])
      return {
        id: asset.id,
        title: asset.title,
        thumbnail: asset.thumbnail || asset.url,
        url: asset.url,
        type: asset.type,
        prompt: asset.prompt,
        style: asset.style,
        author: user?.username || user?.email?.split('@')[0] || '匿名',
        likes: likeCount,
        comments: commentCount,
        date: asset.createdAt.toISOString().slice(0, 10),
        permission: 'public',
        // 宇宙评分
        universeScore: asset.universeScore,
        cinematicScore: asset.cinematicScore,
        narrativeScore: asset.narrativeScore,
        emotionalScore: asset.emotionalScore,
        consistencyScore: asset.consistencyScore,
        renderQualityScore: asset.renderQualityScore,
        worldDepthScore: asset.worldDepthScore,
        engagementScore: asset.engagementScore,
        freshnessScore: asset.freshnessScore,
        // 分群
        clusterName: cluster?.name || null,
        clusterGenre: cluster?.genre || null,
      } as any
    }))

    return toApiResponse({works: enriched, total, hasMore: Number(offset) + enriched.length < total}) satisfies ApiResponse<unknown>;
  })

  // POST /api/universe/works/:id/like — 点赞作品
  fastify.post('/api/universe/works/:id/like', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any

    const existing = await prisma.assetLike.findUnique({
      where: { assetId_userId: { assetId: id, userId } },
    })
    if (existing) {
      await prisma.assetLike.delete({ where: { id: existing.id } })
      return toApiResponse({liked: false}) satisfies ApiResponse<unknown>;
    }
    await prisma.assetLike.create({ data: { assetId: id, userId } })
    return toApiResponse({liked: true}) satisfies ApiResponse<unknown>;
  })

  // POST /api/universe/works/:id/comment — 评论作品
  fastify.post('/api/universe/works/:id/comment', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any
    const { content } = request.body as any
    if (!content) return reply.status(400).send({ error: '评论内容不能为空' })
    const comment = await prisma.assetComment.create({
      data: { assetId: id, userId, content },
    })
    return toApiResponse({comment}) satisfies ApiResponse<unknown>;
  })

  // ============================================
  // 宇宙评分 & 分群
  // ============================================

  // GET /api/universe/clusters — 获取所有宇宙分群
  fastify.get('/api/universe/clusters', async (_request, reply) => {
    const clusters = await prisma.universeCluster.findMany({
      orderBy: { workCount: 'desc' },
    })
    return toApiResponse({clusters}) satisfies ApiResponse<unknown>;
  })

  // POST /api/universe/rescore — 重新计算所有作品评分（管理员）
  fastify.post('/api/universe/rescore', async (_request, reply) => {
    const { recalculateAllScores } = await import('../services/universe-score-engine.js')
    const result = await recalculateAllScores()
    return result
  })

  // GET /api/universe/creator-dna — 获取创作者 DNA 档案
  fastify.get('/api/universe/creator-dna', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    let dna = await prisma.creatorDnaProfile.findUnique({
      where: { userId },
    })
    if (!dna) {
      // 初始化
      dna = await prisma.creatorDnaProfile.create({
        data: {
          userId,
          cinematicStyleSignature: JSON.stringify({ primary_style: 'emerging', confidence: 0.3 }),
          pacingProfile: JSON.stringify({ avg_beat_rate: 0.5, variability: 0.3 }),
          emotionalProfile: JSON.stringify({ dominant_emotion: 'neutral', range: 0.4 }),
          visualProfile: JSON.stringify({ color_palette: 'neutral', contrast: 0.5 }),
          directorSpeciesType: 'emerging_creator',
          dominantGenres: JSON.stringify([]),
        },
      })
    }
    return {
      cinematicStyleSignature: JSON.parse(dna.cinematicStyleSignature || '{}'),
      pacingProfile: JSON.parse(dna.pacingProfile || '{}'),
      emotionalProfile: JSON.parse(dna.emotionalProfile || '{}'),
      visualProfile: JSON.parse(dna.visualProfile || '{}'),
      directorSpeciesType: dna.directorSpeciesType,
      dominantGenres: JSON.parse(dna.dominantGenres || '[]'),
      creatorRank: dna.creatorRank,
    }
  })

  // ============================================
  // 推广代理
  // ============================================

  // GET /api/user/promo — 获取邀请码、好友列表、推广积分
  fastify.get('/api/user/promo', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const membership = await prisma.membership.findUnique({
      where: { userId },
      select: {
        parentId: true,
        children: {
          select: {
            user: { select: { id: true, username: true, email: true, createdAt: true } },
          },
        },
      },
    })

    // 计算推广获得的总积分
    const rewardLogs = await prisma.coinLog.findMany({
      where: { userId, type: 'reward' },
      select: { amount: true },
    })
    const totalRewardCoins = rewardLogs.reduce((sum, log) => sum + (log.amount > 0 ? log.amount : 0), 0)

    const parent = membership?.parentId
      ? await prisma.user.findUnique({ where: { id: membership.parentId }, select: { username: true, email: true } })
      : null

    return {
      referralCode: userId,
      referralUrl: `https://aigc.fushtn.com/register?ref=${userId}`,
      referrer: parent,
      referredUsers: (membership?.children || []).map(c => c.user),
      totalRewardCoins,
    }
  })

  // POST /api/user/agent/apply — 申请代理
  fastify.post('/api/user/agent/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { level = 'mid' } = request.body as any

    const config = await prisma.agentLevelConfig.findUnique({ where: { level } })
    if (!config) return reply.status(400).send({ error: '无效的代理等级' })

    const membershipCheck = await prisma.membership.findUnique({ where: { userId } })
    if (!membershipCheck || membershipCheck.credits < config.priceCoins) {
      return reply.status(400).send({ error: `积分不足，需要 ${config.priceCoins} 积分` })
    }

    const current = membershipCheck
    const levelOrder = ['none', 'mid', 'senior', 'super']
    const currentIdx = levelOrder.indexOf(current?.agentLevel || 'none')
    const targetIdx = levelOrder.indexOf(level)
    if (targetIdx <= currentIdx) {
      return reply.status(400).send({ error: '不能降级或重复申请' })
    }

    // 扣积分（从 membership）
    await prisma.membership.update({
      where: { userId },
      data: { credits: { decrement: config.priceCoins } },
    })
    await prisma.coinLog.create({
      data: {
        userId,
        amount: -config.priceCoins,
        type: 'agent_upgrade',
        remark: `升级为${config.name}`,
      },
    })

    await prisma.membership.update({
      where: { userId },
      data: { agentLevel: level },
    })

    return toApiResponse({success: true, level, agentName: config.name, credits: -config.priceCoins}) satisfies ApiResponse<unknown>;
  })

  // GET /api/user/agent/status — 代理状态查询
  fastify.get('/api/user/agent/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const membership = await prisma.membership.findUnique({
      where: { userId },
      select: { agentLevel: true },
    })

    const levels = await prisma.agentLevelConfig.findMany({ orderBy: { priceCoins: 'asc' } })

    const currentLevel = membership?.agentLevel || 'none'

    const levelNames: Record<string, string> = {
      none: '未申请',
      mid: '中级代理',
      senior: '高级代理',
      super: '超级代理',
    }

    return toApiResponse({agentLevel: currentLevel,
      agentName: levelNames[currentLevel] || '未申请',
      availableLevels: levels,
      status: currentLevel === 'none' ? 'not_applied' : 'approved',}) satisfies ApiResponse<unknown>;
  })

  // ============================================
  // 客户端下载
  // ============================================

  // GET /api/user/client/versions — 版本列表
  fastify.get('/api/user/client/versions', async (_request, reply) => {
    return {
      currentVersion: '1.0.0',
      versions: [
        { version: '1.0.0', releasedAt: '2025-01-15', changelog: '初始版本发布\n- 支持 AI 导演控制\n- 集成图像生成\n- 视频渲染引擎' },
        { version: '0.9.0', releasedAt: '2024-12-20', changelog: 'Beta 版本\n- 基础故事板编辑\n- 角色管理' },
        { version: '0.8.0', releasedAt: '2024-11-10', changelog: 'Alpha 版本\n- 项目创建与管理' },
      ],
    }
  })

  // GET /api/user/client/download/:platform — 下载链接（mock）
  fastify.get('/api/user/client/download/:platform', async (request, reply) => {
    const { platform } = request.params as any

    const downloadLinks: Record<string, { url: string; fileName: string; size: string }> = {
      windows: { url: 'https://dianshangfu-1312954470.cos.ap-guangzhou.myqcloud.com/downloads/KunJing-v1.0.0-win-Setup.exe', fileName: 'KunJing-v1.0.0-win-Setup.exe', size: '182 MB' },
      macos: { url: 'https://dianshangfu-1312954470.cos.ap-guangzhou.myqcloud.com/downloads/KunJing-macos.dmg', fileName: 'KunJing-macos.dmg', size: '150 MB' },
      linux: { url: 'https://dianshangfu-1312954470.cos.ap-guangzhou.myqcloud.com/downloads/KunJing-linux.AppImage', fileName: 'KunJing-linux.AppImage', size: '165 MB' },
    }
    const link = downloadLinks[platform]
    if (!link) {
      return reply.status(404).send({ error: '平台不支持或下载链接不存在', platform })
    }
    return link
  })

  // ============================================
  // 邀请码查询（快捷接口）
  // ============================================
  fastify.get('/api/user/referral-code', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    return {
      referralCode: userId,
      referralUrl: `https://aigc.fushtn.com/register?ref=${userId}`,
    }
  })

  // ============================================
  // 我的图库 — 角色图 + 场景图 + 作品图列表
  // ============================================

  // GET /api/user/gallery — 获取我的图库
  fastify.get('/api/user/gallery', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '50', offset = '0', type } = request.query as any

    // 查用户参与的项目
    const projects = await prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
    const projectIds = projects.map(p => p.id)
    const projectTitleMap = new Map(projects.map(p => [p.id, p.name]))

    type GalleryItem = {
      id: string
      type: string
      url: string
      name: string
      projectId: string
      projectTitle: string
      createdAt: string
    }

    // 非图片 URL 后缀过滤（支持带查询参数的 URL）
    const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|tiff?)(\?|$)/i

    let items: GalleryItem[] = []

    if (!type || type === 'scene') {
      const sceneImages = await prisma.sceneImage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...sceneImages.map(si => ({
        id: si.id,
        type: 'scene' as const,
        url: si.imageUrl,
        name: si.sceneName || '场景图',
        projectId: si.projectId,
        projectTitle: projectTitleMap.get(si.projectId) || '',
        createdAt: si.createdAt?.toISOString?.() || String(si.createdAt),
      })))
    }

    if (!type || type === 'character') {
      const charImages = await prisma.characterImage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...charImages.map(ci => ({
        id: ci.id,
        type: 'character' as const,
        url: ci.imageUrl,
        name: ci.characterName || '角色图',
        projectId: ci.projectId,
        projectTitle: projectTitleMap.get(ci.projectId) || '',
        createdAt: ci.createdAt?.toISOString?.() || String(ci.createdAt),
      })))
    }

    // 分镜图（storyboard）
    if (!type || type === 'storyboard') {
      const storyboardImages = await prisma.storyboardImage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...storyboardImages.map(si => ({
        id: si.id,
        type: 'storyboard' as const,
        url: si.imageUrl,
        name: si.description ? `分镜: ${si.description.slice(0, 30)}` : '分镜图',
        projectId: si.projectId,
        projectTitle: projectTitleMap.get(si.projectId) || '',
        createdAt: si.createdAt?.toISOString?.() || String(si.createdAt),
      })))
    }

    // 首尾帧图（frame）
    if (!type || type === 'frame') {
      const frameImages = await prisma.frameImage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...frameImages.map(fi => ({
        id: fi.id,
        type: 'frame' as const,
        url: fi.imageUrl,
        name: `片段帧 - ${fi.frameType}`,
        projectId: fi.projectId,
        projectTitle: projectTitleMap.get(fi.projectId) || '',
        createdAt: fi.createdAt?.toISOString?.() || String(fi.createdAt),
      })))
    }

    // 道具图（prop）
    if (!type || type === 'prop') {
      const propImages = await prisma.propImage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...propImages.map(pi => ({
        id: pi.id,
        type: 'prop' as const,
        url: pi.imageUrl,
        name: pi.propName || '道具图',
        projectId: pi.projectId,
        projectTitle: projectTitleMap.get(pi.projectId) || '',
        createdAt: pi.createdAt?.toISOString?.() || String(pi.createdAt),
      })))
    }

    if (!type || type === 'asset') {
      const userAssets = await prisma.userAsset.findMany({
        where: { userId, type: 'image' },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      items.push(...userAssets.map(ua => ({
        id: ua.id,
        type: 'asset' as const,
        url: ua.url,
        name: ua.title || '我的作品',
        projectId: '',
        projectTitle: '',
        createdAt: ua.createdAt?.toISOString?.() || String(ua.createdAt),
      })))
    }

    // 过滤非图片URL
    items = items.filter(i => IMAGE_EXT.test(i.url))

    // 按时间排序
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = items.length
    const take = Math.min(Number(limit) || 50, 200)
    const skip = Number(offset) || 0
    items = items.slice(skip, skip + take)

    return { success: true, data: items, total }
  })

  // DELETE /api/user/gallery/:type/:id — 删除图库中的图片
  fastify.delete('/api/user/gallery/:type/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { type, id } = request.params as any

    const TABLE_MAP: Record<string, string> = {
      scene: 'sceneImage',
      character: 'characterImage',
      storyboard: 'storyboardImage',
      frame: 'frameImage',
      prop: 'propImage',
      asset: 'userAsset',
    }
    const modelName = TABLE_MAP[type]
    if (!modelName) return reply.status(400).send({ error: '无效的图库类型' })

    try {
      if (type === 'asset') {
        const asset = await prisma.userAsset.findUnique({ where: { id } })
        if (!asset) return reply.status(404).send({ error: '作品不存在' })
        if (asset.userId !== userId) return reply.status(403).send({ error: '无权删除' })
        await prisma.membership.update({
          where: { userId },
          data: { storageUsed: { decrement: asset.fileSize || 0 } },
        })
        await prisma.userAsset.delete({ where: { id } })
      } else {
        // 其他表通过 projectId 关联验证权限
        const modelMap: Record<string, any> = {
          scene: prisma.sceneImage,
          character: prisma.characterImage,
          storyboard: prisma.storyboardImage,
          frame: prisma.frameImage,
          prop: prisma.propImage,
        }
        const model = modelMap[type]
        if (!model) return reply.status(400).send({ error: '无效类型' })

        const record = await model.findUnique({ where: { id }, select: { projectId: true } })
        if (!record) return reply.status(404).send({ error: '记录不存在' })

        // 验证该项目是否属于当前用户
        const project = await prisma.project.findUnique({ where: { id: record.projectId }, select: { userId: true } })
        if (!project || project.userId !== userId) return reply.status(403).send({ error: '无权删除' })

        await model.delete({ where: { id } })
      }

      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ error: `删除失败: ${e.message}` })
    }
  })

  // ============================================
  // 我的存储空间 — COS 用量与配额
  // ============================================

  // GET /api/user/storage — 获取存储空间详情
  fastify.get('/api/user/storage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    // storageUsed 不再是 User 表字段，改为从项目关联资源计算
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true },
    })

    // 计算用户所有图片/文件资源的总大小（模拟估算）
    const userProjects = await prisma.project.findMany({
      where: { userId },
      select: { id: true },
    })
    const projectIds = userProjects.map(p => p.id)

    // 从各类型资源估算存储用量
    const [charCount, sceneCount, storyboardCount, frameCount, propCount] = await Promise.all([
      prisma.characterImage.count({ where: { projectId: { in: projectIds } } }),
      prisma.sceneImage.count({ where: { projectId: { in: projectIds } } }),
      prisma.storyboardImage.count({ where: { projectId: { in: projectIds } } }),
      prisma.frameImage.count({ where: { projectId: { in: projectIds } } }),
      prisma.propImage.count({ where: { projectId: { in: projectIds } } }),
    ])

    // 每张图片估算 500KB
    const estimatedBytes = (charCount + sceneCount + storyboardCount + frameCount + propCount) * 500 * 1024

    const quotaMap: Record<string, number> = {
      free: 100 * 1024 * 1024,               // 100 MB
      gold: 3 * 1024 * 1024 * 1024,          // 3 GB
      vip: 3 * 1024 * 1024 * 1024,           // 3 GB
      premium: 3 * 1024 * 1024 * 1024,
      Pro: 5 * 1024 * 1024 * 1024,           // 5 GB
      vip_year: 10 * 1024 * 1024 * 1024,     // 10 GB
      vip_season: 10 * 1024 * 1024 * 1024,
      vip_platinum: 50 * 1024 * 1024 * 1024, // 50 GB
      director: 100 * 1024 * 1024 * 1024,    // 100 GB
    }

    const tier = user?.memberTier || 'free'
    const totalBytes = quotaMap[tier] || quotaMap.free
    const usedBytes = estimatedBytes

    const formatSize = (bytes: number): string => {
      if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
      if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
      return (bytes / 1024).toFixed(1) + ' KB'
    }

    return {
      success: true,
      data: {
        used: usedBytes,
        total: totalBytes,
        usedFormatted: formatSize(usedBytes),
        totalFormatted: formatSize(totalBytes),
        percent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
        tier,
        tierLabel: tier,
      },
    }
  })

  // ============================================
  // GET /api/user/usage — 用户今日 AI 使用量
  // ============================================
  fastify.get('/api/user/usage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const quota = await checkDailyQuota(userId)
    const todayUsed = await getTodayUsage(userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true },
    })

    const plan = await prisma.memberPlan.findUnique({
      where: { level: user?.memberTier || 'free' },
      select: { name: true, price: true },
    })

    return {
      success: true,
      data: {
        used: todayUsed,
        limit: quota.limit,
        remaining: quota.remaining,
        canProceed: quota.canProceed,
        tier: user?.memberTier || 'free',
        tierLabel: plan?.name || '免费',
        tierPrice: plan?.price || 0,
      },
    }
  })
}
