import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/stage-model-config.ts — 各阶段模型配置 CRUD
 *
 * 管理角色图/场景图/分镜图/视频 各阶段使用的模型和参数
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function stageModelConfigRoutes(fastify: FastifyInstance) {
  
  // GET /api/v1/stage-model-config — 获取所有阶段配置
  fastify.get('/api/v1/stage-model-config', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    try {
      const configs = await prisma.aiStageModelConfig.findMany({ orderBy: { stage: 'asc' } })
      return { success: true, data: configs } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/v1/stage-model-config/:stage — 获取单个阶段配置
  fastify.get('/api/v1/stage-model-config/:stage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { stage } = request.params as any
      let config = await prisma.aiStageModelConfig.findUnique({ where: { stage } })
      if (!config) {
        // 返回默认值
        const defaults: Record<string, any> = {
          character:  { provider: 'bailian', model: 'wan2.7-image-pro', size: '1024x1024', params: {}, enabled: true },
          scene:      { provider: 'bailian', model: 'wan2.7-image-pro', size: '1024x1024', params: {}, enabled: true },
          storyboard: { provider: 'bailian', model: 'wan2.7-image-pro', size: '1024x1024', params: {}, enabled: true },
          video:      { provider: 'bailian', model: 'wan2.1-t2i-turbo', size: '1280x720', params: {}, enabled: true },
        }
        return { success: true, data: { stage, ...defaults[stage] || defaults.character } } satisfies ApiResponse<unknown>;

      }
      return { success: true, data: config } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/v1/stage-model-config — 创建或更新配置
  fastify.post('/api/v1/stage-model-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any
      const { stage, provider, model, size, params, enabled } = body
      if (!stage) return reply.status(400).send({ success: false, error: '缺少 stage 字段' })

      const config = await prisma.aiStageModelConfig.upsert({
        where: { stage },
        update: { provider, model, size, params, enabled },
        create: {
          stage,
          provider: provider || 'bailian',
          model: model || 'wan2.7-image-pro',
          size: size || '1024x1024',
          params: params || {},
          enabled: enabled ?? true,
        },
      })
      return { success: true, data: config } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/v1/stage-model-config/:stage — 删除配置
  fastify.delete('/api/v1/stage-model-config/:stage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { stage } = request.params as any
      await prisma.aiStageModelConfig.delete({ where: { stage } })
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
