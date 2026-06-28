import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function modelProviderRoutes(fastify: FastifyInstance) {
  // ── 获取所有配置的模型供应商 ──
  fastify.get('/api/model-providers', async (request, reply) => {
    const list = await prisma.modelProvider.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return { success: true, data: list } satisfies ApiResponse<unknown>;

  })

  // ── 获取单个供应商配置 ──
  fastify.get('/api/model-providers/:provider', async (request, reply) => {
    const { provider } = request.params as any
    const item = await prisma.modelProvider.findUnique({ where: { provider } })
    if (!item) return reply.status(404).send({ success: false, error: 'Provider not found' })
    return { success: true, data: item } satisfies ApiResponse<unknown>;

  })

  // ── 创建/更新供应商配置 ──
  fastify.put('/api/model-providers/:provider', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { provider } = request.params as any
    const data = request.body as any
    const item = await prisma.modelProvider.upsert({
      where: { provider },
      update: {
        label: data.label,
        modelType: data.modelType,
        modelName: data.modelName,
        apiKeyEnv: data.apiKeyEnv,
        endpoint: data.endpoint,
        aspectRatioMap: data.aspectRatioMap || JSON.parse('{}'),
        defaultParams: data.defaultParams || JSON.parse('{}'),
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
      create: {
        provider,
        label: data.label || provider,
        modelType: data.modelType || 'image',
        modelName: data.modelName || '',
        apiKeyEnv: data.apiKeyEnv || '',
        endpoint: data.endpoint,
        aspectRatioMap: data.aspectRatioMap || JSON.parse('{}'),
        defaultParams: data.defaultParams || JSON.parse('{}'),
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    })
    return { success: true, data: item } satisfies ApiResponse<unknown>;

  })

  // ── 删除供应商配置 ──
  fastify.delete('/api/model-providers/:provider', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { provider } = request.params as any
    await prisma.modelProvider.delete({ where: { provider } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ── 获取当前活跃的模型参数（按 type 获取，前端调用） ──
  fastify.get('/api/model-providers/active/:modelType', async (request, reply) => {
    const { modelType } = request.params as any
    const item = await prisma.modelProvider.findFirst({
      where: { modelType, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (!item) return reply.status(404).send({ success: false, error: `No active provider for ${modelType}` })
    return { success: true, data: item } satisfies ApiResponse<unknown>;

  })

  // ── 当前使用的 image provider 信息（含参数映射） ──
  fastify.get('/api/model-providers/active/image', async (request, reply) => {
    const item = await prisma.modelProvider.findFirst({
      where: { modelType: 'image', isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (!item) {
      // fallback: 用旧配置
      return {
        success: true,
        data: {
          provider: process.env.IMAGE_PROVIDER || 'aliyun',
          modelName: process.env.ALIYUN_IMAGE_MODEL || 'wanx2.1-t2i-turbo',
          aspectRatioMap: { '16:9': '1280x720', '9:16': '720x1280' },
        },
      }
    }
    return { success: true, data: item } satisfies ApiResponse<unknown>;

  })
}
