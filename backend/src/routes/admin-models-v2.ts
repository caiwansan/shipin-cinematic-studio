import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import crypto from 'crypto'
import { testModelConnection } from '../services/capability.service.js';
import { requireAdmin } from '../middleware/require-admin.js';

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
  fastify.get('/api/admin/models', { preHandler: [requireAdmin] }, async (_req, reply) => {
    const models = await prisma.aiModel.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: models } satisfies ApiResponse<unknown>;

  })

  // 创建模型
  fastify.post('/api/admin/models', { preHandler: [requireAdmin] }, async (req, reply) => {
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
  fastify.put('/api/admin/models/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
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
  fastify.patch('/api/admin/models/:id/toggle', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const existing = await prisma.aiModel.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ success: false, error: '模型不存在' })

    const newStatus = existing.status === 'active' ? 'disabled' : 'active'
    const model = await prisma.aiModel.update({
      where: { id },
      data: { status: newStatus },
    })
    return { success: true, data: model, message: newStatus === 'active' ? '模型已启用' : '模型已禁用' } as any satisfies ApiResponse<unknown>;

  })

  // 删除模型
  fastify.delete('/api/admin/models/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    await prisma.aiModel.delete({ where: { id } })
    return { success: true, data: null } satisfies ApiResponse<unknown>;

  })

  // ── API Key CRUD ──

  // 获取所有 API Key（脱敏展示）
  fastify.get('/api/admin/api-keys', { preHandler: [requireAdmin] }, async (_req, reply) => {
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
  fastify.post('/api/admin/api-keys', { preHandler: [requireAdmin] }, async (req, reply) => {
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
  fastify.delete('/api/admin/api-keys/:provider', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { provider } = req.params as any
    await prisma.apiKey.delete({ where: { provider } })
    return { success: true, data: null } satisfies ApiResponse<unknown>;

  })

  // ── 测试模型连通性 ──
  fastify.post('/api/admin/models/:id/test', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const result = await testModelConnection(id)
    return { success: true, data: result }
  })

  // ── 获取模型列表（按 Provider 分组） ──
  fastify.get('/api/admin/models/groups', { preHandler: [requireAdmin] }, async (_req, reply) => {
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
