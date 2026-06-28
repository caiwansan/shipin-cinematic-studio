/**
 * Visual Constraint Loop — Type Definitions
 *
 * Phase 0: 旁路系统类型定义
 * 不依赖任何旧代码，所有新模块只消费这些类型
 */

// ─── 视角类型 ───
export type ViewType = 'portrait' | 'front' | 'side' | 'back'

// ─── 结构约束校验结果（由 Vision Validator 输出） ───
export interface ViewValidationResult {
  personCount: number
  bodyVisibility: 'head_shoulders' | 'full_body' | 'partial' | 'unknown'
  faceVisibility: 'visible' | 'hidden' | 'partial' | 'unknown'
  cameraAngle: 'front' | 'profile' | 'back' | 'close_up' | 'three_quarter' | 'unknown'
  hasExtraPerson: boolean
  rawCaption: string
}

// ─── Validator Safeguard 输出（Phase 5.1） ───
export interface ValidationResult {
  success: boolean
  degraded: boolean
  timeout: boolean
  reason?: 'timeout' | 'provider_error' | 'json_parse_error' | 'unsupported_provider'
}

/** 降级时的默认 ValidationResult */
export const DEGRADED_RESULT: ValidationResult = {
  success: false,
  degraded: true,
  timeout: false,
  reason: 'provider_error',
}

// ─── 单视图约束规则 ───
export interface ViewRule {
  viewType: ViewType
  checks: ConstraintCheck[]
}

export type ConstraintCheck =
  | { kind: 'personCount'; expected: number }
  | { kind: 'bodyVisibility'; expected: ViewValidationResult['bodyVisibility'] }
  | { kind: 'faceVisibility'; expected: ViewValidationResult['faceVisibility'] }
  | { kind: 'cameraAngle'; expected: ViewValidationResult['cameraAngle'] }

// ─── 四视图完整约束 ───
export interface ViewConstraint {
  requiredViews: ViewType[]
  rules: ViewRule[]
}

// ─── 候选图片（一次采样结果） ───
export interface ViewCandidate {
  url: string
  seed: number
  validation: ViewValidationResult | null
  validationStatus?: ValidationResult  // P5.1: validator 降级信号
  score: number
}

// ─── Identity 全局一致性状态 ───
export interface IdentityState {
  frontImageUrl: string            // 正面全身（identity anchor）
  clothingSignature: string        // 服装描述（自动从 caption 提取）
  poseConsistency: number          // 各视图姿态一致性评分（0-100）
}

// ─── 候选池（每个视角多个候选） ───
export type ViewCandidatePool = Record<ViewType, ViewCandidate[]>

// ─── 最终选中的结果 ───
export interface SelectedViews {
  portrait: ViewCandidate | null
  front: ViewCandidate | null
  side: ViewCandidate | null
  back: ViewCandidate | null
  identityState: IdentityState | null
}

// ─── 四视图默认硬约束 ───
export const FOUR_VIEW_CONSTRAINT: ViewConstraint = {
  requiredViews: ['portrait', 'front', 'side', 'back'],
  rules: [
    {
      viewType: 'portrait',
      checks: [
        { kind: 'personCount', expected: 1 },
        { kind: 'bodyVisibility', expected: 'head_shoulders' },
        { kind: 'faceVisibility', expected: 'visible' },
        { kind: 'cameraAngle', expected: 'close_up' },
      ],
    },
    {
      viewType: 'front',
      checks: [
        { kind: 'personCount', expected: 1 },
        { kind: 'bodyVisibility', expected: 'full_body' },
        { kind: 'faceVisibility', expected: 'visible' },
        { kind: 'cameraAngle', expected: 'front' },
      ],
    },
    {
      viewType: 'side',
      checks: [
        { kind: 'personCount', expected: 1 },
        { kind: 'bodyVisibility', expected: 'full_body' },
        { kind: 'faceVisibility', expected: 'hidden' },
        { kind: 'cameraAngle', expected: 'profile' },
      ],
    },
    {
      viewType: 'back',
      checks: [
        { kind: 'personCount', expected: 1 },
        { kind: 'bodyVisibility', expected: 'full_body' },
        { kind: 'faceVisibility', expected: 'hidden' },
        { kind: 'cameraAngle', expected: 'back' },
      ],
    },
  ],
}
