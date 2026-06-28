/**
 * control-layer/safety-reinforcement.ts
 *
 * ⚔️ Phase 6 — Safety Reinforcement（安全强化）
 *
 * Phase 5 Guard 的升级版。Phase 6 引入插件系统后需要额外的安全层。
 *
 * 新增检测：
 *   1. Plugin Boundary Validator — 插件是否越过自身 scope
 *   2. DSL Abuse Detector — DSL 是否试图影响结构
 *   3. Indirect Blueprint Mutation Detector — 间接 BP 污染检测
 */

import type { PluginOutput } from '../plugin-sandbox/index.js'
import type { VideoBlueprint } from '../types/video-blueprint.js'
import type { DirectorPlan } from '../director-runtime/types.js'

// ── Plugin Boundary Validator ──

export interface PluginBoundaryResult {
  safe: boolean
  violations: Array<{
    pluginId: string
    scope: string
    attemptedAction: string
  }>
}

/**
 * validatePluginBoundaries — 验证所有插件输出是否在各自 scope 内
 */
export function validatePluginBoundaries(
  pluginResults: Array<{ id: string; scope: string; output: PluginOutput }>
): PluginBoundaryResult {
  const violations: PluginBoundaryResult['violations'] = []

  for (const result of pluginResults) {
    const { id, scope, output } = result

    // intent-scope 插件不能输出 styleSuggestions 或 directorPreference
    if (scope === 'intent') {
      if (output.styleSuggestions && output.styleSuggestions.length > 0) {
        violations.push({ pluginId: id, scope, attemptedAction: '输出 styleSuggestions' })
      }
      if (output.directorPreference) {
        violations.push({ pluginId: id, scope, attemptedAction: '输出 directorPreference' })
      }
    }

    // style-scope 插件不能输出 modifiedIntent 或 directorPreference
    if (scope === 'style') {
      if (output.modifiedIntent) {
        violations.push({ pluginId: id, scope, attemptedAction: '修改 intent' })
      }
      if (output.directorPreference) {
        violations.push({ pluginId: id, scope, attemptedAction: '输出 directorPreference' })
      }
    }

    // director-scope 插件不能输出 modifiedIntent 或 styleSuggestions
    if (scope === 'director') {
      if (output.modifiedIntent) {
        violations.push({ pluginId: id, scope, attemptedAction: '修改 intent' })
      }
      if (output.styleSuggestions && output.styleSuggestions.length > 0) {
        violations.push({ pluginId: id, scope, attemptedAction: '输出 styleSuggestions' })
      }
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  }
}

// ── DSL Abuse Detector ──

export interface DSLAbuseResult {
  safe: boolean
  detections: Array<{
    keyword: string
    risk: 'high' | 'medium' | 'low'
    reason: string
  }>
}

// DSL 中禁止的关键词（试图影响结构）
const FORBIDDEN_DSL_KEYWORDS = [
  'scene cut',
  'add scene',
  'remove scene',
  'skip scene',
  'change order',
  '因果',
  '情绪弧',
  '叙事',
  '情节',
  '剧本',
  'story',
  'narrative',
  'plot',
  'causal',
  'emotion arc',
  'scene order',
  'segment',
]

/**
 * detectDSLAbuse — 检查 DSL 是否包含非法关键词
 */
export function detectDSLAbuse(dsl: string): DSLAbuseResult {
  const detections: DSLAbuseResult['detections'] = []
  const lowerDSL = dsl.toLowerCase()

  for (const keyword of FORBIDDEN_DSL_KEYWORDS) {
    if (lowerDSL.includes(keyword.toLowerCase())) {
      const risk: 'high' | 'medium' | 'low' =
        keyword.length > 10 ? 'high' :
        keyword.length > 6 ? 'medium' : 'low'
      detections.push({
        keyword,
        risk,
        reason: `DSL 包含结构控制关键词: "${keyword}"`,
      })
    }
  }

  return {
    safe: detections.length === 0,
    detections,
  }
}

// ── Indirect Blueprint Mutation Detector ──

export interface BlueprintMutationResult {
  mutated: boolean
  diffs: Array<{
    field: string
    original: string
    modified: string
  }>
}

/**
 * detectBlueprintMutation — 检测 Blueprint 是否被间接修改
 *
 * 通过比较相同的 plan 编译两次，检测非确定性输出。
 */
export function detectBlueprintMutation(
  plan: DirectorPlan,
  compileFn: (plan: DirectorPlan) => VideoBlueprint
): BlueprintMutationResult {
  // 同一 plan 编译两次
  const bp1 = compileFn(plan)
  const bp2 = compileFn(plan)

  const diffs: BlueprintMutationResult['diffs'] = []

  // 比较 compiledPrompt
  const p1 = JSON.stringify(bp1.compiledPrompt ?? '')
  const p2 = JSON.stringify(bp2.compiledPrompt ?? '')
  if (p1 !== p2) {
    diffs.push({
      field: 'compiledPrompt',
      original: p1.substring(0, 50),
      modified: p2.substring(0, 50),
    })
  }

  // 比较 shotGraph 长度
  const shots1 = bp1.shotGraph?.shots?.length ?? 0
  const shots2 = bp2.shotGraph?.shots?.length ?? 0
  if (shots1 !== shots2) {
    diffs.push({
      field: 'shotGraph.shots',
      original: `[${shots1} shots]`,
      modified: `[${shots2} shots]`,
    })
  }

  return {
    mutated: diffs.length > 0,
    diffs,
  }
}

// ── 综合安全报告 ──

export interface SafetyReinforcementReport {
  pluginBoundaries: PluginBoundaryResult
  dslAbuse: DSLAbuseResult
  blueprintMutation: BlueprintMutationResult
  overallSafe: boolean
  recommendations: string[]
}

export function generateSafetyReport(
  pluginBoundaries: PluginBoundaryResult,
  dslAbuse: DSLAbuseResult,
  blueprintMutation: BlueprintMutationResult
): SafetyReinforcementReport {
  const recommendations: string[] = []

  if (!pluginBoundaries.safe) {
    recommendations.push(`插件越界: ${pluginBoundaries.violations.length} 个违规，需检查插件 scope 权限`)
  }

  if (!dslAbuse.safe) {
    recommendations.push(`DSL 滥用: ${dslAbuse.detections.length} 个检测，包含结构控制关键词`)
  }

  if (blueprintMutation.mutated) {
    recommendations.push('Blueprint 非确定性输出：同一 plan 编译结果不同，需检查 Compiler 状态')
  }

  return {
    pluginBoundaries,
    dslAbuse,
    blueprintMutation,
    overallSafe: pluginBoundaries.safe && dslAbuse.safe && !blueprintMutation.mutated,
    recommendations,
  }
}
