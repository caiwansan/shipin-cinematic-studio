/**
 * Narrative Constraint Engine (orchestrator)
 * 叙事约束引擎 — Dual-Pass Validator 的核心编排器
 *
 * 职能：
 *   在因果传播之后，叙事约束验证之前，作为 HARD GATE
 *   edit → propagate → validate → accept / repair / reject
 *
 * 系统管道：
 *   Edit Event
 *     ↓
 *   Causal Propagation Engine (existing)
 *     ↓
 *   Narrative Constraint Engine  ←  YOU ARE HERE
 *     ↓
 *   IF PASS:
 *       commit → UI diff
 *   IF FAIL:
 *       repair engine → retry
 *       OR reject with explanation
 */

import {
  DirectorCausalGraph,
  CausalPatch,
} from '../causal-graph/causal-graph-types.js'
import { propagateChange, cleanDirtyFlags } from '../causal-graph/causal-propagation-engine.js'
import { recompileSubgraph } from '../causal-graph/shot-recompiler.js'
import { validateArc } from './story-arc-governor.js'
import { validateTensionCurve } from './tension-curve-validator.js'
import { checkTransitions } from './forbidden-transition-matrix.js'
import { repairGraph } from './repair-engine.js'
import {
  NarrativeConstraint,
  ValidationResult,
  ConstraintViolation,
  createDefaultConstraint,
} from './narrative-constraint-types.js'

export type GateDecision =
  | { action: 'accept'; patches: CausalPatch[] }
  | { action: 'repair_and_accept'; patches: CausalPatch[]; repairs: string[] }
  | { action: 'reject'; violations: ConstraintViolation[]; reason: string }

export interface EngineOptions {
  autoRepair: boolean
  autoReport: boolean
  strictMode: boolean
}

const DEFAULT_OPTIONS: EngineOptions = {
  autoRepair: true,
  autoReport: true,
  strictMode: true,
}

/**
 * Dual-Pass Gate
 * Pass 1: Causal Propagation (calls existing engine)
 * Pass 2: Narrative Validation (this engine)
 * Decision: accept / repair_and_accept / reject
 */
export function narrativeGate(
  graph: DirectorCausalGraph,
  edit: { nodeId: string; newState: Record<string, any> },
  constraint?: NarrativeConstraint,
  options: EngineOptions = DEFAULT_OPTIONS,
): GateDecision {
  const effectiveConstraint = constraint ?? createDefaultConstraint('build_peak_release')

  // Pass 1: Causal Propagation
  const propagation = propagateChange(graph, edit.nodeId, edit.newState)

  // Pass 2: Narrative Validation
  const arcValidation = validateArc(graph, effectiveConstraint)
  const tensionValidation = validateTensionCurve(
    arcValidation.tensionCurve,
    effectiveConstraint,
  )
  const transitionCheck = checkTransitions(graph, effectiveConstraint)

  // 合并所有违规
  const allViolations = [
    ...arcValidation.violations,
    ...tensionValidation.violations,
    ...transitionCheck.violations,
  ]

  // 决定
  if (allViolations.length === 0) {
    // ✅ 通过 — commit
    const recompile = recompileSubgraph(graph, propagation, {
      preserveUnaffected: true,
      useCache: true,
    })

    cleanDirtyFlags(graph)

    return {
      action: 'accept',
      patches: recompile.patches,
    }
  }

  // ❌ 有违规
  if (!options.autoRepair) {
    return {
      action: 'reject',
      violations: allViolations,
      reason: `叙事约束验证失败: ${allViolations.length} 个违规`,
    }
  }

  // 🔧 尝试自动修复
  const repair = repairGraph(graph, allViolations, effectiveConstraint)

  if (repair.success) {
    // 修复后重新验证
    const reValidation = validateArc(graph, effectiveConstraint)

    if (reValidation.valid) {
      return {
        action: 'repair_and_accept',
        patches: repair.patches,
        repairs: repair.appliedStrategies.map(s => s.description),
      }
    }
  }

  // 修复失败 — reject
  return {
    action: 'reject',
    violations: allViolations,
    reason: `自动修复失败。违规: ${allViolations.map(v => v.message).join('; ')}`,
  }
}

/**
 * 快速检查图是否满足叙事约束（只检查，不修饰改）
 */
export function quickCheck(
  graph: DirectorCausalGraph,
  constraint?: NarrativeConstraint,
): { valid: boolean; score: number; issues: string[] } {
  const effectiveConstraint = constraint ?? createDefaultConstraint('build_peak_release')
  const validation = validateArc(graph, effectiveConstraint)

  return {
    valid: validation.valid,
    score: validation.score,
    issues: validation.violations.map(v => v.message),
  }
}

/**
 * 获取叙事约束摘要信息
 */
export function getNarrativeSummary(
  graph: DirectorCausalGraph,
  constraint?: NarrativeConstraint,
): any {
  const effectiveConstraint = constraint ?? createDefaultConstraint('build_peak_release')
  const validation = validateArc(graph, effectiveConstraint)
  const tensionResult = validateTensionCurve(validation.tensionCurve, effectiveConstraint)

  return {
    arcType: effectiveConstraint.arcType,
    valid: validation.valid,
    score: validation.score,
    tensionCurve: validation.tensionCurve,
    peakPositions: validation.peakPositions,
    monotonicRegions: tensionResult.monotonicRegions,
    violations: validation.violations.length,
    summary: [
      `Arc: ${effectiveConstraint.arcType}`,
      `Score: ${(validation.score * 100).toFixed(0)}%`,
      `Tension points: ${validation.tensionCurve.length}`,
      `Peaks: ${validation.peakPositions.length}`,
      validation.valid ? '✅ All constraints satisfied' : `❌ ${validation.violations.length} violations`,
    ].join(' | '),
  }
}
