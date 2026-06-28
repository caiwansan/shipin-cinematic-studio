// @ts-nocheck
import { FastifyInstance } from 'fastify'
import { storyboardService } from '../services/storyboard.service.js'
import { prisma } from '../utils/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';
import { narrativeGateway } from '../runtime/narrative-gateway.js'

export default async function storyboardRoutes(fastify: FastifyInstance) {
  // GET /api/projects/:projectId/storyboards
  fastify.get('/api/projects/:projectId/storyboards', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    return await storyboardService.findByProject(projectId)
  })

  // GET /api/storyboards/:id
  fastify.get('/api/storyboards/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await storyboardService.findById(id)
  })

  // POST /api/projects/:projectId/storyboards
  fastify.post('/api/projects/:projectId/storyboards', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const data = request.body as any
    return await storyboardService.create(projectId, data)
  })

  // PUT /api/storyboards/:id
  fastify.put('/api/storyboards/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const data = request.body as any
    return await storyboardService.update(id, data)
  })

  // DELETE /api/storyboards/:id
  fastify.delete('/api/storyboards/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await storyboardService.delete(id)
  })

  // ============================================
  // 🎬 AI 分镜生成 — 从场景描述生成多组分镜
  // ============================================
  fastify.post('/api/projects/:projectId/storyboards/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const { prompt } = request.body as any

    if (!prompt) return reply.status(400).send({ error: 'prompt is required' })

    // 先查项目，拿剧本内容
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    // 查已有角色信息
    const characters = await prisma.character.findMany({ where: { projectId } })

    const apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY
    if (!apiKey) {
      // 无 API key 时生成模拟分镜
      const shots: any[] = [
        { shotIndex: 0, sceneDescription: prompt, cameraAngle: '全景', movement: '固定镜头', lens: '35mm', duration: 5, prompt: `全景镜头: ${prompt}` },
        { shotIndex: 1, sceneDescription: prompt, cameraAngle: '中景', movement: '缓慢推进', lens: '50mm', duration: 4, prompt: `中景推进: ${prompt}` },
        { shotIndex: 2, sceneDescription: prompt, cameraAngle: '特写', movement: '固定镜头', lens: '85mm', duration: 3, prompt: `特写细节: ${prompt}` },
      ]

      const created = []
      for (const shot of shots) {
        const s = await storyboardService.create(projectId, shot)
        created.push(s)
      }
      return toApiResponse({shots: created, mock: true}) satisfies ApiResponse<unknown>;
    }

    const charInfo = characters.map(c => `- ${c.name}: ${c.description || '无描述'}`).join('\n')

    const systemPrompt = `你是一个专业的影视分镜师。根据用户的场景描述，生成 3~6 个分镜头。

每个分镜必须包含以下字段：
- shotIndex: 序号（从0开始）
- sceneDescription: 该镜头的场景描述（中文，50字以内）
- cameraAngle: 镜头角度（全景/中景/近景/特写/俯拍/仰拍/过肩镜头）
- movement: 运镜方式（固定镜头/缓慢推进/缓慢拉远/平移/跟拍/摇镜头/推轨）
- lens: 焦段（35mm/50mm/85mm/24-70mm/16-35mm/70-200mm）
- duration: 时长秒数（3-8）
- prompt: 该镜头的英文 prompt（用于 AI 绘画/视频生成，包含主体、场景、光线、氛围等详细描述，30-80词）

${charInfo ? `角色信息：\n${charInfo}\n` : ''}
请以 JSON 数组格式返回，不要其他文字。`

    try {
      // ⭐ 统一通过 narrativeGateway 调用 LLM（唯一配置源 = UserModelConfigV2）
      const gatewayResult = await narrativeGateway.execute({
        userId: (request as any).userId || project.userId,
        projectId,
        systemPrompt,
        userMessage: prompt,
        timeoutTier: 'normal',
        maxTokens: 2000,
        temperature: 0.8,
      })

      // 解析 JSON
      let shots: any[]
      try {
        const content = gatewayResult.content
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
        const jsonStr = jsonMatch ? jsonMatch[1] : content
        shots = JSON.parse(jsonStr)
      } catch {
        return reply.status(500).send({ error: 'AI 返回格式异常，请重试' })
      }

      if (!Array.isArray(shots) || shots.length === 0) {
        return reply.status(500).send({ error: 'AI 未生成有效的分镜' })
      }

      const created = []
      for (const shot of shots) {
        const s = await storyboardService.create(projectId, {
          shotIndex: shot.shotIndex ?? 0,
          sceneDescription: shot.sceneDescription || '',
          cameraAngle: shot.cameraAngle || '平视',
          movement: shot.movement || '固定镜头',
          lens: shot.lens || '35mm',
          duration: shot.duration || 5,
          dialogue: shot.dialogue || '',
          notes: shot.notes || '',
          prompt: shot.prompt || '',
        })
        created.push(s)
      }

      return toApiResponse({shots: created, mock: false}) satisfies ApiResponse<unknown>;
    } catch (err: any) {
      console.error('❌ [Storyboard] AI generation failed:', err.message)
      return reply.status(500).send({ error: `分镜生成失败: ${err.message}` })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

