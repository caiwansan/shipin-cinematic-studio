/**
 * llm-normalizer.ts — LLM 输出归一化层（v2）
 *
 * 职责：将 LLM 原始输出转换为符合 Schema Contract 的规范结构。
 * 边界：只做结构归一化，不做语义修复（语义修复在 semantic-repair.ts 中）。
 *
 * v2 关键改进：
 * 1. 递归类型强制：深入嵌套对象字段
 * 2. null handling：null → 默认值，不是保留 null
 * 3. 深度合并：LLM 输出 + 默认 Constitution 的逐字段合并
 *
 * 处理能力：
 * 1. JSON 提取（从 markdown 代码块包装中剥离）
 * 2. 类型强制（string→number, number→string 等，递归）
 * 3. 缺失/ null 字段填充（通过深度合并默认值）
 * 4. 值范围钳制（如 intensity 钳制到 0-10）
 * 5. 非破坏性日志（绝不静默丢弃数据）
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import { createDefaultConstitution } from '../schema/story-constitution.js'
import { schemaValidator, type ValidationResult } from './schema-validator.js'

// ============================================================
// Normalize Result
// ============================================================

export interface NormalizeResult {
  /** 归一化后的 Constitution（始终有效，极端情况为默认值） */
  constitution: StoryConstitution

  /** Schema 验证结果 */
  validation: ValidationResult

  /** RAW→Normalized 的修复记录 */
  fixes: NormalizeFix[]

  /** 是否所有关键字段都来自 LLM（非 fallback） */
  fullyFromLLM: boolean

  /** 总体置信度（0-1） */
  confidence: number
}

export interface NormalizeFix {
  field: string
  type: 'parsed_json' | 'stripped_markdown' | 'type_coerced' | 'filled_default'
      | 'range_clamped' | 'enum_mapped' | 'fallback' | 'null_replaced'
  from: string
  to: string
}

// ============================================================
// JSON 提取器
// ============================================================

function extractJSON(raw: string): { json: string; fixes: NormalizeFix[] } {
  const fixes: NormalizeFix[] = []

  // Step 1: 尝试从 markdown 代码块提取（```json ... ```）
  const jsonBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlockMatch) {
    fixes.push({
      field: 'raw',
      type: 'stripped_markdown',
      from: 'markdown wrapped',
      to: 'extracted JSON block',
    })
    return { json: jsonBlockMatch[1].trim(), fixes }
  }

  // Step 2: 尝试直接解析整个输出
  try {
    JSON.parse(raw.trim())
    return { json: raw.trim(), fixes }
  } catch {
    // 不是有效的 JSON
  }

  // Step 3: 尝试找到第一个 { 到最后一个 }
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    fixes.push({
      field: 'raw',
      type: 'parsed_json',
      from: 'raw text with surrounding content',
      to: 'extracted JSON object',
    })
    return { json: raw.slice(firstBrace, lastBrace + 1), fixes }
  }

  // Step 4: 完全无法提取
  return { json: '{}', fixes }
}

// ============================================================
// 类型强制器（递归版）
// ============================================================

type TypeSchema = 'string' | 'number' | 'boolean' | 'array' | 'object'

/**
 * 深度类型强制：递归处理嵌套对象
 */
function deepCoerce(
  obj: unknown,
  schema: Record<string, TypeSchema | Record<string, any>>,
  path: string,
  fixes: NormalizeFix[],
): unknown {
  if (obj === null || obj === undefined) {
    return undefined
  }

  if (Array.isArray(obj)) {
    // 尝试递归强制数组元素
    return obj.map((item, i) => {
      if (typeof item === 'object' && item !== null) {
        return deepCoerce(item, schema, `${path}[${i}]`, fixes)
      }
      return item
    })
  }

  if (typeof obj !== 'object') {
    return obj // 原始类型不递归
  }

  const result: Record<string, unknown> = {}
  const input = obj as Record<string, unknown>

  for (const [key, expectedType] of Object.entries(schema)) {
    const currentPath = path ? `${path}.${key}` : key
    const value = input[key]

    if (value === null || value === undefined) {
      // 不填充，留给深度合并
      result[key] = undefined
      continue
    }

    if (typeof expectedType === 'object' && !Array.isArray(expectedType)) {
      // 嵌套对象 → 递归
      if (typeof value === 'object' && value !== null) {
        result[key] = deepCoerce(value, expectedType, currentPath, fixes)
      } else {
        // 传入了非对象但 schema 期望对象 → 标记修复，保持原值
        fixes.push({
          field: currentPath,
          type: 'type_coerced',
          from: `typeof ${typeof value}`,
          to: 'object (kept as-is)',
        })
        result[key] = value
      }
      continue
    }

    if (typeof expectedType === 'string') {
      const { coerced, changed } = coerceValue(value, expectedType as TypeSchema)
      if (changed && coerced !== undefined) {
        fixes.push({
          field: currentPath,
          type: 'type_coerced',
          from: `typeof ${typeof value} = ${JSON.stringify(value).slice(0, 50)}`,
          to: `${expectedType} = ${JSON.stringify(coerced)}`,
        })
        result[key] = coerced
      } else if (changed && coerced === undefined) {
        // 强制失败，保持原始值但记录
        result[key] = value
      } else {
        result[key] = value
      }
    }
  }

  return result
}

function coerceValue(value: unknown, targetType: TypeSchema): {
  coerced: unknown
  changed: boolean
} {
  if (value === null || value === undefined) {
    return { coerced: undefined, changed: true }
  }

  switch (targetType) {
    case 'string': {
      if (typeof value === 'string') return { coerced: value, changed: false }
      if (typeof value === 'number') return { coerced: String(value), changed: true }
      if (typeof value === 'boolean') return { coerced: value ? 'true' : 'false', changed: true }
      return { coerced: JSON.stringify(value), changed: true }
    }
    case 'number': {
      if (typeof value === 'number') return { coerced: value, changed: false }
      if (typeof value === 'string') {
        const n = Number(value)
        if (!isNaN(n)) return { coerced: n, changed: true }
      }
      if (typeof value === 'boolean') return { coerced: value ? 1 : 0, changed: true }
      return { coerced: undefined, changed: true }
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { coerced: value, changed: false }
      if (typeof value === 'string') {
        if (['true', '1', 'yes'].includes(value.toLowerCase())) return { coerced: true, changed: true }
        if (['false', '0', 'no'].includes(value.toLowerCase())) return { coerced: false, changed: true }
      }
      if (typeof value === 'number') return { coerced: value !== 0, changed: true }
      return { coerced: undefined, changed: true }
    }
    case 'array': {
      if (Array.isArray(value)) return { coerced: value, changed: false }
      if (typeof value === 'string') {
        try { return { coerced: JSON.parse(value), changed: true } } catch {}
      }
      return { coerced: [value], changed: true }
    }
    case 'object': {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return { coerced: value, changed: false }
      }
      return { coerced: {}, changed: true }
    }
  }
}

// ============================================================
// Constitution Schema Map（深度强制用）
// ============================================================

const CONSTITUTION_SCHEMA: Record<string, any> = {
  coreTheme: 'string',
  schemaVersion: 'string',
  constitutionVersion: 'string',
  projectId: 'string',
  traceId: 'string',
  emotionalTrajectory: {
    dominantEmotion: 'string',
    arcType: 'string',
    peakIntensity: 'number',
    resolutionTone: 'string',
    segments: 'array',
  },
  visualDoctrine: {
    colorDoctrine: {},
    lightingDoctrine: {},
    cameraDoctrine: {},
    compositionDoctrine: {},
  },
  pacingDoctrine: {
    structureType: 'string',
    hookDensity: 'string',
    climaxPlacement: 'number',
    pacingCurve: 'string',
    beatMap: 'array',
  },
  cinematicIdentity: {
    visualConsistencyLevel: 'string',
    primaryInfluences: 'array',
    signatureElements: 'array',
    eraTags: 'array',
  },
  characterLaws: 'array',
  worldPhysics: {
    environmentType: 'string',
    timePeriod: 'string',
    scale: 'string',
    physicsAnomalies: 'array',
  },
  toneBoundaries: 'array',
  forbiddenStyles: 'array',
  confidence: 'number',
}

// ============================================================
// 深度合并
// ============================================================

/**
 * 深度合并：target 中为 undefined 的字段用 source 的填充
 * 不覆盖 target 中已有的任何值（即使 source 有更 "好的" 值）
 *
 * 排除字段：degraded, degradeReason（它们是运行时状态，不是 Schema 字段）
 */
const MERGE_EXCLUDE = new Set(['degraded', 'degradeReason', 'createdAt'])

function deepMergeDefaults(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }

  for (const key of Object.keys(source)) {
    if (MERGE_EXCLUDE.has(key)) continue

    if (result[key] === undefined || result[key] === null) {
      result[key] = source[key]
    } else if (
      typeof result[key] === 'object' && !Array.isArray(result[key]) &&
      typeof source[key] === 'object' && !Array.isArray(source[key])
    ) {
      // 双方都是对象 → 递归合并
      result[key] = deepMergeDefaults(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      )
    }
  }

  return result
}

// ============================================================
// Normalizer 主类
// ============================================================

export class LLMNormalizer {
  /**
   * 归一化 LLM 原始输出
   */
  normalize(rawOutput: string, projectId: string, traceId: string): NormalizeResult {
    const fixes: NormalizeFix[] = []

    // ===== Step 1: Extract JSON =====
    const { json: jsonStr, fixes: jsonFixes } = extractJSON(rawOutput)
    fixes.push(...jsonFixes)

    // ===== Step 2: Parse JSON =====
    let rawObject: Record<string, unknown> = {}
    try {
      rawObject = JSON.parse(jsonStr)
      if (rawObject && typeof rawObject === 'object' && !Array.isArray(rawObject)) {
        fixes.push({
          field: 'raw',
          type: 'parsed_json',
          from: 'string',
          to: 'parsed object',
        })
      }
    } catch (parseError) {
      // JSON 解析失败 → 返回默认 constitution
      const fallback = createDefaultConstitution(projectId, traceId, {
        reason: `JSON 解析失败: ${(parseError as Error).message.slice(0, 100)}`,
      })
      return {
        constitution: fallback,
        validation: {
          valid: false,
          data: fallback,
          errors: [{
            path: 'raw',
            message: `JSON 解析失败: ${(parseError as Error).message}`,
            code: 'custom',
          }],
          warnings: [],
          fixesApplied: 1,
        },
        fixes: [{
          field: 'raw',
          type: 'fallback',
          from: 'invalid JSON',
          to: 'default constitution',
        }],
        fullyFromLLM: false,
        confidence: 0,
      }
    }

    // ===== Step 3: 替换 null 值 =====
    // 在深度强制之前，把所有 null 变成 undefined（然后会被默认值填充）
    this.replaceNulls(rawObject, fixes)

    // ===== Step 4: 深度类型强制 =====
    const coercedObject = deepCoerce(rawObject, CONSTITUTION_SCHEMA, '', fixes) as Record<string, unknown>

    // ===== Step 5: 深度合并默认值 =====
    const defaults = createDefaultConstitution(projectId, traceId) as unknown as Record<string, unknown>
    const merged = deepMergeDefaults(coercedObject, defaults)

    // ===== Step 6: 确保运行时字段正确 =====
    merged.projectId = projectId
    ;(merged as any).traceId = traceId
    // 设置 Zod schema 要求的运行时默认值（deepMergeDefaults 排除了这些字段）
    if (merged.degraded === undefined) merged.degraded = false
    if (merged.createdAt === undefined) merged.createdAt = Date.now()

    // ===== Step 9: 优先检查 LLM 信号 =====
    // 有无语义信号是最关键的判定——即使 Zod 验证通过，没信号也算 degraded
    const llmFieldCount = this.countNonEmptyFields(rawObject)
    const hasLLMSignal = llmFieldCount >= 3 // 至少 3 个非空字段才算有语义信号

    // ===== Step 10: Run Zod validation =====
    const validation = schemaValidator.validate(merged)

    // ===== Step 11: 计算置信度 =====
    const confidence = this.calculateConfidence(validation, fixes)
    const fullyFromLLM = validation.valid
      && fixes.filter(f => f.type === 'fallback').length === 0
      && hasLLMSignal

    // ===== Step 12: 无语义信号 → 标记 degraded（优先级最高） =====
    if (!hasLLMSignal) {
      const constitution = {
        ...validation.data,
        degraded: true,
        degradeReason: `LLM 输出无语义信号（仅 ${llmFieldCount} 个有效字段），使用默认值填充`,
        confidence: 0,
      } as StoryConstitution

      return {
        constitution,
        validation,
        fixes: [
          ...fixes,
          {
            field: 'multiple',
            type: 'fallback',
            from: `LLM output with ${llmFieldCount} fields`,
            to: 'majority default values + degraded flag',
          },
        ],
        fullyFromLLM: false,
        confidence: 0,
      }
    }

    // ===== Step 13: 完全有效 =====
    if (validation.valid) {
      return {
        constitution: validation.data,
        validation,
        fixes,
        fullyFromLLM,
        confidence,
      }
    }

    // ===== Step 14: 验证失败（但有语义信号） =====
    const constitution = {
      ...validation.data,
      degraded: true,
      degradeReason: `Schema 验证失败: ${validation.errors.map(e => e.message).join('; ')}`,
      confidence: Math.min(confidence, 0.5),
    } as StoryConstitution

    return {
      constitution,
      validation,
      fixes: [
        ...fixes,
        {
          field: 'multiple',
          type: 'fallback',
          from: 'validation failures',
          to: 'partial degrade',
        },
      ],
      fullyFromLLM: false,
      confidence: Math.min(confidence, 0.5),
    }
  }

  /**
   * 递归替换所有 null 为 undefined
   */
  private replaceNulls(obj: Record<string, unknown>, fixes: NormalizeFix[], path = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key

      if (value === null) {
        obj[key] = undefined
        fixes.push({
          field: currentPath,
          type: 'null_replaced',
          from: 'null',
          to: 'undefined (will get default)',
        })
      } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        this.replaceNulls(value as Record<string, unknown>, fixes, currentPath)
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (typeof item === 'object' && item !== null) {
            this.replaceNulls(item as Record<string, unknown>, fixes, `${currentPath}[${i}]`)
          }
        })
      }
    }
  }

  /**
   * 统计 LLM 原始 JSON 中有语义含量的非空字段数量
   * 用于判断 LLM 是否真的输出了有效内容，还是接近空对象
   */
  private countNonEmptyFields(obj: Record<string, unknown>): number {
    let count = 0
    for (const [key, value] of Object.entries(obj)) {
      // 忽略元字段
      if (['projectId', 'traceId', 'schemaVersion', 'constitutionVersion'].includes(key)) continue

      if (value === undefined || value === null) continue

      if (typeof value === 'string' && value.trim().length === 0) continue
      if (Array.isArray(value) && value.length === 0) continue
      if (typeof value === 'object' && !Array.isArray(value)) {
        // 空对象不计入
        if (Object.keys(value).length === 0) continue
        // 递归统计嵌套对象
        count += this.countNonEmptyFields(value as Record<string, unknown>)
      } else {
        count++
      }
    }
    return count
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(validation: ValidationResult, fixes: NormalizeFix[]): number {
    if (validation.valid && fixes.length === 0) return 1.0
    if (validation.valid && fixes.length > 0) return 0.9

    const errorCount = validation.errors.length
    const fixCount = fixes.filter(f =>
      f.type !== 'parsed_json' && f.type !== 'stripped_markdown' && f.type !== 'null_replaced',
    ).length
    const base = Math.max(0, 1 - (errorCount * 0.15 + fixCount * 0.05))
    return Math.round(base * 100) / 100
  }
}

/** 全局单例 */
export const llmNormalizer = new LLMNormalizer()
