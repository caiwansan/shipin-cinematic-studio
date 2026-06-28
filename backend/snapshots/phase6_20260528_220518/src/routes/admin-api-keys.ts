import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/admin-api-keys.ts — 后台大模型 API Key 管理路由
 *
 * GET    /api/admin/api-keys        — 获取所有 API Key
 * POST   /api/admin/api-keys        — 新增 API Key
 * PUT    /api/admin/api-keys/:id    — 更新 API Key
 * DELETE /api/admin/api-keys/:id    — 删除 API Key
 *
 * GET    /api/admin/models          — 获取所有 AiModel 配置
 * POST   /api/admin/models          — 新增/更新 AiModel
 * DELETE /api/admin/models/:id      — 删除 AiModel
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminApiKeyRoutes(fastify: FastifyInstance) {
  // ======= API Key 管理 =======

  // GET 所有 key（隐藏部分字符）
  fastify.get('/api/admin/api-keys', { preHandler: [requireAdmin] }, async () => {
    const keys = await prisma.apiKey.findMany({ orderBy: { provider: 'asc' } })
    return {
      success: true,
      keys: keys.map(k => ({
        id: k.id,
        provider: k.provider,
        keyName: k.keyName,
        keyValue: maskKey(k.keyValue),
        updatedAt: k.updatedAt,
      })),
    }
  })

  // POST 新增 key
  fastify.post('/api/admin/api-keys', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { provider, keyName, keyValue } = request.body as any
    if (!provider || !keyName || !keyValue) {
      return reply.status(400).send({ success: false, error: 'provider, keyName, keyValue 为必填' })
    }

    // 写入数据库
    const saved = await prisma.apiKey.upsert({
      where: { provider },
      update: { keyName, keyValue },
      create: { provider, keyName, keyValue },
    })

    // 立即注入到 process.env（无需重启）
    process.env[keyName] = keyValue

    console.log(`[Admin] API Key upserted: ${keyName} (${provider})`)
    return { success: true, key: { ...saved, keyValue: maskKey(saved.keyValue) } } satisfies ApiResponse<unknown>;

  })

  // PUT 更新 key
  fastify.put('/api/admin/api-keys/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const { provider, keyName, keyValue } = request.body as any

    const data: any = {}
    if (provider) data.provider = provider
    if (keyName) data.keyName = keyName
    if (keyValue) data.keyValue = keyValue

    const updated = await prisma.apiKey.update({ where: { id }, data })

    if (keyValue || keyName) {
      process.env[updated.keyName] = updated.keyValue
    }

    return { success: true, key: { ...updated, keyValue: maskKey(updated.keyValue) } } satisfies ApiResponse<unknown>;

  })

  // DELETE key
  fastify.delete('/api/admin/api-keys/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.apiKey.findUnique({ where: { id } })
    if (existing) {
      delete process.env[existing.keyName]
    }
    await prisma.apiKey.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ======= AiModel 管理 =======

  // GET 模型列表
  fastify.get('/api/admin/models', { preHandler: [requireAdmin] }, async () => {
    const models = await prisma.aiModel.findMany({ orderBy: [{ modelType: 'asc' }, { name: 'asc' }] })
    return { success: true, models } satisfies ApiResponse<unknown>;

  })

  // POST 新增/更新模型
  fastify.post('/api/admin/models', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    if (!body.name || !body.provider || !body.modelType) {
      return reply.status(400).send({ success: false, error: 'name, provider, modelType 为必填' })
    }

    const saved = await prisma.aiModel.upsert({
      where: { name: body.name },
      update: body,
      create: body,
    })

    return { success: true, model: saved } satisfies ApiResponse<unknown>;

  })

  // DELETE 模型
  fastify.delete('/api/admin/models/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.aiModel.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })
}

function maskKey(key: string): string {
  if (key.length <= 8) return key.substring(0, 3) + '***'
  return key.substring(0, 6) + '****' + key.substring(key.length - 4)
}
