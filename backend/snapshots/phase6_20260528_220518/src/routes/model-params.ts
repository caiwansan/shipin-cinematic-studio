import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 模型参数 Schema API — 每个模型定义的参数结构，前端据此动态渲染表单
 *
 * 参考参数定义格式（存在 params 字段的 JSON 中）：
 * {
 *   "prompt":        { "label":"提示词", "type":"text", "required":true },
 *   "duration":      { "label":"时长(秒)", "type":"number", "default":5, "min":2, "max":15 },
 *   "ratio":         { "label":"画面比例", "type":"select", "options":["16:9","9:16","1:1"], "default":"16:9" },
 *   "referenceImage":{"label":"参考图", "type":"image", "required":false },
 *   "style":         { "label":"风格", "type":"text" },
 *   "negativePrompt":{"label":"负面提示词", "type":"text", "required":false }
 * }
 */
export default async function modelParamRoutes(fastify: FastifyInstance) {

  // GET /api/v1/model-params — 获取所有模型参数 schema
  fastify.get('/api/v1/model-params', { preHandler: [fastify.authenticate] }, async (_request, _reply) => {
    const schemas = await prisma.aiModelParamSchema.findMany({
      orderBy: { taskType: 'asc' },
    })
    return { success: true, schemas } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/model-params/:taskType — 按任务类型查询
  fastify.get('/api/v1/model-params/:taskType', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskType } = request.params as any
    const list = await prisma.aiModelParamSchema.findMany({
      where: { taskType },
    })
    return { success: true, schemas: list } satisfies ApiResponse<unknown>;

  })

  // POST /api/v1/model-params — 创建/更新参数 schema
  fastify.post('/api/v1/model-params', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { modelId, taskType, params } = request.body as any

    if (!modelId || !taskType || !params) {
      return reply.status(400).send({ success: false, error: '缺少 modelId/taskType/params' })
    }

    const schema = await prisma.aiModelParamSchema.upsert({
      where: { modelId },
      update: { taskType, params },
      create: { modelId, taskType, params },
    })

    console.log(`[ModelParams] ${user.id} set params for model ${modelId} (${taskType})`)
    return { success: true, schema } satisfies ApiResponse<unknown>;

  })
}
