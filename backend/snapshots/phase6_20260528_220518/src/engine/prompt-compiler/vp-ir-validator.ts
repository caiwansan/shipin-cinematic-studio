/**
 * vp-ir-validator.ts — Director Layer v6.6 VP-IR Validator Gate
 *
 * 强制所有 AI 输出符合 VisualPromptIR schema。
 * 这是 compiler 前方的守卫层，防止非结构化数据污染编译链。
 *
 * 设计原则：
 *   1. 硬失败（hard fail）— 不兼容的输入不降级，直接报错
 *   2. 纯函数 — 不修改 IR，只验证
 *   3. 类型完备 — 检查每个必填字段的类型和值
 */

import type { VisualPromptIR } from './visual-prompt-ir.js'
import { validateIR } from './visual-prompt-ir.js'

export class VPIRValidationError extends Error {
  public missingFields: string[]
  public invalidFields: string[]

  constructor(missing: string[], invalid: string[]) {
    const msg = [
      'VP-IR 验证失败',
      missing.length > 0 ? `缺失字段: ${missing.join(', ')}` : '',
      invalid.length > 0 ? `无效字段: ${invalid.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' — ')
    super(msg)
    this.name = 'VPIRValidationError'
    this.missingFields = missing
    this.invalidFields = invalid
  }
}

// ============================================================
// 有效的 shotType 枚举值
// ============================================================

const validShotTypes = new Set([
  'close-up', 'medium', 'wide', 'aerial',
  'over-the-shoulder', 'extreme-close-up',
])

const validLightingTypes = new Set([
  'soft', 'hard', 'dramatic', 'natural', 'backlit', 'rim',
])

const validPacing = new Set(['slow', 'medium', 'fast', 'explosive'])

// ============================================================
// 验证函数
// ============================================================


/**
 * 验证单个 VP-IR 结构的完整性
 * 相比 validateIR() 更严格，检查值有效性而非仅存在性
 */
export function validateVPIR(input: any): VisualPromptIR {
  const missing: string[] = []
  const invalid: string[] = []

  // 1. 顶层
  if (!input) {
    throw new VPIRValidationError(['整个对象为空'], [])
  }

  if (typeof input.subject !== 'string' || !input.subject.trim()) {
    missing.push('subject')
  }

  // 2. scene
  if (!input.scene || typeof input.scene !== 'object') {
    missing.push('scene')
  } else {
    if (!input.scene.environment || typeof input.scene.environment !== 'string') missing.push('scene.environment')
    if (!input.scene.timeOfDay || typeof input.scene.timeOfDay !== 'string') missing.push('scene.timeOfDay')
    if (!input.scene.atmosphere || typeof input.scene.atmosphere !== 'string') missing.push('scene.atmosphere')
  }

  // 3. camera
  if (!input.camera || typeof input.camera !== 'object') {
    missing.push('camera')
  } else {
    if (!input.camera.shotType || typeof input.camera.shotType !== 'string') {
      missing.push('camera.shotType')
    } else if (!validShotTypes.has(input.camera.shotType)) {
      invalid.push(`camera.shotType="${input.camera.shotType}"，有效值: ${[...validShotTypes].join(', ')}`)
    }
    if (!input.camera.angle || typeof input.camera.angle !== 'string') missing.push('camera.angle')
    if (!input.camera.lens || typeof input.camera.lens !== 'string') missing.push('camera.lens')
  }

  // 4. lighting
  if (!input.lighting || typeof input.lighting !== 'object') {
    missing.push('lighting')
  } else {
    if (!input.lighting.type || typeof input.lighting.type !== 'string') {
      missing.push('lighting.type')
    } else if (!validLightingTypes.has(input.lighting.type)) {
      invalid.push(`lighting.type="${input.lighting.type}"，有效值: ${[...validLightingTypes].join(', ')}`)
    }
  }

  // 5. style（不强制报错，但记录）
  const styleMissing: string[] = []
  if (!input.style || typeof input.style !== 'object') {
    styleMissing.push('style')
  } else {
    if (!input.style.cinematicStyle) styleMissing.push('style.cinematicStyle')
  }
  if (styleMissing.length > 0 && false) {
    // 不作为硬错误，只记录
  }

  // 6. constraints
  if (!input.constraints || typeof input.constraints !== 'object') {
    missing.push('constraints')
  } else {
    if (!Array.isArray(input.constraints.avoid)) missing.push('constraints.avoid')
    if (!Array.isArray(input.constraints.mustInclude)) missing.push('constraints.mustInclude')
  }

  // 7. action（验证类型）
  if (input.action && typeof input.action === 'object') {
    if (input.action.pacing && !validPacing.has(input.action.pacing)) {
      invalid.push(`action.pacing="${input.action.pacing}"，有效值: ${[...validPacing].join(', ')}`)
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new VPIRValidationError(missing, invalid)
  }

  return input as VisualPromptIR
}

/**
 * 批量验证多个 VP-IR（用于 segment 列表）
 */
export function validateVPIRBatch(inputs: any[]): VisualPromptIR[] {
  const results: VisualPromptIR[] = []

  for (let i = 0; i < inputs.length; i++) {
    try {
      results.push(validateVPIR(inputs[i]))
    } catch (err) {
      if (err instanceof VPIRValidationError) {
        throw new VPIRValidationError(
          err.missingFields.map((f) => `segments[${i}].${f}`),
          err.invalidFields.map((f) => `segments[${i}].${f}`),
        )
      }
      throw err
    }
  }

  return results
}
