/**
 * ai-optimize-storyboard.ts — 全分镜图提示词生成 API
 *
 * POST /api/ai/optimize-storyboard
 * 输入：剧情 + 镜头列表（shotGraph）+ 角色/场景信息
 * 输出：每镜一张分镜图 prompt（含通用固定前缀 + 单镜可变描述 + 统一负面词）
 *
 * ⭐ System prompt 从 DB PromptTemplate.storyboard-designer 读取
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { getPrompt } from '../runtime/prompt/PromptRegistry.js'

async function getStoryboardPrompt(): Promise<string> {
  return getPrompt('storyboard-designer')
}

export default async function aiOptimizeStoryboardRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-storyboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'

    const body = request.body as any
    const {
      segmentNarrative,    // 剧情描述
      shots,               // [{shotId, shotType, shotName, subject, environment, action}] 镜头列表
      charDetails,         // [{name, costume, appearance}]
      sceneDetails,        // [{name, environment}]
      charImages,          // 角色图片URLs
      sceneImages,         // 场景图片URLs
      videoStyle,          // realistic|anime|3d|ink|watercolor|cyberpunk
      aspectRatio,         // 16:9|9:16|1:1|4:3
    } = body

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return reply.status(400).send({
        success: false,
        error: '缺少 shots（镜头列表）',
      })
    }

    const start = Date.now()

    // 构造参考信息段
    let refSection = ''
    if (charDetails?.length) {
      refSection += '\n## 角色特征\n'
      charDetails.forEach((ch: any) => {
        refSection += `- ${ch.name || '未知'}：服装="${ch.costume || ''}"  外貌="${ch.appearance || ''}"\n`
      })
    }
    if (sceneDetails?.length) {
      refSection += '\n## 场景特征\n'
      sceneDetails.forEach((sc: any) => {
        refSection += `- ${sc.name || '未知'}：${sc.environment || ''}\n`
      })
    }
    if (charImages?.length) {
      refSection += `\n## 角色参考图片\n${charImages.join('\n')}\n`
    }
    if (sceneImages?.length) {
      refSection += `\n## 场景参考图片\n${sceneImages.join('\n')}\n`
    }

    // 构造镜头列表段
    const shotsSection = shots.map((s: any, i: number) => {
      return `镜${i + 1}（${s.shotId || `S${String(i + 1).padStart(2, '0')}`}）：
  - 镜头类型：${s.shotType || 'unknown'}
  - 镜头名称：${s.shotName || ''}
  - 主体：${Array.isArray(s.subject) ? s.subject.join(', ') : (s.subject || '')}
  - 环境：${s.environment || ''}
  - 动作/画面描述：${s.action || ''}`
    }).join('\n')

    const styleGuide = videoStyle
      ? `\n## 视频风格\n【${videoStyle}】\n请严格按照此风格设计所有分镜。光影、色彩、材质、渲染质感必须全程一致。`
      : ''

    const ratioDirective = aspectRatio
      ? `\n## 画面比例\n目标输出比例为 ${aspectRatio}，所有分镜必须严格按此比例构图。`
      : ''

    const userPrompt = `根据以下信息，为一组视频关键分镜生成每镜的图生图提示词。

## 剧情描述
${segmentNarrative || '（无）'}

## 镜头列表
共 ${shots.length} 个镜头
${shotsSection}

${refSection}
${styleGuide}
${ratioDirective}

## 输出要求
1. 所有分镜的 prompt 必须共用完全相同的【通用固定前缀】（画幅、画质、光影、场景、人物穿搭）
2. 每镜只改【机位+焦段+景别+人物静态姿势】
3. prompt 中禁止出现任何动态词（飘动、流动、晃动、翻动等）
4. 每镜的 negativePrompt 完全一致（统一负面词）
5. 输出为 JSON 数组
6. prompt 和 negativePrompt 必须中文，NO English`

    try {
      const systemPrompt = await getStoryboardPrompt()

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt,
        userMessage: userPrompt,
        userId,
        timeoutTier: 'normal',
        maxTokens: 4096,
        temperature: 0.3,
      })

      // 解析 JSON
      let storyboard: any = null
      try {
        storyboard = JSON.parse(gatewayResponse.content)
      } catch (_) {
        const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (jsonMatch) {
          try { storyboard = JSON.parse(jsonMatch[1].trim()) } catch (_) {}
        }
      }

      // 宽松 fallback
      if (!storyboard || !Array.isArray(storyboard)) {
        const firstBracket = gatewayResponse.content.indexOf('[')
        const lastBracket = gatewayResponse.content.lastIndexOf(']')
        if (firstBracket >= 0 && lastBracket > firstBracket) {
          try {
            storyboard = JSON.parse(gatewayResponse.content.substring(firstBracket, lastBracket + 1))
          } catch (_) {}
        }
      }

      if (!storyboard || !Array.isArray(storyboard) || storyboard.length === 0) {
        console.warn('[optimize-storyboard] ⚠️ LLM 返回格式无法解析')
        console.warn('[optimize-storyboard] raw:', gatewayResponse.content.slice(0, 1000))
        return reply.status(422).send({
          success: false,
          error: 'LLM 返回格式无法解析',
          raw: gatewayResponse.content.slice(0, 2000),
        })
      }

      const latency = Date.now() - start
      console.log(`[optimize-storyboard] ✅ ${storyboard.length} frames | ${latency}ms`)

      return {
        success: true,
        data: {
          storyboard,
          totalFrames: storyboard.length,
        },
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
        },
      }
    } catch (err: any) {
      console.error('[optimize-storyboard] error:', err.message || err)
      return reply.status(500).send({
        success: false,
        error: err.message || '服务异常',
      })
    }
  })
}

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
