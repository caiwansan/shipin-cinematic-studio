import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.CRYPTO_ENCRYPTION_KEY || 'default-dev-key-32chars!!'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encrypted = parts.join(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export default async function adminModelRoutes(fastify: FastifyInstance) {
  // ── 模型 CRUD ──

  // 获取所有模型
  fastify.get('/api/v1/admin/models', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    const models = await prisma.aiModel.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: models } satisfies ApiResponse<unknown>;

  })

  // 创建模型
  fastify.post('/api/v1/admin/models', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const body = req.body as any
    const model = await prisma.aiModel.create({
      data: {
        name: body.name,
        provider: body.provider,
        modelType: body.modelType || 'text',
        status: body.status || 'active',
        endpointUrl: body.endpointUrl || '',
        apiKeyRef: body.apiKeyRef || '',
        costPerRequest: body.costPerRequest || 0,
        costPerToken: body.costPerToken || 0,
        qualityScore: body.qualityScore || 0.8,
        avgLatency: body.avgLatency || 0,
        concurrencyMax: body.concurrencyMax || 5,
        currentLoad: 0,
        params: body.params || {},
      },
    })
    return { success: true, data: model } satisfies ApiResponse<unknown>;

  })

  // 更新模型
  fastify.put('/api/v1/admin/models/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    const model = await prisma.aiModel.update({
      where: { id },
      data: {
        name: body.name,
        provider: body.provider,
        modelType: body.modelType,
        status: body.status,
        endpointUrl: body.endpointUrl,
        apiKeyRef: body.apiKeyRef,
        costPerRequest: body.costPerRequest,
        costPerToken: body.costPerToken,
        qualityScore: body.qualityScore,
        avgLatency: body.avgLatency,
        concurrencyMax: body.concurrencyMax,
        params: body.params,
      },
    })
    return { success: true, data: model } satisfies ApiResponse<unknown>;

  })

  // 切换模型启用/禁用（全局开关）
  fastify.patch('/api/v1/admin/models/:id/toggle', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const existing = await prisma.aiModel.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ success: false, error: '模型不存在' })

    const newStatus = existing.status === 'active' ? 'disabled' : 'active'
    const model = await prisma.aiModel.update({
      where: { id },
      data: { status: newStatus },
    })
    return { success: true, data: model, message: newStatus === 'active' ? '模型已启用' : '模型已禁用' } satisfies ApiResponse<unknown>;

  })

  // 删除模型
  fastify.delete('/api/v1/admin/models/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    await prisma.aiModel.delete({ where: { id } })
    return { success: true, message: '模型已删除' } satisfies ApiResponse<unknown>;

  })

  // ── API Key CRUD ──

  // 获取所有 API Key（脱敏展示）
  fastify.get('/api/v1/admin/apikeys', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    const keys = await prisma.apiKey.findMany({ orderBy: { provider: 'asc' } })
    const masked = keys.map(k => ({
      id: k.id,
      provider: k.provider,
      keyName: k.keyName,
      keyValue: k.keyValue.length > 8 ? k.keyValue.slice(0, 8) + '••••••••' : '••••••••',
      updatedAt: k.updatedAt,
    }))
    return { success: true, data: masked } satisfies ApiResponse<unknown>;

  })

  // 新增/更新 API Key（加密存储）
  fastify.post('/api/v1/admin/apikeys', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const body = req.body as any
    const encrypted = encrypt(body.keyValue)
    const key = await prisma.apiKey.upsert({
      where: { provider: body.provider },
      update: { keyName: body.keyName, keyValue: encrypted },
      create: { provider: body.provider, keyName: body.keyName, keyValue: encrypted },
    })
    return { success: true, data: { id: key.id, provider: key.provider, keyName: key.keyName } } satisfies ApiResponse<unknown>;

  })

  // 删除 API Key
  fastify.delete('/api/v1/admin/apikeys/:provider', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { provider } = req.params as any
    await prisma.apiKey.delete({ where: { provider } })
    return { success: true, message: 'API Key 已删除' } satisfies ApiResponse<unknown>;

  })

  // ── 测试模型连通性 ──
  fastify.post('/api/v1/admin/models/:id/test', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const model = await prisma.aiModel.findUnique({ where: { id } })
    if (!model) return reply.code(404).send({ success: false, error: '模型不存在' })

    const t0 = Date.now()
    try {
      // 从环境变量或 ApiKey 表获取 key
      let apiKey = process.env[model.apiKeyRef] || ''
      if (!apiKey && model.apiKeyRef) {
        const stored = await prisma.apiKey.findUnique({ where: { provider: model.provider } })
        if (stored) {
          try { apiKey = decrypt(stored.keyValue) } catch { apiKey = '' }
        }
      }

      const endpoint = model.endpointUrl || (model.provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' :
        model.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
        model.provider === 'bailian' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' :
        '')

      if (!endpoint || !apiKey) {
        return { success: true, data: { ok: false, latency: null, error: !apiKey ? '缺少 API Key' : '缺少 Endpoint URL' } } satisfies ApiResponse<unknown>;

      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.name,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      })
      const json = await res.json()
      const ok = !!(json.choices || json.data || json.id)
      return {
        success: true,
        data: { ok, latency: ok ? Math.round(Date.now() - t0) : null, error: ok ? undefined : `HTTP ${res.status}` },
      }
    } catch (e: any) {
      return { success: true, data: { ok: false, latency: null, error: e.message?.slice(0, 100) } } satisfies ApiResponse<unknown>;

    }
  })

  // ── 获取模型列表（按 Provider 分组） ──
  fastify.get('/api/v1/admin/models/groups', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    const models = await prisma.aiModel.findMany({ orderBy: [{ provider: 'asc' }, { name: 'asc' }] })
    const keys = await prisma.apiKey.findMany()
    const keyMap: Record<string, boolean> = {}
    keys.forEach(k => { keyMap[k.provider] = true })

    const groups: Record<string, { models: typeof models; hasKey: boolean }> = {}
    for (const m of models) {
      if (!groups[m.provider]) groups[m.provider] = { models: [], hasKey: !!keyMap[m.provider] }
      groups[m.provider].models.push(m)
    }
    return { success: true, data: groups } satisfies ApiResponse<unknown>;

  })
}
