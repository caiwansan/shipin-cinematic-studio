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
