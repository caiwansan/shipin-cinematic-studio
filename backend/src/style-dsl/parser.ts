/**
 * style-dsl/parser.ts
 *
 * ⚔️ Phase 5 — Style DSL（受限 DSL）
 *
 * 只能表达 render hints，不能表达 structure。
 *
 * 允许语法：
 *   - lighting_bias: high_key | low_key | natural | mixed
 *   - color_palette: { primary_hue, saturation, temperature }
 *   - pacing_modifier: -0.3 ~ 0.3
 *
 * 严禁：
 *   - scene structure modification
 *   - causal graph influence
 *   - shot graph changes
 *   - narrative type override
 *   - prompt generation
 */

import type { StyleProfile } from '../style-runtime/style-registry.js'

// ── DSL 类型 ──

export type DSLToken =
  | { type: 'LIGHTING'; value: string }
  | { type: 'CONTRAST'; value: 'low' | 'medium' | 'high' }
  | { type: 'HUE'; value: string }
  | { type: 'SATURATION'; value: 'desaturated' | 'neutral' | 'vibrant' }
  | { type: 'TEMPERATURE'; value: 'cool' | 'neutral' | 'warm' }
  | { type: 'LENS'; value: 'wide' | 'standard' | 'tele' }
  | { type: 'MOVEMENT'; value: 'static' | 'smooth' | 'dynamic' }
  | { type: 'DEPTH'; value: 'shallow' | 'medium' | 'deep' }
  | { type: 'PACING_OFFSET'; value: number }
  | { type: 'UNKNOWN'; value: string }

// ── 词汇表（白名单） ──

const ALLOWED_KEYWORDS: Record<string, DSLToken['type']> = {
  '高亮': 'LIGHTING',
  '低光': 'LIGHTING',
  '自然光': 'LIGHTING',
  '混合光': 'LIGHTING',
  '高对比': 'CONTRAST',
  '中对比': 'CONTRAST',
  '低对比': 'CONTRAST',
  '冷暖': 'TEMPERATURE',
  '暖色': 'TEMPERATURE',
  '冷色': 'TEMPERATURE',
  '中性色': 'TEMPERATURE',
  '高饱和': 'SATURATION',
  '中饱和': 'SATURATION',
  '低饱和': 'SATURATION',
  '广角': 'LENS',
  '标准': 'LENS',
  '长焦': 'LENS',
  '流畅': 'MOVEMENT',
  '静态': 'MOVEMENT',
  '动态': 'MOVEMENT',
  '浅景深': 'DEPTH',
  '中景深': 'DEPTH',
  '深景深': 'DEPTH',
}

const CONTRAST_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  '高对比': 'high',
  '中对比': 'medium',
  '低对比': 'low',
}

const SATURATION_MAP: Record<string, 'desaturated' | 'neutral' | 'vibrant'> = {
  '高饱和': 'vibrant',
  '中饱和': 'neutral',
  '低饱和': 'desaturated',
}

const TEMPERATURE_MAP: Record<string, 'cool' | 'neutral' | 'warm'> = {
  '冷色': 'cool',
  '暖色': 'warm',
  '中性色': 'neutral',
}

const LENS_MAP: Record<string, 'wide' | 'standard' | 'tele'> = {
  '广角': 'wide',
  '标准': 'standard',
  '长焦': 'tele',
}

const MOVEMENT_MAP: Record<string, 'static' | 'smooth' | 'dynamic'> = {
  '静态': 'static',
  '流畅': 'smooth',
  '动态': 'dynamic',
}

const DEPTH_MAP: Record<string, 'shallow' | 'medium' | 'deep'> = {
  '浅景深': 'shallow',
  '中景深': 'medium',
  '深景深': 'deep',
}

// ── 词法分析 ──

/**
 * tokenize — Style DSL 词法分析
 *
 * 输入：自然语言文本（如 "高对比 冷色 广角 动态"）
 * 输出：DSLToken[]
 */
export function tokenize(input: string): DSLToken[] {
  const tokens: DSLToken[] = []
  const rawTokens = input.split(/[\s,，;；]+/).filter(t => t.length > 0)

  // 数字正则
  const numRe = /^([+-]?\d+(\.\d+)?)$/

  for (const raw of rawTokens) {
    // 检查是否是数字
    const numMatch = raw.match(numRe)
    if (numMatch) {
      const num = parseFloat(numMatch[1])
      if (num >= -0.3 && num <= 0.3) {
        tokens.push({ type: 'PACING_OFFSET', value: num })
      } else {
        tokens.push({ type: 'UNKNOWN', value: raw })
      }
      continue
    }

    // 检查词汇表
    const tokenType = ALLOWED_KEYWORDS[raw]
    if (tokenType) {
      // 如果是 CONTRAST，将 raw 映射为标准值
      if (tokenType === 'CONTRAST') {
        tokens.push({ type: 'CONTRAST', value: CONTRAST_MAP[raw] ?? 'medium' })
      } else if (tokenType === 'SATURATION') {
        tokens.push({ type: 'SATURATION', value: SATURATION_MAP[raw] ?? 'neutral' })
      } else if (tokenType === 'TEMPERATURE') {
        tokens.push({ type: 'TEMPERATURE', value: TEMPERATURE_MAP[raw] ?? 'neutral' })
      } else if (tokenType === 'LENS') {
        tokens.push({ type: 'LENS', value: LENS_MAP[raw] ?? 'standard' })
      } else if (tokenType === 'MOVEMENT') {
        tokens.push({ type: 'MOVEMENT', value: MOVEMENT_MAP[raw] ?? 'smooth' })
      } else if (tokenType === 'DEPTH') {
        tokens.push({ type: 'DEPTH', value: DEPTH_MAP[raw] ?? 'medium' })
      } else if (tokenType === 'LIGHTING') {
        tokens.push({ type: 'LIGHTING', value: raw })
      } else {
        // 安全的兜底：已知类型但未显式处理的（如 HUE）
        tokens.push({ type: tokenType as 'HUE', value: raw })
      }
    } else {
      tokens.push({ type: 'UNKNOWN', value: raw })
    }
  }

  return tokens
}

// ── 语法分析（token → StyleProfile） ──

/**
 * parseToStyle — DSLToken[] → StyleProfile
 *
 * 将 tokens 编译为 StyleProfile。
 * 只填充 tokens 中包含的字段，其余使用默认值。
 */
export function parseToStyle(tokens: DSLToken[], baseName: string = 'custom'): StyleProfile {
  const style: StyleProfile = {
    name: baseName,
    displayName: '自定义风格',
    description: '通过 Style DSL 定义',
    lightingBias: { dominant: 'natural', contrast: 'medium', description: '自然光' },
    colorPalette: { primaryHue: '中性色', saturation: 'neutral', temperature: 'neutral', description: '中性色彩' },
    lensPreference: { dominant: 'standard', movement: 'smooth', depth: 'medium', description: '标准镜头' },
    pacingModifier: { offset: 0, description: '标准节奏' },
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'LIGHTING': {
        const val = token.value as string
        const dominant = val === '高亮' ? 'high_key' as const :
                         val === '低光' ? 'low_key' as const :
                         val === '混合光' ? 'mixed' as const :
                         'natural'
        style.lightingBias.dominant = dominant
        style.lightingBias.description = val
        break
      }
      case 'CONTRAST':
        style.lightingBias.contrast = token.value as 'low' | 'medium' | 'high'
        style.lightingBias.description += `，${token.value}对比`
        break
      case 'HUE':
        style.colorPalette.primaryHue = token.value as string
        break
      case 'SATURATION':
        style.colorPalette.saturation = token.value as 'desaturated' | 'neutral' | 'vibrant'
        break
      case 'TEMPERATURE':
        style.colorPalette.temperature = token.value as 'cool' | 'neutral' | 'warm'
        style.colorPalette.description = `${token.value}色调`
        break
      case 'LENS': {
        style.lensPreference.dominant = token.value as 'wide' | 'standard' | 'tele'
        style.lensPreference.description = `${token.value}镜头`
        break
      }
      case 'MOVEMENT':
        style.lensPreference.movement = token.value as 'static' | 'smooth' | 'dynamic'
        style.lensPreference.description += `，${token.value}运镜`
        break
      case 'DEPTH':
        style.lensPreference.depth = token.value as 'shallow' | 'medium' | 'deep'
        style.lensPreference.description += `，${token.value}`
        break
      case 'PACING_OFFSET':
        style.pacingModifier.offset = token.value as number
        style.pacingModifier.description = `节奏偏移: ${(token.value as number) > 0 ? '+' : ''}${token.value}`
        break
    }
  }

  return style
}

/**
 * compileDSL — 文本 → StyleProfile（一次完成）
 *
 * 输入："高对比 冷色 广角 动态 +0.1"
 * 输出：完整的 StyleProfile
 */
export function compileDSL(dsl: string, name?: string): StyleProfile {
  const tokens = tokenize(dsl)
  const style = parseToStyle(tokens, name ?? 'dsl_custom')

  // 检查是否包含非法 token
  const unknownTokens = tokens.filter(t => t.type === 'UNKNOWN')
  if (unknownTokens.length > 0) {
    console.warn(`[STYLE_DSL] 未知 token: ${unknownTokens.map(t => t.value).join(', ')}`)
  }

  return style
}

// ── DSL 验证器 ──

export interface DSLValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateDSL(dsl: string): DSLValidationResult {
  const tokens = tokenize(dsl)
  const errors: string[] = []
  const warnings: string[] = []

  if (tokens.length === 0) {
    errors.push('DSL 输入为空')
    return { valid: false, errors, warnings }
  }

  const unknown = tokens.filter(t => t.type === 'UNKNOWN')
  if (unknown.length > 0) {
    warnings.push(`未知词汇: ${unknown.map(t => t.value).join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
