/**
 * Intent Enforcement Layer — 意图强制执行层
 *
 * 确保所有下游系统（Director Agent / Prompt Compiler / Scheduler / Pipeline）
 * 严格遵守 Director Intent State，不允许 reinterpret / override。
 *
 * 使用方式：
 *   const enforced = enforceIntent(intentState, agentOutput)
 *   const valid = validatePipelineOutput(intentState, pipelineResult)
 */

import { type DirectorIntentState } from './director-intent-state.js'

// ============================================================
// Enforcement Results
// ============================================================

export interface EnforcementResult {
  valid: boolean
  violations: EnforcementViolation[]
  corrected: Record<string, any>
}

export interface EnforcementViolation {
  type: 'EMOTION_OVERRIDE' | 'VISUAL_OVERRIDE' | 'CAMERA_OVERRIDE' | 'CONSTRAINT_VIOLATION' | 'CHARACTER_DRIFT'
  field: string
  agentName: string
  originalValue: string
  expectedValue: string
  severity: 'error' | 'warning'
}

/**
 * 强制下游 Agent 输出遵守 Intent State
 * 如果 Agent 输出了与 Intent 不符的值，强制替换
 */
export function enforceIntentOnAgentOutput(
  intent: DirectorIntentState,
  agentOutput: Record<string, any>,
  agentName: string,
): EnforcementResult {
  const violations: EnforcementViolation[] = []
  const corrected = { ...agentOutput }

  // 1. 强制情绪对齐
  if (corrected.emotion && corrected.emotion !== intent.globalEmotion) {
    violations.push({
      type: 'EMOTION_OVERRIDE',
      field: 'emotion',
      agentName,
      originalValue: corrected.emotion,
      expectedValue: intent.globalEmotion,
      severity: 'error',
    })
    corrected.emotion = intent.globalEmotion
  }

  // 2. 强制视觉风格对齐
  if (corrected.visualTone && corrected.visualTone !== intent.visualTone) {
    violations.push({
      type: 'VISUAL_OVERRIDE',
      field: 'visualTone',
      agentName,
      originalValue: corrected.visualTone,
      expectedValue: intent.visualTone,
      severity: 'error',
    })
    corrected.visualTone = intent.visualTone
  }

  // 3. 强制镜头语言对齐
  if (corrected.cameraLanguage && corrected.cameraLanguage !== intent.cameraLanguage) {
    violations.push({
      type: 'CAMERA_OVERRIDE',
      field: 'cameraLanguage',
      agentName,
      originalValue: corrected.cameraLanguage,
      expectedValue: intent.cameraLanguage,
      severity: 'error',
    })
    corrected.cameraLanguage = intent.cameraLanguage
  }

  // 4. 强制约束
  if (intent.constraints.handheldOnly && corrected.cameraMotion === 'static') {
    violations.push({
      type: 'CONSTRAINT_VIOLATION',
      field: 'cameraMotion',
      agentName,
      originalValue: 'static',
      expectedValue: 'handheld',
      severity: 'error',
    })
    corrected.cameraMotion = 'handheld'
  }

  if (intent.constraints.lowLightOnly && corrected.lighting === 'high_key') {
    violations.push({
      type: 'CONSTRAINT_VIOLATION',
      field: 'lighting',
      agentName,
      originalValue: 'high_key',
      expectedValue: 'low_key',
      severity: 'error',
    })
    corrected.lighting = 'low_key'
  }

  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    corrected,
  }
}

/**
 * 验证 Pipeline 输出
 */
export function validatePipelineOutput(
  intent: DirectorIntentState,
  pipelineResult: any,
): EnforcementResult {
  const violations: EnforcementViolation[] = []

  // Pipeline 是执行层，检查最终输出是否匹配
  if (pipelineResult.emotion && pipelineResult.emotion !== intent.globalEmotion) {
    violations.push({
      type: 'EMOTION_OVERRIDE',
      field: 'emotion',
      agentName: 'pipeline',
      originalValue: pipelineResult.emotion,
      expectedValue: intent.globalEmotion,
      severity: 'warning',
    })
  }

  if (pipelineResult.visualStyle && pipelineResult.visualStyle !== intent.visualTone) {
    violations.push({
      type: 'VISUAL_OVERRIDE',
      field: 'visualStyle',
      agentName: 'pipeline',
      originalValue: pipelineResult.visualStyle,
      expectedValue: intent.visualTone,
      severity: 'warning',
    })
  }

  return {
    valid: violations.length <= 1,
    violations,
    corrected: pipelineResult,
  }
}

/**
 * 验证 Scheduler 输出（Scheduler 不改变语义，只优化执行顺序和资源）
 */
export function validateSchedulerOutput(
  intent: DirectorIntentState,
  schedulerGraph: any,
): EnforcementResult {
  // Scheduler 应该完全不涉及语义字段
  const semanticFields = ['emotion', 'cameraLanguage', 'visualTone', 'lighting', 'pacing']
  const violations: EnforcementViolation[] = []

  for (const field of semanticFields) {
    if (schedulerGraph[field] && schedulerGraph[field] !== (intent as any)[field]) {
      violations.push({
        type: 'CAMERA_OVERRIDE',
        field,
        agentName: 'scheduler',
        originalValue: schedulerGraph[field],
        expectedValue: (intent as any)[field],
        severity: 'error',
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    corrected: schedulerGraph,
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

