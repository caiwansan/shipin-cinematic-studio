import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 叙事→画面语言 LLM 分析 API
 *
 * ETFL-EDCL: ORCHESTRATION DOMAIN
 * - 禁止直接调用 model/provider/adapter
 * - 仅允许通过 narrativeGateway 进行 LLM 调用（编排层）
 * - 输出 execution plan，不直接执行
 *
 * API routes (不变)：
 *   POST /api/v1/narrative/analyze    → Gateway Runtime (ORCHESTRATION)
 *   POST /api/v1/narrative/simple-parse → 启发式（不调 LLM）
 *   POST /api/v1/narrative/aigc-spec   → AigcSpecAgent (ORCHESTRATION)
 */

import { FastifyInstance } from 'fastify'
import { aigcOrchestrator } from '../agents/aigc-orchestrator.js'
import { checkLLMQuota } from '../services/with-user-key.js'
import { incrementDailyUsage } from '../services/usage-quota.service.js'
import { narrativeGateway, NarrativeLLMGateway } from '../runtime/narrative-gateway.js'
import { modelAdapterRegistry } from '../model-adapters/index.js'
import { loadFullConfigV2 } from '../config/v2.js'
import { decryptKey } from '../services/crypto.service.js'
import { getProviderStateService } from '../runtime/provider-state/index.js'
import { aigcSpecAgent } from '../agents/aigc-spec-agent.js'
import { safeJsonParse } from '../runtime/execution-guard.js'

const NARRATIVE_SYSTEM_PROMPT = `你是一名专业的影视叙事分析引擎。你的任务是把一段小说/故事文本拆解成可直接用于画面生成的结构化数据——原子事件序列（每个事件对应一个可拍摄的物理动作）。

【核心原则】
1. 只输出纯 JSON，不要任何额外文字、解释、分析。禁止使用 markdown 代码块。JSON 的开始必须是 {，结束必须是 }，中间不能有杂音。
2. 把叙事分解成原子事件序列。每个事件 = 单个物理动作。禁止复合句。宁可事件少而精，不要强行编造。
3. 每个实体必须有空间位置（x: -1~1, y: -1~1, depth: 0~1），必须有前景、中景、背景三层。
4. 把抽象动词（"感到""思考""回忆""想象""希望"）转化为可渲染的物理动作（"站着凝视远方""转身""握紧拳头"）。
5. 用专业影视镜头语言描述：景别（特写/近景/中景/全景/远景）、机位（正打/反打/俯拍/仰拍/过肩）、焦距（广角/标准/长焦）、运动方式（推/拉/摇/移/跟/升/降）；情绪-镜头映射规则如下：
   - calm → wide_establishing (35mm, 静态)
   - tension → medium_follow (85mm f/2.8, dolly)
   - shock → close_reaction (135mm f/1.4, 静态)
   - action → tracking_motion (50mm f/4, follow)
   - sadness → over_shoulder (50mm f/4, dolly)
   - joy → wide_establishing (35mm, orbit)
   - mystery → over_shoulder (75mm f/2.0, dolly)

【★★★ 关键：subject 限定规则 ★★★】
atomicEvents 中的 "subject" 字段必须严格遵循以下规则：
   - calm → wide_establishing (35mm, 静态)
   - tension → medium_follow (85mm f/2.8, dolly)
   - shock → close_reaction (135mm f/1.4, 静态)
   - action → tracking_motion (50mm f/4, follow)
   - sadness → over_shoulder (50mm f/4, dolly)
   - joy → wide_establishing (35mm, orbit)
   - mystery → over_shoulder (75mm f/2.0, dolly)
5. **动作映射**：抽象行为必须有明确的物理动作对应。
6. **只输出纯 JSON，不要任何额外文字、解释、分析。禁止使用 markdown 代码块。JSON 的开始必须是 {，结束必须是 }，中间不能有杂音。**

【★★★ 关键：subject 限定规则 ★★★】
atomicEvents 中的 "subject" 字段必须严格遵循以下规则：
- **只能填写人格化角色/人物/生灵的名字**（如"张三"、"孙悟空"、"百花仙子"、"一条狗"）
- **绝对不能填** "画面"、"镜头"、"场景"、"故事"、"旁白"、"叙述"、"视角"、"摄像机"、"画面中" 等无关元描述词
- 如果某句话/段落没有具体人格化角色在行动，而是描述环境/风景/氛围/过渡，请直接省略该事件，不要强行编造 subject
- **宁可事件少，也不能有错误的 subject**

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
  genre?: string          // ⭐ 剧本风格：古风/仙侠/现代/科幻/奇幻等
  visualStyle?: string    // ⭐ 视觉风格：电影写实/动画/水墨等
}

export default async function narrativeLLMRoutes(app: FastifyInstance) {
  // ============================================================
  // POST /api/v1/narrative/analyze — 用 Gateway Runtime 分析叙事
  // ============================================================
  app.post('/api/v1/narrative/analyze', { preHandler: [app.authenticate] }, async (request, reply) => {
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
      // ===== 配额检查 =====
      const quota = await checkLLMQuota(request)
      if (!quota.canProceed) {
        return reply.status(403).send({ success: false, error: quota.message })
      }

      const userId = (request.user as any)?.id || 'anonymous'

      // 检查前作资料（续集一致性系统）
      const query = request.query as any
      const continuationProjectId = body.title 
        ? await findContinuationRefs(request)
        : null
      let refContext = ''
      if (continuationProjectId) {
        const refs = await loadProjectRefs(continuationProjectId)
        if (refs) refContext = refs
      }
      if (!refContext && query.previousProjectId) {
        const refs = await loadProjectRefs(query.previousProjectId)
        if (refs) refContext = refs
      }

      // 组装提示词
      const userPrompt = refContext
        ? `【前作角色/场景资料库】\n${refContext}\n\n---\n\n请分析以下故事文本（续集），续写并严格遵循前作已建立的角色和场景设定：\n\n${text.slice(0, 8000)}`
        : `请分析以下故事文本，严格按照 JSON schema 输出：\n\n${text.slice(0, 8000)}`

      // ===== 通过 Gateway 执行 LLM 调用 =====
      const gatewayResult = await narrativeGateway.execute({
        systemPrompt: NARRATIVE_SYSTEM_PROMPT,
        userMessage: userPrompt,
        userId,
        projectId: body.title || 'narrative',
        timeoutTier: 'normal',
      })

      const content = gatewayResult.content

      // 解析 JSON — 永不中断，失败有 fallback
      if (!content.includes('{') || !content.includes('}')) {
        console.warn('[Narrative-LLM] ⚠️ LLM 输出不含 JSON 结构, 前500字符:', content.slice(0, 500))
      }
      let { parsed: analysis, degraded: jsonDegraded } = safeJsonParse(content, null)
      if (jsonDegraded) {
        console.warn('[Narrative-LLM] ⚠️ JSON 解析失败, 前300字符:', content.slice(0, 300), '...后100字符:', content.slice(-100))
      }
      if (jsonDegraded || !analysis) {
        // 如果已触发 gateway degrade
        if (gatewayResult.degraded) {
          return {
            success: true,
            degraded: true,
            jobId: gatewayResult.jobId,
            next: 'aigc_pipeline_continue',
            meta: {
              totalMs: Date.now() - start,
              upstreamMs: gatewayResult.latency,
              systemMs: 0,
              totalTokens: 0,
              textLength: text.length,
              provider: gatewayResult.provider,
              fallbackUsed: gatewayResult.fallbackUsed,
              traceId: gatewayResult.traceId,
              gatewayMode: 'async_degrade',
              jobId: gatewayResult.jobId,
            },
          }
        }

        // 非 degrade 时用结构化 fallback
        analysis = {
          title: '解析中',
          genre: '通用',
          overallTone: '待分析',
          emotionalCurve: { arcType: 'rising' },
          atomicEvents: [],
          cameraReasoning: [],
        }
        console.warn('[Narrative-LLM] JSON parse degraded, using placeholder')
      }

      const latency = Date.now() - start

      // 非 VIP 用户消耗免费配额
      if (userId && userId !== 'anonymous') {
        const user = await (await import('../utils/index.js')).prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
        if (user && (user.memberTier === 'free' || user.memberTier === 'basic')) {
          await incrementDailyUsage(userId, 'llm').catch(() => {})
        }
      }

      console.log(`[Narrative-LLM] ✅ ${analysis.title || 'untitled'} | ${analysis.atomicEvents?.length || 0} events | ${latency}ms | tokens: ${gatewayResult.totalTokens}`)

      const upstreamMs = gatewayResult.latency
      const systemMs = latency - upstreamMs

      // backward compatible response shape
      const response: any = {
        success: true,
        data: analysis,
        meta: {
          totalMs: latency,
          upstreamMs,
          systemMs,
          totalTokens: gatewayResult.totalTokens,
          textLength: text.length,
          provider: gatewayResult.provider,
          // 新增 gateway meta
          fallbackUsed: gatewayResult.fallbackUsed,
          traceId: gatewayResult.traceId,
          gatewayMode: gatewayResult.asyncJobId ? 'async_degrade' : 'sync',
        },
      }

      // 如果是异步降级模式，携带 jobId
      if (gatewayResult.asyncJobId) {
        response.meta.jobId = gatewayResult.asyncJobId
        response.meta.asyncMessage = '任务已加入异步队列，请稍后查看结果'
      }

      return response
    } catch (err: any) {
      console.error('[Narrative-LLM] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // ============================================================
  // POST /api/v1/narrative/simple-parse — 轻量分析（不调 LLM）
  // ============================================================
  app.post('/api/v1/narrative/simple-parse', async (request, reply) => {
    const body = request.body as NarrativeAnalysisRequest
    const { text } = body

    if (!text) {
      return reply.status(400).send({ success: false, error: '缺少文本' })
    }

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

  // ============================================================
  // POST /api/v1/narrative/aigc-spec — AigcSpecOrchestrator v2（多 Agent 架构）
  // ============================================================
  app.post('/api/v1/narrative/aigc-spec', async (request, reply) => {
    const body = request.body as NarrativeAnalysisRequest & { aspectRatio?: string; section?: string; existingSpec?: any }
    const { text, title, aspectRatio, genre, visualStyle, section, existingSpec } = body

    if (!text || text.trim().length < 10) {
      return reply.status(400).send({
        success: false,
        error: '文本太短，至少 10 个字符',
      })
    }

    try {
      const quota = await checkLLMQuota(request)
      if (!quota.canProceed) {
        return reply.status(403).send({ success: false, error: quota.message })
      }

      const result = await aigcOrchestrator.generate({ text, title, aspectRatio, genre, visualStyle, section, existingSpec })

      if (!result.success) {
        console.error('[AIGC-Spec] Orchestrator failed:', result.error)
        return reply.status(500).send({
          success: false,
          error: result.error || 'Agent 编排生成失败',
        })
      }

      const userId = (request.user as any)?.id
      if (userId) {
        const user = await (await import('../utils/index.js')).prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
        if (user && (user.memberTier === 'free' || user.memberTier === 'basic')) {
          await incrementDailyUsage(userId, 'llm').catch(() => {})
        }
      }

      const agentStats = result.meta?.agentStats || {}
      const agentSummary = Object.entries(agentStats).map(([k, v]: [string, any]) => `${k}=${v.success ? '✅' : '❌'}`).join(' ')

      console.log(`[AIGC-Spec] ✅ Generated | ${agentSummary} | ${result.meta?.latencyMs}ms`)

      return {
        success: true,
        data: result.data,
        meta: {
          latencyMs: result.meta?.latencyMs,
          totalTokens: 0,
          textLength: text.length,
          agentStats: result.meta?.agentStats,
        },
      }
    } catch (err: any) {
      console.error('[AIGC-Spec] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // ============================================================
  // POST /api/v1/narrative/storyboard-prompt — LLM 生成标准分镜图 prompt
  // ============================================================
  app.post('/api/v1/narrative/storyboard-prompt', async (request, reply) => {
    const body = request.body as {
      title: string
      narrativePurpose: string
      shotPattern: string
      emotionArc: string
      characters: { name: string; clothing: string; props: string; appearance: string; physicalDescription?: string; gender?: string; age?: string; pose?: string; emotion?: string; personality?: string }[]
      scenes: { name: string; description: string; imagePrompt?: string; type?: string; lighting?: string; atmosphere?: string }[]
      aspectRatio?: string
      aigcSpec?: string          // 前端构建的 AIGC 规格表文本
      referenceImages?: { characters?: string[]; scenes?: string[] }
      rawScript?: string         // ⭐ 原始剧本全文
      segmentContext?: any       // 当前段落在原始规格表中的完整数据
      prevSegmentTitle?: string  // 前一段落标题
      nextSegmentTitle?: string  // 后一段落标题
      genre?: string             // ⭐ 剧本风格：古风/仙侠等
      fullSpecTables?: {         // ⭐ 完整规格表
        effectSpecs?: any[]
        actionSpecs?: any[]
        cameraSpecs?: any[]
        emotionSpecs?: any[]
      }
    }
    const { title, narrativePurpose, shotPattern, emotionArc, characters, scenes, aspectRatio, aigcSpec, referenceImages, rawScript, segmentContext, prevSegmentTitle, nextSegmentTitle, fullSpecTables, genre } = body

    try {
      const quota = await checkLLMQuota(request)
      if (!quota.canProceed) {
        return reply.status(403).send({ success: false, error: quota.message })
      }

      const userId = (request.user as any)?.id || 'anonymous'

      const systemPrompt = `你是一个专业的 AIGC 影视分镜提示词工程师。你的任务是根据给定的段落信息、角色设定、场景设定，生成一个可用于火山引擎 Seedream/豆包文生图模型的标准分镜图 prompt。

你必须严格遵守以下规则：
1. 输出必须是一个严格有效的 JSON，不要任何额外文字或代码块标记。
2. JSON 包含两个字段：prompt (正向提示词) 和 negativePrompt (负面提示词)
3. 正向提示词必须包含：画面主体（角色在做什么）、角色姿态和位置、服装道具、场景环境、光线/色调、镜头角度/景别、情绪氛围
4. 正向提示词使用自然中文描述，避免表格化/项目符号，写成一段流畅的画面描述
5. 正向提示词末尾加质量词：4K, highly detailed, cinematic lighting, 影视级画质, 写实风格
6. 负面提示词包含：文字, 水印, 模糊, 变形, 扭曲, 崩坏, 多余肢体, 解剖错误, 低质量, 低分辨率, 糟糕的构图, 画面杂乱, 色彩溢出, 过度曝光, 不自然的动作, 插图风格, 卡通风格

【风格感知规则】（根据输入的【剧本风格】字段自动切换）
- 如果剧本风格为「古风」或「仙侠」：
  a) 场景画面中有地名、匾额、招牌等需要文字的物体，在 prompt 中把文字写在「双引号」内
  b) 文字使用繁体字（如"醉仙樓"、"御劍閣"）
  c) 文字书法风格偏行书或隶书
  d) 色调偏中国传统水墨色调，场景中加入烟雾、薄雾等古风要素
  e) 角色衣物描述使用古风用语（如"布衣"替代"衣服"，"襦裙"替代"裙子"）
- 不指定风格时使用默认现代风格
7. 严格遵守角色已有的外貌、服装和道具设定，不得随意更改
8. 严格遵守场景设定

【高度注意】
- 如果有原始剧本（rawScript），你必须从中提取角色之间的互动细节、对白内容、具体动作和情绪变化，将这些信息转化为画面描述
- 不要只抄结构化字段的文字，要结合原始剧本进行**二次创作**——理解角色动机、戏剧冲突，写出有画面感和故事性的 prompt
- 用具体的中文描述替代通用术语，例如不要说"角色在互动"，而要说"张三愤怒地拍案而起，指着李四说……"

【★ 关键要求：角色与场景视觉锚定】
- 当剧情需要展示角色（人物对话、动作、情绪反应等）时，**必须在 prompt 中嵌入角色的外貌特征、服装颜色和款式、道具等视觉描述**
- 当剧情需要展示场景（环境交代、空间变化等）时，**必须在 prompt 中嵌入场景的光线、氛围、色调、关键物品等视觉描述**
- 参考图 URL 已传入，你的 prompt 必须生成与参考图视觉风格一致的画面描述
- 角色外貌描述参考【角色设定】中的 appearance/服装字段，确保画面中的角色与已生成的角色形象图一致

输出 JSON 格式：
{
  "prompt": "一段流畅的画面描述（中文，80-200字）",
  "negativePrompt": "完整负面词列表（英文/中文混合，逗号分隔）"
}`

      // 组装角色信息（带外观描述——用于视觉锚定）
      const charText = characters?.length
        ? characters.map(c => {
            const desc = [`【${c.name}】`]
            if (c.physicalDescription) desc.push(`完整外貌: ${c.physicalDescription}`)
            if (c.appearance) desc.push(`外观摘要: ${c.appearance}`)
            if (c.clothing) desc.push(`服装: ${c.clothing}`)
            if (c.props) desc.push(`道具: ${c.props}`)
            if (c.gender || c.age) desc.push(`性别: ${c.gender || ''} 年龄: ${c.age || ''}`)
            if (c.pose) desc.push(`姿态: ${c.pose}`)
            if (c.emotion) desc.push(`情绪: ${c.emotion}`)
            if (c.personality) desc.push(`性格: ${c.personality}`)
            return desc.join(' | ')
          }).join('\n')
        : '无角色数据'

      const sceneText = scenes?.length
        ? scenes.map(s => {
            const items = [`【${s.name}】${s.description || ''}`]
            if (s.imagePrompt) items.push(`视觉描述参考: ${s.imagePrompt}`)
            if (s.lighting) items.push(`光线: ${s.lighting}`)
            if (s.atmosphere) items.push(`氛围: ${s.atmosphere}`)
            if (s.type) items.push(`场景类型: ${s.type}`)
            return items.join(' | ')
          }).join('\n')
        : '无场景数据'

      // AIGC 规格表（前端构建的完整规格）
      const aigcSpecText = aigcSpec
        ? `\n【AIGC 规格表】\n${aigcSpec}`
        : ''

      // 参考图信息
      let refImageText = ''
      if (referenceImages?.characters?.length || referenceImages?.scenes?.length) {
        const parts: string[] = []
        if (referenceImages.characters?.length) {
          parts.push(`角色参考图 ${referenceImages.characters.length} 张`)
        }
        if (referenceImages.scenes?.length) {
          parts.push(`场景参考图 ${referenceImages.scenes.length} 张`)
        }
        refImageText = `\n【参考图】已有 ${parts.join('，')}，生成 prompt 时可以参考其构图和视觉风格，确保生成画面与已有参考图一致。`
      }

      // ⭐ 原始剧本（供 LLM 二次创作使用）
      const rawScriptText = rawScript
        ? `\n\n【原始剧本全文】\n${rawScript.slice(0, 3000)}`
        : ''

      // 前后段落标题（叙事连贯性）
      const contextText = prevSegmentTitle || nextSegmentTitle
        ? `\n【叙事上下文】前一段落: ${prevSegmentTitle || '无'} | 后一段落: ${nextSegmentTitle || '无'}`
        : ''

      // ⭐ 完整规格表（effectSpecs / actionSpecs / cameraSpecs / emotionSpecs）
      let fullSpecText = ''
      if (fullSpecTables) {
        const sections: string[] = []
        if (fullSpecTables.effectSpecs?.length) {
          sections.push(`【特效规范】\n${fullSpecTables.effectSpecs.map((e: any) => `- ${e.effectName}: ${e.visualDescription}`).join('\n')}`)
        }
        if (fullSpecTables.emotionSpecs?.length) {
          sections.push(`【情绪规范】\n${fullSpecTables.emotionSpecs.map((e: any) => `- ${e.characterName} → ${e.emotionType} (${e.facialDesc})`).join('\n')}`)
        }
        if (fullSpecTables.cameraSpecs?.length) {
          sections.push(`【运镜规范】\n${fullSpecTables.cameraSpecs.map((c: any) => `- ${c.shotSize || ''} ${c.cameraMovement || ''} ${c.angle || ''} — ${c.purpose || ''}`).join('\n')}`)
        }
        if (sections.length) fullSpecText = `\n\n【完整规格数据】\n${sections.join('\n\n')}`
      }

      // ⭐ 剧本风格（古风/仙侠等——影响分镜 prompt 的文字和书法风格）
      const genreLine = genre ? `\n【剧本风格】${genre}` : ''

      const userMessage = `请为以下段落生成标准分镜图 prompt 和 negativePrompt：

【段落标题】${title}
【叙事目的】${narrativePurpose || '未指定'}
【镜头手法】${shotPattern || '标准镜头'}
【情感氛围】${emotionArc || '中性'}
【画幅比例】${aspectRatio || '16:9'}${genreLine}

【角色设定】
${charText}

【场景设定】
${sceneText}${aigcSpecText}${refImageText}${contextText}${rawScriptText}${fullSpecText}

请严格按照规则生成 JSON 输出。`

      const gatewayResult = await narrativeGateway.execute({
        systemPrompt,
        userMessage,
        userId,
        projectId: title || 'storyboard-prompt',
        timeoutTier: 'normal',
      })

      // 从 LLM 返回提取 JSON
      const content = gatewayResult.content
      let parsed: any = null
      let degraded = false
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[0] : content
        parsed = JSON.parse(jsonStr)
      } catch {
        degraded = true
      }

      // fallback —— LLM 挂了也不会空手
      if (!parsed || !parsed.prompt) {
        const parts: string[] = []
        // AIGC 规格优先（前端已有完整规格表）
        if (aigcSpec) {
          const specLines = aigcSpec.split('\n').map(l => l.replace(/^【.*?】/, '').trim()).filter(Boolean)
          parts.push(`【画面】${narrativePurpose || title || ''}`)
          parts.push(`【规格】${specLines.slice(0, 4).join('，')}`)
          if (characters?.length) {
            parts.push(`【角色】${characters.map(c => `${c.name}${c.appearance ? '，'+c.appearance : ''}${c.clothing ? '，穿着'+c.clothing : ''}`).join('；')}`)
          }
          if (scenes?.length) {
            parts.push(`【场景】${scenes.map(s => `${s.name}：${(s.imagePrompt || s.description || '').slice(0, 60)}`).join('；')}`)
          }
          parts.push(`【氛围】${emotionArc || '中性'}`)
          parts.push('4K，影视级画质，cinematic lighting，写实风格')
          if (referenceImages?.characters?.length) parts.push('参考角色形象保持一致')
          if (referenceImages?.scenes?.length) parts.push('参考场景视觉风格')
        } else {
          const narrativeDesc = narrativePurpose || ''
          parts.push(`画面内容: ${narrativeDesc}`)
          if (characters?.length) {
            parts.push(`角色: ${characters.map(c => `${c.name}，穿着${c.clothing || ''}，${c.props ? '手持'+c.props : ''}`).join('；')}`)
          }
          if (scenes?.length) {
            parts.push(`场景: ${scenes.map(s => s.name).join('、')}`)
          }
          parts.push(`镜头手法: ${shotPattern || '标准镜头'}`, `情感氛围: ${emotionArc || '中性'}`, `影视级画质，写实风格，4K，cinematic lighting`)
        }
        parsed = {
          prompt: parts.join('。'),
          negativePrompt: '文字, 水印, 模糊, 变形, 扭曲, 崩坏, 多余肢体, 解剖错误, 低质量, 低分辨率, 糟糕的构图, 画面杂乱, 色彩溢出, 过度曝光, 不自然的动作, 插图风格, 卡通风格',
        }
      }

      if (userId && userId !== 'anonymous') {
        await incrementDailyUsage(userId, 'llm').catch(() => {})
      }

      return {
        success: true,
        data: parsed,
        degraded,
      }
    } catch (err: any) {
      console.error('[Storyboard-Prompt] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // ============================================================
  // POST /api/v1/narrative/regen-spec — LLM 重新构思 AIGC 规格（imagePrompt）
  // ============================================================
  //
  // ⭐ 剧情上下文来源策略（2026-05-26 更新）：
  //   1. 优先从 DB 读取 project.executionResults.plotBlueprint.scenes[].script
  //      （总指挥重构后的完整脚本），拼成剧情上下文
  //   2. 如果项目无 plotBlueprint 或 script 为空，fallback 到前端传的
  //      context.storyText（原始剧本全文）
  //   3. 如果两地都没有，使用空字符串（Agent 仍能工作，但画面可能与剧本无关）
  //
  app.post('/api/v1/narrative/regen-spec', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any)?.id || 'anonymous'

    const body = request.body as {
      type: 'character' | 'scene' | 'storyboard'
      data: any       // 原始规格数据
      context?: {
        storyText?: string
        projectId?: string
        projectName?: string
        aspectRatio?: string
      }
    }
    const { type, data, context } = body

    try {
      const effectiveUserId = userId
      let systemPrompt = ''
      let userMessage = ''

      // ⭐ 从 projectId 读取 plotBlueprint.scenes[].script 作为剧情上下文
      let storyContextText = context?.storyText || ''
      if (context?.projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: context.projectId },
            select: { executionResults: true, description: true },
          })
          if (project?.executionResults) {
            const er = typeof project.executionResults === 'string'
              ? JSON.parse(project.executionResults)
              : project.executionResults
            const scenes = er?.plotBlueprint?.scenes
            if (scenes?.length) {
              const hasScript = scenes.some((s: any) => s.script && s.script.length > 20)
              if (hasScript) {
                const scriptParts: string[] = []
                for (const scene of scenes) {
                  if (scene.script) {
                    scriptParts.push(`【场景 ${scene.sceneId || '?'}】${scene.name || ''}`)
                    scriptParts.push(scene.script)
                  }
                }
                const builtStory = scriptParts.join('\n')
                if (builtStory.length > 20) {
                  storyContextText = builtStory
                }
              }
            }
          }
        } catch (_e) {
          // 静默失败：DB 读取失败时使用原始 context.storyText
        }
      }

      if (type === 'character') {
        systemPrompt = `你是一位专业的影视导演和AIGC角色设计师。请先阅读剧本全文，深度分析剧本中的人物角色，然后根据角色描述重新生成一个更优质的 imagePrompt（文生图提示词）用于角色形象图生成。

规则：
1. 你是一位专业的影视大导演，现在请阅读剧本，深度分析剧本中的人物角色
2. 把每个人物角色单独提炼出来，给每个角色创造个性鲜明的形象描述
3. 根据视频大模型的生成图片的要求，编写详细的提示词
4. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记
5. JSON 包含：imagePrompt, negativePrompt
6. imagePrompt 使用表格化格式，每行一个 [字段名]: 值，字段包含：构图类型、面部五官、表情眼神、身体姿态、体型轮廓、光影光线、背景环境、时代风格、风格关键词
7. 风格关键词必须包含：角色定妆照、全身人设图、影视级质感
8. 角色必须居中构图，背景纯白色，全身正面展示
9. **严格遵守已有的人物外貌设定，不得随意更改**。对于孙悟空、猪八戒、哪吒、唐僧等中国神话知名角色，必须精确还原其经典形象特征（猪八戒=猪头大耳肥硕圆肚、孙悟空=雷公嘴毛脸、哪吒=少年丸子头等），**不得自行美化、瘦身或改造角色本质特征**
10. ⚠️ **非常关键**：必须根据角色名称推断时代/世界背景，在【时代风格】字段中明确写出。例如：
   - 哪吒、敖丙 → 时代风格: 中国神话古装，封神演义
   - 孙悟空、唐僧 → 时代风格: 中国古代神话，西游记
   - 超人、蝙蝠侠 → 时代风格: 现代超级英雄，欧美科幻
   - 如果有"赛博""机械""未来"等关键词 → 时代风格: 科幻未来
11. **服装必须使用符合角色身份和时代背景的正式服装**（如古装、战甲、现代装等），绝对禁止动作捕捉服、紧身衣、肚兜、短裤。服装描述必须具体（颜色+款式+材质+纹饰）。
12. (⚠️ 致命约束) **AI图片模型会把任何「腹部」「腰腹」「肚子」「腹」相关措辞100%画成孕妇**。如果要描述角色有圆润/丰腴体型，**必须用「全身匀称丰满」「整体圆润」「体态丰腴」「脂肪均匀分布全身」** 来替代。禁止使用「腹部微微隆起」「小肚子」「圆滚滚的小肚子」「腰腹微圆」等字眼。
13. (⚠️ 风格约束) **风格关键词必须包含「写实真人」「不卡通」「真人类」「照片级」**，禁止生成二次元、动漫、卡通风格。角色定妆照必须是写实电影级质感。
14. 负面提示词包含质量和画质问题：模糊, 变形, 多余肢体, 画面崩坏

输出 JSON：
{
  "imagePrompt": "表格化格式的提示词，必须包含【时代风格】字段",
  "negativePrompt": "负面词"
}`

        const storyContext = storyContextText ? `\n\n【剧本原文】\n${storyContextText}` : ''
        userMessage = `${storyContext}

请先阅读上面的剧本原文，然后为以下角色重新生成 imagePrompt：

角色名: ${data.characterName || '未命名'}
外貌描述: ${data.physicalDescription || data.appearance || '未指定'}
体型: ${data.bodyType || data.体型 || data.体型轮廓 || '未指定'}
服装: ${data.clothing || '未指定'}
道具: ${data.props || '无'}
当前 imagePrompt: ${data.imagePrompt || '无'}
性别: ${data.gender || '未指定'}
年龄: ${data.age || '未指定'}

⚠️ **重要：必须严格执行角色的原设定**！外貌描述和体型与"当前 imagePrompt"矛盾时，**以「外貌描述」和「体型」中的信息为准**，不得擅自改变角色的胖瘦、体型、年龄、种族等核心特征。

**务必在 imagePrompt 中添加「时代风格」字段**，根据角色名推断时代背景。例如哪吒=中国神话古装，敖丙=中国神话古装。
作为一个专业影视导演，根据剧本深度分析该角色，重新构思生成更优质的 imagePrompt。`

      } else if (type === 'makeup') {
        systemPrompt = `你是专业的影视定妆造型师。请先阅读剧本全文，深度分析角色的性格、身份和时代背景，然后重新生成更优质的定妆照 imagePrompt。

规则：
1. 定妆照必须穿符合剧情的正式服装（不是动作捕捉服），展现角色的完整造型
2. 纯白色背景，全身正面立正站姿，无道具无武器
3. imagePrompt 使用高密度纯文字流畅描述，约200-350字
4. imagePrompt 必须包含：角色名、全身站姿、面部五官、发型发饰、完整服装（颜色+款式+材质）、饰品细节、时代风格、纯白色背景
5. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记

输出 JSON：
{
  "imagePrompt": "高密度纯文字流畅描述的定妆 prompt",
  "negativePrompt": "动作捕捉服, 紧身衣, 标记点, 非白底, 复杂背景, 多人"
}`

        const storyContext = storyContextText ? `

【剧本原文】
${storyContextText}` : ''
        userMessage = `${storyContext}

请先阅读上面的剧本原文，然后为以下角色重新生成定妆照 imagePrompt：

角色名: ${data.characterName || '未命名'}
服装描述: ${data.description || data.clothingDescription || '未指定'}
时代风格: ${data.eraStyle || '未知'}
服装概览: ${data.attireSummary || '无'}
当前定妆 Prompt: ${data.imagePrompt || '无'}
${context?.aspectRatio ? `画幅比例: ${context.aspectRatio}` : ''}

注意：定妆照穿的是角色的正式剧情服装，绝对禁止出现动作捕捉服、紧身衣、标记点。纯白色背景，全身正面立正站姿。`

      } else if (type === 'scene') {
        systemPrompt = `你是一位专业的影视导演和AIGC场景设计师。请先阅读剧本全文，深度分析剧本中每个场景的氛围和细节，然后重新生成更优质的场景 imagePrompt（文生图提示词）。

规则：
1. 你是一位专业的影视大导演，现在请阅读剧本，深度分析剧本中的场景
2. 每个场景必须包含：环境、氛围、光线、色调、关键视觉元素
3. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记
4. JSON 包含：imagePrompt, negativePrompt
5. imagePrompt 使用表格化格式：景别构图、环境描述、光线色调、天气氛围、画面元素、时代风格、风格关键词
6. 画面中绝对禁止出现任何人物、角色、人影、剪影，必须为空场景/空镜
7. 严格遵守已有的场景设定，不得随意更改

输出 JSON：
{
  "imagePrompt": "表格化格式的提示词",
  "negativePrompt": "负面词"
}`

        const storyContext = storyContextText ? `\n\n【剧本原文】\n${storyContextText}` : ''
        userMessage = `${storyContext}

请先阅读上面的剧本原文，然后为以下场景重新生成 imagePrompt：

场景名: ${data.sceneName || '未命名'}
描述: ${data.description || '未指定'}
当前 imagePrompt: ${data.imagePrompt || '无'}
${context?.aspectRatio ? `画幅比例: ${context.aspectRatio}` : ''}

作为一个专业影视导演，根据剧本深度分析该场景的氛围和视觉元素，重新构思生成更优质的场景 imagePrompt。`

      } else if (type === 'storyboard') {
        systemPrompt = `你是一位专业的影视导演和分镜设计师。请先阅读剧本原文，深度分析剧本中的分镜段落，然后重新生成一段优质的场景画面描述用于图生图。

规则：
1. 你是一位专业的影视大导演，现在请阅读剧本，深度分析剧本中的分镜段落
2. 每个分镜段落必须包含：画面主体、角色动作、环境、光线、镜头角度、情感氛围
3. 输出必须是严格有效的 JSON
4. JSON 包含：imagePrompt, negativePrompt
5. imagePrompt 是一段流畅的画面描述（中文，150-300字），包含画面主体、角色动作、环境、光线、镜头
6. 末尾加质量词：4K, highly detailed, cinematic lighting, 影视级画质
7. 严格遵守已有角色和场景设定
8. ⚠️ **禁止在提示词中描述角色的服装和穿着**——因为系统会使用角色定妆图作为参考图，角色形象以定妆图为准。只需描述角色的动作、表情和所处环境即可。

输出 JSON：
{
  "imagePrompt": "流畅画面描述",
  "negativePrompt": "负面词"
}`

        const storyContext = storyContextText ? `\n\n【剧本原文】\n${storyContextText}` : ''
        const chars = data.characters?.length
          ? data.characters.map((c: any) => `${c.characterName || c}`).join('、')
          : '无角色数据'
        const scenes = data.scenes?.length
          ? data.scenes.map((s: any) => `【${s.sceneName}】${s.description || ''}`).join('\n')
          : '无场景数据'

        userMessage = `请为以下分镜段落重新生成 imagePrompt：

段落标题: ${data.title || '未命名'}
叙事目的: ${data.narrativePurpose || '未指定'}
镜头手法: ${data.shotPattern || '标准镜头'}
情感氛围: ${data.emotionArc || '中性'}

涉及角色（仅需动作和环境，不要描述服装穿着）:
${chars}

场景:
${scenes}

当前 prompt: ${data.currentPrompt || '无'}

⚠️ **非常重要**：
1. imagePrompt 必须是一段流畅的画面描述（中文，150-300字），不能是表格格式
2. 必须包含：画面主体（角色做什么）、环境（哪个场景）、光线氛围、镜头角度
3. 末尾加质量词：cinematic lighting, 4K, highly detailed, 影视级质感
4. **禁止描述角色的服装穿着**——系统已使用角色定妆图作为参考图，角色形象以图为准
5. 必须符合角色的外观设定（年龄、性别）
6. 必须在场景对应的环境中
7. 画面中角色数量不超过该场景实际出现的角色数

请重新构思，生成更优质的分镜图像 prompt。`
      } else if (type === 'voice') {
        systemPrompt = `你是一个专业的AI艺术指导/配音导演。你的任务是根据角色设定，推荐最合适的音色参数用于TTS语音合成。

角色设定包括：角色名、性别、年龄、性格描述、外貌、服装风格、声音特点（如有）。

你需要在以下音色库中选择最合适的音色（voiceType）：
- zh_male_deep（低沉男声）
- zh_male_warm（磁性男声）
- zh_male_calm（沉稳男声）
- zh_male_cheerful（欢快男声）
- zh_female_calm（沉稳女声）
- zh_female_warm（温柔女声）
- zh_female_cheerful（活泼女声）
- zh_female_young（年轻女声）
- zh_male_young（年轻男声）
- zh_male_authoritative（权威男声）

规则：
1. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记
2. JSON 包含：voiceType, speakingStyle（说话风格描述，10字内）, pitch（0.8-1.5）, speed（0.7-1.3）, reason（选型理由，20字内）
3. 根据角色年龄：儿童用高音快语速，老人用低音慢语速
4. 根据角色性格：活泼用 cheerful，沉稳用 calm，权威用 authoritative
5. 根据角色性别选择对应性别的音色库

输出 JSON：
{
  "voiceType": "音色ID",
  "speakingStyle": "说话风格描述",
  "pitch": 1.0,
  "speed": 1.0,
  "reason": "选型理由"
}`

        userMessage = `请为以下角色推荐音色：

角色名: ${data.characterName || '未命名'}
性别: ${data.gender || '未指定'}
年龄: ${data.age || '未指定'}
性格描述: ${data.personality || data.description || '未指定'}
外貌/风格: ${data.appearance || ''} ${data.clothing || ''}
当前音色: ${data.currentVoiceType || '未设置'}
当前说话风格: ${data.currentStyle || '未设置'}

请根据角色设定，推荐最合适的音色参数。`
      } else if (type === 'frame') {
        systemPrompt = `你是一位顶级影视导演和镜头语言设计师。请根据剧本全文，为首尾帧画面重新生成一段高质量的 imagePrompt。

规则：
1. 你是一位专业的影视大导演，现在请阅读剧本原文，深度分析发生在该场景中的关键情节
2. 首帧：段落/场景开场的画面，需要交代环境+出场角色+故事氛围
3. 尾帧：段落/场景结束的画面，需要总结情绪+留下悬念或过渡感
4. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记
5. JSON 包含：imagePrompt, negativePrompt, description（画面描述，20字内）
6. imagePrompt 是一段流畅的画面描述（中文，200-350字），包含：
   - 画面主体（角色在做什么、什么动作、什么表情）
   - 环境背景（哪个场景/时间段）
   - 光线氛围（与剧情情绪一致）
   - 镜头角度（与输入的镜头角度一致）
   - 画面构图
7. 末尾必须加质量词：4K, highly detailed, cinematic lighting, 影视级画质
8. ⚠️ **非常重要**：此画面将使用「图生图」模式，以角色定妆照作为参考图。因此 imagePrompt 中**绝对不要**描述角色外貌、发型、发色、五官、面容、服装、服饰、饰品、体型、身材等外观特征——这些由参考图提供
9. imagePrompt 只写角色的动作、表情、姿态变化、场景环境、光线氛围和镜头语言
10. 严格遵守剧本原文的情节和场景设定，不得自由发挥时代背景

输出 JSON：
{
  "description": "20字内画面描述",
  "imagePrompt": "流畅画面描述，包含镜头角度和具体角色动作环境",
  "negativePrompt": "负面词"
}`

        // 注入完整的角色和场景信息
        const storyContext = storyContextText ? `\n\n【剧本原文】\n${storyContextText}` : ''
        userMessage = `${storyContext}

请为以下首尾帧画面重新生成 imagePrompt：

段落标题: ${data.title || data.sceneName || `段落 ${data.segmentIndex || '0'}`}
帧类型: ${data.frameType === 'first' ? '首帧（段落/场景开场画面）' : '尾帧（段落/场景结束画面）'}
镜头角度: ${data.cameraAngle || '平视'}

场景描述: ${data.description || data.sceneDescription || '未指定'}

当前 prompt: ${data.imagePrompt || data.currentPrompt || '无'}

⚠️ **非常关键**：
1. 必须根据剧本原文中的角色和场景设定生成 prompt，不得套用其他题材
2. 如果剧本是古风/仙侠/神话题材，画面中必须有对应的古装角色和古典场景
3. 如果剧本是现代题材，画面中才是现代角色和都市场景
4. imagePrompt 是一段流畅的描述（中文，200-350字），不是表格
5. 【${data.frameType === 'first' ? '首帧' : '尾帧'}】${data.frameType === 'first' ? '重点交代环境开场+角色入场' : '重点总结情绪+留下画面感'}

请重新构思，生成更优质的首尾帧画面 prompt。

⚠️ **绝对禁止**：不允许在 imagePrompt 中出现任何关于角色外貌、发色、发型、眼型、面容、服装、服饰、体型的描述。所有外观特征以参考图（角色定妆照）为准，只写动作、表情、场景、光线、镜头和氛围。`
      } else if (type === 'video') {
        const totalSeconds = data.duration || 5
        const segCount = Math.max(1, data.segmentCount || 1)
        systemPrompt = `你是一位顶级影视导演和AIGC镜头语言设计师。请根据剧本全文，为视频段落生成精确到每秒的AIGC画面语言时间轴表格。

规则：
1. 你是一位专业的影视大导演，现在请阅读下面的剧本原文
2. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记
3. JSON 包含：timeline（数组，每一秒一个对象）
4. 每个时间点对象包含9个字段：
   - second: 第几秒（从1开始）
   - scene: 画面剧情描述（该秒正在发生什么，15-30字）
   - dialogue: 角色台词/对白（无台词则填"无"）
   - camera: 运镜描述（如"推镜头，从全景推到中景""固定镜头""缓慢横移"等）
   - effect: 特效描述（如"自然光""爆炸火花""屏幕闪烁""粒子效果"等，无则填"自然"）
   - sound: 音效/环境音描述（如"键盘敲击声""风声""背景音乐渐强"等）
   - expression: 角色表情变化（如"眉头紧锁""微笑""惊讶睁大眼睛"等，多角色用逗号分隔）
   - action: 角色动作（该秒角色在做什么，如"站起身走向门口""转头看向窗外"）
   - voiceover: 画外音（旁白/内心独白，无则填"无"）
   - transition: 转场方式（如"硬切""淡入淡出""叠化""推拉摇移跟"等，段内通常填"硬切"）
5. 画面剧情必须与剧本原文严格一致
6. 禁止在 scene/action 中描述角色服装穿着（以角色定妆图为准）
7. 总时长${totalSeconds}秒，需生成${totalSeconds}行时间轴
8. JSON 还包含：additionalPrompt（补充的全局提示词）
9. 输出 JSON 示例：
{
  "timeline": [
    {"second":1,"scene":"程序员坐在工位上，眉头紧锁盯着电脑屏幕","dialogue":"无","camera":"固定镜头，特写键盘和屏幕","effect":"蓝白色屏幕光","sound":"办公室键盘敲击声和空调低鸣","expression":"眉头紧锁，眼神专注中带着焦虑","action":"双手快速敲击键盘","voiceover":"无","transition":"硬切"},
    {"second":2,"scene":"屏幕上弹出机密文件窗口，程序员的瞳孔放大","dialogue":"（低声自语）这是…真的假的？","camera":"急推镜头到屏幕特写","effect":"弹窗光效照亮程序员面庞","sound":"突然停止的键盘声，一声清脆弹窗音效","expression":"瞳孔放大，嘴巴微张，震惊","action":"停下敲键盘，身体前倾仔细看屏幕","voiceover":"他不敢相信自己的眼睛","transition":"硬切"}
  ],
  "additionalPrompt": "电影级质感，蓝冷色调为主，科技公司办公氛围"
}`

        const storyContext = storyContextText ? `\n\n【剧本原文】\n${storyContextText}` : ''
        const chars = (data.characters || []).join('、')
        const scenes = (data.associatedScenes || []).join('、')

        userMessage = `${storyContext}

请为以下视频段落生成精确到每秒的AIGC时间轴表格：

段落标题: ${data.title || '未命名'}
叙事内容: ${data.narrativePurpose || data.description || ''}
视觉内容: ${data.visualContent || ''}
关联角色: ${chars || '无'}
关联场景: ${scenes || '无'}
环境变化: ${data.environmentChange || '无'}
当前分镜图参考: ${data.storyboardPrompt || '无'}

总时长: ${totalSeconds}秒

⚠️ **核心要求**：
1. 严格按照剧本原文的剧情走向，每一秒都要有画面进展，不能停滞
2. 场景中的空间关系要连贯——角色上一秒在A位置，下一秒不能瞬移到B位置
3. 表情变化要自然渐变——不是每秒钟都换表情，而是配合剧情推进
4. 台词/对白要合理分布在对应的时间点上
5. 运镜要有变化，避免全段重复同一种运镜
6. 转场在同一段内通常用"硬切"，段落首帧用"淡入"、尾帧用"淡出"
7. **禁止在 scene/action 字段中描述角色的服装穿着**——角色形象以定妆图为准`

        console.log(`[Regen-Spec] video timeline, duration=${totalSeconds}s`)
      }

      // Phase 2.5: 走 ModelAdapterRegistry（LLM Adapter），绕过 NarrativeGateway
      let llmContent = ''
      let llmProvider = 'volcengine'
      let llmModel = 'doubao-1-5-pro-256k-250115'
      let llmApiKey = ''
      try {
        const v2Config = await loadFullConfigV2(effectiveUserId)

        if (v2Config) {
          const v2 = v2Config as any
          llmProvider = v2.llmProvider || 'volcengine'
          llmModel = v2.llmModel || 'doubao-1-5-pro-256k-250115'
          if (v2.llmApiKey) {
            const keyField = 'llmApiKey'
            const encKey = v2[keyField]
            if (encKey) {
              try {
                llmApiKey = decryptKey(encKey)
              } catch {
                console.warn(`[Regen-Spec] LLM Key 解密失败，使用默认 Key`)
              }
            }
          }
        }

        // 构建 RuntimePayload
        const runtime = {
          userId: effectiveUserId,
          provider: llmProvider,
          model: llmModel,
          apiKey: llmApiKey,
          baseURL: '',
          source: 'narrative-regen-spec',
          taskType: 'llm' as const,
          traceId: `regen-${Date.now()}`,
        }

        const adapterResult = await modelAdapterRegistry.execute(runtime, llmModel, {
          model: llmModel,
          systemPrompt,
          userMessage,
          apiKey: llmApiKey,
        })

        llmContent = adapterResult.content || ''
      } catch (adapterErr: any) {
        console.error(`[Regen-Spec] Adapter 调用失败: ${adapterErr?.message || '(no message)'}`)
        // Provider State v1.1: 双保险记录
        getProviderStateService().markFailure(effectiveUserId, llmProvider, adapterErr, llmApiKey).catch(() => {})
        // 零回退零兜底 — 直接抛错，不降级
        throw new Error(`模型调用失败: ${adapterErr?.message || '请检查大模型设置中的 API Key 和模型配置'}`)
      }

      const content = llmContent
      let parsed: any = null
      try {
        // 先尝试直接解析
        try {
          parsed = JSON.parse(content)
        } catch {
          // 再尝试提取 JSON 块
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            // 清理可能的问题：末尾逗号、单引号、注释
            let cleaned = jsonMatch[0]
              .replace(/,(\s*[}\]])/g, '$1')  // 删除末尾逗号
              .replace(/'/g, '"')               // 单引号转双引号
              .replace(/\/\/.*/g, '')           // 删除单行注释
            parsed = JSON.parse(cleaned)
          } else {
            // 尝试提取 ```json ... ``` 块
            const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (codeMatch) {
              parsed = JSON.parse(codeMatch[1].trim())
            }
          }
        }
      } catch (parseErr) {
        console.error('[Regen-Spec] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr, 'content:', content.slice(0, 300))
      }

      if (!parsed || !parsed.imagePrompt) {
        console.log('[Regen-Spec] Fallback: no imagePrompt in LLM response, using original prompt',
          `type=${type} name=${data.sceneName || data.characterName || 'unknown'}`,
          `parsed=${JSON.stringify(parsed).slice(0, 100)}`)
        parsed = {
          imagePrompt: data.imagePrompt || (type === 'storyboard' ? (data.currentPrompt || '') : ''),
          negativePrompt: '文字, 水印, 模糊, 变形, 扭曲, 崩坏, 多余肢体, 解剖错误, 低质量, 低分辨率',
        }
      } else {
        console.log('[Regen-Spec] ✅ Success:', `type=${type}`, `name=${data.sceneName || data.characterName || 'unknown'}`, `prompt=${parsed.imagePrompt.slice(0, 60)}...`)
      }

      if (userId !== 'anonymous') {
        await incrementDailyUsage(userId, 'llm').catch(() => {})
      }

      return {
        success: true,
        data: parsed,
      }
    } catch (err: any) {
      console.error('[Regen-Spec] Error:', err)
      return reply.status(500).send({
        success: false,
        error: err.message,
      })
    }
  })

  // ============================================================
  // POST /api/v1/narrative/regen-agent — 专业 Agent 重新审视剧本，完整生成单项 AIGC 规格
  // ============================================================
  app.post('/api/v1/narrative/regen-agent', async (request: any, reply: any) => {
    const body = request.body as {
      type: 'character' | 'scene' | 'storyboard' | 'voice' | 'frame'
      storyText: string
      title?: string
      aspectRatio?: string
      currentData?: any
      characterNames?: string[]
    }
    const { type, storyText, title, aspectRatio, currentData, characterNames } = body

    try {
      const quota = await checkLLMQuota(request)
      if (!quota.canProceed) {
        return reply.status(403).send({ success: false, error: quota.message })
      }

      const result = await aigcSpecAgent.regenerateType({
        type,
        text: storyText,
        title,
        aspectRatio: aspectRatio || '16:9',
        currentData,
        characterNames,
      })

      if (!result.success) {
        return reply.status(500).send({ success: false, error: result.error || 'Agent 规格重新生成失败' })
      }

      return {
        success: true,
        data: result.data,
        meta: result.meta,
      }
    } catch (err: any) {
      console.error('[Regen-Agent] Error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}

/** 从 request headers 中提取前作项目 ID */
async function findContinuationRefs(request: any): Promise<string | null> {
  try {
    const authHeader = request.headers?.authorization
    if (!authHeader) return null
    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    const userId = payload.id || payload.sub || payload.userId
    if (!userId) return null
    const { prisma } = await import('../utils/index.js')
    const project = await prisma.project.findFirst({
      where: { userId, continuationFrom: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { continuationFrom: true },
    })
    return project?.continuationFrom || null
  } catch {
    return null
  }
}

/** 加载项目参考图作为上下文文本 */
async function loadProjectRefs(projectId: string): Promise<string | null> {
  try {
    const { prisma } = await import('../utils/index.js')
    const charRefs = await prisma.characterReference.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    const sceneRefs = await prisma.sceneReference.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (!charRefs.length && !sceneRefs.length) return null
    const lines: string[] = []
    if (charRefs.length) {
      lines.push('【已有角色】')
      const seen = new Set<string>()
      for (const r of charRefs) {
        if (!seen.has(r.characterName)) {
          seen.add(r.characterName)
          lines.push(`- ${r.characterName} (参考图: ${r.imageUrl})`)
        }
      }
    }
    if (sceneRefs.length) {
      lines.push('【已有场景】')
      const seen = new Set<string>()
      for (const r of sceneRefs) {
        if (!seen.has(r.sceneName)) {
          seen.add(r.sceneName)
          lines.push(`- ${r.sceneName} (参考图: ${r.imageUrl})`)
        }
      }
    }
    return lines.join('\n')
  } catch (err) {
    console.warn('[Narrative] 加载参考图失败:', err)
    return null
  }

}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

