/**
 * 叙事→画面语言 LLM 分析 API
 *
 * 提供两类接口：
 * 1. 原始 analyze + simple-parse（保持兼容）
 * 2. V2 接口（analyze-v2, deep-analyze, duration, optimize-prompt, regen-spec）
 *    支持 LLM 分析 + 启发式 fallback
 *
 * ⭐ LLM 调用路径已统一走 NarrativeGateway（见 narrative-gateway.ts）
 *    不再使用 extractUserId → injectUserKey → refreshProviderApiKeys → provider.call()
 */

import { FastifyInstance } from 'fastify'

import { normalizeNarrativeSpec } from '../services/narrative/normalize-narrative-spec'
import type { AnalyzeV2Snapshot } from '../types/analyze-v2-snapshot'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma } from '../utils/index.js'
import { StyleProfileService } from '../services/style-profile.service.js'

// ⭐ 从 DB PromptTemplate 读取 prompt（禁止硬编码文本文件）
async function getDbPrompt(name: string): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({ where: { name } })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  // 宪法规定：禁止硬编码 prompt，必须从 DB 读取
  // 如果 DB 没有记录，抛错而非静默降级（迫使运维填充 DB）
  throw new Error(`[NarrativeLLM] PromptTemplate.${name} 在数据库中不存在或内容为空`)
}

/**
 * Extract user ID from request (multi-priority)
 * 1. JWT token
 * 2. projectId owner lookup
 * 3. null
 */
async function extractUserId(request: any): Promise<string | null> {
  // 1. JWT token
  try {
    const auth = request.headers.authorization as string
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7).trim()
      const decoded: any = (request.server as any).jwt.verify(token)
      if (decoded?.id) return decoded.id
    }
  } catch {}

  // 2. body projectId owner lookup
  const body = request.body as any
  if (body?.projectId) {
    try {
      const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { userId: true } })
      if (project?.userId) {
        console.log('[narrative-llm] projectId -> userId: ' + project.userId.substring(0, 12))
        return project.userId
      }
    } catch {}
  }
  if (body?.context?.projectId) {
    try {
      const project = await prisma.project.findUnique({ where: { id: body.context.projectId }, select: { userId: true } })
      if (project?.userId) return project.userId
    } catch {}
  }

  return null
}

const NARRATIVE_SYSTEM_PROMPT = `你是一个专业的电影叙事分析师。你的任务是把一段小说/故事文本拆解成可直接用于画面生成的结构化数据。

你必须严格遵守以下规则：

1. **叙事分解**：把叙事分解成原子事件序列。每个事件 = 单个物理动作。禁止复合句。
2. **视觉锚定**：每个实体的空间位置（x: -1~1, y: -1~1, depth: 0~1），必须有前景、中景、背景三层。
3. **动作翻译**：把抽象动词（"感到""思考""回忆""想象""希望"）转化为可渲染的物理动作（"站着凝视远方""转身""握紧拳头"）。
4. **相机推理**：根据情绪选择镜头：
   - calm → wide_establishing (35mm, 静态)
   - tension → medium_follow (85mm f/2.8, dolly)
   - shock → close_reaction (135mm f/1.4, 静态)
   - action → tracking_motion (50mm f/4, follow)
   - sadness → over_shoulder (50mm f/4, dolly)
   - joy → wide_establishing (35mm, orbit)
   - mystery → over_shoulder (75mm f/2.0, dolly)
5. **动作映射**：抽象行为必须有明确的物理动作对应。
6. **输出格式必须是严格的 JSON，不要任何额外文字。**

输出 schema:
{
  "title": "故事标题",
  "genre": "体裁",
  "atomicEvents": [
    {
      "eventId": "evt_0",
      "subject": "角色名",
      "action": "物理动作（必须是可渲染的）",
      "object": "对象/环境",
      "emotion": "calm|tension|shock|action|sadness|joy|mystery",
      "intensity": 0.0~1.0,
      "abstractVerbWarning": "如果有抽象动词，写在这里；否则 null"
    }
  ],
  "spatialLayouts": [
    {
      "eventId": "evt_0",
      "foreground": [{ "entityId": "name", "position": {"x": 0, "y": -0.3, "depth": 0}, "size": 0.4 }],
      "midground": [],
      "background": [{ "entityId": "环境", "position": {"x": 0, "y": 0, "depth": 1}, "size": 1.0 }],
      "relationships": ["A in_front_of B"]
    }
  ],
  "motionTranslations": [
    {
      "eventId": "evt_0",
      "entityId": "name",
      "motionType": "static|walking|turning|emitting|interacting|collapsing",
      "direction": {"x": 0, "y": 0, "z": 0},
      "intensity": 0.0~1.0,
      "originalAbstractVerb": "如果从抽象动词翻译来的，写原文"
    }
  ],
  "cameraReasoning": [
    {
      "eventId": "evt_0",
      "shotType": "wide_establishing|medium_follow|close_reaction|over_shoulder|tracking_motion",
      "framing": "tight|medium|wide",
      "lensFocalLength": 35,
      "aperture": 5.6,
      "movement": "static|dolly|follow|orbit",
      "reason": "为什么选这个镜头"
    }
  ],
  "emotionalCurve": {
    "segments": [
      {"timeIndex": 0, "emotion": "calm", "intensity": 0.1}
    ],
    "turningPoints": [2],
    "arcType": "rising|falling|wave|plateau"
  },
  "overallTone": "故事的整体基调"
}`

interface NarrativeAnalysisRequest {
  text: string
  title?: string
}

export default async function narrativeLLMRoutes(app: FastifyInstance) {

  // =====================================================
  // POST /api/v1/narrative/analyze
  // 原始 V1 分析接口
  // =====================================================
  app.post('/api/v1/narrative/analyze', async (request, reply) => {
    const userId = await extractUserId(request) || 'anonymous'
    const start = Date.now()
    const body = request.body as NarrativeAnalysisRequest
    const { text } = body

    if (!text || text.trim().length < 10) {
      return reply.status(400).send({
        success: false,
        error: '文本太短，至少 10 个字符',
      })
    }

    try {
      // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用
      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt: NARRATIVE_SYSTEM_PROMPT,
        userMessage: `请分析以下故事文本，严格按照 JSON schema 输出：\n\n${text.slice(0, 8000)}`,
        userId,
        maxTokens: 4096,
        temperature: 0.1,
        timeoutTier: 'normal',
      })

      let analysis: any = null
      try {
        const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gatewayResponse.content]
        const jsonStr = jsonMatch[1].trim()
        analysis = JSON.parse(jsonStr)
        // 解包 AI 返回的 data.data 嵌套结构
        if (analysis && analysis.data && typeof analysis.data === 'object' && !analysis.videoSegments) {
          analysis = analysis.data
        }
      } catch (parseErr) {
        console.error('[Narrative-LLM] JSON parse failed:', parseErr)
        console.log('[Narrative-LLM] Raw:', gatewayResponse.content.slice(0, 1000))
        return reply.status(422).send({
          success: false,
          error: 'LLM 返回格式无法解析',
          raw: gatewayResponse.content.slice(0, 1000),
        })
      }

      const latency = Date.now() - start

      console.log(`[Narrative-LLM] ✅ ${analysis.title || 'untitled'} | ${analysis.atomicEvents?.length || 0} events | ${latency}ms | tokens: ${gatewayResponse.totalTokens}`)

      return {
        success: true,
        data: analysis,
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
          textLength: text.length,
        },
      }
    } catch (err: any) {
      console.error('[Narrative-LLM] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // =====================================================
  // ─── AI 输出 JSON Schema 定义 ───
// AI 必须按此 schema 返回 JSON，不做格式转换
  // 前端 workbench 点击"开始AI拆解"调用
  // 返回: {success, data: {videoSegments, characters, scenes, dialogues, actions, voices}}
  // =====================================================
  app.post('/api/v1/narrative/analyze-v2', async (request, reply) => {
    const userId = await extractUserId(request) || 'anonymous'
    const body = request.body as any
    const { projectName, title, script, targetDuration } = body

    if (!script || script.trim().length < 10) {
      return reply.status(400).send({
        success: false,
        error: '剧本内容太短，至少 10 个字符',
      })
    }

    try {
      // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用
      const analyzePrompt = `剧本名称：${title || projectName || ''}

剧本全文：
${script.slice(0, 8000)}

视频总时长：${targetDuration || 60} 秒`

      let gatewayResponse
      try {
        gatewayResponse = await narrativeGateway.execute({
          systemPrompt: await getDbPrompt('六维数据拆解分析'),
          userMessage: analyzePrompt,
          userId,
          maxTokens: 8192,
          temperature: 0.1,
          timeoutTier: 'long',
        })
      } catch (executeErr: any) {
        console.error('[Narrative-analyze-v2] ⚠️ Gateway execute failed:', executeErr?.message || executeErr)
        // ⭐ Phase A: 已停止 Gateway fallback 写入 executionResults
        const fallback = heuristicAnalyzeV2(script, title || projectName, targetDuration || 60)
        const { normalized: fbNormalized, repaired: fbRepaired, heuristicFallbackUsed: fbHeuristic } = normalizeNarrativeSpec(fallback, script)
        return {
          success: true,
          data: {
            videoSegments: fbNormalized.videoSegments,
            characters: fbNormalized.characters,
            scenes: fbNormalized.scenes,
            dialogues: fbNormalized.dialogues,
            actions: fbNormalized.actions,
            voices: fbNormalized.voices,
            beats: fbNormalized.beats,
            props: fbNormalized.props,
            emotionCurve: fbNormalized.emotionCurve,
          },
        }
      }

      let analysis: any = null
      try {
        const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gatewayResponse.content]
        const jsonStr = jsonMatch[1].trim()
        analysis = JSON.parse(jsonStr)
        console.log('[Narrative-analyze-v2] DEBUG raw parse keys:', Object.keys(analysis).join(', '))
        console.log('[Narrative-analyze-v2] DEBUG has data wrapper:', !!(analysis && analysis.data && typeof analysis.data === 'object'))
        console.log('[Narrative-analyze-v2] DEBUG has direct chars:', !!(analysis && analysis.characters), 'has direct segs:', !!(analysis && analysis.videoSegments))
        // ⭐ 解包 AI 返回的 data.data 嵌套结构（模型可能包装在 { data: {...} } 中）
        if (analysis && analysis.data && typeof analysis.data === 'object' && !analysis.characters && !analysis.videoSegments) {
          analysis = analysis.data
          console.log('[Narrative-analyze-v2] DEBUG unwrapped data, new keys:', Object.keys(analysis).join(', '))
        }
      } catch (parseErr) {
        console.error('[Narrative-analyze-v2] JSON parse failed, falling back to heuristic')
        // ⭐ Phase A: 已停止 Parse fallback 写入 executionResults
        const fallback = heuristicAnalyzeV2(script, title || projectName, targetDuration || 60)
        const { normalized: fbNormalized, repaired: fbRepaired, heuristicFallbackUsed: fbHeuristic } = normalizeNarrativeSpec(fallback, script)
        return {
          success: true,
          data: {
            videoSegments: fbNormalized.videoSegments,
            characters: fbNormalized.characters,
            scenes: fbNormalized.scenes,
            dialogues: fbNormalized.dialogues,
            actions: fbNormalized.actions,
            voices: fbNormalized.voices,
            beats: fbNormalized.beats,
            props: fbNormalized.props,
            emotionCurve: fbNormalized.emotionCurve,
          },
        }
      }

      // ========================================================
      // ⭐ NARRATIVE SNAPSHOT CONSTITUTION
      // Phase 3: Normalize AI output, build AnalyzeV2Snapshot, persist to DB.
      // ========================================================

      // 1. Normalize the raw AI response into a canonical NarrativeSpec
      const { normalized: normalizedSpec, repaired, heuristicFallbackUsed } = normalizeNarrativeSpec(analysis, script)

      // 2. Build the immutable AnalyzeV2Snapshot
      const snapshot: AnalyzeV2Snapshot = {
        version: 'v2',
        createdAt: new Date().toISOString(),
        rawAiResponse: analysis,
        normalized: normalizedSpec,
        parserMeta: {
          parserVersion: '1.0.0',
          repaired,
          heuristicFallbackUsed,
        },
        executionMeta: {
          model: gatewayResponse.provider,
          latency: Date.now() - (body._startTime || Date.now()),
          tokens: gatewayResponse.totalTokens,
        },
      }

      console.log(`[Narrative-analyze-v2] ✅ ${title || projectName} | ${normalizedSpec.videoSegments.length} segs, ${normalizedSpec.characters.length} chars, ${normalizedSpec.beats.length} beats, ${normalizedSpec.props.length} props, ${normalizedSpec.emotionCurve?.length || 0} emotions`)
      if (analysis?.emotionCurve) {
        console.log('[Narrative-analyze-v2] DEBUG raw emotionCurve:', JSON.stringify(analysis.emotionCurve.slice(0, 3)))
      } else {
        console.log('[Narrative-analyze-v2] DEBUG raw emotionCurve is missing. raw keys:', Object.keys(analysis).join(', '))
      }
      if (normalizedSpec.characters?.length) {
        console.log('[Narrative-analyze-v2] characters names:', normalizedSpec.characters.map((c: any) => c.name))
      }
      if (normalizedSpec.scenes?.length) {
        console.log('[Narrative-analyze-v2] scenes names:', normalizedSpec.scenes.map((s: any) => s.name))
      }

      // ⭐ Phase A: 已停止持久化到 executionResults
      // PipelineMaterializer 会自动从 ScriptBreakdown submit 管道写 PipelineStage
      // executionResults 不再作为业务运行时数据源

      // 4. Return the normalized spec to frontend
      return {
        success: true,
        data: {
          videoSegments: normalizedSpec.videoSegments,
          characters: normalizedSpec.characters,
          scenes: normalizedSpec.scenes,
          dialogues: normalizedSpec.dialogues,
          actions: normalizedSpec.actions,
          voices: normalizedSpec.voices,
          beats: normalizedSpec.beats,
          props: normalizedSpec.props,
          emotionCurve: normalizedSpec.emotionCurve,
        },
      }
    } catch (err: any) {
      console.error('[Narrative-analyze-v2] Error:', err)
      const fb2 = heuristicAnalyzeV2(script, title || projectName, targetDuration || 60)
      // ⭐ Phase A: 已停止 fallback 写入 executionResults
      return {
        success: true,
        data: {
          videoSegments: fb2Norm.videoSegments,
          characters: fb2Norm.characters,
          scenes: fb2Norm.scenes,
          dialogues: fb2Norm.dialogues,
          actions: fb2Norm.actions,
          voices: fb2Norm.voices,
          beats: fb2Norm.beats,
          props: fb2Norm.props,
          emotionCurve: fb2Norm.emotionCurve,
        },
      }
    }
  })

  // =====================================================
  // POST /api/v1/narrative/deep-analyze — 深度分析（制作规格书）
  // 前端 SpecificationWorkspace 页面调用
  // 返回: {success, data: {content, narrative}, meta: {totalMs}}
  // =====================================================
  app.post('/api/v1/narrative/deep-analyze', async (request, reply) => {
    const userId = await extractUserId(request) || 'anonymous'
    const body = request.body as any
    const { text, title, genre, visualStyle, aspectRatio, targetDuration, executionId, source } = body

    if (!text || text.trim().length < 10) {
      return reply.status(400).send({
        success: false,
        error: '文本太短',
      })
    }

    try {
      // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用
      const aigcPrompt = await getDbPrompt('aigc-prompt')
      const specPrompt = `${aigcPrompt}\n\n故事标题: ${title || '未命名'}\n故事体裁: ${genre || '古风'}\n视觉风格: ${visualStyle || 'realistic'}\n画面比例: ${aspectRatio || '9:16'}\n目标时长: ${targetDuration || 60} 秒\n\n故事文本:\n${text.slice(0, 8000)}`

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt: await getDbPrompt('aigc-prompt'),
        userMessage: specPrompt,
        userId,
        maxTokens: 8192,
        temperature: 0.1,
        timeoutTier: 'long',
      })

      const startTime = Date.now()
      let rawContent = gatewayResponse.content
      let narrative = null

      try {
        const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gatewayResponse.content]
        const jsonStr = jsonMatch[1].trim()
        narrative = JSON.parse(jsonStr)
      } catch (parseErr) {
        console.warn('[deep-analyze] JSON parse failed, returning raw content')
      }

      // 如果没有 beats，尝试从 AIGC 格式提取
      if (narrative && !narrative.beats) {
        if (narrative.videoSegments) {
          narrative.beats = narrative.videoSegments.flatMap((seg: any, i: number) => {
            if (seg.beats && seg.beats.length > 0) {
              return seg.beats.map((beat: any, j: number) => ({
                id: `bt_${i}_${j}`,
                label: `${seg.title} - 拍${j + 1}`,
                startSecond: beat.start || (i * 10 + j * 5),
                endSecond: beat.end || (i * 10 + (j + 1) * 5),
                emotion: beat.emotion || seg.emotion || 'calm',
                intensity: 0.5,
                scene: seg.scene || '',
                characters: [],
                summary: beat.visual || '',
              }))
            }
            return []
          })
        }
        if (!narrative.characters && narrative.characterSpecs) {
          narrative.characters = narrative.characterSpecs.map((c: any) => ({
            name: c.characterName,
            description: c.physicalDescription || '',
            costume: c.clothing || '',
          }))
        }
        if (!narrative.scenes && narrative.sceneSpecs) {
          narrative.scenes = narrative.sceneSpecs.map((s: any) => ({
            name: s.sceneName,
            environment: s.description || '',
            description: s.description || '',
          }))
        }
        // ⭐ 兼容转换：voiceConfigs → voices
        if (!narrative.voices && narrative.voiceConfigs) {
          narrative.voices = narrative.voiceConfigs.map((v: any, i: number) => ({
            id: `vc_${i}`,
            characterName: v.characterName || `角色 ${i + 1}`,
            voiceType: v.voiceType || '默认',
            pitch: v.pitch || 1.0,
            speed: v.speed || 1.0,
            description: v.speakingStyle || v.ttsPrompt || '',
          }))
        }
        // ⭐ 兼容转换：emotionSpecs → emotionCurve
        if (!narrative.emotionCurve && narrative.emotionSpecs) {
          narrative.emotionCurve = narrative.emotionSpecs.map((e: any, i: number) => ({
            timeIndex: i * 10,
            emotion: e.emotionType || '平静',
            intensity: e.intensity === '轻微' ? 0.3 : e.intensity === '中等' ? 0.5 : e.intensity === '强烈' ? 0.8 : e.intensity === '爆发' ? 1.0 : 0.5,
            characterName: e.characterName || '',
          }))
        }
        // ⭐ 兼容转换：从 videoSegments 提取道具
        if (!narrative.props || narrative.props.length === 0) {
          narrative.props = []
          // 尝试从 characterSpecs.clothing 提取道具
          if (narrative.characterSpecs) {
            for (const c of narrative.characterSpecs) {
              if (c.clothing) {
                narrative.props.push({
                  name: `${c.characterName}的服装`,
                  category: '服装',
                  associatedScene: '',
                  description: c.clothing,
                })
              }
            }
          }
        }
      }

      // ⭐ 即使 AI 已返回 beats，也确保 characters/summary/intensity 字段存在
      if (narrative?.beats) {
        narrative.beats = narrative.beats.map((b: any) => ({
          ...b,
          characters: b.characters || [],
          intensity: b.intensity ?? 0.5,
          summary: b.summary || b.visual?.slice(0, 30) || '',
        }))
      }

      // ⭐ 确保所有标准字段有默认值（即使 AI 没输出）
      if (!narrative.props) narrative.props = []
      if (!narrative.emotionCurve) narrative.emotionCurve = []
      if (!narrative.voices) narrative.voices = []
      if (!narrative.characters) narrative.characters = []
      if (!narrative.scenes) narrative.scenes = []
      if (!narrative.beats) narrative.beats = []

      return {
        success: true,
        data: {
          content: rawContent,
          narrative,
        },
        meta: {
          totalMs: Date.now() - startTime,
        },
      }
    } catch (err: any) {
      console.error('[deep-analyze] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // =====================================================
  // GET /api/v1/narrative/duration — 读取持久化时长
  // PUT /api/v1/narrative/duration — 保存持久化时长
  // =====================================================
  const durationStore = new Map<string, number>()

  app.get('/api/v1/narrative/duration', async (request, reply) => {
    const query = request.query as any
    const projectId = query.projectId

    if (projectId && durationStore.has(projectId)) {
      return {
        success: true,
        data: { targetDuration: durationStore.get(projectId) },
      }
    }

    return {
      success: true,
      data: { targetDuration: null },
    }
  })

  app.put('/api/v1/narrative/duration', async (request, reply) => {
    const body = request.body as any
    const { projectId, targetDuration } = body

    if (projectId && targetDuration) {
      durationStore.set(projectId, targetDuration)
    }

    return {
      success: true,
      data: { saved: true },
    }
  })

  // =====================================================
  // POST /api/v1/narrative/optimize-prompt — prompt 优化
  // =====================================================
  app.post('/api/v1/narrative/optimize-prompt', async (request, reply) => {
    const body = request.body as any
    const { prompt, type } = body

    if (!prompt) {
      return reply.status(400).send({
        success: false,
        error: '缺少 prompt',
      })
    }

    return {
      success: true,
      data: {
        optimized: prompt,
        suggestions: [],
      },
    }
  })

  // =====================================================
  // POST /api/v1/narrative/regen-spec — AI 优化角色/场景 prompt
  // =====================================================
  app.post('/api/v1/narrative/regen-spec', async (request, reply) => {
    const body = request.body as any
    const { type, data, context } = body

    if (!type || !data) {
      return reply.status(400).send({
        success: false,
        error: '缺少 type 或 data',
      })
    }

    const userId = await extractUserId(request) || 'anonymous'
    const storyText = context?.storyText || ''

    try {
      if (type === 'character') {
        const { characterName, description, personality, costume, imagePrompt } = data
        const visualStyle = (body.visualStyle || body.videoStyle || 'realistic') as string
        // ⭐ 风格关键词从 StyleProfile 动态读取（禁止硬编码）
        const profile = await StyleProfileService.getByName(visualStyle)
        const styleSuffix = profile?.styleTokens || '写实真人照片级，不卡通，电影级画质'
        const systemPrompt = `你是一个专业的角色视觉设计师。根据角色描述，生成高质量的 AI 图片生成 prompt。

规则：
1. 返回 JSON：{ "imagePrompt": "中文 prompt（描述角色外貌、服装、气质、光线、构图、艺术风格）", "negativePrompt": "负面提示词" }
2. imagePrompt 用中文描述，包含：角色外貌特征、服装细节、气质表情、光线氛围、镜头构图、艺术风格
3. 长度 100-200 个中文字
4. 不要包含不相关的背景故事描述
5. 中文 prompt 必须追加风格后缀，风格后缀由下方调用者提供：单人，仅此一人，全身定妆照，静态站姿，以及对应的视觉风格描述`

        const userPrompt = `角色名: ${characterName || ''}
描述: ${description || ''}
性格: ${personality || ''}
服装: ${costume || ''}
当前 prompt: ${imagePrompt || ''}
故事背景: ${storyText.slice(0, 500)}

请生成优化后的图片生成 prompt（JSON 格式），并在 imagePrompt 末尾追加以下风格描述：
单人，仅此一人，全身定妆照，静态站姿，${styleSuffix}`

        // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用
        const gatewayResponse = await narrativeGateway.execute({
          systemPrompt,
          userMessage: userPrompt,
          userId,
          maxTokens: 1024,
          temperature: 0.7,
          timeoutTier: 'normal',
        })

        try {
          const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gatewayResponse.content]
          const jsonStr = jsonMatch[1].trim()
          const result = JSON.parse(jsonStr)
          return {
            success: true,
            data: {
              imagePrompt: result.imagePrompt || '',
              negativePrompt: result.negativePrompt || '',
            },
          }
        } catch {
          return {
            success: true,
            data: {
              imagePrompt: gatewayResponse.content.trim().slice(0, 500),
              negativePrompt: '',
            },
          }
        }
      }

      // 场景 prompt 优化（同理）
      if (type === 'scene') {
        const { sceneName, description } = data
        const userPrompt = `场景名: ${sceneName || ''}
描述: ${description || ''}
故事背景: ${storyText.slice(0, 500)}

请生成详细的场景图片生成 prompt（JSON 格式），包含环境、光线、色调、氛围。`

        // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用
        const gatewayResponse = await narrativeGateway.execute({
          systemPrompt: '你是一个专业的场景设计师。根据场景描述生成高质量的 AI 图片生成 prompt。返回 JSON：{ "imagePrompt": "中文 prompt，必须包含：环境描述、光线、色调、氛围、构图", "negativePrompt": "负面提示词" }。场景图中禁止出现任何人、动物、角色。imagePrompt 末尾必须追加：空场景，无人物，无角色，自然环境，仅场景本身',
          userMessage: userPrompt,
          userId,
          maxTokens: 1024,
          temperature: 0.7,
          timeoutTier: 'normal',
        })

        try {
          const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gatewayResponse.content]
          const jsonStr = jsonMatch[1].trim()
          const result = JSON.parse(jsonStr)
          return {
            success: true,
            data: {
              imagePrompt: result.imagePrompt || '',
              negativePrompt: result.negativePrompt || '',
            },
          }
        } catch {
          return {
            success: true,
            data: {
              imagePrompt: gatewayResponse.content.trim().slice(0, 500),
              negativePrompt: '',
            },
          }
        }
      }

      return reply.status(400).send({
        success: false,
        error: `不支持的类型: ${type}`,
      })
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // =====================================================
  // 启发式分析 fallback（不依赖 LLM）
  // =====================================================
  function heuristicAnalyzeV2(script: string, title: string, targetDuration: number) {
    const sentences = script.split(/[。！？\n]+/).filter((s: string) => s.trim().length > 5)
    const segmentCount = Math.max(1, Math.min(sentences.length, 6))
    const segDuration = Math.max(5, Math.floor(targetDuration / segmentCount))

    const videoSegments = Array.from({ length: segmentCount }, (_, i) => {
      const s = sentences[i] || ''
      const hasAction = ['打', '跑', '走', '看', '说', '拿', '放', '跳', '飞', '追', '望', '站', '坐', '抓'].some(v => s.includes(v))
      const emotion: string = s.includes('怒') ? 'tension' :
        s.includes('悲') || s.includes('哭') ? 'sadness' :
        s.includes('笑') || s.includes('喜') ? 'joy' :
        s.includes('惊') || s.includes('吓') ? 'mystery' :
        hasAction ? 'action' : 'calm'
      return {
        id: `seg_${i}`,
        title: `段落 ${i + 1}`,
        duration: segDuration,
        scene: s.slice(0, 30) + '...',
        emotion,
        beats: [{
          start: i * segDuration,
          end: (i + 1) * segDuration,
          camera: emotion === 'calm' ? '中景固定' : emotion === 'action' ? '跟拍' : '特写',
          visual: s.slice(0, 50),
          dialogue: '',
          sound: emotion === 'action' ? '背景音乐+环境音' : '环境音',
          emotion,
        }],
        transition: i < segmentCount - 1 ? '淡出' : '无',
      }
    })

    // 提取可能的角色名（"XX说/道"模式）
    const nameCandidates: string[] = []
    const nameRegex = /([\u4e00-\u9fa5]{2,4})(?:说|道|问|答|喊|叫|走|来|去|看|听|站|坐)/g
    let match
    while ((match = nameRegex.exec(script)) !== null) {
      if (!nameCandidates.includes(match[1])) nameCandidates.push(match[1])
    }

    const characters = nameCandidates.slice(0, 4).map((name, i) => ({
      name,
      gender: i % 2 === 0 ? '男' : '女',
      age: '青年',
      role: i === 0 ? '主角' : i === 1 ? '配角' : '配角',
      description: '',
      clothing: '',
      personality: '',
      voiceType: i % 2 === 0 ? '沉稳' : '温柔',
    }))
    if (characters.length === 0) {
      characters.push({
        name: '主角',
        gender: '男',
        age: '青年',
        role: '主角',
        description: '根据剧本内容自动生成',
        clothing: '',
        personality: '',
        voiceType: '沉稳',
      })
    }

    const scenes = [{
      id: 'sc_0',
      name: '主场景',
      description: '根据剧本内容生成',
      environment: '室内',
      timeOfDay: '白天',
      lighting: '自然光',
      mood: '平静',
      colorTone: '自然色调',
    }]

    return {
      success: true,
      data: {
        videoSegments,
        characters,
        scenes,
        // ── 补齐前端依赖的顶层字段 ──
        beats: videoSegments.flatMap((seg, si) =>
          seg.beats.map((beat, bi) => ({
            id: `bt_${si}_${bi}`,
            label: `${seg.title} - 拍${bi + 1}`,
            start: beat.start,
            end: beat.end,
            startSecond: beat.start,
            endSecond: beat.end,
            camera: beat.camera,
            visual: beat.visual,
            dialogue: beat.dialogue || '',
            sound: beat.sound || '',
            emotion: beat.emotion || seg.emotion || 'calm',
            scene: seg.scene || '',
            characters: [],
            intensity: 0.5,
            summary: beat.visual?.slice(0, 30) || '',
          }))
        ),
        props: [],
        emotionCurve: videoSegments.map((seg, i) => ({
          timeIndex: i,
          emotion: seg.emotion || 'calm',
          intensity: 0.5,
        })),
        dialogues: videoSegments.map(seg => ({
          segmentId: seg.id,
          characterName: characters[0]?.name || '角色',
          text: '',
          emotion: seg.emotion,
          timing: '自动',
        })),
        actions: videoSegments.flatMap(seg => characters.map(ch => ({
          segmentId: seg.id,
          characterName: ch.name,
          action: '待定',
          duration: 3,
        }))),
        voices: characters.map(ch => ({
          characterName: ch.name,
          voiceType: ch.voiceType || '沉稳',
          pitch: 1.0,
          speed: 1.0,
          description: `${ch.name}的音色`,
        })),
      },
    }
  }

  // =====================================================
  // POST /api/v1/narrative/simple-parse
  // 轻量分析（不调 LLM，用启发式）
  // =====================================================
  app.post('/api/v1/narrative/simple-parse', async (request, reply) => {
    const body = request.body as NarrativeAnalysisRequest
    const { text } = body

    if (!text) {
      return reply.status(400).send({ success: false, error: '缺少文本' })
    }

    // 用换行/句号分段
    const sentences = text.split(/[。！？\n]+/).filter(s => s.trim().length > 5)
    const events = sentences.map((s, i) => {
      const hasAction = ['打', '跑', '走', '看', '说', '拿', '放', '跳', '飞', '追'].some(v => s.includes(v))
      const hasEmotion = ['愤怒', '悲伤', '快乐', '恐惧', '惊讶', '紧张', '平静'].some(v => s.includes(v))

      return {
        eventId: `evt_${i}`,
        subject: 'unknown',
        action: hasAction ? s.trim().slice(0, 20) : 'static',
        object: 'unknown',
        emotion: hasEmotion ? 'tension' : 'calm',
        intensity: hasAction ? 0.7 : 0.3,
        abstractVerbWarning: null,
      }
    })

    return {
      success: true,
      data: {
        title: body.title || '未命名',
        genre: 'auto',
        atomicEvents: events,
        spatialLayouts: events.map((_, i) => ({
          eventId: `evt_${i}`,
          foreground: [{ entityId: 'subject', position: { x: 0, y: -0.3, depth: 0 }, size: 0.4 }],
          midground: [],
          background: [{ entityId: 'background', position: { x: 0, y: 0, depth: 1 }, size: 1.0 }],
          relationships: [],
        })),
        motionTranslations: events.map((e, i) => ({
          eventId: `evt_${i}`,
          entityId: e.subject,
          motionType: e.action === 'static' ? 'static' : 'walking',
          direction: { x: 0, y: 0, z: 0 },
          intensity: e.intensity,
          originalAbstractVerb: null,
        })),
        cameraReasoning: events.map((e, i) => ({
          eventId: `evt_${i}`,
          shotType: e.emotion === 'calm' ? 'wide_establishing' : 'medium_follow',
          framing: 'medium',
          lensFocalLength: e.emotion === 'calm' ? 35 : 85,
          aperture: e.emotion === 'calm' ? 5.6 : 2.8,
          movement: 'static',
          reason: 'auto',
        })),
        emotionalCurve: {
          segments: events.map((e, i) => ({ timeIndex: i, emotion: e.emotion, intensity: e.intensity })),
          turningPoints: [],
          arcType: 'plateau',
        },
        overallTone: 'auto',
      },
      meta: { method: 'heuristic', textLength: text.length },
    }
  })
}
