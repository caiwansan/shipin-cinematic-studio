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
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { createCinematicSequence } from '../cinematic-ir/types.js'
import { compileCinematicSequence } from '../cinematic-ir/compiler.js'

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
  const systemPrompt = readFileSync(
    join(__dirname, `../prompts/agents/${def.promptFile}`),
    'utf-8',
  )

  // 如果是剧情总指挥，附加红楼梦微表情库
  let finalPrompt = systemPrompt
  if (def.promptFile === 'plot-supervisor.txt') {
    try {
      const lib = readFileSync(
        join(__dirname, '../prompts/agents/honglou-microexpression-library.txt'),
        'utf-8',
      )
      finalPrompt = systemPrompt + '\n\n## 参考：红楼梦微表情库\n在以上角色面部分析和段落画面描述中，严格参考以下微表情风格库进行描写。每个角色必须有独特的表情特征。\n\n```\n' + lib + '\n```'
    } catch {}
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
      const output = spec[def.outputKey]
      if (!output) {
        // 尝试根级别返回
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
    // 尝试宽松解析（单引号 → 双引号、无引号 key、尾部逗号）
    try {
      return JSON.parse(
        jsonStr
          .replace(/'/g, '"')
          .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
          .replace(/,\s*([}\]])/g, '$1')
      )
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
}

export class AigcSpecOrchestrator {
  private stats = { calls: 0, successes: 0, failures: 0, agentResults: {} as Record<string, any> }

  async generate(input: AigcSpecInput): Promise<{
    success: boolean
    data?: AigcSpecOutput
    error?: string
    meta?: { latencyMs: number; agentStats: Record<string, any> }
  }> {
    const start = Date.now()
    this.stats.calls++

    const storyText = (input.text || '').slice(0, TEXT_MAX_LENGTH)
    const { section, userId } = input
    console.log(`[AigcOrchestrator] generate called, section=${section || '(full)'}`)

    // ⭐ 风格上下文（需要早于 section 和全量流程使用）
    const styleContext = []
    if (input.genre) styleContext.push(`【剧本风格】${input.genre}`)
    if (input.visualStyle) styleContext.push(`【视觉风格】${input.visualStyle}`)
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
      if (input.existingSpec) {
        const es = input.existingSpec
        if (agentIdx === 5 || agentIdx === 6) {
          contextJson = JSON.stringify({
            characters: es.characterSpecs || [],
            scenes: es.sceneSpecs || [],
          })
        }
      }
      const raw = await runAgent(agentDef, storyText, contextJson, 1, styleSuffix, userId)
      if (!raw.success) {
        return { success: false, error: `${agentDef.name} 失败: ${raw.error}`, meta: { latencyMs: Date.now() - start, agentStats: { [agentDef.name]: { success: false, error: raw.error } } } }
      }

      const output: any = {}
      if (agentIdx === 5) {
        // storyboard/video → 画面设计师，返回 videoSegments + frameDesign
        const frameRoot = raw.rawSpec || raw.spec
        output.videoSegments = frameRoot?.videoSegments || raw.spec?.videoSegments || []
        output.frameDesign = frameRoot?.frameDesign || raw.spec?.frameDesign || []
      } else if (agentIdx === 6) {
        // props → 道具设计师，提取 props 数组
        const propRoot = raw.rawSpec || raw.spec
        output.propSpecs = propRoot?.props || propRoot?.propSpecs || raw.spec?.props || raw.spec?.propSpecs || []
      } else {
        output[agentDef.outputKey] = raw.spec
      }

      // storyboard 复用 videoSegments key
      if (section === 'storyboard') delete output.frameDesign

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

    // ⭐ Phase 1-4 已迁移——专业 Agent（角色/场景/定妆/声音/画面/道具/镜头）
    // 不再在 generate() 中串行执行。用户通过前端卡片"📋 从总指挥获取"把剧情蓝图
    // 的纯文本填入各卡片，再点"✨ AI 优化"触发后端 section 模式逐项调用。
    // 此路径仅返回剧情总指挥拆解的 9 维纯文本 JSON。

    const output: AigcSpecOutput = {
      plotBlueprint,
      characterSpecs: [],
      characterMakeupSpecs: [],
      sceneSpecs: [],
      voiceConfigs: [],
      videoSegments: [],
      frameDesign: [],
      videoProduction: {},
      propSpecs: [],
      effectSpecs: [],
      actionSpecs: [],
      cameraSpecs: [],
      emotionSpecs: [],
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

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

