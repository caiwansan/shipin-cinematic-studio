// @ts-nocheck
// ─── QQ授权登录 ───
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'

// 获取QQ配置
async function getQQConfig() {
  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'qq_oauth' } })
  if (!secret || !secret.enabled) return null
  try { return JSON.parse(secret.config) } catch { return null }
}

export default async function qqOAuthRoutes(fastify: FastifyInstance) {

  // GET /api/admin/qq-oauth/config — 管理员获取配置
  fastify.get('/api/admin/qq-oauth/config', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'qq_oauth' } })
    if (!secret) return { enabled: false, config: { appId: '', appSecret: '', redirectUri: '' } }

    let config = { appId: '', appSecret: '', redirectUri: '' }
    try { config = JSON.parse(secret.config) } catch {}
    return { enabled: secret.enabled, config }
  })

  // PUT /api/admin/qq-oauth/config — 管理员保存配置
  fastify.put('/api/admin/qq-oauth/config', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { appId, appSecret, redirectUri, enabled } = request.body as any
    const config = JSON.stringify({ appId: appId || '', appSecret: appSecret || '', redirectUri: redirectUri || 'https://aigc.fushtn.com/api/auth/qq/callback' })

    await prisma.paymentSecret.upsert({
      where: { channel: 'qq_oauth' },
      update: { config, enabled: enabled !== undefined ? !!enabled : true },
      create: { channel: 'qq_oauth', config, enabled: enabled !== undefined ? !!enabled : true, remark: 'QQ开放平台登录配置' },
    })

    return { success: true }
  })

  // GET /api/auth/qq/authorize — 用户端：获取QQ授权URL
  fastify.get('/api/auth/qq/authorize', async (_request, reply) => {
    const config = await getQQConfig()
    if (!config || !config.appId) {
      return reply.status(400).send({ error: 'QQ登录未配置' })
    }

    const state = Math.random().toString(36).substring(2, 10)
    const redirectUri = encodeURIComponent(config.redirectUri || 'https://aigc.fushtn.com/api/auth/qq/callback')
    const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${config.appId}&redirect_uri=${redirectUri}&scope=get_user_info&state=${state}`

    return { authUrl, state }
  })

  // GET /api/auth/qq/callback — QQ扫码后的回调重定向
  fastify.get('/api/auth/qq/callback', async (request, reply) => {
    const { code } = request.query as any
    if (!code) {
      return reply.redirect('/?error=缺少授权code')
    }
    // code 交给 POST 相同的处理逻辑，返回页面
    try {
      const config = await getQQConfig()
      if (!config || !config.appId || !config.appSecret) {
        return reply.redirect('/?error=QQ登录未配置')
      }
      const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${config.appId}&client_secret=${config.appSecret}&code=${code}&redirect_uri=${config.redirectUri}`
      const tRes = await fetch(tokenUrl)
      const tData: any = await tRes.json()
      if (tData.errcode) return reply.redirect('/?error=QQ授权失败')
      const accessToken = tData.access_token
            // QQ: token → openid → userinfo
      const meRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`)
      const meText = await meRes.text()
      const meMatch = meText.match(/\{.*\}/)
      const meData = meMatch ? JSON.parse(meMatch[0]) : {}
      const qqOpenid = meData.openid || ''
      const uRes = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${config.appId}&openid=${qqOpenid}`)
      const uData: any = await uRes.json()
      if (uData.errcode) return reply.redirect('/?error=获取用户信息失败')

      const qqOpenId = unionid || openid
      const nickname = uData.nickname || 'QQ用户'
      const avatarUrl = uData.figureurl_qq_2 || uData.figureurl_qq_1 || ''
      let user = await prisma.user.findFirst({ where: { OR: [{ qqOpenId }, { email: `qq_${qqOpenId}@aigc.fushtn.com` }] } })
      if (!user) {
        const email = `qq_${qqOpenId}@aigc.fushtn.com`
        const { randomUUID } = await import('crypto')
        const tempPwd = randomUUID().slice(0, 16)
        user = await prisma.user.create({
          data: { email, username: nickname, passwordHash: tempPwd, qqOpenId, coins: 0, memberTier: 'free' },
        })
        const existingMembership = await prisma.membership.findUnique({ where: { userId: user.id } })
        if (!existingMembership) {
          await prisma.membership.create({ data: { userId: user.id, tier: 'free', credits: 0, startDate: new Date() } })
        }
      } else {
        await prisma.user.update({ where: { id: user.id }, data: { qqOpenId, username: nickname || user.username } })
      }
      const jwt = await import('jsonwebtoken')
      const JWT_SECRET = process.env.JWT_SECRET || 'aigc-director-runtime-secret-key-2026'
      const newVer = (user.tokenVersion || 1) + 1
      await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer } }).catch(() => {})
      const token = jwt.default.sign({ id: user.id, email: user.email, role: 'user', tokenVersion: newVer }, JWT_SECRET, { expiresIn: '30d' })
      // 重定向回前端，带上 token
      return reply.redirect('/?qq_token=' + token + '&qq_user=' + encodeURIComponent(nickname))
    } catch (err: any) {
      return reply.redirect('/?error=QQ登录失败')
    }
  })

  // POST /api/auth/qq/callback — 前端手动调用（传code换token），保留原逻辑
  fastify.post('/api/auth/qq/callback', async (request, reply) => {
    const { code } = request.body as any
    if (!code) return reply.status(400).send({ error: '缺少授权 code' })

    const config = await getQQConfig()
    if (!config || !config.appId || !config.appSecret) {
      return reply.status(400).send({ error: 'QQ登录未配置' })
    }

    try {
      // 用 code 换 access_token
      const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${config.appId}&client_secret=${config.appSecret}&code=${code}&redirect_uri=${config.redirectUri}`
      const tokenRes = await fetch(tokenUrl)
      const tokenData: any = await tokenRes.json()

      if (tokenData.errcode) {
        return reply.status(400).send({ error: `QQ授权失败: ${tokenData.errmsg || tokenData.errcode}` })
      }

      const { access_token, openid, unionid } = tokenData

      // 获取用户QQ信息
      const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`)
      const userData: any = await userRes.json()

      if (userData.errcode) {
        return reply.status(400).send({ error: `获取用户信息失败: ${userData.errmsg || userData.errcode}` })
      }

      const qqOpenId = unionid || openid
      const nickname = userData.nickname || 'QQ用户'
      const avatarUrl = userData.headimgurl || ''

      // 查找或创建用户
      let user = await prisma.user.findFirst({ where: { OR: [{ qqOpenId }, { email: `qq_${qqOpenId}@aigc.fushtn.com` }] } })

      if (!user) {
        // 新用户注册
        const email = `qq_${qqOpenId}@aigc.fushtn.com`
        const { randomUUID } = await import('crypto')
        const tempPwd = randomUUID().slice(0, 16)

        user = await prisma.user.create({
          data: {
            email,
            username: nickname,
            passwordHash: tempPwd,
            // avatar: avatarUrl,
            qqOpenId,
            coins: 0,
            memberTier: 'free',
          },
        })

        // 创建会员记录
        const existingMembership = await prisma.membership.findUnique({ where: { userId: user.id } })
        if (!existingMembership) {
          await prisma.membership.create({
            data: {
              userId: user.id,
              tier: 'free',
              credits: 0,
              startDate: new Date(),
            },
          })
        }
      } else {
        // 更新用户信息
        await prisma.user.update({
          where: { id: user.id },
          data: { qqOpenId, username: nickname || user.username },
        })
      }

      // 生成 JWT token（复用 auth.service 的逻辑，简单生成）
      const jwt = await import('jsonwebtoken')
      const JWT_SECRET = process.env.JWT_SECRET || 'aigc-director-runtime-secret-key-2026'
      const newVer = (user.tokenVersion || 1) + 1
      await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer } }).catch(() => {})
      const token = jwt.default.sign(
        { id: user.id, email: user.email, role: 'user', tokenVersion: newVer },
        JWT_SECRET,
        { expiresIn: '30d' }
      )

      // 获取会员信息
      const membership = await prisma.membership.findUnique({ where: { userId: user.id } })

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          coins: user.coins,
          memberTier: user.memberTier || membership?.tier || 'free',
          membership: membership ? { tier: membership.tier, credits: membership.credits } : null,
        }
      }
    } catch (err: any) {
      return reply.status(500).send({ error: `QQ登录失败: ${err.message}` })
    }
  })

  // GET /api/auth/qq/status — 检查QQ登录是否已配置
  fastify.get('/api/auth/qq/status', async (_request, reply) => {
    const config = await getQQConfig()
    return { enabled: !!(config && config.appId && config.enabled !== false), appId: config?.appId || '' }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

