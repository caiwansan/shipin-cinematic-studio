/**
 * services/hdz/llm.client.ts — 混沌珠 LLM 调用客户端
 *
 * 混沌珠内部专用的 LLM 调用封装，绕过 broken 的 unifiedAIGateway adapter imports。
 * 直接从 UserModelConfigV2 读取 BYOK 配置，通过 provider adapter 调用。
 *
 * BYOK 纪律：不硬编码任何 API Key
 *
 * 包含：analyzeStyleDna — 上传参考文本后自动调用 LLM 分析文风指纹
 */

import { userModelConfigV2Repository } from './repositories/user-model-config-v2.repository.js'
import { hdzProjectRepository } from './repositories/hdz-project.repository.js'
import { hdzChapterRepository } from './repositories/hdz-chapter.repository.js'
import { hdzStyleDnaRepository } from './repositories/hdz-style-dna.repository.js'
import { decryptKey } from '../crypto.service.js'
import { prisma } from '../../utils/index.js'
import { incrementDailyUsage } from '../usage-quota.service.js'

// ─── 类型定义（与 orchestrator 共享） ───

export type AgentType = 'planner' | 'character' | 'director' | 'writer' | 'reviewer'

export interface OrchestratorContext {
  userId: string
  projectId: string
  taskId: string
  agentType: AgentType
  mode: 'single' | 'full'
  chapterNo?: number
  chapterId?: string
  userInput?: string
  historyMessages?: { role: 'user' | 'assistant'; content: string; timestamp: number }[]
}

export interface LLMConfig {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
  maxTokens?: number
  // ★ 02-B Task 4：Usage Ledger 业务元数据（由 orchestrator/调用方附加）
  userId?: string
  taskType?: string
  projectId?: string
  taskId?: string
}

/**
 * 从 UserModelConfigV2 读取 LLM 配置（BYOK）
 * meta 可选：附加 Usage Ledger 元数据（taskType/projectId/taskId）
 */
export async function getUserLLMConfig(
  userId: string,
  meta?: { taskType?: string; projectId?: string; taskId?: string },
): Promise<LLMConfig | null> {
  const v2 = await userModelConfigV2Repository.findUnique({ userId })
  if (!v2 || !v2.llmEnabled || !v2.llmApiKey || !v2.llmApiKey.trim()) return null

  // 兼容加密 key 和明文 key（历史遗留数据）
  let apiKey: string
  if (v2.llmApiKey.includes(':')) {
    try {
      apiKey = decryptKey(v2.llmApiKey)
    } catch {
      return null
    }
  } else {
    console.warn(`[llm.client] ⚠️ 用户 ${userId.substring(0, 8)} 使用明文 LLM API Key（建议重新保存）`)
    apiKey = v2.llmApiKey
  }

  return {
    provider: v2.llmProvider || 'volcengine',
    modelName: v2.llmModel || 'doubao-seed-2-1-pro-260628',
    apiKey,
    baseUrl: v2.llmBaseUrl || undefined,  // 只用 llmBaseUrl，忽略过时的 baseUrl 字段
    // ★ 02-B Task 4：附加 Usage Ledger 元数据
    userId,
    taskType: meta?.taskType,
    projectId: meta?.projectId,
    taskId: meta?.taskId,
  }
}

/**
 * 调用 LLM 对话（OpenAI 兼容接口）
 * 支持 volcengine/deepseek/aliyun/openai
 */
export async function callLLM(
  llmCfg: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const url = getBaseUrl(llmCfg.provider, llmCfg.baseUrl)
  // 自动转换废弃模型名（如 deepseek-chat → deepseek-v4-flash）
  const model = llmCfg.provider === 'deepseek' ? resolveDeepSeekModel(llmCfg.modelName) : llmCfg.modelName

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: options?.maxTokens || 16384,
    temperature: options?.temperature ?? 0.7,
  }

  const fetchUrl = `${url}/chat/completions`
  const bodyStr = JSON.stringify(body)
  console.log(`[callLLM] POST ${llmCfg.provider}/${llmCfg.modelName} url=${fetchUrl.substring(0, 80)}... bodyLen=${bodyStr.length}`)
  
  let resp: Response
  try {
    resp = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmCfg.apiKey}`,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(240000), // 4 分钟超时（glm-4-flash 批量 JSON 生成较慢）
    })
  } catch (fetchErr: any) {
    console.error(`[callLLM] ❌ fetch failed: ${fetchErr.cause ? JSON.stringify(fetchErr.cause) : fetchErr.message}`)
    throw new Error(`LLM API 请求失败 (${fetchErr.message})${fetchErr.cause ? ': ' + fetchErr.cause.code : ''}`)
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`LLM ${resp.status} ${resp.statusText}: ${errText.slice(0, 200)}`)
  }

  const data: any = await resp.json()
  console.log(`[callLLM] ✅ ${llmCfg.provider}/${llmCfg.modelName} done, tokens=${data?.usage?.total_tokens || '?'}`)

  // ★ 02-B Task 4：LLM Usage Ledger——每次调用写明细（provider/model/tokens/cost/agentType）
  try {
    const totalTokens = Number(data?.usage?.total_tokens || data?.usage?.completion_tokens || 0)
    await prisma.usageLog.create({
      data: {
        userId: llmCfg.userId || '',
        projectId: llmCfg.projectId || undefined,
        taskId: llmCfg.taskId || undefined,
        taskType: llmCfg.taskType || 'hdz_generic',
        provider: llmCfg.provider,
        tokens: String(totalTokens),
        cost: estimateLlmCost(llmCfg.provider, totalTokens),
        isPlatform: false, // BYOK 用户自带 Key，平台不承担成本
      },
    })
  } catch (usageErr: any) {
    console.warn(`[UsageLedger] 记账失败（不影响生成）: ${usageErr.message}`)
  }

  return data?.choices?.[0]?.message?.content || ''
}

/** 估算成本（¥，按 token 量粗算——仅用于台账展示，非计费依据） */
function estimateLlmCost(provider: string, tokens: number): number {
  // 近似单价：¥/1M tokens（输入+输出混合粗估）
  const rates: Record<string, number> = {
    deepseek: 2,      // deepseek-v4 系列约 ¥2/1M
    volcengine: 8,    // 豆包 seed 系列
    aliyun: 8,        // qwen 系列
    openai: 15,       // gpt-4o 级别
    zhipu: 5,
    moonshot: 12,
  }
  const rate = rates[provider] || 5
  return Math.round((tokens / 1_000_000) * rate * 10000) / 10000
}

/**
 * 解析 LLM 返回的 JSON（极健壮版）
 * 1. 去掉所有前置非 JSON 文本
 * 2. 找到第一个 { 开始（或 [）
 * 3. 匹配完整的 JSON 对象（花括号深度追踪）
 * 4. 支持 markdown 代码块包裹
 * 5. 未闭合时自动补全括号 + 去除末尾残缺字段
 */
export function parseLLMJson(text: string): any {
  if (!text || typeof text !== 'string') throw new Error('LLM 返回空')
  
  // 找到第一个 { 或 [ 的位置
  const startIdx = text.search(/[{[]/)
  if (startIdx < 0) throw new Error('JSON 中找不到 { 或 [')
  
  const trimmed = text.slice(startIdx)
  const firstChar = trimmed[0]
  const closeChar = firstChar === '{' ? '}' : ']'
  
  let depth = 0
  let inString = false
  let escapeNext = false
  let lastGoodBreak = -1  // 最后一个完整字段的结束位置
  
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]
    
    if (escapeNext) { escapeNext = false; continue }
    if (c === '\\' && inString) { escapeNext = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    
    if (c === firstChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) {
        try { return JSON.parse(trimmed.slice(0, i + 1)) } catch {
          // 即使闭合了也可能无效，尝试修复
        }
      }
    }
    // 记录最后一个完整 key:value 对的结束位置（换行符前或逗号前）
    if (depth === 1 && (c === ',' || c === '\n')) {
      lastGoodBreak = i
    }
  }
  
  // ★ 未闭合自动修复：补足缺少的括号 + 处理末尾残缺内容
  if (depth > 0 && lastGoodBreak > 0) {
    const baseJson = trimmed.slice(0, lastGoodBreak)
    let repaired = ''
    if (firstChar === '{') {
      repaired = baseJson + '}'.repeat(depth)
    } else {
      repaired = baseJson + ']'.repeat(depth)
    }
    try {
      return JSON.parse(repaired)
    } catch { /* 继续尝试更保守的修复 */ }
  }

  throw new Error(`JSON 未闭合（depth=${depth}），已扫描 ${trimmed.length} 字符`)
}

/**
 * 从 PromptTemplate 表读取 Agent prompt（无硬编码）
 * @param name PromptTemplate 的 name 字段
 * @param variables 可选变量替换表，例如 { "$TITLE": "xxx" }
 */
export async function getAgentPrompt(name: string, variables?: Record<string, string>): Promise<string> {
  const { getPrompt } = await import('../../runtime/prompt/PromptRegistry.js')
  let prompt = await getPrompt(name)

  if (variables) {
    for (const [key, val] of Object.entries(variables)) {
      prompt = prompt.replaceAll(key, val ?? '')
    }
  }
  return prompt
}

/**
 * 生成「三大锁定」上下文块
 * 注入到 Planner/Writer/Reviewer 的 system prompt 中
 */
export async function getLockContext(projectId: string, chapterNo?: number): Promise<string> {
  const project = await hdzProjectRepository.findUnique({ id: projectId })
  if (!project) return ''

  const locks = (project.locks as any) || {}
  const parts: string[] = []

  // 1️⃣ 大纲锁定（精简版 — 只保留当前章前后各2章）
  if (locks.outlineLocked !== false) {
    const chapters = await hdzChapterRepository.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
    }) as any[]
    if (chapters.length > 0) {
      const ctxChapterNo = chapterNo || 1
      const nearby = chapters.filter(ch => Math.abs(ch.chapterNo - ctxChapterNo) <= 2)
      const outlineLines = nearby.map(ch =>
        `第${ch.chapterNo}章「${ch.title}」：${(ch.outline || '').slice(0, 400)}`
      )
      if (outlineLines.length > 0) {
        parts.push(`【大纲锁定（附近章节）】\n第 ${ctxChapterNo} 章大纲已锁定，以下为前后关联章节的大纲概览（需保持一致）：\n${outlineLines.join('\n')}\n`)
      }
    }
  }

  // 2️⃣ 逻辑锁定（仅输出状态标记，不重复输出记忆内容——$MEMORY_CONTEXT 已提供）
  if (locks.logicLocked !== false) {
    parts.push(`【故事逻辑已锁定】作者已确认世界设定和故事逻辑，所有创作必须严格遵守，不得前后矛盾。\n`)
  }

  if (parts.length === 0) return ''

  const lockStatus = [
    locks.styleLocked !== false ? '✅ 风格已锁定' : '⬜ 风格未锁定',
    locks.outlineLocked !== false ? '✅ 大纲已锁定' : '⬜ 大纲未锁定',
    locks.logicLocked !== false ? '✅ 逻辑已锁定' : '⬜ 逻辑未锁定',
  ].join(' | ')

  return `\n═══════════ 三大锁定系统 ═══════════\n${lockStatus}\n\n${parts.join('\n')}\n═══════════════════════════════\n`
}

export function getBaseUrl(provider: string, customUrl?: string): string {
  if (customUrl) return customUrl.replace(/\/+$/, '')
  const defaults: Record<string, string> = {
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
    // DeepSeek 官方: https://api.deepseek.com（OpenAI 兼容）
    // 注意：不要加 /v1 后缀，DeepSeek 的 endpoint 是 /chat/completions 而非 /v1/chat/completions
    deepseek: 'https://api.deepseek.com',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    longcat: 'https://api.longcat.chat/openai',
  }
  return defaults[provider] || 'https://api.openai.com/v1'
}

/**
 * DeepSeek 模型名映射（兼容旧名 → 新名）
 * deepseek-chat / deepseek-reasoner 已于 2026/07/24 废弃
 */
export function resolveDeepSeekModel(modelName: string): string {
  const deprecated: Record<string, string> = {
    'deepseek-chat': 'deepseek-v4-flash',
    'deepseek-reasoner': 'deepseek-v4-flash',  // reasoning → v4-flash + thinking 模式
    'deepseek-coder': 'deepseek-v4-flash',
  }
  return deprecated[modelName] || modelName
}

/**
 * 简易 deepseek chat 调用（用于封面 prompt 生成等轻量场景）
 * 走用户 BYOK，provider 选 deepseek/volcengine/aliyun/openai 任一有 key 的
 */
export async function deepseekChat(userId: string, system: string, userMessage: string, maxTokens = 4096): Promise<string> {
  const config = await getUserLLMConfig(userId)
  if (!config) {
    throw new Error('请先配置大模型 API Key（LLM）')
  }

  const url = `${getBaseUrl(config.provider, config.baseUrl)}/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      max_tokens: config.maxTokens || maxTokens,
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LLM 调用失败: ${response.status} ${text}`)
  }

  const json = await response.json()
  // 扣减一次配额（异步非阻塞）
  incrementDailyUsage(userId, 'llm').catch(() => {})
  return json.choices?.[0]?.message?.content || ''
}

/**
 * ─────────────────────────────────────────────────────────
 *  文风指纹分析 (Style DNA Fingerprint)
 *  用户上传参考文本后，异步调用 LLM 分析文风特征
 * ─────────────────────────────────────────────────────────
 */

/**
 * 风格分析 System Prompt
 * 要求 LLM 从多个维度定量/定性分析文本风格，输出严格 JSON
 */
const STYLE_ANALYSIS_SYSTEM_PROMPT = `你是一位资深的文学风格分析专家。请从以下维度深入分析给定的文本，并以严格的 JSON 格式输出分析结果。

请始终以 JSON 对象输出，不包含任何 Markdown 代码块包裹或其他文本。要求数值精度为整数或保留一位小数。

分析维度：

1. **sentenceLength** (句子长度特征)
   - avgWordsPerSentence: 平均每句字数（汉字字符数，number）
   - shortSentenceRatio: 短句（≤15字）比例，0.0 ~ 1.0
   - longSentenceRatio: 长句（≥40字）比例，0.0 ~ 1.0
   - description: 一句话概括句子长度特点

2. **vocabulary** (用词偏好)
   - commonWords: 高频词示例数组（最多5个，string[]）
   - chengyuDensity: 成语密度，0.0 ~ 1.0
   - colloquialLevel: 口语化程度，0~10 整数
   - description: 一句话概括用词特点

3. **sentenceStructure** (句式结构)
   - simpleComplexRatio: 简单句与复合句的比例描述（如 "6:4"）
   - rhetoricalDevices: 修辞手法偏好数组（如 ["排比", "反问", "设问", "比喻", "拟人"]）
   - description: 一句话概括句式特点

4. **emotion** (情感倾向)
   - overallTendency: 总体情感倾向（"偏积极" / "偏消极" / "中性" / "复杂多变"）
   - fluctuationLevel: 情感波动幅度，0~10 整数（0=极平稳，10=大起大落）
   - description: 一句话概括情感特点

5. **narrative** (叙事视角)
   - pov: 主要视角（"第一人称" / "第三人称" / "混合"）
   - povSwitchFreq: 视角切换频率，0~10 整数（0=从不切换，10=频繁切换）
   - description: 一句话概括叙事特点

6. **rhythm** (节奏特征)
   - avgParagraphLength: 平均段落字数（汉字字符数，取整）
   - dialogueRatio: 对话占比，0.0 ~ 1.0
   - description: 一句话概括节奏特点

7. **uniqueExpressions** (特色词汇/表达)
   - list: 特色表达数组，每个对象包含 { phrase: string, note: string }，最多5个
   - description: 一句话概括文风特色

8. **summary** (总体评价)
   - styleLabel: 用 2~4 个标签概括文风（如 ["细腻", "幽默", "古风"]，string[]）
   - overall: 一段精炼的总体文风评价（50~150字）

请确保 JSON 格式正确，所有字段完整，不要遗漏任何维度。`

/**
 * 分析参考文本，提取文风指纹并存入数据库
 *
 * @param projectId - 项目ID
 * @param userId - 用户ID
 * @param sourceText - 用户上传的参考文本
 *
 * 异步执行，不阻塞调用方。失败时静默记录日志，不抛出异常。
 */
export async function analyzeStyleDna(projectId: string, userId: string, sourceText: string): Promise<void> {
  // 1. 获取用户 LLM 配置
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) {
    console.warn(`[analyzeStyleDna] 用户 ${userId} 未配置 LLM，跳过分析`)
    // 写入一个标记，避免前端无限等待
    await hdzStyleDnaRepository.upsert(
      { projectId },
      { projectId, sourceText, fingerprint: { status: 'skipped', reason: 'LLM not configured' } },
      { fingerprint: { status: 'skipped', reason: 'LLM not configured' } },
    )
    return
  }

  // 2. 标记正在分析
  await hdzStyleDnaRepository.upsert(
    { projectId },
    { projectId, sourceText, fingerprint: { status: 'analyzing' } },
    { fingerprint: { status: 'analyzing' } },
  )

  // 3. 调用 LLM 分析
  try {
    const userMessage = `请分析以下文本的文风特征：\n\n${sourceText.slice(0, 5000)}`  // 限制 5000 字
    const raw = await callLLM(llmCfg, STYLE_ANALYSIS_SYSTEM_PROMPT, userMessage, {
      maxTokens: 4096,
      temperature: 0.3,
    })

    // 4. 解析 JSON
    const fingerprint = parseLLMJson(raw)

    // 5. 写入数据库
    await hdzStyleDnaRepository.upsert(
      { projectId },
      { projectId, sourceText, fingerprint: { ...fingerprint, status: 'completed', analyzedAt: new Date().toISOString() } },
      { fingerprint: { ...fingerprint, status: 'completed', analyzedAt: new Date().toISOString() } },
    )

    console.log(`[analyzeStyleDna] 项目 ${projectId} 文风指纹分析完成`)
  } catch (err: any) {
    console.error(`[analyzeStyleDna] 项目 ${projectId} 分析失败:`, err.message)
    // 失败时写入错误状态，不阻塞后续操作
    await hdzStyleDnaRepository.upsert(
      { projectId },
      { projectId, sourceText, fingerprint: { status: 'failed', error: err.message } },
      { fingerprint: { status: 'failed', error: err.message } },
    ).catch(e => console.error('[analyzeStyleDna] 写入失败状态出错:', e))
  }
}
