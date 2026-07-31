/**
 * routes/admin-platform-default-models.routes.ts — Sprint-ADMIN-IA-REALITY-03 T02
 *
 * 平台默认模型（Platform Model Registry 的默认分配层）
 *   - GET  /api/admin/platform-default-models            列表（按 capability）
 *   - PUT  /api/admin/platform-default-models/:stage     保存默认模型
 *   - POST /api/admin/platform-default-models/:stage/test 测试连通性
 *
 * 对应 runtime 第 5 层（AiStageModelConfig = stage_config）
 * 优先级冻结：用户 BYOK → 企业配置 → 平台默认模型 → env fallback
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { testModelConnection } from '../services/capability.service.js'

const STAGE_LABEL: Record<string, string> = {
  llm: '文本生成',
  image: '图片生成',
  video: '视频生成',
  tts: '语音合成',
  music: '音乐生成',
}

const STAGE_CAPABILITY: Record<string, string[]> = {
  llm: ['TEXT', 'EMBEDDING'],
  image: ['IMAGE'],
  video: ['VIDEO'],
  tts: ['AUDIO'],
  music: ['AUDIO'],
}

export default async function adminPlatformDefaultModelsRoutes(fastify: FastifyInstance) {
  // ── 列表 ──
  fastify.get('/api/admin/platform-default-models', { preHandler: [requireAdmin] }, async () => {
    const stages = await prisma.aiStageModelConfig.findMany({ orderBy: { stage: 'asc' } })
    const models = await prisma.aiModel.findMany({ select: { id: true, name: true, provider: true, modelType: true, capabilities: true, status: true } })
    const apiKeys = await prisma.apiKey.findMany({ select: { provider: true } })
    const keySet = new Set(apiKeys.map(k => k.provider))

    const data = Object.keys(STAGE_LABEL).map(stage => {
      const cfg = stages.find(s => s.stage === stage)
      // 候选模型：能力匹配（capabilities 为空时按 modelType 兜底）
      const TYPE_TO_CAP: Record<string, string> = { llm: 'TEXT', image: 'IMAGE', video: 'VIDEO', tts: 'AUDIO', music: 'AUDIO' }
      const candidates = models.filter(m => {
        if (m.status !== 'active') return false
        const caps = (m.capabilities?.length ? m.capabilities : [m.modelType]).map((c: string) => {
          const up = c.toUpperCase()
          return TYPE_TO_CAP[up.toLowerCase()] || up
        })
        return caps.some((c: string) => STAGE_CAPABILITY[stage]?.includes(c))
      })
      return {
        stage,
        label: STAGE_LABEL[stage],
        config: cfg ? { provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, size: cfg.size, enabled: cfg.enabled } : null,
        candidateModels: candidates.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          modelType: m.modelType,
          hasKey: keySet.has(m.provider) || !!process.env[`${m.provider.toUpperCase()}_API_KEY`],
        })),
      }
    })

    return { success: true, data }
  })

  // ── 保存默认模型 ──
  fastify.put('/api/admin/platform-default-models/:stage', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { stage } = request.params as { stage: string }
    if (!STAGE_LABEL[stage]) return reply.code(400).send({ success: false, error: `未知能力: ${stage}` })

    const body = request.body as { provider?: string; model?: string; baseUrl?: string; enabled?: boolean }
    if (!body.provider || !body.model) {
      return reply.code(400).send({ success: false, error: '缺少 provider 或 model' })
    }

    // 能力白名单校验：模型必须支持该 stage 的能力
    // 匹配规则：capabilities 优先；为空时用 modelType 映射（llm→TEXT, image→IMAGE, video→VIDEO, tts→AUDIO, music→AUDIO）
    const model = await prisma.aiModel.findFirst({ where: { name: body.model } })
    if (model) {
      const TYPE_TO_CAP: Record<string, string> = { llm: 'TEXT', image: 'IMAGE', video: 'VIDEO', tts: 'AUDIO', music: 'AUDIO' }
      const caps = (model.capabilities?.length ? model.capabilities : [model.modelType]).map((c: string) => {
        const up = c.toUpperCase()
        return TYPE_TO_CAP[up.toLowerCase()] || up
      })
      const ok = caps.some((c: string) => STAGE_CAPABILITY[stage]?.includes(c))
      if (!ok) {
        return reply.code(400).send({
          success: false,
          error: `模型 ${body.model} 能力 [${caps.join(',')}] 不支持 ${STAGE_LABEL[stage]}（白名单 ${STAGE_CAPABILITY[stage].join('/')}）`,
        })
      }
    }

    const cfg = await prisma.aiStageModelConfig.upsert({
      where: { stage },
      update: {
        provider: body.provider,
        model: body.model,
        baseUrl: body.baseUrl || '',
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
      create: {
        stage,
        provider: body.provider,
        model: body.model,
        baseUrl: body.baseUrl || '',
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
    })
    return { success: true, data: cfg }
  })

  // ── 测试默认模型连通性 ──
  fastify.post('/api/admin/platform-default-models/:stage/test', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { stage } = request.params as { stage: string }
    const cfg = await prisma.aiStageModelConfig.findUnique({ where: { stage } })
    if (!cfg) return reply.code(404).send({ success: false, error: `${STAGE_LABEL[stage]} 未配置默认模型` })

    const model = await prisma.aiModel.findFirst({ where: { name: cfg.model } })
    if (!model) {
      return reply.code(404).send({ success: false, error: `模型 ${cfg.model} 不在模型库中，无法测试` })
    }
    const result = await testModelConnection(model.id)
    return { success: true, data: { ...result, model: model.name, provider: cfg.provider } }
  })
}
