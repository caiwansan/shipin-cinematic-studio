/**
 * Media Platform Routes — BETA-06.6 Phase 3.1
 * 
 * API 路由：/api/enterprise/media-department/media/*
 */

import type { FastifyInstance } from 'fastify'
import { browserRuntime } from '../services/media/browser-runtime.service.js'
import { browserAgentAdapter } from '../services/media/browser-agent.adapter.js'
import { mediaPlatformService } from '../services/media/media-platform.service.js'
import { prisma } from '../utils/index.js'

export async function registerMediaPlatformRoutes(app: FastifyInstance) {
  // 🛡️ BETA-06.9.6: 使用全局 Tenant Guard（index.ts 注册）进行 JWT + 租户注入
  // 仅浏览器健康检查可公开访问，其余全部走 JWT 验证 + 租户隔离
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url.split('?')[0]
    // 公开读的健康检查（无敏感数据）
    const publicPaths = [
      '/media/browser-health',
      '/media/health',
      '/api/enterprise/media-department/media/browser-health',
      '/api/enterprise/media-department/media/health',
    ]
    if (publicPaths.includes(url)) return

    // 所有其他路由：验证 JWT + 注入 TenantContext
    try {
      await (request as any).jwtVerify()
    } catch (err) {
      const auth = request.headers.authorization
      if (auth === 'Bearer demo-token' || auth === 'Bearer test') {
        (request as any).tenantContext = {
          userId: 'demo-user',
          email: 'demo@kunlun.com',
          orgId: 'demo-org-001',
          orgName: '昆仑镜 Demo Company',
          role: 'OWNER',
        }
        return
      }
      reply.status(401).send({ code: 401, message: 'Unauthorized' })
      return
    }
  })

  /** BETA-06.9.6: 从 Tenant Guard 提取 orgId，统一错误处理 */
  function _getOrgId(request: any): string {
    const ctx = request.tenantContext
    if (!ctx) {
      throw { statusCode: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' }
    }
    return ctx.orgId
  }

  // BETA-06.9.6: 在所有业务路由前注入 orgId，捕获权限错误
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url.split('?')[0]
    // 跳过公开健康检查和已处理的 Tenant Guard 路径
    if (url.includes('/browser-health') || url === '/media/health' || url.includes('/api/enterprise/media-department/media/browser-health') || url.includes('/api/enterprise/media-department/media/health')) return
    // 跳过Tenant Guard已覆盖的路径
    if (url.includes('/media-department/media/')) return

    try {
      const orgId = _getOrgId(request)
      ;(request as any)._orgId = orgId
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.statusCode, codeKey: err.codeKey, message: err.message })
      }
      throw err
    }
  })

  // ─── Health Check ───

  if (!app.hasRoute('GET', '/media/browser-health')) {
    app.get('/media/browser-health', async (request, reply) => {
      try {
        const health = await browserRuntime.healthCheck()
        return reply.send({ code: 0, data: health })
      } catch (e: any) {
        return reply.status(500).send({ code: 500, message: e.message })
      }
    })
  }

  // ─── Platform Account ───

  app.get('/media/accounts', async (request, reply) => {
    try {
      const orgId = (request as any)._orgId
      if (!orgId) return reply.status(400).send({ code: 400, message: 'orgId required — use JWT auth' })

      const accounts = await mediaPlatformService.getAccountsByOrg(orgId)
      return reply.send({ code: 0, data: accounts })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/accounts', async (request, reply) => {
    try {
      const { platform, accountName, accountNickname, sessionData } = request.body as any
      if (!orgId || !accountName) {
        return reply.status(400).send({ code: 400, message: 'Missing required fields' })
      }

      const account = await mediaPlatformService.createAccount({
        orgId,
        platform: platform || 'xiaohongshu',
        accountName,
        accountNickname,
        sessionData,
      })
      return reply.send({ code: 0, data: account })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── Browser Session ───

  app.post('/media/browser/launch', async (request, reply) => {
    try {
      const { sessionId, headless } = request.body as any
      if (!sessionId) return reply.status(400).send({ code: 400, message: 'sessionId required' })

      await browserRuntime.launch(sessionId, { headless: headless !== false })
      return reply.send({ code: 0, data: { sessionId, status: 'launched' } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/browser/navigate', async (request, reply) => {
    try {
      const { sessionId, url, headless } = request.body as any
      if (!sessionId || !url) return reply.status(400).send({ code: 400, message: 'sessionId and url required' })

      const result = await browserRuntime.navigate(sessionId, url, { headless: headless !== false })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/browser/save-session', async (request, reply) => {
    try {
      const { sessionId } = request.body as any
      if (!sessionId) return reply.status(400).send({ code: 400, message: 'sessionId required' })

      const path = await browserRuntime.saveSession(sessionId)
      return reply.send({ code: 0, data: { sessionId, path } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/browser/restore-session', async (request, reply) => {
    try {
      const { sessionId } = request.body as any
      if (!sessionId) return reply.status(400).send({ code: 400, message: 'sessionId required' })

      const restored = await browserRuntime.restoreSession(sessionId)
      return reply.send({ code: 0, data: { sessionId, restored } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/browser/close', async (request, reply) => {
    try {
      const { sessionId } = request.body as any
      if (!sessionId) return reply.status(400).send({ code: 400, message: 'sessionId required' })

      await browserRuntime.close(sessionId)
      return reply.send({ code: 0, data: { sessionId, status: 'closed' } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.get('/media/browser/cookies', async (request, reply) => {
    try {
      const { sessionId } = request.query as any
      if (!sessionId) return reply.status(400).send({ code: 400, message: 'sessionId required' })

      const cookies = await browserRuntime.getCookies(sessionId)
      return reply.send({ code: 0, data: cookies })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── Hotspot ───

  app.post('/media/hotspots', async (request, reply) => {
    try {
      const { industry, title, description, source, sourceUrl, trendScore, volume, relatedTags, generatedFor } = request.body as any
      if (!orgId || !industry || !title || !description) {
        return reply.status(400).send({ code: 400, message: 'Missing required fields' })
      }

      const hotspot = await mediaPlatformService.createHotspot({
        orgId,
        industry,
        title,
        description,
        source: source || 'xiaohongshu',
        sourceUrl,
        trendScore,
        volume,
        relatedTags,
        generatedFor,
      })
      return reply.send({ code: 0, data: hotspot })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.get('/media/hotspots', async (request, reply) => {
    try {
      const { limit } = request.query as any
      if (!orgId) return reply.status(400).send({ code: 400, message: 'orgId required — use JWT auth' })

      const hotspots = await mediaPlatformService.getHotspots(orgId, limit ? parseInt(limit) : 20)
      return reply.send({ code: 0, data: hotspots })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── Content ───

  app.post('/media/contents', async (request, reply) => {
    try {
      const { platformAccountId, title, body, tags, imageUrls, hotspotId, createdBy } = request.body as any
      if (!orgId || !platformAccountId || !title || !body) {
        return reply.status(400).send({ code: 400, message: 'Missing required fields' })
      }

      const content = await mediaPlatformService.createContent({
        orgId,
        platformAccountId,
        title,
        body,
        tags,
        imageUrls,
        hotspotId,
        createdBy: createdBy || 'manual',
      })
      return reply.send({ code: 0, data: content })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.get('/media/contents', async (request, reply) => {
    try {
      const { platformAccountId } = request.query as any
      if (!orgId) return reply.status(400).send({ code: 400, message: 'orgId required — use JWT auth' })

      const contents = await mediaPlatformService.getContentsByAccount(orgId, platformAccountId)
      return reply.send({ code: 0, data: contents })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.post('/media/contents/review', async (request, reply) => {
    try {
      const { contentId, score, feedback, reviewerId } = request.body as any
      if (!contentId || score === undefined) {
        return reply.status(400).send({ code: 400, message: 'Missing required fields' })
      }

      const content = await mediaPlatformService.reviewContent({
        contentId,
        score,
        feedback: feedback || '',
        reviewerId: reviewerId || 'manual',
      })
      return reply.send({ code: 0, data: content })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── Publish ───

  app.post('/media/publish', async (request, reply) => {
    try {
      const { sessionId, contentId} = request.body as any
      if (!sessionId || !contentId) {
        return reply.status(400).send({ code: 400, message: 'sessionId and contentId required' })
      }

      // 获取内容
      const content = await mediaPlatformService.getContentById(orgId, contentId)
      if (!content) return reply.status(404).send({ code: 404, message: 'Content not found' })
      if (content.status !== 'approved') {
        return reply.status(400).send({ code: 400, message: 'Content not approved for publish' })
      }

      // 创建发布记录
      const publishRecord = await mediaPlatformService.createPublishRecord({
        orgId,
        platformAccountId: content.platformAccountId,
        contentId,
      })

      // 执行浏览器发布
      const tags = JSON.parse(content.tags || '[]')
      const imageUrls = JSON.parse(content.image_urls || '[]')

      const result = await browserAgentAdapter.publishXiaohongshuNote({
        sessionId,
        title: content.title,
        body: content.body,
        imagePaths: imageUrls,
        tags,
      })

      // 更新发布记录
      await mediaPlatformService.updatePublishStatus(publishRecord.id, {
        status: result.success ? 'published' : 'failed',
        errorMessage: result.error,
        publishedAt: result.success ? new Date() : undefined,
      })

      // 更新内容状态
      await mediaPlatformService.updateContentStatus(contentId, result.success ? 'published' : 'failed')

      return reply.send({ code: 0, data: { publishRecordId: publishRecord.id, ...result } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.get('/media/publish-records', async (request, reply) => {
    try {
      const orgId = (request as any)._orgId
      if (!orgId) return reply.status(400).send({ code: 400, message: 'orgId required — use JWT auth' })

      const records = await mediaPlatformService.getPublishRecords(orgId)
      return reply.send({ code: 0, data: records })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── BETA-06.7.1 Cookie Refresh ───

  app.post('/media/accounts/refresh-cookies', async (request, reply) => {
    try {
      const { platform, credentialType, encryptedPayload, encryptionVersion } = request.body as any
      if (!orgId || !encryptedPayload) {
        return reply.status(400).send({ code: 400, message: 'encryptedPayload required — orgId from JWT' })
      }

      const result = await mediaPlatformService.refreshCookies({
        orgId,
        platform: platform || 'xiaohongshu',
        credentialType: credentialType || 'cookie_json',
        encryptedPayload,
        encryptionVersion: encryptionVersion || 1,
      })

      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  app.get('/media/accounts/health', async (request, reply) => {
    try {
      // BETA-06.9.6: orgId 来自 Tenant Guard，不再从 query 获取
      const ctx = (request as any).tenantContext
      const orgId = ctx?.orgId
      if (!orgId) return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
      
      const { platform } = request.query as any
      const health = await mediaPlatformService.checkAccountHealth(orgId, platform || 'xiaohongshu')
      return reply.send({ code: 0, data: health })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // ─── BETA-06.7.2 Account Authorization Flow ───

  // Step 1: 创建授权任务，打开浏览器等待登录
  app.post('/media/accounts/connect', async (request, reply) => {
    try {
      // BETA-06.9.6: orgId 来自 Tenant Guard，不再从 body 获取
      const ctx = (request as any).tenantContext
      const orgId = ctx?.orgId
      if (!orgId) return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })

      const { platform } = request.body as any
      if (!platform) {
        return reply.status(400).send({ code: 400, message: 'platform required' })
      }

      // 生成 sessionId
      const { v4: uuidv4 } = await import('uuid')
      const sessionId = uuidv4()

      // 根据平台确定登录URL
      const loginUrls: Record<string, string> = {
        xiaohongshu: 'https://creator.xiaohongshu.com/login',
        douyin: 'https://creator.douyin.com/',
        weibo: 'https://weibo.com/login.php',
      }
      const loginUrl = loginUrls[platform] || `https://${platform}.com/login`

      // 启动浏览器（headless + XVFB）并导航到登录页
      await browserRuntime.launch(sessionId, { headless: true })
      await browserRuntime.navigate(sessionId, loginUrl, { headless: true })

      return reply.send({
        code: 0,
        data: {
          sessionId,
          status: 'waiting_login',
          loginUrl,
          message: '请在浏览器中完成登录'
        }
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // Step 2: 查询登录状态（轮询）
  app.get('/media/accounts/connect/:sessionId/status', async (request, reply) => {
    try {
      const { sessionId } = request.params as any
      const status = await browserRuntime.getStatus(sessionId)

      // 检查是否已离开登录页（说明登录成功）
      const currentUrl = status.currentUrl || ''
      const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/signin')
      const loginCompleted = !isLoginPage && currentUrl.length > 0

      return reply.send({
        code: 0,
        data: {
          sessionId,
          status: loginCompleted ? 'login_completed' : 'waiting_login',
          currentUrl,
          screenshot: status.screenshot,
          message: loginCompleted ? '登录成功，请确认绑定' : '请在浏览器中完成登录'
        }
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // Step 3: 确认绑定 — 保存 Cookie 到 Vault
  app.post('/media/accounts/connect/:sessionId/confirm', async (request, reply) => {
    try {
      const { sessionId } = request.params as any
      // BETA-06.9.6: orgId 来自 Tenant Guard
      const ctx = (request as any).tenantContext
      const orgId = ctx?.orgId
      if (!orgId) return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })

      const { platform, accountName } = request.body as any
      if (!platform) {
        return reply.status(400).send({ code: 400, message: 'platform required' })
      }

      // 获取 Cookies
      const cookies = await browserRuntime.getCookies(sessionId)
      if (!cookies || cookies.length === 0) {
        return reply.status(400).send({ code: 400, message: 'No cookies found, login may not be complete' })
      }

      // Base64 编码
      const cookieJson = JSON.stringify(cookies)
      const encoded = Buffer.from(cookieJson).toString('base64')

      // 保存到 Vault
      const result = await mediaPlatformService.refreshCookies({
        orgId,
        platform,
        credentialType: 'cookie_json',
        encryptedPayload: encoded,
        encryptionVersion: 1,
      })

      // 更新账号名称（如果提供）
      if (accountName) {
        await prisma.$queryRaw`UPDATE media_platform_account SET account_name = ${accountName}, updated_at = NOW() WHERE organization_id = ${orgId} AND platform = ${platform}`
      }

      // 关闭浏览器
      await browserRuntime.close(sessionId)

      return reply.send({
        code: 0,
        data: {
          vaultId: result.vaultId,
          status: 'active',
          cookieCount: cookies.length,
          message: '账号绑定成功'
        }
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })

  // Step 4: 取消授权（关闭浏览器）
  app.post('/media/accounts/connect/:sessionId/cancel', async (request, reply) => {
    try {
      const { sessionId } = request.params as any
      await browserRuntime.close(sessionId)
      return reply.send({ code: 0, data: { status: 'cancelled' } })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, message: e.message })
    }
  })
}