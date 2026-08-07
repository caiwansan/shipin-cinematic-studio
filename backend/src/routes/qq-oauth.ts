import type { ApiResponse } from '../contracts/api/base.js';
// @ts-nocheck
// ─── QQ授权登录 ───
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// OAuth state 内存存储（防 CSRF）
const oauthStateMap = new Map<string, { createdAt: number }>()

// 每 5 分钟清理过期 state（>10分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of oauthStateMap.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) {
      oauthStateMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

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
    return toApiResponse({enabled: secret.enabled, config}) satisfies ApiResponse<unknown>;
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

    return toApiResponse({success: true}) satisfies ApiResponse<unknown>;
  })

  // GET /api/auth/qq/authorize — 用户端：获取QQ授权URL
  fastify.get('/api/auth/qq/authorize', async (_request, reply) => {
    const config = await getQQConfig()
    if (!config || !config.appId) {
      return reply.status(400).send({ error: 'QQ登录未配置' })
    }

    const state = Math.random().toString(36).substring(2, 10)
    oauthStateMap.set(state, { createdAt: Date.now() })
    const redirectUri = encodeURIComponent(config.redirectUri || 'https://aigc.fushtn.com/api/auth/qq/callback')
    // display=pc 强制PC扫码模式
    const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${config.appId}&redirect_uri=${redirectUri}&scope=get_user_info&state=${state}&display=pc`

    return toApiResponse({authUrl, state}) satisfies ApiResponse<unknown>;
  })

  // 辅助函数：统一构造 redirect URL，自动 encode 错误消息
  function redirectWithEncodedError(reply: any, errorMsg: string) {
    const safeMsg = encodeURIComponent(errorMsg)
    return reply.type('text/html; charset=utf-8').send('<!DOCTYPE html>\n<html><body><script>\n' +
      "try { localStorage.setItem('oauth_error', '" + safeMsg + "'); } catch(e){}\n" +
      "try { localStorage.setItem('oauth_error_at', Date.now()+''); } catch(e){}\n" +
      "try { window.close(); } catch(e){}\n" +
      "setTimeout(function(){ window.location.href = '/?error=" + safeMsg + "'; }, 500);\n" +
      '</script></body></html>')
  }

  // GET /api/auth/qq/callback — QQ扫码后的回调重定向
  fastify.get('/api/auth/qq/callback', async (request, reply) => {
    const { code, state } = request.query as any
    // state 校验：防 CSRF
    const stateEntry = state ? oauthStateMap.get(state) : undefined
    if (!state || !stateEntry) {
      return redirectWithEncodedError(reply, 'state 无效或已过期')
    }
    if (Date.now() - stateEntry.createdAt > 10 * 60 * 1000) {
      oauthStateMap.delete(state)
      return redirectWithEncodedError(reply, 'state 已过期')
    }
    oauthStateMap.delete(state)

    if (!code) {
      return redirectWithEncodedError(reply, '缺少授权code')
    }
    try {
      const config = await getQQConfig()
      if (!config || !config.appId || !config.appSecret) {
        return redirectWithEncodedError(reply, 'QQ登录未配置')
      }

      // ── Step 1: code 换 access_token ──
      const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${config.appId}&client_secret=${config.appSecret}&code=${code}&redirect_uri=${config.redirectUri}&fmt=json`
      const tRes = await fetch(tokenUrl)
      const tText = await tRes.text()

      let tData: any
      try { tData = JSON.parse(tText) } catch {
        const params = new URLSearchParams(tText)
        tData = {
          access_token: params.get('access_token'),
          expires_in: params.get('expires_in'),
          refresh_token: params.get('refresh_token'),
        }
      }

      if (tData.error || !tData.access_token) {
        console.error('[QQ OAuth] token error:', tData.error_description || tData.error || 'no access_token')
        return redirectWithEncodedError(reply, 'QQ授权失败')
      }

      const accessToken = tData.access_token

      // ── Step 2: access_token 换 openid ──
      const meRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${accessToken}&fmt=json`)
      const meText = await meRes.text()
      let meData: any
      try { meData = JSON.parse(meText) } catch {
        const meMatch = meText.match(/\{.*\}/)
        meData = meMatch ? JSON.parse(meMatch[0]) : {}
      }

      const qqOpenId = meData.openid || ''
      if (!qqOpenId) {
        console.error('[QQ OAuth] no openid:', meText)
        return redirectWithEncodedError(reply, '获取QQ身份失败')
      }

      // ── Step 3: 获取用户信息 ──
      const uRes = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${config.appId}&openid=${qqOpenId}`)
      const uData: any = await uRes.json()

      if (uData.ret !== 0) {
        console.error('[QQ OAuth] get_user_info error:', uData.msg || uData.ret)
        return redirectWithEncodedError(reply, '获取用户信息失败')
      }

      const nickname = uData.nickname || 'QQ用户'
      const avatarUrl = uData.figureurl_qq_2 || uData.figureurl_qq_1 || ''

      // ── Step 4: 查找现有用户 ──
      let user = await prisma.user.findFirst({
        where: { OR: [{ qqOpenId }, { email: `qq_${qqOpenId}@aigc.fushtn.com` }] }
      })

      if (user) {
        // 已绑定用户 — 正常登录
        await prisma.user.update({ where: { id: user.id }, data: { qqOpenId, username: nickname || user.username } })

        const JWT_SECRET = (process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET 环境变量未配置") })())
        const newVer = (user.tokenVersion || 1) + 1
        await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer } }).catch(() => {})
        const token = jwt.sign(
          { id: user.id, email: user.email, role: 'user', tokenVersion: newVer },
          JWT_SECRET,
          { expiresIn: '30d' }
        )

        // localStorage 方式返回（弹窗内将 token 写入 localStorage，自动关闭）
        // 通过 localStorage 即可跨 tab/弹窗通信，无需依赖 window.opener.postMessage
        const safeUser = JSON.stringify({ id: user.id, nickname }).replace(/</g, '\\u003C')
        return reply.type('text/html; charset=utf-8').send('<!DOCTYPE html>\n<html><body><script>\n' +
          // 写入 localStorage（双写 token key + auth_user 信息）
          "var keys = ['auth_token','accessToken','token'];\n" +
          "for (var i=0;i<keys.length;i++) { try { localStorage.setItem(keys[i], '" + token + "'); } catch(e){} }\n" +
          "try { localStorage.setItem('auth_user','" + safeUser.replace(/'/g, "\\'") + "'); } catch(e){}\n" +
          "try { localStorage.setItem('oauth_login_at',Date.now()+''); } catch(e){}\n" +
          "try { document.cookie = 'auth_token=" + token + "; path=/; max-age=2592000'; } catch(e){}\n" +
          "try { window.close(); } catch(e){}\n" +
          // 如果 window.close 失败（某些浏览器限制），fallback 跳回首页
          "setTimeout(function(){ window.location.href='/user/bind-phone'; }, 500);\n" +
          '</script></body></html>')
      } else {
        // 新用户 — QQ 授权直接注册，无需绑手机号
        const crypto = await import('crypto')
        const email = `qq_${qqOpenId}@aigc.fushtn.com`
        user = await prisma.user.create({
          data: {
            email,
            username: nickname || 'QQ用户',
            qqOpenId,
            passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
            memberTier: 'free',
          },
        })

        // 注册赠送钻石（COMMUNITY-REGISTER-REWARD-01：默认 10；原“赠送体验积分 100”统一并入注册奖励）
        await prisma.membership.create({
          data: { userId: user.id, tier: 'free', credits: 0 },
        }).catch(() => {})
        try {
          const { grantRegisterReward } = await import('../services/community/community-reward.service.js')
          await grantRegisterReward(user.id)
        } catch (e) {
          console.error('[QqOAuth] Register reward failed:', e)
        }

        const JWT_SECRET = (process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET 环境变量未配置") })())
        const token = jwt.sign(
          { id: user.id, email: user.email, role: 'user', tokenVersion: 1 },
          JWT_SECRET,
          { expiresIn: '30d' }
        )

        const safeUser = JSON.stringify({ id: user.id, nickname }).replace(/</g, '\\u003C')
        return reply.type('text/html; charset=utf-8').send('<!DOCTYPE html>\n<html><body><script>\n' +
          "var keys = ['auth_token','accessToken','token'];\n" +
          "for (var i=0;i<keys.length;i++) { try { localStorage.setItem(keys[i], '" + token + "'); } catch(e){} }\n" +
          "try { localStorage.setItem('auth_user','" + safeUser.replace(/'/g, "\\'") + "'); } catch(e){}\n" +
          "try { localStorage.setItem('oauth_login_at',Date.now()+''); } catch(e){}\n" +
          "try { document.cookie = 'auth_token=" + token + "; path=/; max-age=2592000'; } catch(e){}\n" +
          "try { window.close(); } catch(e){}\n" +
          "setTimeout(function(){ window.location.href='/'; }, 500);\n" +
          '</script></body></html>')
      }
    } catch (err: any) {
      console.error('[QQ OAuth] callback error:', err?.message || err)
      return redirectWithEncodedError(reply, 'QQ登录失败')
    }
  })

  // POST /api/auth/qq/callback — 前端手动调用（传code换token）
  fastify.post('/api/auth/qq/callback', async (request, reply) => {
    const { code, state } = request.body as any
    // state 校验：防 CSRF
    const stateEntry = state ? oauthStateMap.get(state) : undefined
    if (!state || !stateEntry) {
      return reply.status(403).send({ error: 'state 无效或已过期' })
    }
    if (Date.now() - stateEntry.createdAt > 10 * 60 * 1000) {
      oauthStateMap.delete(state)
      return reply.status(403).send({ error: 'state 已过期' })
    }
    oauthStateMap.delete(state)

    if (!code) return reply.status(400).send({ error: '缺少授权 code' })

    const config = await getQQConfig()
    if (!config || !config.appId || !config.appSecret) {
      return reply.status(400).send({ error: 'QQ登录未配置' })
    }

    try {
      // ── Step 1: code 换 access_token ──
      const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${config.appId}&client_secret=${config.appSecret}&code=${code}&redirect_uri=${config.redirectUri}&fmt=json`
      const tRes = await fetch(tokenUrl)
      const tText = await tRes.text()

      let tData: any
      try { tData = JSON.parse(tText) } catch {
        const params = new URLSearchParams(tText)
        tData = {
          access_token: params.get('access_token'),
          expires_in: params.get('expires_in'),
          refresh_token: params.get('refresh_token'),
        }
      }

      if (tData.error || !tData.access_token) {
        return reply.status(400).send({ error: `QQ授权失败: ${tData.error_description || tData.error || '无 access_token'}` })
      }

      const accessToken = tData.access_token

      // ── Step 2: access_token 换 openid ──
      const meRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${accessToken}&fmt=json`)
      const meText = await meRes.text()
      let meData: any
      try { meData = JSON.parse(meText) } catch {
        const meMatch = meText.match(/\{.*\}/)
        meData = meMatch ? JSON.parse(meMatch[0]) : {}
      }

      const qqOpenId = meData.openid || ''
      if (!qqOpenId) {
        return reply.status(400).send({ error: '获取QQ openid 失败' })
      }

      // ── Step 3: 获取用户信息 ──
      const uRes = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${config.appId}&openid=${qqOpenId}`)
      const uData: any = await uRes.json()

      if (uData.ret !== 0) {
        return reply.status(400).send({ error: `获取用户信息失败: ${uData.msg || uData.ret}` })
      }

      const nickname = uData.nickname || 'QQ用户'
      const avatarUrl = uData.figureurl_qq_2 || uData.figureurl_qq_1 || ''

      // ── Step 4: 查找或创建用户 ──
      let user = await prisma.user.findFirst({
        where: { OR: [{ qqOpenId }, { email: `qq_${qqOpenId}@aigc.fushtn.com` }] }
      })

      if (!user) {
        // 新用户 — 返回绑定要求，前端跳绑定手机页面
        const BIND_SECRET = (process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET 环境变量未配置") })())
        const bindToken = jwt.sign(
          { type: 'qq_bind', qqOpenId, nickname, avatarUrl, exp: Math.floor(Date.now() / 1000) + 30 * 60 },
          BIND_SECRET
        )
        return {
          requireBind: true,
          bindToken,
          qqNickname: nickname,
          qqAvatarUrl: avatarUrl,
        }
      }

      await prisma.user.update({ where: { id: user.id }, data: { qqOpenId, username: nickname || user.username } })

      // ── Step 5: 生成 JWT ──
      // jwt imported at top of file
      const JWT_SECRET = (process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET 环境变量未配置") })())
      const newVer = (user.tokenVersion || 1) + 1
      await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer } }).catch(() => {})
      const token = jwt.sign(
        { id: user.id, email: user.email, role: 'user', tokenVersion: newVer },
        JWT_SECRET,
        { expiresIn: '30d' }
      )

      const membership = await prisma.membership.findUnique({ where: { userId: user.id } })

      // ⭐ 统一会员等级：以 Membership 为真相源
      let resolvedTier = membership?.tier || user.memberTier || 'free'
      if (user.memberTier !== resolvedTier && resolvedTier !== 'free') {
        try {
          await prisma.user.update({ where: { id: user.id }, data: { memberTier: resolvedTier } })
          user.memberTier = resolvedTier
        } catch {}
      }
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          coins: (user.membership?.credits ?? 0),
          memberTier: resolvedTier,
          membership: membership ? { tier: membership.tier, credits: membership.credits } : null,
          agentStatus: user.agentStatus,
          agentLevel: user.agentLevel,
        }
      }
    } catch (err: any) {
      return reply.status(500).send({ error: `QQ登录失败: ${err.message}` })
    }
  })

  // POST /api/auth/qq/bind — QQ首次登录绑定手机号
  fastify.post('/api/auth/qq/bind', async (request, reply) => {
    const { phone, code, bindToken } = request.body as any

    if (!phone || !code || !bindToken) {
      return reply.status(400).send({ error: '缺少必填参数' })
    }

    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 校验 bindToken
    let qqOpenId: string | undefined
    let qqNickname: string | undefined
    try {
      const BIND_SECRET = process.env.JWT_SECRET
      if (!BIND_SECRET) throw new Error('JWT_SECRET 未配置')
      const j = await import('jsonwebtoken')
      const decoded = j.default.verify(bindToken, BIND_SECRET) as any
      if (decoded.type !== 'qq_bind' || !decoded.qqOpenId) {
        return reply.status(400).send({ error: 'QQ绑定令牌无效' })
      }
      qqOpenId = decoded.qqOpenId
      qqNickname = decoded.nickname
    } catch {
      return reply.status(400).send({ error: 'QQ绑定令牌已过期或无效' })
    }

    // 检查该 QQ 是否已被绑定
    const bound = await prisma.user.findFirst({ where: { qqOpenId } })
    if (bound) {
      return reply.status(400).send({ error: '该QQ账号已被其他用户绑定' })
    }

    // 校验短信验证码
    const smsRecord = await prisma.smsCode.findFirst({
      where: { phone, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!smsRecord) {
      return reply.status(400).send({ error: '验证码错误或已过期' })
    }

    // 标记验证码已使用
    await prisma.smsCode.update({ where: { id: smsRecord.id }, data: { used: true } })

    // 检查手机号是否已注册
    const existingUser = await prisma.user.findUnique({ where: { email: phone } })
    if (existingUser) {
      await prisma.user.update({ where: { id: existingUser.id }, data: { qqOpenId, username: qqNickname || existingUser.username } })
      // 生成 JWT
      const JWT_SECRET = process.env.JWT_SECRET || ''
      const newVer = (existingUser.tokenVersion || 1) + 1
      await prisma.user.update({ where: { id: existingUser.id }, data: { tokenVersion: newVer } }).catch(() => {})
      const token = jwt.sign(
        { id: existingUser.id, email: existingUser.email, role: 'user', tokenVersion: newVer },
        JWT_SECRET,
        { expiresIn: '30d' }
      )
      return {
        accessToken: token,
        user: { id: existingUser.id, email: existingUser.email, username: existingUser.username },
      }
    }

    // 新用户 — 注册（OAuth用户无需密码，设随机哈希）
    const crypto = await import('crypto')
    const user = await prisma.user.create({
      data: {
        email: phone,
        username: qqNickname || phone,
        phone,
        qqOpenId,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        memberTier: 'free',
      },
    })

    // 注册赠送钻石（COMMUNITY-REGISTER-REWARD-01：默认 10；原“赠送体验积分 100”统一并入注册奖励）
    await prisma.membership.create({
      data: { userId: user.id, tier: 'free', credits: 0 },
    }).catch(() => {})
    try {
      const { grantRegisterReward } = await import('../services/community/community-reward.service.js')
      await grantRegisterReward(user.id)
    } catch (e) {
      console.error('[QqOAuth/bind] Register reward failed:', e)
    }

    // 生成 JWT
    const JWT_SECRET = process.env.JWT_SECRET || ''
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user', tokenVersion: 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return {
      accessToken: token,
      user: { id: user.id, email: user.email, username: user.username },
    }
  })

  // GET /api/auth/qq/status — 检查QQ登录是否已配置
  fastify.get('/api/auth/qq/status', async (_request, reply) => {
    const config = await getQQConfig()
    return toApiResponse({enabled: !!(config && config.appId && config.enabled !== false), appId: config?.appId || ''}) satisfies ApiResponse<unknown>;
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};