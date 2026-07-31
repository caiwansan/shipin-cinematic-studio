/**
 * routes/admin-ai-provider.routes.ts — Sprint-ADMIN-IA-REALITY-03 T02
 *
 * 平台 Provider 注册表（AiProvider）
 *  - GET    /api/admin/ai-providers                列表（含模型数/Key状态/健康状态）
 *  - POST   /api/admin/ai-providers                新增 Provider
 *  - PUT    /api/admin/ai-providers/:code          更新（name/endpoint/enabled）
 *  - PATCH  /api/admin/ai-providers/:code/toggle   启用/禁用
 *  - DELETE /api/admin/ai-providers/:code          删除（有模型关联时拒绝）
 *  - POST   /api/admin/ai-providers/:code/test     测试连接（更新 credentialStatus）
 *
 * 治理规则：
 *  - Provider 只能由平台 Admin 注册，workspace 不得自建 Provider
 *  - credentialStatus 与 Model Health Center 状态一致
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

const CAPABILITY_LABEL: Record<string, string> = {
  llm: '文本',
  image: '图片',
  video: '视频',
  tts: '语音',
  music: '音乐',
}

export default async function adminAiProviderRoutes(fastify: FastifyInstance) {
  // ── 列表 ──
  fastify.get('/api/admin/ai-providers', { preHandler: [requireAdmin] }, async () => {
    const providers = await prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } })
    const models = await prisma.aiModel.findMany({ select: { provider: true, modelType: true, status: true, capabilities: true } })
    const apiKeys = await prisma.apiKey.findMany({ select: { provider: true } })
    const keySet = new Set(apiKeys.map(k => k.provider))

    const data = providers.map(p => {
      const provModels = models.filter(m => m.provider === p.providerCode)
      return {
        ...p,
        modelCount: provModels.length,
        activeModelCount: provModels.filter(m => m.status === 'active').length,
        capabilities: [...new Set(provModels.flatMap(m => m.capabilities?.length ? m.capabilities : [m.modelType]))],
        hasPlatformKey: keySet.has(p.providerCode),
      }
    })

    const summary = {
      total: providers.length,
      enabled: providers.filter(p => p.enabled).length,
      ok: providers.filter(p => p.credentialStatus === 'ok').length,
      failed: providers.filter(p => p.credentialStatus === 'failed').length,
      untested: providers.filter(p => p.credentialStatus === 'untested').length,
      decryptError: providers.filter(p => p.credentialStatus === 'decrypt_error').length,
    }

    return { success: true, data, summary }
  })

  // ── 新增 ──
  fastify.post('/api/admin/ai-providers', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as { providerCode?: string; name?: string; endpoint?: string }
    const providerCode = (body.providerCode || '').trim().toLowerCase()
    if (!providerCode) return reply.code(400).send({ success: false, error: '缺少 providerCode' })
    if (!body.name) return reply.code(400).send({ success: false, error: '缺少 name' })

    const exist = await prisma.aiProvider.findUnique({ where: { providerCode } })
    if (exist) return reply.code(409).send({ success: false, error: `Provider ${providerCode} 已存在` })

    const provider = await prisma.aiProvider.create({
      data: {
        providerCode,
        name: body.name.trim(),
        endpoint: (body.endpoint || '').trim(),
        credentialStatus: 'untested',
        enabled: true,
      },
    })
    return { success: true, data: provider }
  })

  // ── 更新 ──
  fastify.put('/api/admin/ai-providers/:code', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = request.body as { name?: string; endpoint?: string; enabled?: boolean }
    const exist = await prisma.aiProvider.findUnique({ where: { providerCode: code } })
    if (!exist) return reply.code(404).send({ success: false, error: `Provider ${code} 不存在` })

    const provider = await prisma.aiProvider.update({
      where: { providerCode: code },
      data: {
        name: body.name !== undefined ? body.name.trim() : exist.name,
        endpoint: body.endpoint !== undefined ? body.endpoint.trim() : exist.endpoint,
        enabled: body.enabled !== undefined ? body.enabled : exist.enabled,
      },
    })
    return { success: true, data: provider }
  })

  // ── 启用/禁用 ──
  fastify.patch('/api/admin/ai-providers/:code/toggle', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { code } = request.params as { code: string }
    const exist = await prisma.aiProvider.findUnique({ where: { providerCode: code } })
    if (!exist) return reply.code(404).send({ success: false, error: `Provider ${code} 不存在` })

    const provider = await prisma.aiProvider.update({
      where: { providerCode: code },
      data: { enabled: !exist.enabled, credentialStatus: !exist.enabled ? exist.credentialStatus : 'untested' },
    })
    return { success: true, data: provider, message: provider.enabled ? '已启用' : '已禁用' }
  })

  // ── 删除（有模型关联时拒绝）──
  fastify.delete('/api/admin/ai-providers/:code', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { code } = request.params as { code: string }
    const exist = await prisma.aiProvider.findUnique({ where: { providerCode: code } })
    if (!exist) return reply.code(404).send({ success: false, error: `Provider ${code} 不存在` })

    const modelCount = await prisma.aiModel.count({ where: { provider: code } })
    if (modelCount > 0) {
      return reply.code(409).send({ success: false, error: `Provider ${code} 下仍有 ${modelCount} 个模型，请先移除模型` })
    }

    await prisma.aiProvider.delete({ where: { providerCode: code } })
    return { success: true, message: '已删除' }
  })

  // ── 测试连接（更新 credentialStatus）──
  fastify.post('/api/admin/ai-providers/:code/test', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { code } = request.params as { code: string }
    const provider = await prisma.aiProvider.findUnique({ where: { providerCode: code } })
    if (!provider) return reply.code(404).send({ success: false, error: `Provider ${code} 不存在` })

    // 复用 Model Health Center 的测试能力：取该 provider 第一个 active 模型测试
    const model = await prisma.aiModel.findFirst({
      where: { provider: code, status: 'active' },
      orderBy: { createdAt: 'asc' },
    })

    let status = 'untested'
    let detail: any = { tested: false, reason: '无可用模型' }

    if (model) {
      try {
        const { testModelConnection } = await import('../services/capability.service.js')
        const result = await testModelConnection(model.id)
        status = result.ok ? 'ok' : 'failed'
        detail = { tested: true, model: model.name, latency: result.latency, error: result.error }
      } catch (e: any) {
        status = 'failed'
        detail = { tested: true, error: e.message?.slice(0, 100) }
      }
    } else {
      // 无模型：只验证是否有平台 Key
      const apiKeyRow = await prisma.apiKey.findUnique({ where: { provider: code } })
      const envKey = process.env[`${code.toUpperCase()}_API_KEY`] || ''
      if (apiKeyRow || envKey) {
        status = 'untested'
        detail = { tested: false, reason: '有凭据但无模型可测' }
      }
    }

    const updated = await prisma.aiProvider.update({
      where: { providerCode: code },
      data: { credentialStatus: status },
    })

    return { success: true, data: { ...updated, detail } }
  })

  // ── 能力字典（前端用）──
  fastify.get('/api/admin/ai-providers/capabilities/dict', { preHandler: [requireAdmin] }, async () => {
    return { success: true, data: CAPABILITY_LABEL }
  })
}
