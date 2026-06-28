/**
 * control-layer/orchestrator.ts
 *
 * ⚔️ Phase 5 — Creative Orchestrator（调度器）
 *
 * 职责：
 *   组合 DirectorProfile + StyleDSL → 安全的 ExecutionPlan
 *
 * 规则：
 *   - validate compatibility（Director 是否支持该风格）
 *   - enforce Phase 4 constraints（Style 不污染结构）
 *   - block unsafe combinations
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { DirectorProfile } from '../director-registry/index.js'
import type { StyleProfile } from '../style-runtime/style-registry.js'
import { validateStyleIntegrity } from '../director-runtime/validator.js'

// ── Execution Plan ──

export interface ExecutionPlan {
  /** 使用的 Director */
  director: DirectorProfile
  /** 使用的风格 */
  style: StyleProfile
  /** 生成的 DirectorPlan */
  plan: DirectorPlan
  /** 兼容性状态 */
  compatibility: {
    valid: boolean
    warnings: string[]
    risks: string[]
  }
  /** 时间戳 */
  createdAt: number
}

// ── 组合验证 ──

export interface CombinationResult {
  valid: boolean
  warnings: string[]
  risks: string[]
  reason: string
}

function validateCombination(
  director: DirectorProfile,
  style: StyleProfile
): CombinationResult {
  const warnings: string[] = []
  const risks: string[] = []

  // 1. 检查 Director 是否支持该风格
  if (!director.supportedStyles.includes(style.name)) {
    if (style.name === 'custom' || style.name.startsWith('dsl_')) {
      warnings.push(`Director ${director.name} 不支持自定义风格，尝试使用兼容模式`)
    } else {
      warnings.push(`Director ${director.name} 未明确注册风格 ${style.displayName}，使用默认兼容模式`)
    }
  }

  // 2. 检查风格兼容性
  if (style.pacingModifier.offset > 0.2) {
    risks.push('节奏偏移过大（>0.2），可能影响叙事节奏一致性')
  }
  if (style.pacingModifier.offset < -0.2) {
    risks.push('节奏偏移过低（<-0.2），可能让叙事节奏过于缓慢')
  }

  return {
    valid: true, // 软检查，不阻塞
    warnings,
    risks,
    reason: warnings.length > 0 || risks.length > 0
      ? `组合存在 ${warnings.length} 个警告，${risks.length} 个风险`
      : '组合兼容',
  }
}

// ── Orchestrator ──

/**
 * orchestrate — 组合 Director + Style → ExecutionPlan
 *
 * 完整流程：
 *   1. 验证 Director 与 Style 兼容性
 *   2. 生成执行计划
 *   3. 检查 Style 是否污染规划结构
 */
export function orchestrate(
  director: DirectorProfile,
  style: StyleProfile,
  plan: DirectorPlan,
  originalPlan?: DirectorPlan
): ExecutionPlan {
  const compatibility = validateCombination(director, style)

  // 检查 Style 污染
  if (originalPlan) {
    const integrity = validateStyleIntegrity(originalPlan, plan)
    if (!integrity.valid) {
      for (const v of integrity.violations) {
        compatibility.warnings.push(`STYLE_LEAK: ${v.message}`)
        compatibility.risks.push('Style 污染叙事结构，结果不可靠')
      }
    }
  }

  return {
    director,
    style,
    plan,
    compatibility: {
      valid: compatibility.valid,
      warnings: compatibility.warnings,
      risks: compatibility.risks,
    },
    createdAt: Date.now(),
  }
}
