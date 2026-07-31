/**
 * AIGC Spec Agent v3 - 剧情统筹 + 多 Agent 编排架构
 *
 * 架构：
 *   ① 剧情总指挥（统筹）→ 输出剧情蓝图
 *       ↓
 *   ② 角色设计师 ── 场景设计师 ── 并行
 *       ↓
 *   ③ 声音设计师 ── 画面设计师 ── 并行（依赖角色+场景）
 *       ↓
 *   ④ 道具设计师（依赖角色+场景）
 *       ↓
 *   ⑤ 镜头/特效师（依赖前面全部）
 *       ↓
 *   ⑥ 合并输出
 *
 * 剧情统筹先行，后面的专业 agent 都带上蓝图作为上下文，
 * 确保角色/场景/道具/画面风格高度一致。
 *
 * ========== DAG 执行模型 ==========
 * Phase 0: 剧情总指挥（串行，作为后续 agent 的上下文基础）
 * Phase 1: 角色 + 场景 + 定妆 —— 可并行（Promise.allSettled）
 *   - buildCharacter 角色设计 ⚡
 *   - buildScene     场景设计 ⚡
 *   - buildMakeup    定妆设计（依赖角色，可提前获取角色数据后启动）
 * Phase 2: 声音 + 画面 + 道具 + 镜头/特效 —— 可并行（Promise.allSettled）
 *   - buildVoice        声音（依赖角色）
 *   - buildPortrait     定妆/画面（依赖角色+场景）
 *   - buildCameraEffect 镜头/特效（依赖场景）
 *   - buildProp         道具（依赖角色+场景）
 * ==================================
 *
 * 当前实现：Phase 1 全部完成后 Phase 2 才能开始。
 * 后续优化方向：Phase 2 的部分步骤（声音依赖角色但不依赖场景）可以在
 * Phase 1 的角色设计完成后立即启动，无需等待场景设计完成，
 * 实现更细粒度的 DAG 调度。
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { buildPromptCached } from './prompt-service.js'
import { StyleProfileService } from '../services/style-profile.service.js'

// ─── Agent Configuration ─────────────────────────────

interface AgentDef {
  name: string           // 路由名称
  promptFile: string     // 对应的 prompt 文件
  outputKey: string      // 合并到最终 spec 时的 key
}

const AGENTS: AgentDef[] = [
  { name: '剧情总指挥',        promptFile: 'plot-supervisor.txt',          outputKey: 'plotBlueprint' },
  { name: '角色设计师',        promptFile: 'character-designer.txt',        outputKey: 'characterSpecs' },
  { name: '场景设计师',        promptFile: 'scene-designer.txt',           outputKey: 'sceneSpecs' },
  { name: '角色定妆师',        promptFile: 'makeup-designer.txt',          outputKey: 'characterMakeupSpecs' },  // 🆕
  { name: '声音设计师',        promptFile: 'sound-designer.txt',           outputKey: 'voiceConfigs' },
  { name: '画面设计师',        promptFile: 'frame-designer.txt',           outputKey: 'frameDesign' },
  { name: '道具设计师',        promptFile: 'props-designer.txt',           outputKey: 'propSpecs' },
  { name: '镜头/特效师',       promptFile: 'director-of-photography.txt',  outputKey: 'effectSpecs' },
]

// 画面设计师还返回 videoSegments + videoProduction（特殊处理）
const FRAME_AGENT_EXTRA_KEYS = ['videoSegments', 'videoProduction']

// ─── LLM 调用（通过 NarrativeGateway）─────────────

const AGENT_TIMEOUT_SECONDS = 60
const AGENT_MAX_TOKENS = 8192
const TEXT_MAX_LENGTH = 4000

/**
 * 从 DB PromptTemplate 表读取模板内容
 * 所有 agent prompt 必须走这里，禁止硬编码
 */
async function loadPromptTemplate(templateName: string): Promise<string | null> {
  try {
    const { prisma } = await import('../utils/index.js')
    const row = await prisma.promptTemplate.findUnique({ where: { name: templateName } })
    const content = row?.content as Record<string, any> | undefined
    if (content?.prompt) {
      const rules = content.rules
      const outputFormat = content.outputFormat
      let result = content.prompt
      if (outputFormat) result += '\n\n【输出格式】\n' + outputFormat
      if (Array.isArray(rules) && rules.length > 0) {
        result += '\n\n【约束】\n' + rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')
      }
      return result
    }
    return null
  } catch {
    return null
  }
}

/**
 * ⭐ SSOT（Phase 4）: 严格读取 PromptTemplate，缺失即抛错（禁止硬编码 fallback）。
 * 生产链所有 prompt 必须存在 DB，否则视为部署错误。
 */
async function loadPromptTemplateStrict(templateName: string): Promise<string> {
  const prompt = await loadPromptTemplate(templateName)
  if (!prompt) {
    throw new Error(`[AigcOrchestrator] PromptTemplate.${templateName} 在数据库中不存在或内容为空（SSOT 禁止硬编码 fallback）`)
  }
  return prompt
}

async function callAgentLLM(
  systemPrompt: string,
  storyText: string,
  contextJson: string,
  agentName: string,
  styleSuffix: string = '',
  userId?: string,
): Promise<string> {
  // 每条上下文：给 agent 提供故事 + 已生成的部分（供参考）
  const userPrompt = contextJson
    ? `故事文本：\n${storyText}\n\n已生成的规格（供参考）：\n${contextJson}${styleSuffix}`
    : `故事文本：\n${storyText}${styleSuffix}`

  console.log('========== FINAL LLM PROMPT ==========')
  console.log(`[callAgentLLM] agentName=${agentName}, promptLen=${userPrompt.length}, contextJsonLen=${(contextJson || '').length}`)
  console.log(userPrompt.slice(0, 2000))
  if (userPrompt.length > 2000) console.log(`...(截断, 总长${userPrompt.length})`)
  console.log('=======================================')

  const result = await narrativeGateway.execute({
    systemPrompt,
    userMessage: userPrompt,
    userId: userId || 'anonymous',
    timeoutTier: 'batch',
    maxTokens: AGENT_MAX_TOKENS,
  })

  return result.content
}

// ─── Agent 类 ────────────────────────────────────────

interface AgentResult {
  spec: any
  raw: string
  success: boolean
  error?: string
  rawSpec?: any
}

async function runAgent(
  def: AgentDef,
  storyText: string,
  contextJson: string,
  retries: number = 1,
  styleSuffix: string = '',
  userId?: string,
): Promise<AgentResult> {
  // ⭐ 从 PromptService 读取（统一入口）
  const result = await buildPromptCached({ agentName: def.name })

  if (!result.prompt) {
    throw new Error(`[AigcOrchestrator] PromptTemplate.${def.name} 在数据库中不存在或内容为空`)
  }
  const systemPrompt = result.prompt

  // 如果是剧情总指挥，附加红楼梦微表情引用
  let finalPrompt = systemPrompt
  if (def.promptFile === 'plot-supervisor.txt') {
    // 微表情库已内联到 PromptTemplate.剧情总指挥 的内容中，此处无需额外附加
    finalPrompt = systemPrompt
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await callAgentLLM(finalPrompt, storyText, contextJson, def.name, styleSuffix, userId)
      console.log(`[AigcAgent] ${def.name} response length: ${raw.length}, contextJson length: ${contextJson.length}`)

      // 解析 JSON（支持代码块）
      const spec = parseSpecJson(raw)
      if (!spec) {
        if (attempt < retries) {
          console.warn(`[AigcAgent] ${def.name} JSON parse failed, raw start: ${raw.slice(0, 300)}`)
          console.warn(`[AigcAgent] ${def.name} JSON parse failed, retrying (${attempt + 1}/${retries})`)
          // 重试时给错误反馈
          contextJson = `[上���返回值 JSON 解析失败，请确保输出为严格有效的 JSON]\n${raw.slice(0, 200)}`
          continue
        }
        console.warn(`[AigcAgent] ${def.name} JSON parse FINAL failure, raw first 500 chars: ${raw.slice(0, 500)}`)
        return {
          spec: null,
          raw,
          success: false,
          error: 'JSON 解析失败',
        }
      }

      // 提取对应 key
      // 画面设计师特殊处理：它的 outputKey 是 frameDesign，但实际输出包含 videoSegments + frameDesign + videoProduction，
      // 所以不能截取，需要返回整个顶层 JSON
      if (def.name === '画面设计师') {
        return { spec: spec, raw, success: true, rawSpec: spec }
      }
      const output = spec[def.outputKey]
      if (!output) {
        // 尝试常见别名（AI 有时输出的字段名不匹配）
        const aliases: Record<string, string> = {
          'sceneSpecs': 'scenes',
          'characterSpecs': 'characters',
          'propSpecs': 'props',
          'voiceConfigs': 'voices',
          'effectSpecs': 'effects',
        }
        const alias = aliases[def.outputKey]
        if (alias && spec[alias]) {
          return { spec: spec[alias], raw, success: true, rawSpec: spec }
        }
        // 尝试根级别返回（兼容旧格式）
        return { spec: spec, raw, success: true, rawSpec: spec }
      }

      return { spec: output, raw, success: true, rawSpec: spec }
    } catch (err: any) {
      if (attempt < retries) {
        console.warn(`[AigcAgent] ${def.name} LLM call failed: ${err.message}, retrying`)
        continue
      }
      return {
        spec: null,
        raw: '',
        success: false,
        error: err.message,
      }
    }
  }

  return { spec: null, raw: '', success: false, error: 'max retries exceeded' }
}

// ─── JSON 解析工具 ───────────────────────────────────

function parseSpecJson(content: string): any {
  if (!content) return null

  // 提取代码块
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  let jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()

  // 如果没有代码块或代码块匹配失败，尝试直接找到第一个 '{' 或 '[' 开始提取
  if (!jsonMatch) {
    const jsonStart = jsonStr.search(/[{[]/)
    if (jsonStart >= 1) {
      // 有前缀文字（如 "JSON解析结果: {"），去掉前缀
      jsonStr = jsonStr.substring(jsonStart).trim()
    }
  }

  try {
    return JSON.parse(jsonStr)
  } catch {
    // ⭐ 宽松解析第一层：修复单引号、key引号、尾部逗号
    try {
      const looseJson = jsonStr
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(looseJson)
    } catch {}
    // ⭐ 宽松解析第二层：定位式修复——利用 JSON.parse 错误位置精准修复未转义引号
    try {
      let attempt = jsonStr
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1')
        .trim()
      const firstBrace = attempt.search(/[{[]/)
      if (firstBrace > 0) attempt = attempt.substring(firstBrace)

      for (let pass = 0; pass < 5; pass++) {
        try {
          return JSON.parse(attempt)
        } catch (e: any) {
          const m = e.message && e.message.match(/position (\d+)/)
          if (!m) throw e
          const errPos = parseInt(m[1])
          // 从错误位置向前找最近的 "，替换为 \u0022
          let found = -1
          for (let j = errPos; j >= Math.max(0, errPos - 80); j--) {
            if (attempt[j] === '"') {
              found = j
              break
            }
          }
          if (found < 0) throw e
          attempt = attempt.slice(0, found) + '\\u0022' + attempt.slice(found + 1)
        }
      }
      return JSON.parse(attempt)
    } catch {
      // 尝试截断 JSON 修复：通过正则找到完整 JSON 起始/结束位置
      try {
        let fixed = jsonStr.trim()
        // 去掉尾部不完整 token
        fixed = fixed.replace(/[,\s]*$/, '')
        // 暴力策略：找到最后一个值字符串结尾的完整位置
        // 当截断发生在数组内部时，尝试截断到最后一个完整对象
        // 步骤1：找到最后一个 "引号开始的值" 的结束位置
        const lastQuoteEnd = fixed.lastIndexOf('"')
        let cutPos = -1
        // 检查最后一个双引号后面是否跟着 :,"}] 等合法字符
        if (lastQuoteEnd > 0 && lastQuoteEnd > fixed.lastIndexOf('"', lastQuoteEnd - 1)) {
          // 如果最后一个字符是 " (但不完整的字符串), 回退到上一个完整对象
          const lastBrace = fixed.lastIndexOf('}')
          const lastBracket = fixed.lastIndexOf(']')
          if (lastBrace > lastBracket) {
            cutPos = lastBrace + 1
          } else if (lastBracket > lastBrace) {
            cutPos = lastBracket + 1
          }
        }
        if (cutPos > 0) {
          fixed = fixed.substring(0, cutPos)
        }
        // 补齐最外层缺失的花括号
        let openBraces = (fixed.match(/\{/g) || []).length
        let closeBraces = (fixed.match(/\}/g) || []).length
        while (closeBraces < openBraces) { fixed += '}'; closeBraces++ }
        let openBrackets = (fixed.match(/\[/g) || []).length
        let closeBrackets = (fixed.match(/\]/g) || []).length
        while (closeBrackets < openBrackets) { fixed += ']'; closeBrackets++ }
        const quoteCount = (fixed.match(/"/g) || []).length
        if (quoteCount % 2 !== 0) fixed += '"'
        return JSON.parse(fixed)
      } catch {
        return null
      }
    }
  }
}

// ─── Orchestrator ────────────────────────────────────

interface AigcSpecInput {
  text: string
  title?: string
  aspectRatio?: string
  genre?: string           // ⭐ 剧本风格
  visualStyle?: string     // ⭐ 视觉风格
  section?: string         // ⭐ 只重新生成指定 section（character/scene/storyboard/voice/video）
  projectId?: string      // ⭐ 项目 ID，用于 CinematicIR 持久化
  existingSpec?: any       // ⭐ 已有的完整 designSpec，section 模式提供给 agent 做 context
  sceneDescription?: string // ⭐ 场景 section 模式：优化时传入的场景描述文本（单条，兼容旧版）
  sceneDescriptions?: { sceneName: string; description: string }[] // ⭐ 所有场景描述数组
  instruction?: string     // ⭐ 场景 section 模式：给 AI 的额外优化指令
  userId?: string          // ⭐ 用户 ID，用于使用用户自己的 API Key
}

interface AigcSpecOutput {
  plotBlueprint: any
  characterSpecs: any[]
  characterMakeupSpecs: any[]   // 🆕 角色定妆
  sceneSpecs: any[]
  voiceConfigs: any[]
  videoSegments: any[]
  frameDesign: any[]
  videoProduction: any
  propSpecs: any[]
  effectSpecs: any[]
  actionSpecs: any[]
  cameraSpecs: any[]
  emotionSpecs: any[]
  storyboardSpecs: any[]
  // 以下为运行时扩展字段（V3 向后兼容）
  characters?: any[]
  scenes?: any[]
  voices?: any[]
  props?: any[]
  effects?: any[]
  emotionCurve?: any[]
  segments?: any[]
  storyArc?: any
  cameraLanguage?: any[]
  soundDesign?: any[]
  effectsDesign?: any[]
  videoDesigns?: any[]
  storyboard?: any[]
  effectSound?: any[]
  v3?: {
    segments: any[]
    characters: any[]
    scenes: any[]
  }
}

export class AigcSpecOrchestrator {
  private stats = { calls: 0, successes: 0, failures: 0, agentResults: {} as Record<string, any> }

  async generate(input: AigcSpecInput): Promise<{
    success: boolean
    data?: AigcSpecOutput
    error?: string
    /** SSOT（Phase 4 / Task 4.4）: 失败契约字段 */
    errorCode?: string
    userMessage?: string
    meta?: { latencyMs: number; agentStats: Record<string, any> }
  }> {
    const start = Date.now()
    this.stats.calls++

    const storyText = (input.text || '').slice(0, TEXT_MAX_LENGTH)
    const { section, userId } = input
    console.log(`[AigcOrchestrator] generate called, section=${section || '(full)'}`)

    // ⭐ 优先使用「剧本拆解总导演」一键 Agent（替代 8 Agent 串行链路）
    if (!section) {
      try {
        const { getPrompt } = await import('../runtime/prompt/PromptRegistry.js')
        const masterPrompt = await getPrompt('剧本拆解总导演').catch((e: any) => { console.warn('[AigcOrchestrator] ⚠️ getPrompt error:', e.message); return null })
        if (masterPrompt) {
          console.log(`[AigcOrchestrator] 🎭 剧本拆解总导演 prompt 存在，使用一键拆解模式`)
          const { runBreakdownMaster } = await import('./script-breakdown-master.js')
          console.log(`[AigcOrchestrator] 📤 调用 runBreakdownMaster, storyText.length=${storyText.length}`)
          const masterResult = await runBreakdownMaster(storyText, userId || 'anonymous', {
            title: input.title,
            genre: input.genre,
            visualStyle: input.visualStyle,
          })
          console.log(`[AigcOrchestrator] 📥 runBreakdownMaster 返回: success=${masterResult.success}, error=${masterResult.error?.substring(0, 100) || 'none'}, data=${masterResult.data ? 'yes' : 'no'}, rawContent=${(masterResult.rawContent || '').substring(0, 80)}`)
          if (masterResult.success && masterResult.data) {
            this.stats.successes++
            const d = masterResult.data as any  // V3 NarrativeConstitution
            console.log(`[AigcOrchestrator] ✅ 剧本拆解总导演 V3 成功: ${d.segments?.length || 0} segments, ${d.characters?.length || 0} chars, ${d.scenes?.length || 0} scenes`)

            // V3 → AigcSpecOutput 映射层（V3: segment 内联 camera/characters/environment/emotion）
            const masterOutput = buildV3SpecOutput(d, input)
            this.stats.agentResults['剧本拆解总导演'] = { success: true }
            return {
              success: true,
              data: masterOutput,
              meta: {
                latencyMs: Date.now() - start,
                agentStats: this.stats.agentResults,
                breakdownMaster: true,
              },
            }
          }
          // ❌ 总导演失败则直接报错
          console.error(`[AigcOrchestrator] ❌ 剧本拆解总导演执行失败: ${masterResult.error}`)
          return { success: false, error: `剧本拆解总导演失败: ${masterResult.error || '未知错误'}` }
        }
        console.log(`[AigcOrchestrator] 📝 剧本拆解总导演 prompt 不存在，使用传统 8 Agent 链路`)
      } catch (masterErr: any) {
        console.warn(`[AigcOrchestrator] ⚠️ 剧本拆解总导演加载失败: ${masterErr.message}，使用传统 8 Agent 链路`)
      }
    }

    // ⭐ 风格上下文从 StyleProfile 动态读取（禁止硬编码）
    const styleContext = []
    if (input.genre) styleContext.push(`【剧本风格】${input.genre}`)
    if (input.visualStyle) {
      const profile = await StyleProfileService.getByName(input.visualStyle)
      const desc = profile?.styleTokens || `${input.visualStyle}风格`
      styleContext.push(`【视觉风格】${desc}`)
    }
    if (input.aspectRatio) styleContext.push(`【画幅比例】${input.aspectRatio}`)
    const styleSuffix = styleContext.length > 0 ? `\n\n${styleContext.join('\n')}` : ''

    // ⭐ section 模式：只重新生成单个 section，不复用旧 context => 快速响应
    if (section) {
      console.log(`[AigcOrchestrator] 🏃 section mode: ${section}`)
      const sectionAgentMap: Record<string, number> = { supervisor: 0, character: 1, scene: 2, voice: 4, storyboard: 5, video: 5, props: 6, makeup: 3 }
      const agentIdx = sectionAgentMap[section]
      if (agentIdx === undefined) return { success: false, error: `未知 section: ${section}`, meta: { latencyMs: 0, agentStats: {} } }

      const agentDef = AGENTS[agentIdx]
      // 为 frame-designer 和 props-designer 提供角色+场景 context
      let contextJson = ''
      let extraPrompt = ''  // 额外的用户提示（如场景优化指令）
      if (input.existingSpec) {
        const es = input.existingSpec
        if (agentIdx === 2 || agentIdx === 5 || agentIdx === 6) {
          contextJson = JSON.stringify({
            characters: es.characterSpecs || [],
            scenes: es.sceneSpecs || [],
          })
        }
      }
      // ⭐ Default sectionStoryText — fallback for non-Runtime agents
      let sectionStoryText = storyText
      // ⭐ 场景 section 特殊处理：用 RuntimePromptCompiler 替代 storyText
      if (agentIdx === 2) {
        try {
          const { buildRuntimeContext, buildRuntimePrompt } = await import('../api/director-v2/runtime/runtime-prompt-builder.js')
          // ⭐ 用 sceneDescriptions 数组替代单值 sceneDescription
          const sceneDescs = (input as any).sceneDescriptions
          const runtime = buildRuntimeContext({
            sceneDescription: (input as any).sceneDescription,
            sceneDescriptions: sceneDescs,
            sceneSpecs: input.existingSpec?.sceneSpecs,
            characterSpecs: input.existingSpec?.characterSpecs,
            videoSegments: input.existingSpec?.videoSegments,
          })
          sectionStoryText = buildRuntimePrompt(runtime, 'scene', {
            enhance: (input as any).instruction || '请以场景图概念设计为目标，优化所有场景的视觉提示词。输出纯视觉场景图描述，不包含人物、角色。重点描述每个场景的环境、光线、构图、色调、氛围。可以增强细节，但不能改变场景的核心视觉设定。',
            trace: true,
          })
          console.log(`[AigcOrchestrator] 🏃 SCENE RUNTIME CONSUMPTION: prompt length=${sectionStoryText.length}, sceneDescs=${sceneDescs?.length || 0}, hasSceneDesc=${!!(input as any).sceneDescription}`)
        } catch (err: any) {
          console.warn(`[AigcOrchestrator] ⚠️ RuntimePromptBuilder failed (${err.message}), fallback to legacy storyText`)
          // Legacy fallback: use sceneDescription if available
          if ((input as any).sceneDescription) sectionStoryText = (input as any).sceneDescription
        }
      }
      // ⭐ storyboard section 特殊处理：通过 RuntimePromptCompiler 构建完整上下文
      if (agentIdx === 5) {
        extraPrompt = (input as any).instruction || ''
        try {
          const { buildRuntimeContext, buildRuntimePrompt } = await import('../api/director-v2/runtime/runtime-prompt-builder.js')
          const runtime = buildRuntimeContext({
            scriptText: storyText,
            sceneDescription: (input as any).sceneDescription,
            sceneSpecs: input.existingSpec?.sceneSpecs,
            characterSpecs: input.existingSpec?.characterSpecs,
            videoSegments: input.existingSpec?.videoSegments,
            voiceConfigs: input.existingSpec?.voiceConfigs,
          })
          const runtimePrompt = buildRuntimePrompt(runtime, 'storyboard', {
            trace: true,
          })
          sectionStoryText = runtimePrompt
          console.log(`[AigcOrchestrator] 🏃 STORYBOARD RUNTIME CONSUMPTION: prompt length=${runtimePrompt.length}`)
        } catch (err: any) {
          console.warn(`[AigcOrchestrator] ⚠️ Storyboard RuntimePromptBuilder failed (${err.message}), using legacy storyText`)
        }
        console.log(`[AigcOrchestrator] 🏃 storyboard section optimize: text length=${sectionStoryText?.length||0}, extraPrompt length=${extraPrompt?.length||0}`)
        // ⭐ 从 DB 读取分镜优化模板（SSOT Phase 4：缺失即抛错，禁止硬编码 fallback）
        const storyboardSystemPrompt = await loadPromptTemplateStrict('storyboard-optimizer')
        const raw = await callAgentLLM(
          storyboardSystemPrompt,
          sectionStoryText,
          contextJson,
          '分镜提示词优化',
          '',
          userId
        )
        let storyboardSpecs: any[] = []
        try {
          // 尝试解析 JSON
          const parsed = JSON.parse(raw.replace(/```json\s*([\s\S]*?)```/g, '$1').trim())
          if (Array.isArray(parsed)) {
            storyboardSpecs = parsed
          } else if (parsed.storyboardSpecs) {
            storyboardSpecs = parsed.storyboardSpecs
          } else if (parsed.imagePrompt) {
            storyboardSpecs = [parsed]
          }
        } catch {
          console.warn('[AigcOrchestrator] storyboard section JSON parse failed, trying regex fallback')
          // 正则回退
          const posMatch = raw.match(/(?:正向|positive)[：:]\s*([\s\S]*?)(?=(?:负向|negative)[：:]|$)/i)
          const negMatch = raw.match(/(?:负向|negative)[：:]\s*([\s\S]*?)$/i)
          if (posMatch?.[1]?.trim()) {
            storyboardSpecs = [{
              imagePrompt: posMatch[1].trim(),
              negativePrompt: negMatch?.[1]?.trim() || '',
            }]
          }
        }
        if (storyboardSpecs.length === 0) {
          return { success: false, error: '分镜提示词优化失败：JSON 解析失败', meta: { latencyMs: Date.now() - start, agentStats: {} } }
        }
        return {
          success: true,
          data: { storyboardSpecs } as any,
          meta: { latencyMs: Date.now() - start, agentStats: { '分镜提示词优化': { success: true } } },
        }
      }

      // ⭐ 场景 section：不走 runAgent（场景设计师），直接用 scene-optimizer 模板调 LLM
      if (agentIdx === 2) {
        console.log(`[AigcOrchestrator] 🏃 scene section optimize: text length=${sectionStoryText?.length||0}, extraPrompt length=${extraPrompt?.length||0}`)
        // 从 DB 读取场景优化模板（SSOT Phase 4：缺失即抛错，禁止硬编码 fallback）
        const sceneSystemPrompt = await loadPromptTemplateStrict('scene-optimizer')
        const raw = await callAgentLLM(
          sceneSystemPrompt,
          sectionStoryText,
          contextJson,
          '场景图提示词优化',
          styleSuffix,
          userId,
        )
        let sceneSpecs: any[] = []
        try {
          const parsed = JSON.parse(raw.replace(/```json\s*([\s\S]*?)```/g, '$1').trim())
          // 尝试多种输出格式：sceneSpecs 数组、scenes 数组、直接数组
          if (parsed.sceneSpecs && Array.isArray(parsed.sceneSpecs)) sceneSpecs = parsed.sceneSpecs
          else if (parsed.scenes && Array.isArray(parsed.scenes)) sceneSpecs = parsed.scenes
          else if (Array.isArray(parsed)) sceneSpecs = parsed
          // 保底：把 imagePrompt 补回
          sceneSpecs = sceneSpecs.filter((s: any) => s.imagePrompt)
          // 补全 sceneName
          const origScenes = (input.existingSpec?.sceneSpecs || [])
          sceneSpecs.forEach((s: any, i: number) => {
            if (!s.sceneName && origScenes[i]) s.sceneName = origScenes[i].name
          })
          console.log(`[AigcOrchestrator] ✅ 场景优化成功: ${sceneSpecs.length} 条`)
        } catch (err: any) {
          console.warn(`[AigcOrchestrator] ❌ 场景优化 JSON 解析失败: ${err.message}, raw=${raw.substring(0, 200)}`)
        }
        if (sceneSpecs.length === 0) {
          return { success: false, error: '场景图提示词优化失败', meta: { latencyMs: Date.now() - start, agentStats: {} } }
        }
        return {
          success: true,
          data: { sceneSpecs } as any,
          meta: { latencyMs: Date.now() - start, agentStats: { '场景图提示词优化': { success: true } } },
        }
      }
      // ⭐ makeup / character / voice / props / supervisor: 使用 runAgent（调用 LLM Agent 模板）
      if (agentIdx !== 2 && agentIdx !== 5) {
        console.log(`[AigcOrchestrator] 🏃 ${section} section: running agent ${agentDef.name}`)
        const raw = await runAgent(agentDef, sectionStoryText, contextJson, 1, styleSuffix, userId)
        if (!raw.success) {
          // ⭐ SSOT（Phase 4 / Task 4.4）: 禁止 success:true + 空数组。
          //    任何 Agent 失败都必须返回失败契约，由前端展示 userMessage，不静默降级。
          return {
            success: false,
            errorCode: `${agentDef.name}_GENERATION_FAILED`,
            error: `${agentDef.name} 生成失败: ${raw.error || 'LLM 调用失败'}`,
            userMessage: `${agentDef.name} 生成失败，请重试。${raw.error ? `（${raw.error}）` : ''}`,
            meta: { latencyMs: Date.now() - start, agentStats: { [agentDef.name]: { success: false, error: raw.error } } },
          }
        }
        const output: any = {}
        if (agentIdx === 6) {
          const propRoot = raw.rawSpec || raw.spec
          output.propSpecs = propRoot?.props || propRoot?.propSpecs || raw.spec?.props || raw.spec?.propSpecs || []
        } else {
          output[agentDef.outputKey] = raw.spec
        }
        return {
          success: true,
          data: output as any,
          meta: { latencyMs: Date.now() - start, agentStats: { [agentDef.name]: { success: true } } },
        }
      }

      // For storyboard/scene agents that have already returned above — this is unreachable
      // but kept for clarity
      if (!raw.success) {
        return { success: false, error: `${agentDef.name} 失败: ${raw.error}`, meta: { latencyMs: Date.now() - start, agentStats: {} } }
      }

      const output: any = {}
      if (agentIdx === 5) {
        // storyboard/video → 画面设计师，返回 videoSegments + frameDesign
        // ⚠️ 画面设计师的 outputKey 是 frameDesign，但实际 AI 输出包含 videoSegments + frameDesign + videoProduction
        // 必须从 raw.rawSpec（顶层 JSON）取这些字段，而不是 raw.spec（它会被 outputKey 截断为 frameDesign 数组）
        const topLayer = raw.rawSpec || raw.spec
        const videoSegments = topLayer?.videoSegments || []
        const frameDesign = topLayer?.frameDesign || []
        const videoProduction = topLayer?.videoProduction || (Array.isArray(topLayer) ? null : topLayer)

        // ⭐ 合并 frameDesign.firstFramePrompt → videoSegments 的 imagePrompt
        if (frameDesign?.length > 0 && videoSegments.length > 0) {
          for (let i = 0; i < videoSegments.length; i++) {
            if (!videoSegments[i].imagePrompt && frameDesign[i]?.firstFrame?.imagePrompt) {
              videoSegments[i].imagePrompt = frameDesign[i].firstFrame.imagePrompt
            }
          }
        }

        // storyboard section 返回 storyboardSpecs（含 imagePrompt + negativePrompt）
        if (section === 'storyboard') {
          // 从 rawSpec 顶层提取直出的 storyboardSpecs，或从 videoSegments 构建
          const stSpecs = topLayer?.storyboardSpecs || []
          if (stSpecs.length > 0) {
            output.storyboardSpecs = stSpecs
          } else if (videoSegments?.length) {
            output.storyboardSpecs = videoSegments.map((vs: any) => ({
              imagePrompt: vs.imagePrompt || '',
              negativePrompt: vs.negativePrompt || '',
              sceneName: vs.title || '',
              description: vs.fullText || '',
            }))
          }
        }
      } else if (agentIdx === 6) {
        // props → 道具设计师，提取 props 数组
        const propRoot = raw.rawSpec || raw.spec
        output.propSpecs = propRoot?.props || propRoot?.propSpecs || raw.spec?.props || raw.spec?.propSpecs || []
      } else {
        output[agentDef.outputKey] = raw.spec
      }

      // ⭐ 场景 section：容错处理 — AI 可能不输出 imagePrompt，从其他字段组合
      if (agentIdx === 2 && Array.isArray(output.sceneSpecs)) {
        const esScenes = (input.existingSpec?.sceneSpecs || [])
        output.sceneSpecs = output.sceneSpecs.map((s: any, i: number) => {
          const original = esScenes.find((x: any) => x.sceneName === s.sceneName || x.name === s.sceneName) || esScenes[i] || {}
          if (!s.imagePrompt) {
            s.imagePrompt = s.visualPrompt || s.visualDescription || s.prompt || s.optimizedPrompt || 
              original.imagePrompt || 
              [s.description || original.description || '', s.environment || original.environment || '', s.mood || original.mood || '']
                .filter(Boolean).join('。') || 
              s.sceneName || ''
          }
          if (!s.sceneName) s.sceneName = original.sceneName || original.name || `场景${i + 1}`
          if (!s.description) s.description = original.description || ''
          return s
        })
      }

      return {
        success: true,
        data: output,
        meta: { latencyMs: Date.now() - start, agentStats: { [agentDef.name]: { success: true } } },
      }
    }

    // === Phase 0: 剧情总指挥（统筹）→ 输出剧情蓝图 ===
    console.log(`[AigcOrchestrator] 🎬 Phase 0: 剧情总指挥启动...`)
    const supervisorResult = await runAgent(AGENTS[0], storyText, '', 1, styleSuffix, userId)
    this.stats.agentResults['plot-supervisor'] = { success: supervisorResult.success, error: supervisorResult.error }

    const plotBlueprint = supervisorResult.success
      ? (supervisorResult.rawSpec?.plotBlueprint || supervisorResult.spec?.plotBlueprint || {})
      : {}

    if (!supervisorResult.success) {
      console.warn(`[AigcOrchestrator] ⚠️ 剧情总指挥失败，继续执行专业 Agent: ${supervisorResult.error}`)
    } else {
      console.log(`[AigcOrchestrator] ✅ 剧情蓝图生成: 类型=${plotBlueprint.storyType || '未知'}, 角色=${(plotBlueprint.characterOverview || []).length}人`)
    }

    // 构建上下文：剧情蓝图给后续 agent 参考
    const blueprintContext = supervisorResult.success ? `\n【剧情蓝图】\n${JSON.stringify(plotBlueprint, null, 2)}` : ''
    console.log(`[AigcOrchestrator] 📋 剧情蓝图 structure: type=${plotBlueprint.storyType || 'none'}, characters=${(plotBlueprint.characters || []).length}, scenes=${(plotBlueprint.scenes || []).length}`)
    if (plotBlueprint.characters?.length > 0) {
      plotBlueprint.characters.forEach((c: any, i: number) => {
        const evos = c.stateEvolution || []
        console.log(`[AigcOrchestrator]   character[${i}]: ${c.name}, stateEvolution=${evos.length} items`)
        evos.forEach((e: any, j: number) => {
          console.log(`[AigcOrchestrator]     evolution[${j}]: variant="${e.variant}", sceneRange=[${e.sceneRange}]`)
        })
      })
    }

    // === Phase 1-7: 专业 Agent 并行执行（角色/场景/定妆/声音/画面/道具/镜头） ===
    // 后续用户可通过"✨ AI 优化"单条触发 section 模式重新生成
    //
    // TODO: DAG 优化 - Phase 1 的以下步骤可并行（当前已用 Promise.allSettled 并行）：
    //   - 角色设计（AGENTS[1] character-designer）
    //   - 场景设计（AGENTS[2] scene-designer）
    //   - 定妆师（AGENTS[3] makeup-designer）依赖角色，但与场景独立
    //
    // TODO: DAG 优化 - Phase 2 的以下步骤可并行（当前已用 Promise.allSettled 并行）：
    //   - 声音（AGENTS[4] sound-designer）依赖角色但独立于场景
    //   - 画面（AGENTS[5] frame-designer）依赖角色+场景
    //   - 道具（AGENTS[6] props-designer）依赖角色+场景
    //   - 镜头/特效（AGENTS[7] director-of-photography）依赖场景但独立
    //
    // 进一步优化方向：如果 Phase 1 的角色设计（buildCharacter）已完成，Phase 2 的
    // buildPortrait（定妆）和 buildVoice（声音）可以提前启动，不必等待 Phase 1 全部完成。
    // 当前 Phase 2 等 Phase 1 全部完成才启动，但实际定妆只依赖角色，声音也只依赖角色。
    // 更细粒度的 DAG 调度可通过 AgentDef 表的 executionMode 字段实现。
    console.log(`[AigcOrchestrator] 🏃 Phase 1-7: 专业 Agent 并行启动...`)

    // Agent 1-3（角色/场景/定妆）→ 先跑，给后续提供 context
    const phase1Indices = [1, 2, 3] // 角色设计师、场景设计师、定妆师
    const phase1Results = await Promise.allSettled(
      phase1Indices.map(idx => runAgent(AGENTS[idx], storyText, blueprintContext, 1, styleSuffix, userId))
    )

    // 提取 Phase 1 的成功结果（用于后续 agent 的 context）
    const phase1Specs: Record<string, any> = {}
    phase1Indices.forEach((idx, i) => {
      const r = phase1Results[i]
      if (r.status === 'fulfilled' && r.value.success) {
        if (idx === 1) phase1Specs.characterSpecs = r.value.spec
        if (idx === 2) phase1Specs.sceneSpecs = r.value.spec
        if (idx === 3) phase1Specs.characterMakeupSpecs = r.value.spec
        this.stats.agentResults[AGENTS[idx].name] = { success: true }
      } else {
        const err = r.status === 'fulfilled' ? r.value.error : (r.reason?.message || 'unknown')
        this.stats.agentResults[AGENTS[idx].name] = { success: false, error: err }
        console.warn(`[AigcOrchestrator] ⚠️ ${AGENTS[idx].name} 失败: ${err}`)
      }
    })

    // Agent 4-7（声音/画面/道具/镜头）→ 并行，带上 phase1 结果做 context
    const phase1Context = Object.keys(phase1Specs).length > 0
      ? blueprintContext + `\n【已生成的角色/场景规格】\n${JSON.stringify(phase1Specs, null, 2)}`
      : blueprintContext

    const phase2Indices = [4, 5, 6, 7] // 声音、画面、道具、镜头
    const phase2Results = await Promise.allSettled(
      phase2Indices.map(idx => runAgent(AGENTS[idx], storyText, phase1Context, 1, styleSuffix, userId))
    )

    // 提取 Phase 2 结果（画面设计师特殊处理）
    const phase2Specs: Record<string, any> = {}
    phase2Indices.forEach((idx, i) => {
      const r = phase2Results[i]
      if (r.status === 'fulfilled' && r.value.success) {
        if (idx === 4) phase2Specs.voiceConfigs = r.value.spec
        if (idx === 5) {
          // 画面设计师：提取 videoSegments + frameDesign + videoProduction
          // ⚠️ 必须从 raw.rawSpec（顶层 JSON）取，因为 raw.spec 被 outputKey 截断为 frameDesign
          const topLayer = r.value.rawSpec || r.value.spec
          phase2Specs.videoSegments = topLayer?.videoSegments || []
          phase2Specs.frameDesign = topLayer?.frameDesign || []
          phase2Specs.videoProduction = topLayer?.videoProduction || {}
        }
        if (idx === 6) {
          const propRoot = r.value.rawSpec || r.value.spec
          phase2Specs.propSpecs = propRoot?.props || propRoot?.propSpecs || r.value.spec?.props || r.value.spec?.propSpecs || []
        }
        if (idx === 7) phase2Specs.effectSpecs = r.value.spec
        this.stats.agentResults[AGENTS[idx].name] = { success: true }
      } else {
        const err = r.status === 'fulfilled' ? r.value.error : (r.reason?.message || 'unknown')
        this.stats.agentResults[AGENTS[idx].name] = { success: false, error: err }
        console.warn(`[AigcOrchestrator] ⚠️ ${AGENTS[idx].name} 失败: ${err}`)
      }
    })

    console.log(`[AigcOrchestrator] ✅ Phase 1-7 完成`)

    // 从镜头/特效师输出中提取 actionSpecs/cameraSpecs/emotionSpecs
    const effectRoot = phase2Specs.effectSpecs || {}
    const actionSpecs = effectRoot.actionSpecs || plotBlueprint.actionSpecs || []
    const cameraSpecs = effectRoot.cameraSpecs || plotBlueprint.cameraSpecs || []
    const emotionSpecs = effectRoot.emotionSpecs || []

    const output: AigcSpecOutput = {
      plotBlueprint,
      characterSpecs: (phase1Specs.characterSpecs || []).map((c: any) => {
        // ⭐ 确保 name 为中文角色名（如果 alias 是中文而 name 不是，交换两者）
        const rawName = (c.name || '').trim()
        const rawAlias = (c.alias || '').trim()
        if (!rawName && rawAlias) return { ...c, name: rawAlias, alias: '' }
        const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s)
        if (!hasChinese(rawName) && hasChinese(rawAlias)) {
          return { ...c, name: rawAlias, alias: rawName }
        }
        return c
      }),
      characterMakeupSpecs: phase1Specs.characterMakeupSpecs || [],
      sceneSpecs: phase1Specs.sceneSpecs || [],
      voiceConfigs: phase2Specs.voiceConfigs || [],
      videoSegments: phase2Specs.videoSegments || [],
      frameDesign: phase2Specs.frameDesign || [],
      videoProduction: phase2Specs.videoProduction || {},
      propSpecs: phase2Specs.propSpecs || [],
      effectSpecs: phase2Specs.effectSpecs || [],
      actionSpecs,
      cameraSpecs,
      emotionSpecs,
      storyboardSpecs: [],
    }

    return {
      success: true,
      data: output,
      meta: {
        latencyMs: Date.now() - start,
        agentStats: this.stats.agentResults,
      },
    }
  }

  getStats() {
    return { ...this.stats }
  }
}

// ─── Singleton ────────────────────────────────────────

export const aigcOrchestrator = new AigcSpecOrchestrator()

// ============================================================
// V3 NarrativeConstitution → AigcSpecOutput 映射函数
// ============================================================

function buildV3SpecOutput(d: any, input: AigcSpecInput): AigcSpecOutput {
  // 后处理：根据剧本字数约束分段数，超出则自动合并
  const storyText = input.text || input.title || '';
  const maxSegments = Math.max(1, Math.ceil((storyText.length || 300) / 120));
  if ((d.segments?.length || 0) > maxSegments) {
    console.log('[buildV3SpecOutput] segments auto-merge: ' + d.segments.length + ' -> ' + maxSegments + ' (textLen=' + storyText.length + ')');
    d.segments = mergeSegments(d.segments, maxSegments, storyText);
  }
  // 从 segments 派生 emotionCurve（向后兼容）
  const derivedEmotionCurve = (d.segments || []).map((s: any, i: number) => ({
    timeIndex: i,
    segmentKey: s.id || `seg_${s.segmentNumber || i + 1}`,
    segmentId: s.id || `seg_${s.segmentNumber || i + 1}`,
    timeRange: '',
    emotionIntensity: s.emotion?.intensity ? Math.round(s.emotion.intensity * 100) : 50,
    emotionDesc: s.emotion?.type || s.emotion || 'neutral',
    emotion: s.emotion?.type || s.emotion || `点 ${i + 1}`,
    intensity: s.emotion?.intensity ?? 0.5,
  }))

  return {
    plotBlueprint: {
      title: input.title || d.title || '',
      genre: [input.genre || '未知'],
      logline: '',
      synopsis: '',
      threeActStructure: {
        act1: d.storyArc?.setup || '',
        act2: d.storyArc?.conflict || '',
        act3: d.storyArc?.climax || '',
        resolution: d.storyArc?.resolution || '',
      },
      characters: (d.characters || []).map((c: any) => {
        const rawName = c.name || ''
        const rawAlias = c.alias || ''
        const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s)
        const finalName = hasChinese(rawName) ? rawName : (hasChinese(rawAlias) ? rawAlias : rawName)
        const finalAlias = finalName === rawName ? rawAlias : rawName
        return { name: finalName, alias: finalAlias } }),
      scenes: (d.scenes || []).map((s: any) => ({ name: s.name || s.sceneName, alias: '' })),
      segments: (d.segments || []).map((s: any) => ({
        segmentId: s.id || `seg_${s.segmentNumber || 0}`,
        sortOrder: s.segmentNumber || 0,
        title: `${s.id || ''} ` + `第${s.segmentNumber}段`,
        script: s.visualDesc || '',
        dialogue: s.dialogue || '',
        emotionArc: s.emotion?.type || '',
        duration: s.duration || 12,
        name: `${s.id || ''} ` + `第${s.segmentNumber}段`,
      })),
    },
    characterSpecs: (d.characters || []).map((c: any) => {
      // ⭐ 如果 alias 是中文而 name 是英文，交换两者（确保 name 为原始角色名）
      const rawName = c.name || ''
      const rawAlias = c.alias || ''
      const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s)
      const finalName = hasChinese(rawName) ? rawName : (hasChinese(rawAlias) ? rawAlias : rawName)
      const finalAlias = finalName === rawName ? rawAlias : rawName
      return {
        name: finalName,
        alias: finalAlias,
        identity: c.alias || '',
      age: c.age || '',
      appearance: typeof c.appearance === 'string' ? { description: c.appearance } : (c.appearance || {}),
      description: typeof c.appearance === 'string' ? c.appearance : (c.appearance?.description || c.appearance || ''),
      gender: c.alias?.includes('女') ? '女' : (c.alias?.includes('男') ? '男' : ''),
      personality: Array.isArray(c.personality) ? c.personality.map((p: string) => ({ trait: p })) : [],
      background: c.background || '',
      arc: c.arc || '',
      voiceGuide: c.voiceGuide || '',
      emotionState: c.emotionState || '',
      motivation: c.motivation || '',
      goal: c.goal || '',
      }
    }),
    characterMakeupSpecs: [],
    sceneSpecs: (d.scenes || []).map((s: any, si: number) => {
      const env = s.environment || {};
      const _loc = typeof env === 'object' ? (env.location || '') : '';
      const _atm = typeof env === 'object' ? (env.atmosphere || '') : '';
      const _envStr = typeof env === 'string' ? env : '';
      const _sty = s.style || '';
      const _desc = s.description || s.summary || [_loc, _atm, _sty, _envStr].filter(Boolean).join('、') || s.name || '';
      // ⭐ 从该场景的所有段落中推导情绪基调（取最频繁的情绪类型）
      const sceneSegments = (d.segments || []).filter((seg: any) => seg.sceneId === s.id || seg.sceneId === `scene_${si + 1}`)
      const sceneMood = sceneSegments.length > 0
        ? sceneSegments.map((seg: any) => seg.emotion?.type || '').filter(Boolean).sort((a: string, b: string) =>
            sceneSegments.filter((s: any) => (s.emotion?.type || '') === a).length -
            sceneSegments.filter((s: any) => (s.emotion?.type || '') === b).length
          ).pop() || _atm
        : _atm
      return {
        name: s.name || '',
        sceneName: s.name || '',
        description: _desc,
        summary: s.summary || _desc,
        alias: '',
        category: s.location || '',
        environment: typeof env === 'object' && env !== null
          ? env
          : (typeof env === 'string' ? env : {}),
        environmentText: typeof env === 'object' && env !== null
          ? `${env.location || ''}，${env.atmosphere || ''}`
          : (typeof env === 'string' ? env : ''),
        mood: sceneMood,
        spaceStructure: '',
        colorPalette: typeof env === 'object' ? (env.colorPalette || '') : '',
        lighting: typeof env === 'object' ? (env.lighting || '') : '',
        // ⭐ P0: 补齐缺失的六维字段
        weather: typeof env === 'object' ? (env.weather || '') : '',
        timeOfDay: typeof env === 'object' ? (env.timeOfDay || '') : '',
        moodKeywords: [],
        dramaticFunction: '',
        emotion: sceneMood,
        narrativePurpose: '',
        // ⭐ 从六维数据自动编译默认 imagePrompt（即使 AI 优化未触发也有基础提示词）
        imagePrompt: [
          `${env.location || ''}，${env.atmosphere || ''}`,
          env.lighting ? `光照：${env.lighting}` : '',
          env.weather ? `天气：${env.weather}` : '',
          env.timeOfDay ? `时段：${env.timeOfDay}` : '',
          env.colorPalette ? `色调：${env.colorPalette}` : '',
          sceneMood ? `氛围：${sceneMood}` : '',
        ].filter(Boolean).join('，') || _desc,
      };
    }),
    voiceConfigs: (d.voices || []).map((v: any) => {
      const foundChar = (d.characters || []).find((c: any) => c.id === v.characterId)
      return {
      characterName: foundChar?.name || '',
      voiceType: v.voiceType || '',
      timbre: v.timbre || '',
      speed: v.speed || '',
      pitch: '',
      speakingStyle: v.speakingStyle || '',
      emotionalRange: '',
      reference: '',
      characterId: v.characterId || '',
    }}),
    videoSegments: (d.segments || []).map((s: any) => {
      // ⭐ P7: visualDesc 是派生字段，如果 LLM 未输出则从结构化数据自动编译
      // 优先使用 segment 级数据，不足时从场景级 environment 补充
      const _sceneId = s.sceneId || ''
      const _scene = (d.scenes || []).find((sc: any) => sc.id === _sceneId)
      const _sceneEnv = _scene?.environment || {}
      const _segEnv = typeof s.environment === 'object' ? s.environment : {}
      const _camera = typeof s.camera === 'object' ? [s.camera.shot, s.camera.movement, s.camera.angle].filter(Boolean).join('/') : ''
      const _action = typeof s.action === 'object' ? [s.action.primary, s.action.interaction, s.action.expression].filter(Boolean).join('，') : (s.action || '')
      // 环境描述：先用 segment 级，不足时从场景级补充
      const _env = [_segEnv.location, _segEnv.lighting, _segEnv.atmosphere].filter(Boolean).join('，') 
        || [_sceneEnv.location, _sceneEnv.lighting, _sceneEnv.atmosphere, _sceneEnv.weather, _sceneEnv.timeOfDay].filter(Boolean).join('，')
      const _charNames = (s.characters || []).map((cp: any) => {
        const foundChar = (d.characters || []).find((c: any) => c.id === cp.characterId)
        return foundChar?.name || cp.characterId || ''
      }).filter(Boolean).join('、')
      const _visualDesc = s.visualDesc || [_env, _charNames, _camera, _action, s.dialogue, s.emotion?.type].filter(Boolean).join(' | ')
      return {
        segmentId: s.id || `seg_${s.segmentNumber || 0}`,
        segmentNumber: s.segmentNumber || 0,
        title: s.id || '',
        name: s.id || '',
        sceneNumber: (s.sceneId || '').replace('scene_', '') || '0',
        sceneName: (d.scenes || []).find((sc: any) => sc.id === s.sceneId)?.name || s.sceneId || '',
        sceneAlias: '',
        associatedScenes: JSON.stringify([(d.scenes || []).find((sc: any) => sc.id === s.sceneId)?.name || s.sceneId || 'scene_unknown']),
        scenes: [(d.scenes || []).find((sc: any) => sc.id === s.sceneId)?.name || s.sceneId || ''].filter(Boolean),
        timeOfDay: s.environment?.timeOfDay || '',
        startTime: '',
        endTime: '',
        duration: s.duration || 12,
        narrative: (_visualDesc || '') + (s.dialogue ? ' 对白：' + s.dialogue : ''),
        narrativePurpose: _visualDesc || '',
        fullText: _visualDesc || '',
        visualDesc: _visualDesc || '',
      action: typeof s.action === 'object' && s.action !== null
        ? { primary: s.action.primary || '', interaction: s.action.interaction || '', expression: s.action.expression || '' }
        : (typeof s.action === 'string' ? { primary: s.action, interaction: '', expression: '' } : s.action || {}),
      actionText: typeof s.action === 'object' && s.action !== null
        ? [s.action.primary, s.action.interaction, s.action.expression].filter(Boolean).join('，')
        : (s.action || ''),
      dialogue: s.dialogue || '',
      emotionAmbience: s.emotion?.type || '',
      emotionalTone: s.emotion?.type || '',
      emotionArc: s.emotion?.type || 'neutral',
      characterPresence: (s.characters || []).map((cp: any) => {
        const foundChar = (d.characters || []).find((c: any) => c.id === cp.characterId)
        return {
          characterId: cp.characterId,
          name: foundChar?.name || cp.characterId || '',
          role: cp.role || 'primary',
          emotion: cp.emotion || '',
          focus: cp.focus || 0.5,
        }
      }),
      scenePresence: [(d.scenes || []).find((sc: any) => sc.id === s.sceneId)?.name || s.sceneId || ''].filter(Boolean),
      propPresence: [],
      cameraAngle: s.camera?.angle || '',
      cameraMovement: s.camera?.movement || '',
      cameraShot: s.camera?.shot || '',
      cameraLens: s.camera?.lens || '',
      sortOrder: s.segmentNumber || 0,
    }}),
    frameDesign: {
      visualStyle: input.visualStyle || '',
      colorGuideline: '',
    },
    videoProduction: {
      totalDuration: (d.segments || []).reduce((sum: number, s: any) => sum + (s.duration || 12), 0),
      aspectRatio: '9:16',
    },
    propSpecs: (d.props || []).map((p: any) => ({
      propName: p.name || '',
      name: p.name || '',
      category: p.category || '',
      description: p.description || '',
      function: p.function || '',
      designNotes: p.designNotes || '',
      character: p.character || p.characterId || '',
      characterName: p.characterName || p.character || '',
    })),
    effectSpecs: (d.effectsDesign || []).map((e: any, i: number) => ({
      segmentKey: e.segmentId || '',
      segmentNumber: i,
      ambientSound: '',
      actionSound: '',
      emotionMusic: '',
      visualEffects: e.visualEffect || '',
      transition: e.transition || '',
      effectName: e.segmentId || `特效 ${i + 1}`,
      effectType: 'vfx_sound',
      description: e.visualEffect || '',
      visualDescription: e.visualEffect || '',
      intensity: 1.0,
    })),
    actionSpecs: [],
    cameraSpecs: [],
    emotionSpecs: derivedEmotionCurve,
    storyboardSpecs: [],
    characters: (d.characters || []).map((c: any) => ({
      name: c.name || '',
      alias: c.alias || '',
      identity: c.alias || '',
      age: c.age || '',
      appearance: c.appearance || '',
      description: typeof c.appearance === 'string' ? c.appearance : (c.appearance?.description || c.appearance || ''),
      personality: c.personality || [],
      background: '',
      arc: '',
    })),
    scenes: (d.scenes || []).map((s: any) => ({
      sceneName: s.name || '',
      sceneAlias: '',
      name: s.name || '',
      locationType: s.location || '',
      environment: typeof s.environment === 'object' && s.environment !== null
        ? s.environment.location || ''
        : (s.environment || ''),
      description: s.summary || s.description || '',
      imagePrompt: s.imagePrompt || '',
      timeOfDay: s.environment?.timeOfDay || '',
      weather: s.environment?.weather || '',
      mood: s.mood || s.atmosphere || '',
      atmosphere: s.environment?.atmosphere || '',
      spaceStructure: '',
      colorPalette: s.environment?.colorPalette || '',
      lighting: s.environment?.lighting || '',
      moodKeywords: [],
    })),
    voices: (d.voices || []).map((v: any) => ({
      characterName: '',
      voiceType: v.voiceType || '',
      timbre: v.timbre || '',
      speed: v.speed || '',
      pitch: '',
      speakingStyle: v.speakingStyle || '',
      emotionalRange: '',
      reference: '',
    })),
    props: (d.props || []).map((p: any) => ({
      name: p.name || '',
      category: p.category || '',
      description: p.description || '',
      function: p.function || '',
      designNotes: p.designNotes || '',
      relatedCharacter: '',
    })),
    effects: (d.effectsDesign || []).map((e: any, i: number) => ({
      segmentKey: e.segmentId || '',
      ambientSound: '',
      actionSound: '',
      emotionMusic: '',
      visualEffects: e.visualEffect || '',
      transition: e.transition || '',
      effectName: e.segmentId || `特效 ${i + 1}`,
      effectType: 'vfx_sound',
    })),
    emotionCurve: derivedEmotionCurve,
    segments: (d.segments || []).map((s: any) => ({
      segmentId: s.id || `seg_${s.segmentNumber || 0}`,
      segmentNumber: s.segmentNumber || 0,
      sceneNumber: parseInt((s.sceneId || '').replace('scene_', '') || '0', 10),
      sceneName: s.sceneId || '',
      sceneAlias: '',
      startTime: '',
      endTime: '',
      duration: s.duration || 12,
      visualDesc: s.visualDesc || '',
      action: typeof s.action === 'object' && s.action !== null ? s.action.primary || '' : (s.action || ''),
      dialogue: s.dialogue || '',
      emotionAmbience: s.emotion?.type || '',
      emotion: s.emotion?.type || '',
      emotionIntensity: s.emotion?.intensity ? Math.round(s.emotion.intensity * 100) : 0,
      title: s.id || '',
      name: s.id || '',
      sortOrder: s.segmentNumber || 0,
    })),
    storyArc: d.storyArc,
    cameraLanguage: [],
    soundDesign: d.soundDesign || [],
    effectsDesign: d.effectsDesign || [],
    videoDesigns: [],
    storyboard: [],
    effectSound: [],
    // V3 结构化透传
    v3: {
      segments: (d.segments || []),
      characters: (d.characters || []),
      scenes: (d.scenes || []),
    },
  } as unknown as AigcSpecOutput
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};



// 合并 segments 到目标数量（按字数均匀分配）
function mergeSegments(segs: any[], targetCount: number, storyText: string): any[] {
  if (segs.length <= targetCount) return segs;
  const result: any[] = [];
  const chunkSize = Math.ceil(segs.length / targetCount);
  for (let i = 0; i < segs.length; i += chunkSize) {
    const chunk = segs.slice(i, i + chunkSize);
    const first = chunk[0];
    result.push({
      ...first,
      id: first.id + '_merged',
      segmentNumber: result.length + 1,
      visualDesc: chunk.map(s => s.visualDesc || s.description || '').filter(Boolean).join('，'),
      dialogue: chunk.map(s => s.dialogue || '').filter(Boolean).join('\n'),
      duration: chunk.reduce((sum, s) => sum + (s.duration || 8), 0),
      characters: chunk.flatMap(s => s.characters || []),
      // 取最后一段的 emotion
      emotion: chunk[chunk.length - 1]?.emotion || chunk[chunk.length - 1]?.emotion,
      action: chunk.map(s => s.action || '').filter(Boolean).join('，'),
    });
  }
  return result;
}
