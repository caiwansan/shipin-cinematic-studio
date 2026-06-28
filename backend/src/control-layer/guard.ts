/**
 * control-layer/guard.ts
 *
 * ⚔️ Phase 5 — Safety Guard（安全守卫）
 *
 * 综合检测：
 *   1. director-style collision
 *   2. structure leakage attempt
 *   3. DSL overreach
 *   4. Blueprint contamination
 *   5. Execution Spine protection
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { VideoBlueprint } from '../types/video-blueprint.js'
import type { DirectorProfile } from '../director-registry/index.js'
import { validateDirectorPlan, validateBlueprintCleanliness } from '../director-runtime/validator.js'

// ── 守卫结果 ──

export interface GuardResult {
  safe: boolean
  checks: Array<{
    name: string
    passed: boolean
    message?: string
    severity: 'error' | 'warning' | 'info'
  }>
}

// ── 守卫函数 ──

/**
 * runSafetyGuard — 综合安全检查
 *
 * 在 Director → Blueprint 整个链路执行安全检查。
 */
export function runSafetyGuard(
  plan: DirectorPlan,
  director: DirectorProfile,
  blueprint?: VideoBlueprint
): GuardResult {
  const checks: GuardResult['checks'] = []

  // Check 1: DirectorPlan 合规性
  const planValidation = validateDirectorPlan(plan)
  checks.push({
    name: 'DirectorPlan 合规性',
    passed: planValidation.valid,
    message: planValidation.valid ? '通过' : planValidation.violations.map(v => v.message).join('; '),
    severity: planValidation.valid ? 'info' : 'error',
  })

  // Check 2: Director 配置合规
  const directorValid = director.id === 'canon' || director.id.startsWith('ext_')
  checks.push({
    name: 'Director 配置合规',
    passed: directorValid,
    message: directorValid ? `Director ${director.id} 配置有效` : `Director ${director.id} 不符合注册规范`,
    severity: directorValid ? 'info' : 'error',
  })

  // Check 3: Director 支持类型匹配
  const firstScene = plan.sceneSegmentation[0]
  const typeMatch = firstScene
    ? director.supportedNarrativeTypes.some(t => plan.narrativeIntent.includes(t) || t === '默认')
    : true
  checks.push({
    name: 'Director 类型匹配',
    passed: typeMatch,
    message: typeMatch ? '叙事类型与 Director 匹配' : '叙事类型与 Director 不匹配',
    severity: typeMatch ? 'info' : 'warning',
  })

  // Check 4: Blueprint 未被污染
  if (blueprint) {
    const cleanliness = validateBlueprintCleanliness(blueprint)
    checks.push({
      name: 'Blueprint 清洁度',
      passed: cleanliness.valid,
      message: cleanliness.valid ? '通过' : cleanliness.violations.map(v => v.message).join('; '),
      severity: cleanliness.valid ? 'info' : 'error',
    })
  }

  const hasError = checks.some(c => c.severity === 'error' && !c.passed)

  return {
    safe: !hasError,
    checks,
  }
}

/**
 * checkDSLOverreach — DSL 越界检测
 *
 * DSL 只能表达 render hints。
 * 如果检测到 DSL 试图影响叙事结构，返回警告。
 */
export function checkDSLOverreach(tokens: Array<{ type: string; value: unknown }>): GuardResult {
  const checks: GuardResult['checks'] = []

  // DSL 允许的 token 类型
  const ALLOWED_TYPES = ['LIGHTING', 'CONTRAST', 'HUE', 'SATURATION', 'TEMPERATURE',
    'LENS', 'MOVEMENT', 'DEPTH', 'PACING_OFFSET', 'UNKNOWN']

  const forbidden = tokens.filter(t => !ALLOWED_TYPES.includes(t.type))
  checks.push({
    name: 'DSL 越界检测',
    passed: forbidden.length === 0,
    message: forbidden.length > 0
      ? `检测到禁止的 token 类型: ${forbidden.map(t => t.type).join(', ')}`
      : '通过',
    severity: forbidden.length > 0 ? 'error' : 'info',
  })

  return {
    safe: forbidden.length === 0,
    checks,
  }
}
