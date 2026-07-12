/**
 * StructuredOutputService (SOL) — LLM Structured Output Layer
 * 
 * 将任意 LLM 输出归一化为标准 JSON。
 * 职责：
 *   - normalize(): 将任意 LLM 输出归一化为标准 JSON 字符串
 *   - extract(): 多阶段 JSON 提取
 *   - validate(): 验证 JSON 结构
 *   - repair(): 修复常见 JSON 错误
 * 
 * 绝不抛异常 — 所有失败路径返回 { __raw, __stage: 'UNSTRUCTURED' }
 */

import { ProviderOutputProfile, getProviderProfile } from './provider-output-profile.js'

// ===== Telemetry =====
interface SOLStats {
  totalCalls: number
  parseSuccess: number      // 第一阶段（标准 JSON.parse）成功
  repairSuccess: number     // 修复后成功
  repairFailed: number      // 最终 UNSTRUCTURED
  extractSuccess: number    // extract() 成功
  extractFailed: number     // extract() 失败
}

let stats: SOLStats = {
  totalCalls: 0,
  parseSuccess: 0,
  repairSuccess: 0,
  repairFailed: 0,
  extractSuccess: 0,
  extractFailed: 0,
}

// ===== MultiStageExtractor =====

/**
 * 多阶段 JSON 提取器
 * 1. 标准 JSON.parse → 成功则结束
 * 2. 提取 Markdown 代码块 ```json ... ``` → 解析
 * 3. 提取文本中第一个 {...} JSON Object → 解析
 * 4. JSON Repair（修复缺失逗号、尾随逗号、单引号、多余文本、代码块残留）
 * 5. 最后返回 { __raw: content, __stage: 'UNSTRUCTURED' }
 */
function multiStageExtract(content: string): { value: any; stage: string } {
  if (!content || typeof content !== 'string') {
    return { value: { __raw: content, __stage: 'UNSTRUCTURED' }, stage: 'UNSTRUCTURED' }
  }

  // Stage 1: 标准 JSON.parse
  try {
    const trimmed = content.trim()
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { value: parsed, stage: 'PARSE_DIRECT' }
    }
  } catch {
    // 继续下一阶段
  }

  // Stage 2: 提取 Markdown 代码块
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    const jsonStr = codeBlockMatch[1].trim()
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { value: parsed, stage: 'PARSE_MARKDOWN_BLOCK' }
      }
    } catch {
      // 继续
    }
  }

  // Stage 2.5: 尝试提取不带标记的语言的代码块
  const genericBlockMatch = content.match(/```\s*\n?([\s\S]*?)```/)
  if (genericBlockMatch) {
    const jsonStr = genericBlockMatch[1].trim()
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { value: parsed, stage: 'PARSE_GENERIC_BLOCK' }
      }
    } catch {
      // 继续
    }
  }

  // Stage 3: 提取文本中第一个 {...} JSON Object
  const braceMatch = content.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0])
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { value: parsed, stage: 'PARSE_BRACE_EXTRACT' }
      }
    } catch {
      // 继续
    }
  }

  // Stage 4: JSON Repair
  const repaired = repairJSON(content)
  try {
    const parsed = JSON.parse(repaired)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { value: parsed, stage: 'REPAIRED' }
    }
  } catch {
    // 最后一步
  }

  // Stage 5: 无法解析
  return { value: { __raw: content, __stage: 'UNSTRUCTURED' }, stage: 'UNSTRUCTURED' }
}

// ===== JSON Repair =====

/**
 * 修复常见 JSON 错误：
 * - 单引号代替双引号（针对 property name）
 * - 尾随逗号
 * - 缺失逗号
 * - 多余文本前后
 * - 代码块残留（如 markdown 标记没被完全提取）
 * - 中文标点（中文模型经常用中文标点替代英文标点）
 */
function repairJSON(content: string): string {
  if (!content) return '{}'

  let cleaned = content.trim()

  // 1. 尝试提取代码块内容（再次清理）
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 2. 尝试找到最外层的 {} 对象
  const braceStart = cleaned.indexOf('{')
  const braceEnd = cleaned.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1)
  }

  // 3. 去除多余的换行和缩进（保留必要空格）
  cleaned = cleaned.replace(/\n\s*/g, ' ')

  // 4. 修复单引号属性名/值（中文模型常见）
  // 将形如 'key': 或 'value' 替换为 "key": 或 "value"
  cleaned = cleaned.replace(/'/g, '"')

  // 5. 修复中文冒号（中文模型用：替代: 在 JSON 中）
  // 注意: 只修复键值对中的中文冒号
  cleaned = cleaned.replace(/("[\s\S]*?")\s*：\s*/g, '$1: ')

  // 6. 修复中文引号
  cleaned = cleaned.replace(/["""]/g, '"')
  cleaned = cleaned.replace(/[''']/g, '"')

  // 7. 去除尾随逗号（在 } 和 ] 之前）
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // 8. 去除布尔值和 null 值周围的多余空格
  cleaned = cleaned.replace(/\s+(true|false|null)\s+/g, ' $1 ')

  // 9. 去除属性名和值之间的空格问题
  // property名前后的多余空格
  cleaned = cleaned.replace(/"\s+(?=\w)/g, '"')
  cleaned = cleaned.replace(/(?<=\w)\s+"/g, '"')

  // 10. 修复缺失逗号（"key": "value" "nextKey" -> "key": "value", "nextKey"）
  // 在 value 的结束引号和下一个属性名的引号之间加逗号
  cleaned = cleaned.replace(/"\s+"(?=\w)/g, '", "')
  // 在两个值之间加逗号（数字或布尔值后面跟引号）
  cleaned = cleaned.replace(/(\d|true|false|null|\})\s+(?=")/g, '$1, ')
  // 在引号后面跟数字或布尔值之前加逗号
  cleaned = cleaned.replace(/(?<=")\s+(\d|true|false|null)/g, ', $1')

  // 11. 修复多余的中文句号（中文模型常在末尾加句号）
  cleaned = cleaned.replace(/。+\s*"(\s*[}\]])/g, '"$1')
  cleaned = cleaned.replace(/。"\s*/g, '"')

  // 12. 确保以 } 结尾
  const finalBrace = cleaned.lastIndexOf('}')
  if (finalBrace > 0) {
    cleaned = cleaned.substring(0, finalBrace + 1)
  }

  // 13. 如果完全为空，返回空对象
  if (!cleaned || cleaned === '') return '{}'

  return cleaned
}

// ===== Validation =====

/**
 * 验证解析后的 JSON 对象是否包含 Presence 所需的标准字段
 */
function validatePresenceOutput(obj: any): { valid: boolean; reason?: string } {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, reason: '输出不是对象' }
  }

  // visibility 是核心必选字段
  if (obj.visibility !== undefined) {
    const validVisibilities = ['visible', 'partial', 'missing', 'unknown']
    if (!validVisibilities.includes(obj.visibility)) {
      return { valid: false, reason: `visibility 值无效: ${obj.visibility}` }
    }
  }

  // knowledgeQuality (0-100)
  if (obj.knowledgeQuality !== undefined && (typeof obj.knowledgeQuality !== 'number' || obj.knowledgeQuality < 0 || obj.knowledgeQuality > 100)) {
    return { valid: false, reason: 'knowledgeQuality 超出范围 (0-100)' }
  }

  // confidence (0-100)
  if (obj.confidence !== undefined && (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100)) {
    return { valid: false, reason: 'confidence 超出范围 (0-100)' }
  }

  return { valid: true }
}

// ===== Normalize =====

/**
 * 将任意 LLM 输出归一化为标准 JSON 字符串
 * @param content 原始 LLM 输出
 * @param provider Provider 名称（用于 profile 规则）
 * @param profile ProviderOutputProfile（可选，不传则自动获取）
 * @returns 归一化后的 JSON 字符串（如无法解析则返回原始内容）
 */
function normalize(
  content: string,
  provider?: string,
  profile?: ProviderOutputProfile
): string {
  stats.totalCalls++

  if (!content || typeof content !== 'string') {
    stats.repairFailed++
    return JSON.stringify({ __raw: content, __stage: 'UNSTRUCTURED' })
  }

  // 应用 provider-specific 修复规则
  let processed = content
  const prof = profile || (provider ? getProviderProfile(provider) : undefined)
  if (prof && prof.knownRepairRules.length > 0) {
    processed = applyRepairRules(processed, prof.knownRepairRules)
  }

  // 多阶段提取
  const { value, stage } = multiStageExtract(processed)

  if (stage === 'UNSTRUCTURED') {
    stats.repairFailed++
    return JSON.stringify({ __raw: content, __stage: 'UNSTRUCTURED' })
  }

  if (stage === 'PARSE_DIRECT') {
    stats.parseSuccess++
  } else {
    stats.repairSuccess++
  }

  // 验证
  const validation = validatePresenceOutput(value)
  if (!validation.valid) {
    // 验证失败，但能解析就不降级，标记 __validationWarning
    value.__validationWarning = validation.reason
  }

  return JSON.stringify(value)
}

// ===== Extract =====

/**
 * 多阶段 JSON 提取
 * @param content 原始 LLM 输出
 * @returns 解析后的对象（或 { __raw, __stage: 'UNSTRUCTURED' }）
 */
function extract(content: string, profile?: ProviderOutputProfile): any {
  if (!content || typeof content !== 'string') {
    stats.extractFailed++
    return { __raw: content, __stage: 'UNSTRUCTURED' }
  }

  // 应用 provider-specific 修复规则
  let processed = content
  if (profile && profile.knownRepairRules.length > 0) {
    processed = applyRepairRules(processed, profile.knownRepairRules)
  }

  const { value, stage } = multiStageExtract(processed)

  if (stage === 'UNSTRUCTURED') {
    stats.extractFailed++
  } else {
    stats.extractSuccess++
  }

  return value
}

// ===== Provider-Specific Rules =====

function applyRepairRules(content: string, rules: string[]): string {
  let result = content
  for (const rule of rules) {
    switch (rule) {
      case 'remove_trailing_period':
        // 去除 JSON 末尾的多余句号
        result = result.replace(/。+\s*$/, '')
        break
      case 'fix_single_quotes':
        // 将单引号替换为双引号（针对中文模型常见用单引号）
        result = result.replace(/'/g, '"')
        break
      case 'remove_chinese_punctuation':
        // 去除中文标点（中文模型在 JSON 中混入中文标点）
        result = result.replace(/[：；，。！？、【】《》「」『』“”]/g, (match) => {
          // 将中文标点映射为英文
          const map: Record<string, string> = {
            '：': ':',
            '；': ';',
            '，': ',',
            '。': '.',
            '！': '',
            '？': '',
            '、': ',',
            '【': '[',
            '】': ']',
            '《': '',
            '》': '',
            '「': '"',
            '」': '"',
            '『': '"',
            '』': '"',
            '"': '"',
            '"': '"',
          }
          return map[match] || match
        })
        break
    }
  }
  return result
}

// ===== Public API =====

export class StructuredOutputService {
  /**
   * 将任意 LLM 输出归一化为标准 JSON 字符串
   */
  normalize(content: string, provider?: string, profile?: ProviderOutputProfile): string {
    return normalize(content, provider, profile)
  }

  /**
   * 多阶段 JSON 提取
   */
  extract(content: string, profile?: ProviderOutputProfile): any {
    return extract(content, profile)
  }

  /**
   * 验证解析后的 JSON 对象
   */
  validate(obj: any): { valid: boolean; reason?: string } {
    return validatePresenceOutput(obj)
  }

  /**
   * 修复常见 JSON 错误
   */
  repair(content: string): string {
    return repairJSON(content)
  }

  /**
   * 获取运行时统计
   */
  static getStats(): SOLStats {
    return { ...stats }
  }

  /**
   * 重置统计
   */
  static resetStats(): void {
    stats = {
      totalCalls: 0,
      parseSuccess: 0,
      repairSuccess: 0,
      repairFailed: 0,
      extractSuccess: 0,
      extractFailed: 0,
    }
  }
}
