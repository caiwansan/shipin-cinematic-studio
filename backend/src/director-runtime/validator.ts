/**
 * director-runtime/validator.ts
 *
 * ⚔️ Phase 2 Implementation — 编译验证器
 *
 * 在 compile() 前后执行双重检查：
 *   - 输入检查：DirectorPlan 是否包含视觉/技术字段
 *   - 输出检查：VideoBlueprint 是否包含叙事残留
 *
 * 这是「不可逆转换边界」的实施保障。
 */

import type { DirectorPlan } from './types.js'
import type { VideoBlueprint } from '../types/video-blueprint.js'
import { assertNoDirectorLeak } from './types.js'
import { validateNarrativeGraph } from './narrative-graph.js'

// ── 验证结果 ──

export interface ValidationResult {
  valid: boolean
  violations: Array<{
    type: 'DIRECTOR_LEAK' | 'BLUEPRINT_CONTAMINATION' | 'GRAPH_INVALID' | 'STRUCTURE_INCOMPLETE' | 'STYLE_LEAK'
    message: string
    path?: string
  }>
}

// ── 输入验证 ──

/**
 * validateDirectorPlan — DirectorPlan 合规性检查
 *
 * 检查：
 *   1. 违禁字段（assertNoDirectorLeak）
 *   2. NarrativeGraph 合法性（validateNarrativeGraph）
 *   3. 结构完整性
 */
export function validateDirectorPlan(plan: unknown): ValidationResult {
  const violations: ValidationResult['violations'] = []

  // 1. 违禁字段检查
  try {
    assertNoDirectorLeak(plan)
  } catch (e) {
    violations.push({
      type: 'DIRECTOR_LEAK',
      message: (e as Error).message,
    })
  }

  // 2. 结构完整性检查
  const structureIssues = checkPlanStructure(plan)
  violations.push(...structureIssues)

  // 3. NarrativeGraph 合法性
  if (plan && typeof plan === 'object') {
    const p = plan as Record<string, unknown>
    if (p.narrativeGraph && !validateNarrativeGraph(p.narrativeGraph)) {
      violations.push({
        type: 'GRAPH_INVALID',
        message: 'NarrativeGraph 包含非法字段或结构不完整',
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

/**
 * checkPlanStructure — DirectorPlan 结构完整性检查
 * 不涉及违禁字段，只检查字段存在性
 */
function checkPlanStructure(value: unknown): ValidationResult['violations'] {
  const violations: ValidationResult['violations'] = []

  if (!value || typeof value !== 'object') {
    violations.push({ type: 'STRUCTURE_INCOMPLETE', message: 'DirectorPlan 不是对象' })
    return violations
  }

  const plan = value as Record<string, unknown>
  const requiredFields = ['narrativeIntent', 'emotionalArc', 'sceneSegmentation', 'narrativeLogic', 'narrativeGraph']

  for (const field of requiredFields) {
    if (!(field in plan)) {
      violations.push({ type: 'STRUCTURE_INCOMPLETE', message: `缺少必填字段: ${field}`, path: field })
    }
  }

  // sceneSegmentation 必须是数组
  if (plan.sceneSegmentation !== undefined && !Array.isArray(plan.sceneSegmentation)) {
    violations.push({ type: 'STRUCTURE_INCOMPLETE', message: 'sceneSegmentation 必须是数组', path: 'sceneSegmentation' })
  }

  // narrativeLogic 必须包含三个子字段
  if (plan.narrativeLogic && typeof plan.narrativeLogic === 'object') {
    const nl = plan.narrativeLogic as Record<string, unknown>
    for (const field of ['causeEffectGraph', 'tensionFlow', 'pacingModel']) {
      if (!(field in nl)) {
        violations.push({ type: 'STRUCTURE_INCOMPLETE', message: `narrativeLogic 缺少: ${field}`, path: `narrativeLogic.${field}` })
      }
    }
  }

  return violations
}

// ── 输出验证 ──

/**
 * validateBlueprintCleanliness — Blueprint 是否干净（无叙事残留）
 *
 * Blueprint 是纯媒体结构，不能包含：
 *   - narrativeIntent / emotionalArc / narrativeLogic / narrativeGraph
 *   - Director 相关的 meta 信息
 */
export function validateBlueprintCleanliness(blueprint: unknown): ValidationResult {
  const violations: ValidationResult['violations'] = []

  if (!blueprint || typeof blueprint !== 'object') {
    violations.push({ type: 'BLUEPRINT_CONTAMINATION', message: 'Blueprint 不是对象' })
    return { valid: false, violations }
  }

  const bp = blueprint as Record<string, unknown>

  // 检查叙事残留
  const narrativeResidue = ['narrativeIntent', 'emotionalArc', 'narrativeLogic', 'narrativeGraph']

  for (const field of narrativeResidue) {
    if (field in bp) {
      violations.push({
        type: 'BLUEPRINT_CONTAMINATION',
        message: `Blueprint 包含叙事残留字段: ${field}`,
        path: field,
      })
    }
  }

  // 检查是否包含 Director 的 meta 信息
  if (bp.meta && typeof bp.meta === 'object') {
    const meta = bp.meta as Record<string, unknown>
    if ('inputSource' in meta) {
      violations.push({
        type: 'BLUEPRINT_CONTAMINATION',
        message: 'Blueprint 包含 Director 的 meta 信息',
        path: 'meta.inputSource',
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

// ── Style Guard（Phase 4 — 防止风格污染叙事结构） ──

export function validateStyleIntegrity(
  originalPlan: unknown,
  styledPlan: unknown
): ValidationResult {
  const violations: ValidationResult['violations'] = []
  if (!originalPlan || !styledPlan) {
    violations.push({ type: 'STYLE_LEAK', message: '输入为空' })
    return { valid: false, violations }
  }
  const orig = originalPlan as Record<string, unknown>
  const styled = styledPlan as Record<string, unknown>

  if (Array.isArray(orig.sceneSegmentation) && Array.isArray(styled.sceneSegmentation)) {
    if (orig.sceneSegmentation.length !== styled.sceneSegmentation.length) {
      violations.push({ type: 'STYLE_LEAK', message: `Style 改变了场景分割数量: ${orig.sceneSegmentation.length} → ${styled.sceneSegmentation.length}`, path: 'sceneSegmentation' })
    }
    for (let i = 0; i < orig.sceneSegmentation.length && i < styled.sceneSegmentation.length; i++) {
      const o = orig.sceneSegmentation[i] as Record<string, unknown>
      const s = styled.sceneSegmentation[i] as Record<string, unknown>
      if (o.id !== s.id) {
        violations.push({ type: 'STYLE_LEAK', message: `Style 改变了场景顺序: ${o.id} → ${s.id}`, path: `sceneSegmentation[${i}]` })
        break
      }
    }
  }

  const origLogic = orig.narrativeLogic as Record<string, unknown> | undefined
  const styledLogic = styled.narrativeLogic as Record<string, unknown> | undefined
  if (origLogic?.causeEffectGraph && styledLogic?.causeEffectGraph) {
    if (JSON.stringify(origLogic.causeEffectGraph) !== JSON.stringify(styledLogic.causeEffectGraph)) {
      violations.push({ type: 'STYLE_LEAK', message: 'Style 改变了因果图结构', path: 'narrativeLogic.causeEffectGraph' })
    }
  }

  if (Array.isArray(orig.emotionalArc) && Array.isArray(styled.emotionalArc)) {
    if (JSON.stringify(orig.emotionalArc) !== JSON.stringify(styled.emotionalArc)) {
      violations.push({ type: 'STYLE_LEAK', message: 'Style 改变了情绪弧线', path: 'emotionalArc' })
    }
  }

  return { valid: violations.length === 0, violations }
}
