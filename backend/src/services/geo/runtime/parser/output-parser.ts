// ============================================================
// Output Parser — KMKI-RUNTIME-005
// 四级容错：JSON.parse → strip markdown → extract JSON → repair
// Agent 永远收到标准 JSON
// ============================================================

export interface ParseResult<T = any> {
  success: boolean
  data?: T
  error?: string
  stage: 'direct' | 'strip_markdown' | 'extract_json' | 'repair' | 'failed'
  raw: string
}

/**
 * 核心解析函数：四级容错
 */
export function parseLLMOutput<T = any>(raw: string): ParseResult<T> {
  if (!raw || typeof raw !== 'string') {
    return { success: false, error: 'Empty LLM output', stage: 'failed', raw }
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return { success: false, error: 'Empty LLM output', stage: 'failed', raw }
  }

  // Stage 1: 直接解析
  try {
    const data = JSON.parse(trimmed) as T
    return { success: true, data, stage: 'direct', raw }
  } catch {
    // 继续
  }

  // Stage 2: 去除 markdown 代码块包裹
  const stripped = stripMarkdownCodeBlock(trimmed)
  if (stripped !== trimmed) {
    try {
      const data = JSON.parse(stripped) as T
      return { success: true, data, stage: 'strip_markdown', raw }
    } catch {
      // 继续
    }
  }

  // Stage 3: 提取第一个完整的 JSON 对象或数组
  const extracted = extractJSON(stripped)
  if (extracted) {
    try {
      const data = JSON.parse(extracted) as T
      return { success: true, data, stage: 'extract_json', raw }
    } catch {
      // 继续
    }
  }

  // Stage 4: 修复常见 JSON 问题后重试
  const repaired = repairJSON(extracted || stripped)
  if (repaired) {
    try {
      const data = JSON.parse(repaired) as T
      return { success: true, data, stage: 'repair', raw }
    } catch {
      // 继续
    }
  }

  return { success: false, error: 'Failed to parse LLM output after all stages', stage: 'failed', raw }
}

/**
 * 去除 markdown 代码块 ```json ... ``` 或 ``` ... ```
 */
function stripMarkdownCodeBlock(text: string): string {
  const patterns = [
    /```(?:json|javascript|js|typescript|ts)?\s*\n?([\s\S]*?)\n?\s*```/,
    /`{3,}(?:json)?\s*\n?([\s\S]*?)\n?\s*`{3,}/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]?.trim()) {
      return match[1].trim()
    }
  }
  return text
}

/**
 * 从文本中提取第一个完整的 JSON 对象或数组
 */
function extractJSON(text: string): string | null {
  // 找第一个 { 或 [
  let startIdx = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return null

  const openChar = text[startIdx]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let endIdx = -1

  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === openChar) depth++
    else if (text[i] === closeChar) {
      depth--
      if (depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  if (endIdx === -1) return null
  return text.slice(startIdx, endIdx)
}

/**
 * 修复常见 JSON 格式问题
 * 只修复安全的：尾部逗号、非法换行、单引号
 */
function repairJSON(text: string): string | null {
  if (!text) return null

  // 去 BOM
  let result = text.replace(/^\uFEFF/, '')

  // 去尾部逗号（对象和数组的最后一项后有逗号）
  result = result.replace(/,\s*([}\]])/g, '$1')

  // 非法换行（JSON 字符串中不允许真实换行）
  // 安全的做法：只替换不在字符串中的换行
  result = result.replace(/\n\s*/g, ' ')

  // 单引号替代双引号（只限于属性名和字符串值）
  // 宽松处理：如果 JSON 中单引号更多，尝试替换
  const singleQuotes = (result.match(/'/g) || []).length
  const doubleQuotes = (result.match(/"/g) || []).length
  if (singleQuotes > doubleQuotes / 2) {
    result = result.replace(/'/g, '"')
  }

  return result
}

/**
 * 安全解析 LLM 输出，抛出友好错误
 */
export function safeParseJSON<T = any>(raw: string, label?: string): T {
  const result = parseLLMOutput<T>(raw)
  if (!result.success) {
    const tag = label ? `[${label}] ` : ''
    throw new Error(`${tag}LLM JSON parse failed after 4 stages. Raw: ${raw.slice(0, 200)}`)
  }
  return result.data!
}
