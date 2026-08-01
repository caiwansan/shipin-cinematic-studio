/**
 * routes/ai-provider-directory.routes.ts — AI Provider Center（大模型注册中心）
 *
 * 掌柜指令 2026-08-01：昆仑镜 AI 模型生态入口，官方注册/充值/教程/推广链接聚合。
 *
 * 公开接口：
 *   GET /api/ai-provider-directory          模型供应商目录（status=active，按 sort；登录用户附带 connected 状态）
 *   GET /api/ai-provider-directory/:code    单家详情
 *
 * 后台管理（requireAdmin）：
 *   POST   /api/admin/ai-provider-directory        新增供应商
 *   PUT    /api/admin/ai-provider-directory/:id    更新（含 affiliateUrl 推广链接）
 *   PATCH  /api/admin/ai-provider-directory/:id/toggle  启用/禁用
 *   DELETE /api/admin/ai-provider-directory/:id    删除
 *
 * BYOK 原则（冻结）：本模块只聚合官方入口，不保存用户 API Key、不代理充值/付费。
 * connected 状态 = 当前用户是否已在个人模型配置（UserModelConfigV2）中配置该供应商 Key。
 */

import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

/** iframe 预检缓存（host → verdict，10 分钟 TTL） */
const frameCheckCache = new Map<string, { verdict: string; reason: string; ts: number }>()

/**
 * 能力评分清洗：仅保留六维 { cost, speed, quality, chinese, coding, reasoning }，钳制 0-100
 * AI-CENTER-02A：运营维护数据，非法输入丢弃；非对象返回 null
 */
const SCORE_KEYS = ['cost', 'speed', 'quality', 'chinese', 'coding', 'reasoning'] as const
function sanitizeCapabilityScore(raw: any): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, number> = {}
  for (const k of SCORE_KEYS) {
    const v = Number(raw[k])
    out[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0
  }
  return out
}

/**
 * GET /api/ai-center/iframe-check?url=<encoded>
 * 探测第三方站点是否允许 iframe 内嵌（X-Frame-Options / CSP frame-ancestors）
 * 安全边界：
 *  - 仅允许 http(s)
 *  - SSRF 防护：host 必须在供应商目录（active）的 loginUrl/officialWebsite 域名白名单内
 *  - 只探测响应头，不保存/代理任何第三方内容
 */
async function iframeCheck(app: FastifyInstance) {
  app.get('/api/ai-center/iframe-check', async (req, reply) => {
    const url = (req.query as any)?.url as string | undefined
    if (!url) return reply.status(400).send({ code: 1, error: 'url 必填' })
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reply.status(400).send({ code: 1, error: 'url 非法' })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return reply.status(400).send({ code: 1, error: '仅支持 http/https' })
    }
    // SSRF 防护：host 必须在供应商白名单内
    const providers = await prisma.aiProviderDirectory.findMany({
      where: { status: 'active' },
      select: { loginUrl: true, officialWebsite: true },
    })
    const allowedHosts = new Set<string>()
    for (const p of providers) {
      for (const u of [p.loginUrl, p.officialWebsite]) {
        if (!u) continue
        try { allowedHosts.add(new URL(u).host) } catch { /* 忽略非法 URL */ }
      }
    }
    if (!allowedHosts.has(parsed.host)) {
      return reply.status(403).send({ code: 1, error: '仅支持昆仑镜已收录供应商域名' })
    }
    // 缓存命中
    const cached = frameCheckCache.get(parsed.host)
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      return { code: 0, data: { ...cached, url } }
    }
    // 探测响应头
    let verdict = 'unknown'
    let reason = '无法探测（目标可能拦截非浏览器请求）'
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
      })
      const xfo = (res.headers.get('x-frame-options') || '').toLowerCase()
      const csp = (res.headers.get('content-security-policy') || '').toLowerCase()
      const fa = csp.match(/frame-ancestors\s+([^;]+)/)?.[1]?.trim()
      if (xfo && (xfo === 'deny' || xfo === 'sameorigin')) {
        verdict = 'deny'; reason = `X-Frame-Options: ${xfo}`
      } else if (fa && (fa.includes("'none'") || fa.includes("'self'"))) {
        verdict = 'deny'; reason = `CSP frame-ancestors: ${fa}`
      } else {
        verdict = 'allow'; reason = xfo || fa ? `允许（${xfo || fa}）` : '无 frame 限制头'
      }
    } catch (e: any) {
      reason = `探测失败：${e?.message || '网络错误'}`
    }
    const entry = { verdict, reason, ts: Date.now() }
    frameCheckCache.set(parsed.host, entry)
    return { code: 0, data: { verdict, reason, url } }
  })
}

/** 可选用户认证：有 token 返回 userId，无/无效返回 null（公开接口不强制登录） */
async function optionalUserId(req: FastifyRequest): Promise<string | null> {
  try {
    await req.jwtVerify()
    const decoded = req.user as any
    return decoded?.id || null
  } catch {
    return null
  }
}

/** 计算用户已配置的供应商 code 集合（个人模型配置，BYOK） */
async function connectedCodes(userId: string | null): Promise<Set<string>> {
  const set = new Set<string>()
  if (!userId) return set
  try {
    const cfg = await prisma.userModelConfigV2.findUnique({ where: { userId } })
    if (!cfg) return set
    const pairs: Array<[string | null, string | null]> = [
      [cfg.llmProvider, cfg.llmApiKey],
      [cfg.imageProvider, cfg.imageApiKey],
      [cfg.videoProvider, cfg.videoApiKey],
      [cfg.ttsProvider, cfg.ttsApiKey],
      [cfg.musicProvider, cfg.musicApiKey],
    ]
    for (const [provider, key] of pairs) {
      if (provider && key) set.add(provider)
    }
  } catch { /* 配置缺失不影响目录展示 */ }
  return set
}

export default async function aiProviderDirectoryRoutes(app: FastifyInstance) {
  await iframeCheck(app)

  // ── 公开：目录列表 ──
  app.get('/api/ai-provider-directory', async (req) => {
    const [list, connected] = await Promise.all([
      prisma.aiProviderDirectory.findMany({
        where: { status: 'active' },
        orderBy: [{ sort: 'asc' }, { recommended: 'desc' }],
      }),
      connectedCodes(await optionalUserId(req as FastifyRequest)),
    ])
    return {
      code: 0,
      data: list.map((p) => ({
        ...p,
        // 前台按钮优先级：推广链接（启用时）→ 官方注册链接
        registerUrl: p.affiliateEnabled && p.affiliateUrl ? p.affiliateUrl : p.registerUrl,
        registerViaAffiliate: !!(p.affiliateEnabled && p.affiliateUrl),
        connected: connected.has(p.code),
      })),
    }
  })

  // ── 公开：单家详情 ──
  app.get('/api/ai-provider-directory/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const p = await prisma.aiProviderDirectory.findUnique({ where: { code } })
    if (!p || p.status !== 'active') {
      return reply.status(404).send({ code: 1, error: '供应商不存在或已下架' })
    }
    const connected = await connectedCodes(await optionalUserId(req as FastifyRequest))
    return {
      code: 0,
      data: {
        ...p,
        registerUrl: p.affiliateEnabled && p.affiliateUrl ? p.affiliateUrl : p.registerUrl,
        registerViaAffiliate: !!(p.affiliateEnabled && p.affiliateUrl),
        connected: connected.has(p.code),
      },
    }
  })

  // ── 后台：全量列表（含停用，供管理页） ──
  app.get('/api/admin/ai-provider-directory', { preHandler: [requireAdmin] }, async () => {
    const list = await prisma.aiProviderDirectory.findMany({
      orderBy: [{ sort: 'asc' }, { recommended: 'desc' }],
    })
    return { code: 0, data: list }
  })

  // ── 后台：新增 ──
  app.post('/api/admin/ai-provider-directory', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = req.body as any
    if (!body?.code || !body?.name) {
      return reply.status(400).send({ code: 1, error: 'code 与 name 必填' })
    }
    const exist = await prisma.aiProviderDirectory.findUnique({ where: { code: body.code } })
    if (exist) return reply.status(409).send({ code: 1, error: 'code 已存在' })
    const created = await prisma.aiProviderDirectory.create({
      data: {
        code: body.code,
        name: body.name,
        logo: body.logo || '',
        description: body.description || null,
        category: body.category || 'domestic',
        country: body.country || '',
        tags: Array.isArray(body.tags) ? body.tags : [],
        officialWebsite: body.officialWebsite || '',
        registerUrl: body.registerUrl || '',
        billingUrl: body.billingUrl || '',
        documentationUrl: body.documentationUrl || '',
        loginUrl: body.loginUrl || '',
        browserEnabled: body.browserEnabled !== undefined ? !!body.browserEnabled : true,
        apiEnabled: body.apiEnabled !== undefined ? !!body.apiEnabled : true,
        capabilityScore: sanitizeCapabilityScore(body.capabilityScore),
        affiliateUrl: body.affiliateUrl || '',
        affiliateEnabled: !!body.affiliateEnabled,
        affiliateDescription: body.affiliateDescription || null,
        recommended: Number(body.recommended) || 3,
        sort: Number(body.sort) || 0,
        status: body.status || 'active',
      },
    })
    return { code: 0, data: created }
  })

  // ── 后台：更新 ──
  app.put('/api/admin/ai-provider-directory/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    const exist = await prisma.aiProviderDirectory.findUnique({ where: { id } })
    if (!exist) return reply.status(404).send({ code: 1, error: '供应商不存在' })
    const updated = await prisma.aiProviderDirectory.update({
      where: { id },
      data: {
        name: body.name ?? exist.name,
        logo: body.logo ?? exist.logo,
        description: body.description ?? exist.description,
        category: body.category ?? exist.category,
        country: body.country ?? exist.country,
        tags: Array.isArray(body.tags) ? body.tags : exist.tags,
        officialWebsite: body.officialWebsite ?? exist.officialWebsite,
        registerUrl: body.registerUrl ?? exist.registerUrl,
        billingUrl: body.billingUrl ?? exist.billingUrl,
        documentationUrl: body.documentationUrl ?? exist.documentationUrl,
        loginUrl: body.loginUrl ?? exist.loginUrl,
        browserEnabled: body.browserEnabled !== undefined ? !!body.browserEnabled : exist.browserEnabled,
        apiEnabled: body.apiEnabled !== undefined ? !!body.apiEnabled : exist.apiEnabled,
        capabilityScore: body.capabilityScore !== undefined ? sanitizeCapabilityScore(body.capabilityScore) : exist.capabilityScore,
        affiliateUrl: body.affiliateUrl ?? exist.affiliateUrl,
        affiliateEnabled: body.affiliateEnabled ?? exist.affiliateEnabled,
        affiliateDescription: body.affiliateDescription ?? exist.affiliateDescription,
        recommended: body.recommended != null ? Number(body.recommended) : exist.recommended,
        sort: body.sort != null ? Number(body.sort) : exist.sort,
        status: body.status ?? exist.status,
      },
    })
    return { code: 0, data: updated }
  })

  // ── 后台：启用/禁用 ──
  app.patch('/api/admin/ai-provider-directory/:id/toggle', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exist = await prisma.aiProviderDirectory.findUnique({ where: { id } })
    if (!exist) return reply.status(404).send({ code: 1, error: '供应商不存在' })
    const updated = await prisma.aiProviderDirectory.update({
      where: { id },
      data: { status: exist.status === 'active' ? 'disabled' : 'active' },
    })
    return { code: 0, data: updated }
  })

  // ── 后台：删除 ──
  app.delete('/api/admin/ai-provider-directory/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exist = await prisma.aiProviderDirectory.findUnique({ where: { id } })
    if (!exist) return reply.status(404).send({ code: 1, error: '供应商不存在' })
    await prisma.aiProviderDirectory.delete({ where: { id } })
    return { code: 0, data: { deleted: true } }
  })
}
