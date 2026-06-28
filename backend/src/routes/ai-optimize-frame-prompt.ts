/**
 * ai-optimize-frame-prompt.ts — 帧图提示词优化 API
 *
 * POST /api/ai/optimize-frame-prompt
 * 输入：整段剧情 + 帧图画面描述 + 帧类型 + 参考图片URLs
 * 输出：针对该帧的优化后图生图 prompt + negativePrompt
 *
 * ⭐ System prompt 从 DB PromptTemplate 读取（禁止硬编码文本文件）
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma } from '../utils/index.js'
import { StyleProfileService } from '../services/style-profile.service.js'

/**
 * ⭐ 视频风格 → 视觉特征指引
 * 从 StyleProfile 表读取（禁止硬编码）
 */

async function getFrameDesignerPrompt(): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: 'frame-designer' },
  })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  throw new Error('[ai-optimize-frame-prompt] PromptTemplate.frame-designer 在数据库中不存在或内容为空')
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

export default async function aiOptimizeFramePromptRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-frame-prompt', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = extractUserId(request) || 'anonymous'

    const body = request.body as any
    const {
      segmentNarrative,      // 整段剧情描述
      frameDescription,      // 该帧的画面描述
      frameType,             // 'first' | 'last'
      prevFrameDescription,  // ⭐ 前一帧的画面描述（帧间继承）
      prevFramePrompt,       // ⭐ 前一帧优化后的 prompt（帧间继承）
      charImages,            // 角色图片URLs []
      sceneImages,           // 场景图片URLs []
      propImages,            // 道具图片URLs []
      charDetails,           // [{ name, costume, appearance }] 角色详细特征
      sceneDetails,          // [{ name, environment }] 场景详细特征
      videoStyle,            // 视频风格：realistic|anime|3d|clay|pixel|ink|cyberpunk|watercolor
      aspectRatio,           // 画面比例：16:9|9:16|1:1|4:3
    } = body

    if (!frameDescription && !segmentNarrative) {
      return reply.status(400).send({
        success: false,
        error: '缺少必要参数 frameDescription 或 segmentNarrative',
      })
    }

    const start = Date.now()

    // ⭐ 首帧图禁止使用道具图作为参考（图生图模式，道具会干扰角色/场景生成）
    const safePropImages = propImages?.length && frameType !== 'first' ? propImages : []

    // 构造 user prompt
    let referencesSection = ''
    if (charDetails?.length) {
      referencesSection += '\n## 选中角色的详细特征\n'
      charDetails.forEach((ch: any, i: number) => {
        referencesSection += `- 角色${i + 1}（${ch.name || '未知'}）：`
        if (ch.costume) referencesSection += ` 服装="${ch.costume}"`
        if (ch.appearance) referencesSection += ` 外貌特征="${ch.appearance}"`
        referencesSection += '\n'
      })
    }
    if (sceneDetails?.length) {
      referencesSection += '\n## 选中场景的特征\n'
      sceneDetails.forEach((sc: any, i: number) => {
        referencesSection += `- 场景${i + 1}（${sc.name || '未知'}）：`
        if (sc.environment) referencesSection += ` 环境描述="${sc.environment}"`
        referencesSection += '\n'
      })
    }
    if (charImages?.length) {
      referencesSection += `\n## 角色参考图片（${charImages.length}张）`
      charImages.forEach((img: string, i: number) => {
        referencesSection += `\n- 角色图${i + 1}: ${img}`
      })
    }
    if (sceneImages?.length) {
      referencesSection += `\n## 场景参考图片（${sceneImages.length}张）`
      sceneImages.forEach((img: string, i: number) => {
        referencesSection += `\n- 场景图${i + 1}: ${img}`
      })
    }
    // ⭐ 道具图仅在尾帧中引用
    if (safePropImages?.length) {
      referencesSection += `\n## 道具参考图片（${safePropImages.length}张）`
      safePropImages.forEach((img: string, i: number) => {
        referencesSection += `\n- 道具图${i + 1}: ${img}`
      })
    }

    // ⭐ 视频风格指引 & 画面比例
    const profile = await StyleProfileService.getByName(videoStyle || 'realistic')
    const styleGuide = profile?.description || profile?.styleTokens || '写实电影风格'
    const styleDirective = videoStyle
      ? `\n## 视频风格\n当前设定的视频风格为：【${videoStyle}】\n该风格的视觉特征：${styleGuide}\n请严格按照此风格设计画面。prompt 中的光影、色彩、线条、材质、构图、渲染质感都必须与此风格一致。\n如果与剧情描述有冲突，以风格为首要约束——例如选择「水墨国风」时，即使剧情是科幻场景，也请用水墨笔触和留白来表现。`
      : ''
    const ratioDirective = aspectRatio
      ? `\n## 画面比例\n目标输出比例为 ${aspectRatio}，请在构图时考虑该比例的画面布局。`
      : ''

    const frameTypeLabel = { first: '首帧（第0秒）', last: '尾帧（最后一秒）' }[frameType] || '帧'

    // ⭐ 帧间继承：前一帧的场景设定（对 mid/last 帧提供）
    const prevFrameSection = (prevFrameDescription || prevFramePrompt)
      ? `\n## 前一帧的设定（帧间继承，必须确保与本帧保持空间一致性）
前一帧画面描述：${prevFrameDescription || '（无）'}
前一帧优化提示词：${prevFramePrompt || '（无）'}

【重要要求】请分析前一帧的场景布局（人物位置、物体摆放、空间结构），在本帧中保持连续性：
- 场景的空间布局（房间结构、家具位置、背景元素）应与前一帧一致，除非剧情明确说明场景已切换
- 人物的相对位置（站在哪儿、坐在哪儿）应合理延续
- 如果本帧与前一帧发生在同一场景，环境细节（墙壁颜色、装饰、光线方向）必须匹配
- 如果发生视角切换，请在提示词中体现合理的视角变化（如从全景切到特写），但场景本身保持一致`
      : ''

    const userPrompt = `根据以下信息，为一个视频帧优化画面提示词。输出语言为中文。${styleDirective}${ratioDirective}

## 整段剧情上下文
${segmentNarrative || '（无）'}

## 帧类型
${frameTypeLabel}

## 该帧的画面描述
${frameDescription}
${prevFrameSection}

${referencesSection}

## 输出要求（严格）
1. 【语言】prompt 和 negativePrompt 都必须用中文输出。NO English in the output.
2. 【面部】根据画面描述精确描述角色表情（眼睛、嘴巴、眉毛），不要照搬参考图片的表情
3. 【服装】使用 charDetails 中的服装/外貌，不要照搬参考图片中的服饰
4. 【场景】使用 sceneDetails 中的环境描述。参考图片仅供氛围参考，场景内容以文字描述为准
5. 【物理】角色必须自然坐在椅子上、站在地面上、靠在桌子上。身体部位不能嵌入家具、墙壁或物体中。尊重重力和物理规则
6. 帧画面描述必须与叙事时间线一致
7. 【风格】prompt 中必须体现所选视频风格的视觉特征（光影、色彩、线条、材质、构图、渲染质感）
8. 【连续性】如果提供了前一帧的设定，必须确保本帧的场景空间、人物位置与前一帧合理衔接，不能出现场景突变或人物位移不合理
${frameType === 'first' ? `9. 【首帧注意】首帧是图生图，角色已有定妆照作为 img2img 输入，prompt 中不要重复描写角色服装/身材细节，只需描写当前帧的表情/动作/氛围。首帧不要包含道具描述。` : `9. 【道具参考】如果提供了道具参考图片，请在 prompt 中描述道具在当前帧中的状态（位置、完整度、遮挡关系），但不需详尽说明道具的外观细节——道具图已提供视觉参考。`}
10. 【场景空间结构理解】你必须仔细分析场景参考图中的所有物体（桌子、椅子、鸟笼、窗户、花瓶、床、灯具、门、台阶等），理解它们的三维空间位置、大小比例和结构关系：
    - 每个物体在场景中的相对位置（前后、左右、上下关系）
    - 物体的真实比例和尺寸关系（桌子多高、椅子多大、门在哪个位置）
    - 场景的空间格局（室内/室外、房间结构、走廊走向、建筑布局）
    - 将这些空间理解融入到 prompt 中，确保生成的帧图拥有明确的三维空间感
11. 【非神话故事的人体比例约束】对于非仙侠、非神话、非奇幻的剧情（普通都市、古装、历史、生活类场景），角色人体与周边环境的比例必须严格符合现实常理：
    - 人的身高应与门、桌子、椅子、窗户等参照物保持真实比例
    - 角色的体重和体型应与剧中设定一致（不能忽胖忽瘦、忽高忽矮）
    - 角色接触环境物体时（坐椅子、靠桌子、握刀剑）肢体与物体的交互点位置必须正确
    - 行走、奔跑、跳跃等动作的幅度和频率应符合人体运动学规律
    - 如剧情明确是神话/仙侠/奇幻类（涉及法天象地、巨人、缩地成寸等），则以上约束可酌情放宽

## 输出格式（严格 JSON）
{
  "prompt": "完整的图生图提示词，中文。包含画面构图、光线氛围、角色外貌和表情、环境细节、画质描述。",
  "negativePrompt": "负面提示词，中文。包含物理约束：身体嵌入表面、肢体穿透物体、异常姿势、漂浮等"
}`

    try {
      // ⭐ 从 DB 读取 system prompt（禁止硬编码文本文件）
      const frameSystem = await getFrameDesignerPrompt()

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt: frameSystem,
        userMessage: userPrompt,
        userId: userId || 'anonymous',
        timeoutTier: 'normal',
        maxTokens: 2048,
        temperature: 0.3,
      })

      let optimized: any = null
      try {
        optimized = JSON.parse(gatewayResponse.content)
      } catch (_) {
        // Try: markdown code block (```json ... ```)
        const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (jsonMatch) {
          try { optimized = JSON.parse(jsonMatch[1].trim()) } catch (_) {}
        }
      }

      // ⭐ 如果严格解析失败，尝试宽松提取：
      // 找 { "prompt": ... 开头的 JSON 对象或 { "prompt" ... 的未格式化 JSON
      if (!optimized || !optimized.prompt) {
        // 尝试找第一个 "{ 到最后一个 }" 之间的内容
        const firstBrace = gatewayResponse.content.indexOf('{')
        const lastBrace = gatewayResponse.content.lastIndexOf('}')
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const jsonCandidate = gatewayResponse.content.substring(firstBrace, lastBrace + 1)
          try {
            optimized = JSON.parse(jsonCandidate)
          } catch (_) {
            // 尝试修复常见 JSON 格式问题：尾随逗号、单引号、缺少引号的 key
            try {
              const fixed = jsonCandidate
                .replace(/,(\s*[}\]])/g, '$1')          // 移除尾随逗号
                .replace(/'/g, '"')                       // 单引号转双引号
                .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // 未引号 key 加引号
              optimized = JSON.parse(fixed)
            } catch (_) {
              // 最终 fallback: 尝试按行提取 prompt 和 negativePrompt
              const promptLine = gatewayResponse.content.match(/["']prompt["']\s*[=:]\s*["']([^"']+)["']/)
              const negLine = gatewayResponse.content.match(/["']negativePrompt["']\s*[=:]\s*["']([^"']+)["']/)
              if (promptLine) {
                optimized = {
                  prompt: promptLine[1],
                  negativePrompt: negLine ? negLine[1] : '低质量、模糊、畸形、变形、多余肢体',
                }
              }
            }
          }
        }
      }

      if (!optimized || !optimized.prompt) {
        console.warn('[optimize-frame-prompt] ⚠️ LLM 返回格式无法解析')
        console.warn('[optimize-frame-prompt] system prompt (前500):', frameSystem.slice(0, 500))
        console.warn('[optimize-frame-prompt] user prompt (前500):', userPrompt.slice(0, 500))
        console.warn('[optimize-frame-prompt] raw response (全部):', gatewayResponse.content)
        return reply.status(422).send({
          success: false,
          error: 'LLM 返回格式无法解析',
          raw: gatewayResponse.content.slice(0, 2000),
        })
      }

      // ⭐ 后处理：检测是否有不应出现的英文（optional safeguard，主要靠 prompt）
      let finalPrompt = optimized.prompt
      let finalNegative = optimized.negativePrompt || ''

      const latency = Date.now() - start
      console.log(`[optimize-frame-prompt] ✅ ${frameType} | ${latency}ms`)

      return {
        success: true,
        data: {
          prompt: finalPrompt,
          negativePrompt: finalNegative,
        },
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
        },
      }
    } catch (err: any) {
      console.error('[optimize-frame-prompt] error:', err.message || err)
      return reply.status(500).send({
        success: false,
        error: err.message || '服务异常',
      })
    }
  })
}
