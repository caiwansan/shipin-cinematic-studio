import { FilmLanguageIR, freezeFilmIR, createFilmIRMetadata } from "../runtime/film-language-ir.js";
/**
 * POST /api/ai/optimize-shot-script
 * AI 优化视频脚本 — 逐秒优化镜头语言、角色动作、微表情、特效音效
 *
 * 输入: { segmentId, narrative, dialogue, effects, charImages, sceneImages }
 * 输出: { narrative, dialogue, effects }
 *
 * ⭐ LLM 调用路径统一走 NarrativeGateway（见 narrative-gateway.ts）
 *    不再使用 extractUserId → injectUserKey → refreshProviderApiKeys → provider.call()
 *
 * ⭐ System prompt 从 DB PromptTemplate 读取（禁止硬编码文本文件）
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma } from '../utils/index.js'

/**
 * 从 DB PromptTemplate 读取摄影指导 prompt
 */
async function getDirectorOfPhotographyPrompt(): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: 'director-of-photography' },
  })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  throw new Error('[ai-optimize-shot] PromptTemplate.director-of-photography 在数据库中不存在或内容为空')
}

/**
 * 从 JWT token 中提取 userId
 */
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

export default async function aiOptimizeShotRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-shot-script', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'

    const body = request.body as any
    const { segmentId, narrative, dialogue, effects, charImages, sceneImages, propImages, charDetails, sceneDetails, targetDuration } = body

    if (!narrative && !dialogue && !effects) {
      return reply.status(400).send({
        success: false,
        error: '至少需要提供 narrative / dialogue / effects 中的一个',
      })
    }

    try {
      // 构建用户 prompt
      let userPrompt = `请优化以下视频片段脚本，按逐秒输出优化结果。\n\n`

      if (narrative) userPrompt += `## 剧情描述\n${narrative}\n\n`
      if (dialogue) userPrompt += `## 对话文本\n${dialogue}\n\n`
      if (effects) userPrompt += `## 特效音效描述\n${effects}\n\n`
      if (charImages?.length > 0) userPrompt += `## 角色引用图片\n${charImages.slice(0, 5).join('\n')}\n\n`
      if (sceneImages?.length > 0) userPrompt += `## 场景引用图片\n${sceneImages.slice(0, 3).join('\n')}\n\n`
      if (propImages?.length > 0) userPrompt += `## 道具引用图片\n${propImages.slice(0, 5).join('\n')}\n\n`

      // ⭐ 嵌入选中场景的详细描述，防止 AI 每次构建不同场景
      if (sceneDetails?.length > 0) {
        userPrompt += `## 已选场景描述（严格遵循，禁止自行构建其他场景）\n${sceneDetails.map((s: any, i: number) =>
          `- 场景${i + 1}（${s.name || '未知'}）: ${s.environment || '（无描述）'}`
        ).join('\n')}\n\n`
      }

      // ⭐ 嵌入选中角色的服装/外貌，约束角色一致性
      if (charDetails?.length > 0) {
        userPrompt += `## 选中角色特征（禁止修改服装/外貌）\n${charDetails.map((c: any, i: number) =>
          `- 角色${i + 1}（${c.name || '未知'}）: 服装="${c.costume || '同上'}" 外貌="${c.appearance || ''}"`
        ).join('\n')}\n\n`
      }

      if (segmentId) userPrompt += `## 片段 ID\n${segmentId}\n\n`
      if (targetDuration && targetDuration > 0) {
        userPrompt += `## ⏱️ 目标时长\n请严格按照 ${targetDuration} 秒设计逐秒镜头脚本。优化结果中的 optimizedShots 数组必须包含从 second=0 到 second=${targetDuration - 1} 的完整逐秒数据。\n\n`
      }
      userPrompt += `请严格按照 JSON 格式输出优化后的逐秒脚本。首帧、中帧、尾帧的画面描述必须与以上"已选场景描述"中的环境保持一致，不得自行构建新场景。角色服装/外貌必须与"选中角色特征"一致。`

      const start = Date.now()

      // ⭐ 从 DB 读取 system prompt（禁止硬编码文本文件）
      const SYSTEM_PROMPT = await getDirectorOfPhotographyPrompt()

      // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用（自动发现用户配置、自动注入 Key）
      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: userPrompt,
        userId,
        maxTokens: 16384,
        temperature: 0.1,
        timeoutTier: 'long',
      })

      let optimized: any = null
      // 多层 JSON parse 兜底
      const tryParse = (str: string): any => {
        try { return JSON.parse(str) } catch { return null }
      }
      optimized = tryParse(gatewayResponse.content)
      if (!optimized) {
        // Try markdown code block
        const m = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (m) optimized = tryParse(m[1].trim())
      }
      if (!optimized) {
        // Try raw {} extraction with last-closing-brace
        const fb = gatewayResponse.content.indexOf('{')
        const lb = gatewayResponse.content.lastIndexOf('}')
        if (fb >= 0 && lb > fb) {
          optimized = tryParse(gatewayResponse.content.substring(fb, lb + 1))
        }
      }
      if (!optimized) {
        // Final fallback: truncated JSON repair (DeepSeek 截断)
        const fb = gatewayResponse.content.indexOf('{')
        if (fb >= 0) {
          const truncated = gatewayResponse.content.substring(fb)
          // Try last } first
          const lb = truncated.lastIndexOf('}')
          if (lb >= 0) optimized = tryParse(truncated.substring(0, lb + 1))
          // Try append suffixes
          if (!optimized) {
            for (const s of [']}', '}}', '}']) {
              optimized = tryParse(truncated + s)
              if (optimized) break
            }
          }
        }
      }
      if (!optimized) {
        console.error('[ai-optimize-shot] JSON parse failed, raw:', gatewayResponse.content.slice(0, 500))
        return reply.status(422).send({
          success: false,
          error: 'LLM 返回格式无法解析',
          raw: gatewayResponse.content.slice(0, 2000),
        })
      }

      const latency = Date.now() - start
      console.log(`[ai-optimize-shot] ✅ segment=${segmentId || 'unknown'} | ${optimized.optimizedShots?.length || 0} shots | ${latency}ms`)

      // 提取 filmIR（Phase A: LLM 直接输出；无则 null）
      let llmFilmIR: FilmLanguageIR | null = optimized.filmIR || optimized.filmLanguageIR || null
      if (llmFilmIR) {
        // 注入 metadata（LLM 不会输出 metadata，由系统补充）
        llmFilmIR.metadata = createFilmIRMetadata({
          createdBy: (gatewayResponse as any).provider || 'unknown',
          createdAt: new Date().toISOString(),
          source: 'ai-optimize-shot',
          confidence: 0.6,
          provider: (gatewayResponse as any).provider || undefined,
        })
        // ⭐ Immutable: freeze 防止后续模块修改
        llmFilmIR = freezeFilmIR(llmFilmIR) as unknown as FilmLanguageIR
      }
      const filmIRInfo = llmFilmIR ? {
        filmIR: llmFilmIR,
        compilerVersion: 'film-ir@0.1',
      } : { filmIR: null, compilerVersion: null }

      return {
        success: true,
        data: {
          narrative: optimized.narrative || '',
          dialogue: optimized.dialogue || '',
          effects: optimized.effects || '',
          negativePrompt: optimized.negativePrompt || '',
          optimizedShots: optimized.optimizedShots || [],
          firstFrameDescription: optimized.firstFrameDescription || '',
          lastFrameDescription: optimized.lastFrameDescription || '',
          // ⭐ FilmLanguageIR v0.1 Canonical Runtime
          ...filmIRInfo,
        },
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
        },
      }
    } catch (err: any) {
      console.error('[ai-optimize-shot] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })
}
