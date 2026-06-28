/**
 * @deprecated 此 Agent（v2）已被 ScriptBreakdown + 数据库驱动流程替代。
 * 当前脚本拆解逻辑已迁移至 Narrative Compiler v2 的 database-first 架构，
 * 通过 ScriptBreakdown model 持久化结果。
 * 此文件保留仅用于历史参考。
 *
 * aigc-spec-agent-v2.ts — Narrative Compiler v2 Agent
 *
 * 职责：
 *   - schema filler：从剧本中提取信息填充固定 schema
 *   - strict type enforcer：duration 8-10s，beats 之和=totalDuration
 *
 * 禁止：
 *   ❌ reasoning output（中间推理结果不返回）
 *   ❌ free text generation（只输出结构化 JSON）
 *   ❌ narrative rewriting（不改写剧本内容）
 *   ❌ summarization logic（不做摘要）
 *   ❌ prompt 拼接（不写自然语言指令）
 *
 * 系统已从 "prompt-based narrative generation" 进化为
 *   "deterministic narrative compilation"
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { buildPromptCached } from './prompt-service.js'

// ⭐ 从 PromptService 读取（统一入口）
// 读取 prompt 和 output_schema 两个字段
let systemPromptCache: { prompt: string; outputSchema: string } | null = null

async function loadSystemPrompt(): Promise<{ prompt: string; outputSchema: string }> {
  if (systemPromptCache) return systemPromptCache
  const result = await buildPromptCached({ agentName: 'aigc-spec-agent-v2' })
  if (!result.outputSchema) throw new Error('PromptTemplate.aigc-spec-agent-v2.output_schema 为空')
  systemPromptCache = { prompt: result.prompt, outputSchema: result.outputSchema }
  return systemPromptCache
}

export interface ScriptBreakdownInput {
  projectName: string
  title: string
  script: string
  targetDuration: number
  userId: string
  projectId?: string
}

export interface V2ExecuteOpts {
  input: ScriptBreakdownInput
  maxTokens?: number
  timeoutTier?: 'normal' | 'batch'
}

/**
 * 执行结构化拆解——不再拼接 prompt，schema 即指令
 */
export async function executeV2(opts: V2ExecuteOpts): Promise<any> {
  const { input, maxTokens = 16384, timeoutTier = 'batch' } = opts

  // 构造 user message: 只有剧本 + 参数，没有自然语言指令
  const userMessage = JSON.stringify({
    projectName: input.projectName,
    title: input.title,
    totalDuration: input.targetDuration,
    script: input.script.slice(0, 8000), // 长度保护
  })

  const sp = await loadSystemPrompt()
  const systemPrompt = sp.prompt + '\n\n## Schema 定义\n' + sp.outputSchema

  const result = await narrativeGateway.execute({
    systemPrompt,
    userMessage,
    userId: input.userId,
    projectId: input.projectId || input.title,
    timeoutTier,
    maxTokens,
  })

  const content = result.content
  if (!content.includes('{')) {
    throw new Error('Agent v2 输出不包含 JSON 结构')
  }

  // 提取 JSON
  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  const jsonStr = content.slice(jsonStart, jsonEnd + 1)

  try {
    const parsed = JSON.parse(jsonStr)
    validateBreakdown(parsed, input.targetDuration)
    return parsed
  } catch (err: any) {
    throw new Error(`Agent v2 JSON 解析失败: ${err.message}`)
  }
}

/**
 * 校验输出合法性
 */
function validateBreakdown(breakdown: any, expectedDuration: number): void {
  const errors: string[] = []

  if (!breakdown.videoSegments || !Array.isArray(breakdown.videoSegments)) {
    errors.push('缺少 videoSegments')
  } else {
    const total = breakdown.videoSegments.reduce((s: number, seg: any) => s + (seg.duration || 0), 0)
    if (Math.abs(total - expectedDuration) / expectedDuration > 0.1) {
      errors.push(`视频段总时长 ${total}s 偏离目标 ${expectedDuration}s 超过 ±10%`)
    }
    breakdown.videoSegments.forEach((seg: any, i: number) => {
      if (seg.duration < 8 || seg.duration > 10) {
        errors.push(`videoSegment[${i}] duration=${seg.duration}，不在 8-10s 范围内`)
      }
      if (seg.beats?.length) {
        const beatTotal = seg.beats.reduce((s: number, b: any) => s + (b.end - b.start), 0)
        if (Math.abs(beatTotal - seg.duration) > 1) {
          errors.push(`videoSegment[${i}] beats 时长和 ${beatTotal} 与 duration ${seg.duration} 不匹配`)
        }
      }
    })
  }

  if (!breakdown.characters?.length) errors.push('缺少 characters')
  if (!breakdown.scenes?.length) errors.push('缺少 scenes')

  if (errors.length > 0) {
    console.warn('[AigcSpecAgentV2] 校验警告:', errors.join('; '))
    // 校验不通过不改写，只在日志中记录
  }
}
