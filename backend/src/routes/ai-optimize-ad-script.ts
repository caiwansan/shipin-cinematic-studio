/**
 * ai-optimize-ad-script.ts — 广告脚本 AI 优化 API
 *
 * POST /api/ai/optimize-ad-script
 * 输入：原始广告脚本（产品卖点、目标受众、广告风格等）
 * 输出：优化后的广告剧情 + 对话/旁白 + 音效设计
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { StyleProfileService } from '../services/style-profile.service.js'
import { prisma } from '../utils/index.js'

async function getAdSystemPrompt(): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: 'ad-script-designer' },
  })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  // 默认 prompt
  return `你是一位顶级的 AI 视频生成提示词工程师。你的任务是将原始广告文案转化为简洁、精准的 AIGC 视频生成指令。

## 核心原则

⚠️ 大模型生成视频时，描述越复杂质量越差。必须使用简洁的镜头语言，每 2-3 秒一个画面。

## 输出格式

按照以下严格 JSON 格式输出：

{
  "shots": [
    {
      "shot": "Shot 1",
      "time": 3,
      "scene": "画面描述，包含机位和主体，不超过30字",
      "camera": "推/拉/摇/移/跟/升/降/固定",
      "action": "主体动作描述，不超过15字"
    },
    ...
  ],
  "narrative": "将每个 shot 按时间顺序拼接成一段连贯的镜头语言，包含运镜和画面变化，不超过 150 字",
  "optimizedDialogue": "整段旁白文案",
  "optimizedEffects": "BGM和音效，≤30字"
}

## 示例

输入："矿泉水广告，纯净天然"
输出：
{
  "shots": [
    {"shot":"Shot 1","time":3,"scene":"水滴从叶尖滑落，逆光慢镜头","camera":"微距特写，浅景深","action":"水滴晶莹坠落"},
    {"shot":"Shot 2","time":4,"scene":"一双手从泉水中捧起清水","camera":"中景推近，摇摄跟随","action":"手掌缓缓展开"},
    {"shot":"Shot 3","time":3,"scene":"年轻人仰头畅饮，水珠顺脸颊滑落","camera":"近景固定，焦点在面部","action":"喉结滚动，惬意微笑"}
  ],
  "narrative": "逆光特写下水滴从叶尖的晶莹坠落，中景镜头缓缓推近一双手捧起清泉，近景定格年轻人仰头畅饮的惬意瞬间",
  "optimizedDialogue": "纯净天然，源自深山",
  "optimizedEffects": "轻快钢琴，流水声"
}

## 规则
- **每个 scene 不超过 30 字**，包含画面主体 + 运镜方向 + 光影氛围
- 每个镜头必须写 camera 运镜方式，空镜头也要有推拉
- 总时长控制在 6-15 秒
- 如果使用参考图（图生视频），prompt 侧重描述参考图中的动态变化
- **narrative 必须是纯文本，不超过 150 字，不要嵌套 JSON 或特殊符号**
- 不要写复杂场景堆砌，一个镜头只说一件事`
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

async function getStyleDesc(style: string): Promise<string> {
  if (!style) return ''
  const profile = await StyleProfileService.getByName(style)
  return profile?.description || profile?.styleTokens || style
}

import { requireMemberTierByPolicy } from '../middleware/require-member-tier.js'

export default async function aiOptimizeAdScriptRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-ad-script', { preHandler: [app.authenticate, requireMemberTierByPolicy('aiOptimize.adScript')] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'
    const { script, style } = request.body as any

    if (!script?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 script 参数' })
    }

    const start = Date.now()
    const styleDirective = style ? `\n## 广告风格要求：${await getStyleDesc(style)}` : ''
    const userPrompt = `## 原始广告脚本/文案\n${script}${styleDirective}\n\n请按照广告短视频的风格，输出优化后的广告剧情描述、对话旁白和音效设计。`

    try {
      const systemPrompt = await getAdSystemPrompt()
      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt,
        userMessage: userPrompt,
        userId: userId || 'anonymous',
        timeoutTier: 'normal',
        maxTokens: 2048,
        temperature: 0.6,
      })

      let rawContent = gatewayResponse.content.trim()

      // 清理可能的 markdown 代码块
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim()
      }

      let narrative = ''
      let dialogue = ''
      let effects = ''
      let shots: any[] = []

      try {
        const parsed = JSON.parse(rawContent)
        // 新格式：shots 数组 + 汇总
        if (parsed.shots && Array.isArray(parsed.shots) && parsed.shots.length > 0) {
          shots = parsed.shots
          // 从 shots 拼接生成 narrative/dialogue/effects
          narrative = parsed.narrative || shots.map((s: any) => `[${s.time}s] ${s.camera} ${s.scene}`).join('\n')
          dialogue = parsed.optimizedDialogue || shots.map((s: any) => s.dialogue || '').filter(Boolean).join('\n')
          effects = parsed.optimizedEffects || shots.map((s: any) => s.effects || '').filter(Boolean).join('\n')
        } else {
          // 旧格式兼容
          if (parsed.narrative) narrative = String(parsed.narrative).trim()
          if (parsed.dialogue) dialogue = String(parsed.dialogue).trim()
          if (parsed.effects) effects = String(parsed.effects).trim()
          if (parsed.optimizedDialogue && !dialogue) dialogue = String(parsed.optimizedDialogue).trim()
          if (parsed.optimizedEffects && !effects) effects = String(parsed.optimizedEffects).trim()
        }
      } catch {
        narrative = rawContent
      }

      console.log(`[optimize-ad-script] ✅ ${Date.now() - start}ms, 镜头=${shots.length}, 剧情=${narrative.length}字, 对话=${dialogue.length}字, 特效=${effects.length}字`)

      return {
        success: true,
        data: { narrative, dialogue, effects, shots },
        meta: { latencyMs: Date.now() - start },
      }
    } catch (err: any) {
      console.error('[optimize-ad-script] error:', err.message || err)
      return reply.status(500).send({ success: false, error: err.message || '服务异常' })
    }
  })
}
