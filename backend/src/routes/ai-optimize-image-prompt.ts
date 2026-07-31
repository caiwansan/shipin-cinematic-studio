/**
 * ai-optimize-image-prompt.ts — 图片提示词 AI 优化 API
 *
 * POST /api/ai/optimize-image-prompt
 * 输入：原始提示词 + 负面提示词 + 是否有参考图
 * 输出：优化后的提示词
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { getPrompt } from '../runtime/prompt/PromptRegistry.js'

function extractUserId(request: any): string | null {
  try {
    const auth = request.headers.authorization as string
    if (!auth || !auth.startsWith('Bearer ')) return null
    const token = auth.slice(7).trim()
    const decoded: any = (request.server as any).jwt.verify(token)
    return decoded?.id || null
  } catch {
    return null
  }
}

import { requireMemberTierByPolicy } from '../middleware/require-member-tier.js'

export default async function aiOptimizeImagePromptRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-image-prompt', { preHandler: [app.authenticate, requireMemberTierByPolicy('aiOptimize.imagePrompt')] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'
    const { prompt, negativePrompt, hasRefImage } = request.body as any

    if (!prompt?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 prompt 参数' })
    }

    const start = Date.now()
    // ⭐ SSOT（Phase 4）: system prompt 从 PromptTemplate 表读取，禁止硬编码
    let systemPrompt: string
    try {
      systemPrompt = await getPrompt('image-prompt-optimizer')
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: `提示词模板缺失: ${err.message}` })
    }
    const userPrompt = `原始描述：${prompt}\n${negativePrompt ? `需避免的元素：${negativePrompt}\n` : ''}${hasRefImage ? '（已有参考图，请生成与参考图风格一致的提示词）\n' : ''}\n请输出优化后的中文图生图提示词。只输出 JSON：{"optimizedPrompt": "..."}`

    try {
      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt,
        userMessage: userPrompt,
        userId,
        timeoutTier: 'fast',
        maxTokens: 1024,
        temperature: 0.5,
      })

      let rawContent = gatewayResponse.content.trim()
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) rawContent = codeBlockMatch[1].trim()

      let optimizedPrompt = rawContent
      try {
        const parsed = JSON.parse(rawContent)
        if (parsed.optimizedPrompt) optimizedPrompt = String(parsed.optimizedPrompt).trim()
      } catch {}

      return {
        success: true,
        data: { optimizedPrompt },
        meta: { latencyMs: Date.now() - start },
      }
    } catch (err: any) {
      console.error('[optimize-image-prompt] error:', err.message || err)
      return reply.status(500).send({ success: false, error: err.message || '优化失败' })
    }
  })
}
