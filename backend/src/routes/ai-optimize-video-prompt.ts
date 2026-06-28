/**
 * ai-optimize-video-prompt.ts — 视频 prompt AI 优化 API
 *
 * POST /api/ai/optimize-video-prompt
 * 输入：整段剧情描述 + 对话 + 特效 + 时长 + 三帧画面描述
 * 输出：中文镜头语言风格优化后的剧情描述 + 三帧分别优化后的画面描述
 *
 * ⭐ System prompt 从 DB PromptTemplate 读取
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma, getRouteConfig } from '../utils/index.js'
import { checkDailyQuota, incrementDailyUsage } from '../services/usage-quota.service.js'
import { StyleProfileService } from '../services/style-profile.service.js'

/**
 * ⭐ 视频风格 → 镜头语言指引
 * 从 StyleProfile 表读取（禁止硬编码）
 */

async function getVideoPromptDesigner(): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: 'video-prompt-designer' },
  })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  throw new Error('[ai-optimize-video-prompt] PromptTemplate.video-prompt-designer 在数据库中不存在或内容为空')
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

export default async function aiOptimizeVideoPromptRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-video-prompt', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'

    const body = request.body as any
    const {
      segmentNarrative,   // 整段剧情描述（中文）
      dialogue,           // 对话文本
      effects,            // 特效描述
      duration,           // 视频时长（秒）
      firstFrameDesc,     // 首帧画面描述
      lastFrameDesc,      // 尾帧画面描述
      videoStyle,         // 视频风格：realistic|anime|3d|clay|pixel|ink|cyberpunk|watercolor
    } = body

    if (!segmentNarrative) {
      return reply.status(400).send({
        success: false,
        error: '缺少必要参数 segmentNarrative',
      })
    }

    // ⭐ 免费用户每日 AI 优化次数限制
    let quota: { canProceed: boolean; used: number; limit: number; remaining: number } | null = null
    try {
      quota = await checkDailyQuota(userId)
      if (!quota.canProceed) {
        return reply.status(429).send({
          success: false,
          error: `今日 AI 优化次数已达上限（${quota.limit} 次），请明日再试`,
          quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
        })
      }
    } catch {
      // 配额检查失败时放行（不阻塞功能）
      quota = { canProceed: true, used: 0, limit: 99, remaining: 99 }
      console.warn('[optimize-video-prompt] ⚠️ 配额检查异常，已放行')
    }

    const start = Date.now()

    // ⭐ 视频风格指引
    const profile = await StyleProfileService.getByName(videoStyle || 'realistic')
    const styleGuide = profile?.description || profile?.styleTokens || '写实电影风格'
    const styleDirective = videoStyle
      ? `\n当前设定的视频风格为：【${videoStyle}】\n该风格的镜头语言特征：${styleGuide}\n请严格按照此风格编写镜头语言和视觉描述。`
      : ''

    // 构造 user prompt（中文输入，要求中文镜头语言输出）
    const userPrompt = [
      '## 原始剧情描述（待优化）',
      segmentNarrative || '（无）',
      '',
      styleDirective,
      '',
      dialogue ? `## 对话文本\n${dialogue}` : '',
      effects ? `## 特效/音效描述\n${effects}` : '',
      duration ? `## 视频时长：${duration} 秒` : '',
      firstFrameDesc ? `## 首帧画面描述（第0秒）\n${firstFrameDesc}` : '',
      lastFrameDesc ? `## 尾帧画面描述（最后一秒）\n${lastFrameDesc}` : '',
      '',
      '## 输出要求（严格）',
      '1. 从视觉语言角度改写整段剧情描述：明确每段镜头对应的景别（特写/近景/中景/全景/远景）、机位（平视/仰视/俯视/过肩/主观）、镜头运动方式（固定/推/拉/摇/移/跟/升/降/环绕）。',
      '2. 保持原始剧情的时间线和故事逻辑不变。',
      '3. 具体到每个时间点的画面内容，让 AI 视频模型能准确理解每一秒应该呈现什么。',
      '4. 优化后的描述应为纯中文，保留原始对话文本格式（如果提供）。',
      '5. 保持简洁：每个描述不超过 30 字，只说「看见什么、镜头怎么动」，不写角色心理或剧情解释。',
      '6. 【风格约束】输出的镜头语言和视觉描述必须与当前视频风格一致，不可偏离。',
      '7. 除了整段剧情描述，还要分别优化首帧、中帧、尾帧的画面描述词。首帧描述应聚焦视频开头第0秒的画面，中帧描述聚焦视频中间时刻的画面，尾帧描述聚焦视频末尾的画面。',
      '',
      '## 输出格式（严格 JSON，不要 markdown 代码块包裹，只输出 JSON）',
      '{',
      '  "optimizedNarrative": "整段镜头语言优化后的剧情描述（纯文本，无JSON转义）",',
      '  "optimizedDialogue": "优化后的对话文本，保持人物对话的连贯性和自然度，与剧情描述对齐",',
      '  "optimizedEffects": "优化后的特效/音效描述，与剧情和对话匹配",',
      '  "optimizedFirstFrame": "首帧画面描述（第0秒的独立镜头描述）",',
      '  "optimizedMidFrame": "中帧画面描述（视频中间时刻的独立镜头描述）",',
      '  "optimizedLastFrame": "尾帧画面描述（视频末尾的独立镜头描述）"',
      '}',
    ].filter(Boolean).join('\n')

    try {
      const systemPrompt = await getVideoPromptDesigner()

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt,
        userMessage: userPrompt,
        userId: userId || 'anonymous',
        timeoutTier: 'normal',
        maxTokens: 3072,
        temperature: 0.5,
      })

      let rawContent = gatewayResponse.content.trim()

      // 清理可能的 markdown 代码块包裹
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim()
      }

      // 尝试解析 JSON
      let optimizedNarrative = rawContent
      let optimizedDialogue = ''
      let optimizedEffects = ''
      let optimizedFirstFrame = ''
      let optimizedMidFrame = ''
      let optimizedLastFrame = ''

      try {
        const parsed = JSON.parse(rawContent)
        if (parsed.optimizedNarrative) optimizedNarrative = String(parsed.optimizedNarrative).trim()
        if (parsed.optimizedDialogue) optimizedDialogue = String(parsed.optimizedDialogue).trim()
        if (parsed.optimizedEffects) optimizedEffects = String(parsed.optimizedEffects).trim()
        if (parsed.optimizedFirstFrame) optimizedFirstFrame = String(parsed.optimizedFirstFrame).trim()
        if (parsed.optimizedMidFrame) optimizedMidFrame = String(parsed.optimizedMidFrame).trim()
        if (parsed.optimizedLastFrame) optimizedLastFrame = String(parsed.optimizedLastFrame).trim()
      } catch {
        // JSON 解析失败时，整段内容作为 optimizedNarrative 保留
        console.warn('[optimize-video-prompt] ⚠️ AI 输出非标准 JSON，整段作为 narrative')
      }

      // 清理首尾引号
      optimizedNarrative = optimizedNarrative.replace(/^["']|["']$/g, '').trim()
      optimizedDialogue = optimizedDialogue.replace(/^["']|["']$/g, '').trim()
      optimizedEffects = optimizedEffects.replace(/^["']|["']$/g, '').trim()
      optimizedFirstFrame = optimizedFirstFrame.replace(/^["']|["']$/g, '').trim()
      optimizedMidFrame = optimizedMidFrame.replace(/^["']|["']$/g, '').trim()
      optimizedLastFrame = optimizedLastFrame.replace(/^["']|["']$/g, '').trim()

      const latency = Date.now() - start
      console.log(`[optimize-video-prompt] ✅ ${latency}ms, 剧情=${optimizedNarrative.length}字, 对话=${optimizedDialogue.length}字, 特效=${optimizedEffects.length}字, 首帧=${optimizedFirstFrame.length}字, 中帧=${optimizedMidFrame.length}字, 尾帧=${optimizedLastFrame.length}字`)

      // ⭐ 记录本次调用（异步不阻塞）
      incrementDailyUsage(userId, 'llm').catch(err => {
        console.warn('[optimize-video-prompt] ⚠️ 记录调用次数失败:', err.message)
      })

      return {
        success: true,
        data: {
          optimizedNarrative,
          optimizedDialogue,
          optimizedEffects,
          optimizedFirstFrame,
          optimizedMidFrame,
          optimizedLastFrame,
          // 返回剩余次数让前端显示
          quota: {
            used: (quota?.used ?? 0) + 1,
            limit: quota?.limit ?? 99,
            remaining: (quota?.remaining ?? 99) - 1,
          },
        },
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
        },
      }
    } catch (err: any) {
      console.error('[optimize-video-prompt] error:', err.message || err)
      return reply.status(500).send({
        success: false,
        error: err.message || '服务异常',
      })
    }
  })
}
