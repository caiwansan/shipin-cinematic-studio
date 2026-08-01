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
const BROWSER_MODES = ['iframe', 'external_fallback', 'desktop_webview', 'disabled'] as const
function sanitizeBrowserMode(raw: any): string {
  return BROWSER_MODES.includes(raw) ? raw : 'iframe'
}
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

/** 能力综合分：六维平均（图片/视频等非语言模型忽略 coding/reasoning 为 0 的维度） */
function abilityOf(p: { capabilityScore: any }): number {
  const caps = p.capabilityScore as Record<string, number> | null
  if (!caps) return 0
  const dims = ['cost', 'speed', 'quality', 'chinese', 'coding', 'reasoning']
  const vals = dims.map((d) => Number(caps[d]) || 0)
  const nonZero = vals.filter((v) => v > 0)
  if (!nonZero.length) return 0
  return Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
}

/** 性价比 = 能力综合×60% + 价格优势×40%（纯计算，禁 AI 调用） */
function valueScoreOf(p: { capabilityScore: any; costScore?: number | null }): number | null {
  const a = abilityOf(p)
  if (!a) return null
  return Math.round((a * 0.6 + (p.costScore ?? 50) * 0.4) * 10) / 10
}

/** 参考价格：优先输入价（元/百万tokens），无则 null */
function priceOf(p: { pricingInfo: any }): number | null {
  const info = p.pricingInfo as any
  const v = info?.inputPrice
  return typeof v === 'number' ? v : null
}

// ════════════════════════════════════════════════════════════════
// AI-CENTER-06：全球 AI 模型数据库（模型粒度）
// 性价比 = 能力综合×60% + 价格优势×40%（纯计算，无 AI）
// 真实性：verified 才参与价格排行；pending 不展示价格数字
// ════════════════════════════════════════════════════════════════
const MODEL_DIMS = ['cost', 'speed', 'quality', 'chinese', 'coding', 'reasoning'] as const

/** 模型能力综合分（忽略 0 维度，图片/视频模型自然降维） */
function modelAbility(cap: any): number {
  if (!cap || typeof cap !== 'object') return 0
  const vals = MODEL_DIMS.map((d) => Number(cap[d]) || 0).filter((v) => v > 0)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** 模型性价比 = 能力×60% + 价格优势分×40%（cap.cost 即价格优势 0-100） */
function modelValueScore(m: { capabilityScore: any }): number | null {
  const a = modelAbility(m.capabilityScore)
  if (!a) return null
  const cost = Number((m.capabilityScore as any)?.cost) || 50
  return Math.round((a * 0.6 + cost * 0.4) * 10) / 10
}

/** 模型 → 前台 DTO（含性价比/状态） */
function modelDto(m: any) {
  const cap = m.capabilityScore as Record<string, number> | null
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    modelVersion: m.modelVersion,
    providerCode: m.provider?.code,
    providerName: m.provider?.name,
    providerLogo: m.provider?.logo || '',
    providerCountry: m.provider?.country || '',
    modelTypes: m.modelTypes || [],
    contextWindow: m.contextWindow,
    maxOutput: m.maxOutput,
    inputPrice: m.inputPrice,
    inputCacheHit: m.inputCacheHit,
    outputPrice: m.outputPrice,
    currency: m.currency,
    priceModel: m.priceModel,
    capabilityScore: cap,
    capabilitySource: m.capabilitySource,
    ability: modelAbility(cap),
    valueScore: modelValueScore(m),
    officialDocsUrl: m.officialDocsUrl,
    officialApiUrl: m.officialApiUrl,
    lastVerifiedAt: m.lastVerifiedAt,
    dataSource: m.dataSource,
    verifiedBy: m.verifiedBy,
    dataStatus: m.dataStatus,
    description: m.description,
    sort: m.sort,
    registerUrl: m.provider?.affiliateEnabled && m.provider?.affiliateUrl ? m.provider.affiliateUrl : (m.provider?.registerUrl || ''),
    registerViaAffiliate: !!(m.provider?.affiliateEnabled && m.provider?.affiliateUrl),
  }
}

export default async function aiProviderDirectoryRoutes(app: FastifyInstance) {
  await iframeCheck(app)

  // ── AI-CENTER-06 公开：模型列表（?type= 分类 + ?q= 搜索，模型粒度） ──
  app.get('/api/ai-provider-directory/models', async (req) => {
    const { type, q } = req.query as { type?: string; q?: string }
    const where: any = { status: 'active', provider: { status: 'active' } }
    if (type && type !== 'all') where.modelTypes = { has: type }
    let list = await prisma.aiModelDirectory.findMany({
      where,
      include: { provider: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
    if (q && q.trim()) {
      const kw = q.trim().toLowerCase()
      list = list.filter((m) =>
        m.name.toLowerCase().includes(kw) ||
        m.code.toLowerCase().includes(kw) ||
        (m.provider.name || '').toLowerCase().includes(kw) ||
        (m.description || '').toLowerCase().includes(kw)
      )
    }
    return { code: 0, data: list.map(modelDto) }
  })

  // ── AI-CENTER-06 公开：排行榜（三榜：综合性价比 / 最强能力·推理 / 最低成本） ──
  app.get('/api/ai-provider-directory/leaderboards', async () => {
    const list = await prisma.aiModelDirectory.findMany({
      where: { status: 'active', dataStatus: 'verified', provider: { status: 'active' } },
      include: { provider: true },
    })
    const ranked = list.map(modelDto).filter((m) => m.valueScore != null)
    // 综合性价比榜
    const value = [...ranked].sort((a: any, b: any) => b.valueScore - a.valueScore).slice(0, 10)
      .map((m: any, i) => ({ rank: i + 1, ...m }))
    // 最强能力榜（推理）：仅语言/Agent 模型，按 reasoning 降序
    const reasoning = list
      .filter((m) => (m.modelTypes as string[]).some((t) => ['language', 'agent'].includes(t)) && Number((m.capabilityScore as any)?.reasoning) > 0)
      .map((m) => ({
        ...modelDto(m),
        reasoning: Number((m.capabilityScore as any)?.reasoning) || 0,
        quality: Number((m.capabilityScore as any)?.quality) || 0,
      }))
      .sort((a: any, b: any) => b.reasoning - a.reasoning).slice(0, 10)
      .map((m: any, i) => ({ rank: i + 1, ...m }))
    // 最低成本榜（输入价升序，仅 verified 有价）
    const cheapest = list
      .filter((m) => m.inputPrice != null && (m.modelTypes as string[]).includes('language'))
      .map((m) => ({ ...modelDto(m), inputPrice: m.inputPrice! }))
      .sort((a: any, b: any) => a.inputPrice - b.inputPrice).slice(0, 10)
      .map((m: any, i) => ({ rank: i + 1, ...m }))
    return { code: 0, data: { value, reasoning, cheapest } }
  })

  // ── AI-CENTER-06 公开：模型对比（?codes=a,b,c） ──
  app.get('/api/ai-provider-directory/compare', async (req) => {
    const { codes } = req.query as { codes?: string }
    const codeList = (codes || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5)
    if (!codeList.length) {
      const def = await prisma.aiModelDirectory.findMany({
        where: { status: 'active', dataStatus: 'verified', modelTypes: { has: 'language' }, provider: { status: 'active' } },
        include: { provider: true },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        take: 3,
      })
      return { code: 0, data: def.map(modelDto) }
    }
    const list = await prisma.aiModelDirectory.findMany({
      where: { code: { in: codeList }, status: 'active' },
      include: { provider: true },
    })
    return { code: 0, data: list.map(modelDto) }
  })

  // ── AI-CENTER-06 公开：价格变更时间线（可信度：可追溯） ──
  app.get('/api/ai-provider-directory/price-history', async () => {
    const rows = await prisma.aiModelPriceHistory.findMany({
      include: { model: { include: { provider: true } } },
      orderBy: { verifiedAt: 'desc' },
      take: 30,
    })
    return {
      code: 0,
      data: rows.map((r) => ({
        id: r.id,
        modelCode: r.model.code,
        modelName: r.model.name,
        providerName: r.model.provider.name,
        inputPrice: r.inputPrice,
        outputPrice: r.outputPrice,
        currency: r.currency,
        verifiedAt: r.verifiedAt,
        verifiedBy: r.verifiedBy,
        dataSource: r.dataSource,
        note: r.note,
      })),
    }
  })

  // ── AI-CENTER-06 公开：模型详情（含价格历史 + 同厂商其他模型） ──
  app.get('/api/ai-provider-directory/models/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const m = await prisma.aiModelDirectory.findUnique({ where: { code }, include: { provider: true } })
    if (!m || m.status !== 'active' || m.provider.status !== 'active') {
      return reply.status(404).send({ code: 1, error: '模型不存在或已下架' })
    }
    const [history, siblings] = await Promise.all([
      prisma.aiModelPriceHistory.findMany({ where: { modelId: m.id }, orderBy: { verifiedAt: 'desc' }, take: 20 }),
      prisma.aiModelDirectory.findMany({
        where: { providerId: m.providerId, status: 'active', id: { not: m.id } },
        include: { provider: true },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
    ])
    return {
      code: 0,
      data: {
        ...modelDto(m),
        provider: {
          code: m.provider.code,
          name: m.provider.name,
          logo: m.provider.logo || '',
          country: m.provider.country || '',
          category: m.provider.category,
          officialWebsite: m.provider.officialWebsite,
          billingUrl: m.provider.billingUrl,
          documentationUrl: m.provider.documentationUrl,
          registerUrl: m.provider.affiliateEnabled && m.provider.affiliateUrl ? m.provider.affiliateUrl : m.provider.registerUrl,
          registerViaAffiliate: !!(m.provider.affiliateEnabled && m.provider.affiliateUrl),
          affiliateDescription: m.provider.affiliateDescription,
        },
        priceHistory: history.map((h) => ({ id: h.id, inputPrice: h.inputPrice, outputPrice: h.outputPrice, currency: h.currency, verifiedAt: h.verifiedAt, verifiedBy: h.verifiedBy, dataSource: h.dataSource, note: h.note })),
        siblings: siblings.map(modelDto),
      },
    }
  })

  // ── AI-CENTER-06 公开：模型统计（40+ AI 模型等真实数字） ──
  app.get('/api/ai-provider-directory/model-stats', async () => {
    const [models, providers] = await Promise.all([
      prisma.aiModelDirectory.count({ where: { status: 'active', provider: { status: 'active' } } }),
      prisma.aiProviderDirectory.count({ where: { status: 'active' } }),
    ])
    const verified = await prisma.aiModelDirectory.count({ where: { status: 'active', dataStatus: 'verified' } })
    return { code: 0, data: { modelCount: models, providerCount: providers, verifiedCount: verified, verifiedPrice: verified } }
  })

  // ── AI-CENTER-06 后台：模型管理列表 ──
  app.get('/api/admin/ai-model-directory', { preHandler: [requireAdmin] }, async () => {
    const list = await prisma.aiModelDirectory.findMany({
      include: { provider: true, priceHistory: { orderBy: { verifiedAt: 'desc' }, take: 1 } },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
    return { code: 0, data: list.map((m) => ({ ...modelDto(m), provider: undefined, providerCode: m.provider.code, providerName: m.provider.name, lastHistory: m.priceHistory[0] || null })) }
  })

  // ── AI-CENTER-06 后台：新增模型 ──
  app.post('/api/admin/ai-model-directory', { preHandler: [requireAdmin] }, async (req, reply) => {
    const body = req.body as any
    if (!body?.code || !body?.name || !body?.providerCode) {
      return reply.status(400).send({ code: 1, error: 'code/name/providerCode 必填' })
    }
    const provider = await prisma.aiProviderDirectory.findUnique({ where: { code: body.providerCode } })
    if (!provider) return reply.status(400).send({ code: 1, error: '厂商不存在' })
    const exist = await prisma.aiModelDirectory.findUnique({ where: { code: body.code } })
    if (exist) return reply.status(409).send({ code: 1, error: 'code 已存在' })
    const cap = sanitizeCapabilityScore(body.capabilityScore) as any
    const created = await prisma.aiModelDirectory.create({
      data: {
        providerId: provider.id,
        code: body.code,
        name: body.name,
        modelVersion: body.modelVersion || null,
        modelTypes: Array.isArray(body.modelTypes) ? body.modelTypes : [],
        contextWindow: body.contextWindow != null ? Number(body.contextWindow) : null,
        maxOutput: body.maxOutput != null ? Number(body.maxOutput) : null,
        inputPrice: body.inputPrice != null ? Number(body.inputPrice) : null,
        inputCacheHit: body.inputCacheHit != null ? Number(body.inputCacheHit) : null,
        outputPrice: body.outputPrice != null ? Number(body.outputPrice) : null,
        currency: body.currency || 'USD',
        priceModel: body.priceModel || 'token',
        capabilityScore: cap,
        officialDocsUrl: body.officialDocsUrl || '',
        officialApiUrl: body.officialApiUrl || '',
        description: body.description || null,
        sort: Number(body.sort) || 0,
        status: body.status || 'active',
        dataStatus: body.dataStatus || 'pending',
        dataSource: body.dataSource || '',
        verifiedBy: body.verifiedBy || '',
        lastVerifiedAt: body.dataStatus === 'verified' ? new Date() : null,
      },
    })
    return { code: 0, data: created }
  })

  // ── AI-CENTER-06 后台：更新模型 ──
  app.put('/api/admin/ai-model-directory/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    const exist = await prisma.aiModelDirectory.findUnique({ where: { id: Number(id) } })
    if (!exist) return reply.status(404).send({ code: 1, error: '模型不存在' })
    const updated = await prisma.aiModelDirectory.update({
      where: { id: Number(id) },
      data: {
        name: body.name ?? exist.name,
        modelVersion: body.modelVersion !== undefined ? body.modelVersion : exist.modelVersion,
        modelTypes: Array.isArray(body.modelTypes) ? body.modelTypes : exist.modelTypes,
        contextWindow: body.contextWindow !== undefined ? (body.contextWindow != null ? Number(body.contextWindow) : null) : exist.contextWindow,
        maxOutput: body.maxOutput !== undefined ? (body.maxOutput != null ? Number(body.maxOutput) : null) : exist.maxOutput,
        inputPrice: body.inputPrice !== undefined ? (body.inputPrice != null ? Number(body.inputPrice) : null) : exist.inputPrice,
        inputCacheHit: body.inputCacheHit !== undefined ? (body.inputCacheHit != null ? Number(body.inputCacheHit) : null) : exist.inputCacheHit,
        outputPrice: body.outputPrice !== undefined ? (body.outputPrice != null ? Number(body.outputPrice) : null) : exist.outputPrice,
        currency: body.currency ?? exist.currency,
        priceModel: body.priceModel ?? exist.priceModel,
        capabilityScore: body.capabilityScore !== undefined ? (sanitizeCapabilityScore(body.capabilityScore) as any) : exist.capabilityScore,
        officialDocsUrl: body.officialDocsUrl ?? exist.officialDocsUrl,
        officialApiUrl: body.officialApiUrl ?? exist.officialApiUrl,
        description: body.description !== undefined ? body.description : exist.description,
        sort: body.sort != null ? Number(body.sort) : exist.sort,
        status: body.status ?? exist.status,
      },
    })
    return { code: 0, data: updated }
  })

  // ── AI-CENTER-06 后台：标记已验证（可信度核心操作：更新三要素 + 写价格快照） ──
  app.post('/api/admin/ai-model-directory/:id/verify', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    const exist = await prisma.aiModelDirectory.findUnique({ where: { id: Number(id) } })
    if (!exist) return reply.status(404).send({ code: 1, error: '模型不存在' })
    const admin = (req as any).admin || { username: 'admin' }
    const verifiedBy = body?.verifiedBy || admin.username || 'admin'
    const dataSource = body?.dataSource || exist.dataSource || '后台人工验证'
    const updated = await prisma.aiModelDirectory.update({
      where: { id: Number(id) },
      data: {
        dataStatus: 'verified',
        lastVerifiedAt: new Date(),
        verifiedBy,
        dataSource,
      },
    })
    await prisma.aiModelPriceHistory.create({
      data: {
        modelId: Number(id),
        inputPrice: exist.inputPrice,
        outputPrice: exist.outputPrice,
        currency: exist.currency,
        verifiedBy,
        dataSource,
        note: body?.note || '人工验证',
      },
    })
    return { code: 0, data: { id: updated.id, dataStatus: 'verified', lastVerifiedAt: updated.lastVerifiedAt, verifiedBy, dataSource } }
  })

  // ── AI-CENTER-06 后台：删除模型 ──
  app.delete('/api/admin/ai-model-directory/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exist = await prisma.aiModelDirectory.findUnique({ where: { id: Number(id) } })
    if (!exist) return reply.status(404).send({ code: 1, error: '模型不存在' })
    await prisma.aiModelDirectory.delete({ where: { id: Number(id) } })
    return { code: 0, data: { deleted: true } }
  })

  // ── 公开：目录列表（支持 ?type= 分类过滤 + ?q= 搜索） ──
  app.get('/api/ai-provider-directory', async (req) => {
    const { type, q } = req.query as { type?: string; q?: string }
    const where: any = { status: 'active' }
    if (type && type !== 'all') where.modelTypes = { has: type }
    const [list, connected] = await Promise.all([
      prisma.aiProviderDirectory.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { recommended: 'desc' }],
      }),
      connectedCodes(await optionalUserId(req as FastifyRequest)),
    ])
    let rows = list
    if (q && q.trim()) {
      const kw = q.trim().toLowerCase()
      rows = rows.filter((p) =>
        p.name.toLowerCase().includes(kw) ||
        p.modelName.toLowerCase().includes(kw) ||
        (p.description || '').toLowerCase().includes(kw) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(kw)) ||
        (p.supportedModels as string[] || []).some((m) => m.toLowerCase().includes(kw))
      )
    }
    return {
      code: 0,
      data: rows.map((p) => ({
        ...p,
        registerUrl: p.affiliateEnabled && p.affiliateUrl ? p.affiliateUrl : p.registerUrl,
        registerViaAffiliate: !!(p.affiliateEnabled && p.affiliateUrl),
        connected: connected.has(p.code),
        valueScore: valueScoreOf(p),
      })),
    }
  })

  // ── 公开：统计（Hero 三个数据卡：全球模型 / 支持厂商 / 已连接） ──
  app.get('/api/ai-provider-directory/stats', async (req) => {
    const [list, connected] = await Promise.all([
      prisma.aiProviderDirectory.findMany({ where: { status: 'active' } }),
      connectedCodes(await optionalUserId(req as FastifyRequest)),
    ])
    const modelLines = list.reduce((n, p) => n + ((p.supportedModels as string[])?.length || 0), 0)
    return {
      code: 0,
      data: {
        modelCount: modelLines,          // 全球模型（品牌线数）
        providerCount: list.length,       // 支持厂商
        connectedCount: connected.size,   // 已连接（当前用户真实配置）
        typeCount: {
          language: list.filter((p) => (p.modelTypes as string[])?.includes('language')).length,
          image: list.filter((p) => (p.modelTypes as string[])?.includes('image')).length,
          video: list.filter((p) => (p.modelTypes as string[])?.includes('video')).length,
          audio: list.filter((p) => (p.modelTypes as string[])?.includes('audio')).length,
          multimodal: list.filter((p) => (p.modelTypes as string[])?.includes('multimodal')).length,
          agent: list.filter((p) => (p.modelTypes as string[])?.includes('agent')).length,
        },
      },
    }
  })

  // ── 公开：AI Compare 二维对比（能力 vs 价格，性价比计算，纯计算无 AI） ──
  app.get('/api/ai/center/compare', async () => {
    const list = await prisma.aiProviderDirectory.findMany({ where: { status: 'active' } })
    const data = list
      .map((p) => ({
        code: p.code,
        name: p.name,
        modelName: p.modelName,
        valueScore: valueScoreOf(p),
        ability: abilityOf(p),   // 能力综合 0-100
        costScore: p.costScore ?? 50, // 价格优势 0-100（高=便宜）
        price: priceOf(p),       // 参考输入价（元/百万tokens，用于横轴）
        types: p.modelTypes || [],
      }))
      .filter((x) => x.valueScore != null)
    return { code: 0, data }
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
        browserMode: sanitizeBrowserMode(body.browserMode),
        apiEnabled: body.apiEnabled !== undefined ? !!body.apiEnabled : true,
        capabilityScore: sanitizeCapabilityScore(body.capabilityScore) as any,
        affiliateUrl: body.affiliateUrl || '',
        affiliateEnabled: !!body.affiliateEnabled,
        affiliateDescription: body.affiliateDescription || null,
        recommended: Number(body.recommended) || 3,
        sort: Number(body.sort) || 0,
        status: body.status || 'active',
        // AI-CENTER-05 分类字段
        modelName: body.modelName || '',
        modelTypes: Array.isArray(body.modelTypes) ? body.modelTypes : [],
        contextLength: body.contextLength != null ? Number(body.contextLength) : null,
        priceSource: body.priceSource || '官方公开价格',
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
        browserMode: body.browserMode !== undefined ? sanitizeBrowserMode(body.browserMode) : exist.browserMode,
        apiEnabled: body.apiEnabled !== undefined ? !!body.apiEnabled : exist.apiEnabled,
        capabilityScore: (body.capabilityScore !== undefined ? sanitizeCapabilityScore(body.capabilityScore) : exist.capabilityScore) as any,
        // AI-CENTER-04：价格运营 + 标签运营（运营后台维护，无算法）
        pricingInfo: body.pricingInfo !== undefined ? body.pricingInfo : exist.pricingInfo,
        costScore: body.costScore != null ? Number(body.costScore) : exist.costScore,
        supportedModels: Array.isArray(body.supportedModels) ? body.supportedModels : exist.supportedModels,
        recommendTag: body.recommendTag !== undefined ? body.recommendTag : exist.recommendTag,
        pricingUpdatedAt: body.pricingUpdatedAt != null ? new Date(body.pricingUpdatedAt) : exist.pricingUpdatedAt,
        affiliateUrl: body.affiliateUrl ?? exist.affiliateUrl,
        affiliateEnabled: body.affiliateEnabled ?? exist.affiliateEnabled,
        affiliateDescription: body.affiliateDescription ?? exist.affiliateDescription,
        recommended: body.recommended != null ? Number(body.recommended) : exist.recommended,
        sort: body.sort != null ? Number(body.sort) : exist.sort,
        status: body.status ?? exist.status,
        // AI-CENTER-05 分类字段
        modelName: body.modelName !== undefined ? body.modelName : exist.modelName,
        modelTypes: Array.isArray(body.modelTypes) ? body.modelTypes : exist.modelTypes,
        contextLength: body.contextLength !== undefined ? (body.contextLength != null ? Number(body.contextLength) : null) : exist.contextLength,
        priceSource: body.priceSource !== undefined ? body.priceSource : exist.priceSource,
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
