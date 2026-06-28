// ⭐ Shadow Injection：在 orchestrator 执行后对 Agent 输出进行 shadow normalize + validate
// Phase A+：不修改 orchestrator 内部逻辑，只在外围做观测

import { normalizeFields, collectNormalizeStats } from './normalizer'
import { validateAgentOutput } from './validator'
import { AGENT_SCHEMA_VERSIONS, FIELD_MAP, AGENT_SCHEMAS } from './registry'

// ⭐ drift 指标结构
export interface AgentDriftMetrics {
  agentName: string
  schemaName: string
  timestamp: string

  // normalize
  totalFields: number
  mappedFields: number
  hitRate: number

  // validation
  validationErrors: string[]
  hasSchemaErrors: boolean
  hasEnumMismatch: boolean

  // entropy
  unknownFields: string[]         // 不在 FIELD_MAP 中的字段
  duplicateSemantics: string[]    // 同一语义不同写法的字段

  // soft failure
  softFailure: boolean
}

export interface ShadowInjectionResult {
  driftMetrics: AgentDriftMetrics[]
  summary: {
    total: number
    avgHitRate: number
    agentsWithErrors: number
    agentsWithUnknownFields: number
  }
}

// ⭐ 对单个 Agent 输出做 shadow injection
export function shadowValidate(
  agentName: string,
  rawOutput: string,
): AgentDriftMetrics | null {
  // 解析 JSON
  let parsed: any
  try {
    const cleaned = rawOutput.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return null  // 解析失败，无法校验
  }

  // 提取 spec（兼容有 outputKey 包装和无包装）
  const agentDef = AGENT_MAP[agentName]
  const specData = agentDef?.outputKey && parsed[agentDef.outputKey]
    ? parsed[agentDef.outputKey]
    : parsed

  const schemaName = agentDef?.schemaName || agentName

  // 1. Normalize
  const normalized = normalizeFields(specData)
  const stats = collectNormalizeStats(specData, normalized)

  // 2. Validate
  const validation = validateAgentOutput(schemaName, normalized)

  // 3. 检测 unknown fields
  const knownAliases = new Set(
    Object.values(FIELD_MAP).flatMap(f => f.alias)
  )
  const unknownFields = findUnknownFields(specData, knownAliases)

  // 4. 检测 duplicate semantics
  const duplicateSemantics = findDuplicateSemantics(specData)

  return {
    agentName,
    schemaName,
    timestamp: new Date().toISOString(),
    totalFields: stats.totalFields,
    mappedFields: stats.mappedFields,
    hitRate: stats.hitRate,
    validationErrors: validation.errors,
    hasSchemaErrors: validation.errors.length > 0,
    hasEnumMismatch: validation.errors.some(e => e.includes('oneOf') || e.includes('not in')),
    unknownFields,
    duplicateSemantics,
    softFailure: validation.errors.length > 0 && validation.valid, // WARN 模式
  }
}

// ⭐ 批量 shadow injection
export function batchShadowValidate(items: { agentName: string; rawOutput: string }[]): ShadowInjectionResult {
  const results = items
    .map(item => shadowValidate(item.agentName, item.rawOutput))
    .filter(Boolean) as AgentDriftMetrics[]

  const total = results.length
  const agentsWithErrors = results.filter(r => r.hasSchemaErrors).length
  const agentsWithUnknownFields = results.filter(r => r.unknownFields.length > 0).length
  const avgHitRate = total > 0
    ? results.reduce((s, r) => s + r.hitRate, 0) / total
    : 1

  return {
    driftMetrics: results,
    summary: { total, avgHitRate, agentsWithErrors, agentsWithUnknownFields },
  }
}

// ⭐ Agent → schema 映射
const AGENT_MAP: Record<string, { schemaName: string; outputKey?: string }> = {
  'plot-supervisor':      { schemaName: 'plot', outputKey: 'plotBlueprint' },
  'character-designer':   { schemaName: 'character', outputKey: 'characters' },
  'scene-designer':       { schemaName: 'scene', outputKey: 'scenes' },
  'sound-designer':       { schemaName: 'voice', outputKey: 'voices' },
  'frame-designer':       { schemaName: 'frame', outputKey: undefined },
  'props-designer':       { schemaName: 'prop', outputKey: 'props' },
  'director-of-photography': { schemaName: undefined, outputKey: undefined },
  'makeup-designer':      { schemaName: 'character' },
  'action-optimizer':     { schemaName: undefined },
  'video-prompt-optimizer': { schemaName: undefined },
}

// ⭐ 找出所有不在 FIELD_MAP alias 中的字段名
function findUnknownFields(obj: any, knownAliases: Set<string>): string[] {
  const unknown: string[] = []

  function walk(value: any, path: string) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    for (const key of Object.keys(value)) {
      if (!knownAliases.has(key) && !key.startsWith('_')) {
        unknown.push(`${path}.${key}`)
      }
      walk(value[key], `${path}.${key}`)
    }
  }

  walk(obj, '$')
  return [...new Set(unknown)]
}

// ⭐ 检测同一对象内是否存在语义重复的字段（如 sceneId + scene_id）
function findDuplicateSemantics(obj: any): string[] {
  const duplicates: string[] = []

  function walk(value: any, seen: Set<string>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return

    const presentKeys = Object.keys(value).filter(k => !k.startsWith('_'))

    // 对每个 FIELD_MAP entry，检查是否有多个 alias 同时出现
    for (const [canonical, def] of Object.entries(FIELD_MAP)) {
      const hits = presentKeys.filter(k => def.alias.includes(k))
      if (hits.length > 1) {
        duplicates.push(`${canonical}: [${hits.join(', ')}]`)
      }
    }

    for (const v of Object.values(value)) {
      walk(v, seen)
    }
  }

  walk(obj, new Set())
  return [...new Set(duplicates)]
}

// ⭐ 获取当前 drift 快照（用于 API）
export function getDriftSummary(): string[] {
  return [
    `FIELD_MAP: ${Object.keys(FIELD_MAP).length} canonical fields`,
    `AGENT_SCHEMAS: ${Object.keys(AGENT_SCHEMAS).length} agent schemas`,
    `AGENT_SCHEMA_VERSIONS: ${Object.keys(AGENT_SCHEMA_VERSIONS).length} agent versions`,
    `KNOWN ALIASES: ${Object.values(FIELD_MAP).flatMap(f => f.alias).length} total aliases`,
  ]
}
