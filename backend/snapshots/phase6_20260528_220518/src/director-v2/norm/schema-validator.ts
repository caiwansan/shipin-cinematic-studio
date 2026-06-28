/**
 * schema-validator.ts — Zod Schema Validation Layer
 *
 * 运行时验证 LLM 输出是否符合 Schema Contract。
 * 这是 Normalizer 的前置步骤：
 *   raw LLM → schema-validator → normalizer → semantic-repair → typed output
 *
 * 每个 Schema 类型都有对应的 Zod 校验器，支持：
 * - 字段缺失检测（required fields）
 * - 类型检查
 * - 枚举值约束
 * - 范围检查
 * - 嵌套结构验证
 */

import { z, type ZodError, type ZodSchema } from 'zod'
import type { StoryConstitution } from '../schema/story-constitution.js'
import type { EmotionalArc, EmotionalArcSegment } from '../schema/emotional-arc.js'
import type { VisualDoctrine, ColorDoctrine, LightingDoctrine, CameraDoctrine, CompositionDoctrine } from '../schema/visual-doctrine.js'
import type { PacingDoctrine, PacingBeat } from '../schema/pacing-doctrine.js'
import type { CinematicIdentity, SignatureElement } from '../schema/cinematic-identity.js'
import type { CharacterLaw, VisualLock, VoiceProfile, EmotionVisualMap } from '../schema/character-law.js'
import type { WorldPhysics, PhysicsAnomaly } from '../schema/world-physics.js'
import type { ToneBoundary } from '../schema/tone-boundary.js'

// ============================================================
// Zod 校验器集合
// ============================================================

const EmotionalArcSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  primaryEmotion: z.string(),
  secondaryEmotion: z.string().optional(),
  intensity: z.number().min(0).max(10),
  direction: z.enum(['rising', 'falling', 'plateau', 'spike', 'drop', 'peak']),
  durationRatio: z.number().min(0).max(1),
  trigger: z.string().optional(),
  emotionTags: z.array(z.string()).default([]),
})

const EmotionalArcSchema = z.object({
  dominantEmotion: z.string(),
  arcType: z.enum(['linear', 'wave', 'inverted_u', 'u_shape', 'crescendo', 'diminuendo', 'complex']),
  segments: z.array(EmotionalArcSegmentSchema).default([]),
  peakIntensity: z.number().min(0).max(10),
  peakSegmentIndex: z.number().optional(),
  resolutionTone: z.string(),
  curveDescription: z.string().optional(),
})

const ColorDoctrineSchema = z.object({
  primaryPalette: z.array(z.string()).default([]),
  accentPalette: z.array(z.string()).default([]),
  colorSymbolism: z.record(z.string()).default({}),
  temperatureBias: z.enum(['warm', 'cool', 'neutral', 'contrast_driven']),
  saturationRange: z.tuple([z.number(), z.number()]).optional(),
  consistencyLevel: z.enum(['loose', 'moderate', 'strict']).optional(),
})

const SceneLightingExceptionSchema = z.object({
  sceneId: z.string(),
  override: z.enum(['natural', 'high_key', 'low_key', 'noir', 'chiaroscuro', 'dramatic', 'soft_diffused', 'hard_edged', 'mixed']),
  reason: z.string(),
})

const LightingDoctrineSchema = z.object({
  baseApproach: z.enum(['natural', 'high_key', 'low_key', 'noir', 'chiaroscuro', 'dramatic', 'soft_diffused', 'hard_edged', 'mixed']),
  keySceneExceptions: z.array(SceneLightingExceptionSchema).default([]),
  lightSourceBias: z.enum(['natural', 'practical', 'stylized']).optional(),
})

const CameraDoctrineSchema = z.object({
  defaultLensBias: z.string(),
  preferredMotions: z.array(z.string()).default([]),
  motionIntensityRange: z.tuple([z.number(), z.number()]).default([1, 5]),
  stabilityBias: z.enum(['fluid', 'grounded', 'raw', 'mixed']).optional(),
})

const CompositionDoctrineSchema = z.object({
  defaultComposition: z.string(),
  depthBias: z.enum(['shallow', 'medium', 'deep', 'mixed']),
  compositionDiscipline: z.enum(['strict', 'moderate', 'loose']).optional(),
})

const VisualDoctrineSchema = z.object({
  colorDoctrine: ColorDoctrineSchema,
  lightingDoctrine: LightingDoctrineSchema,
  cameraDoctrine: CameraDoctrineSchema,
  compositionDoctrine: CompositionDoctrineSchema,
})

const PacingBeatSchema = z.object({
  beatNumber: z.number(),
  name: z.string(),
  phase: z.enum(['setup', 'tension', 'escalation', 'climax', 'release']),
  intensity: z.number().min(0).max(10),
  duration: z.number(),
  allowsHooks: z.boolean().default(true),
  minHooks: z.number().optional(),
  maxHooks: z.number().optional(),
  preferredShotTypes: z.array(z.string()).optional(),
  description: z.string().optional(),
})

const PacingDoctrineSchema = z.object({
  structureType: z.enum(['three_act', 'five_act', 'episodic', 'non_linear', 'circular', 'kyo_genshi']),
  hookDensity: z.enum(['sparse', 'moderate', 'dense', 'intense']),
  beatMap: z.array(PacingBeatSchema).default([]),
  climaxPlacement: z.number().min(0).max(1),
  pacingCurve: z.enum(['crescendo', 'wave', 'staccato', 'sustained', 'erratic', 'roller_coaster']),
  targetHookInterval: z.number().optional(),
  targetDuration: z.number().optional(),
})

const SignatureElementSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  mandatory: z.boolean().optional(),
})

const CinematicIdentitySchema = z.object({
  primaryInfluences: z.array(z.string()).default([]),
  signatureElements: z.array(z.union([z.string(), SignatureElementSchema])).default([]),
  eraTags: z.array(z.string()).default([]),
  visualConsistencyLevel: z.enum(['standard', 'strict', 'creative']),
  styleDeviationBudget: z.number().min(0).max(1).optional(),
  franchiseFingerprint: z.string().optional(),
})

const EmotionVisualMapSchema = z.object({
  emotion: z.string().optional(),
  expressionDescription: z.string().optional(),
  bodyLanguage: z.string().optional(),
  intensity: z.number().optional(),
})

const VoiceProfileSchema = z.object({
  style: z.string(),
  pitch: z.enum(['low', 'medium', 'high']),
  speed: z.enum(['slow', 'normal', 'fast']),
  accent: z.string().optional(),
}).optional()

const VisualLockSchema = z.object({
  faceFeatures: z.string().optional(),
  bodyType: z.string().optional(),
  height: z.string().optional(),
  hairStyle: z.string().optional(),
  hairColor: z.string().optional(),
  eyeFeatures: z.string().optional(),
  skinTone: z.string().optional(),
  distinguishingFeatures: z.array(z.string()).default([]),
  visualSignature: z.string().optional(),
  consistentKeywords: z.array(z.string()).default([]),
})

const CharacterLawSchema = z.object({
  characterId: z.string(),
  name: z.string(),
  role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor', 'extra']),
  visualLock: VisualLockSchema,
  bodyLanguageProfile: z.string().optional(),
  voiceProfile: VoiceProfileSchema,
  emotionToVisual: z.array(EmotionVisualMapSchema).default([]),
  forbiddenDescriptors: z.array(z.string()).default([]),
})

const PhysicsAnomalySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  visualImpact: z.string().optional(),
  triggerScenes: z.array(z.string()).optional(),
})

const WorldPhysicsSchema = z.object({
  environmentType: z.enum(['realistic', 'fantasy', 'sci_fi', 'post_apocalyptic', 'historical', 'surreal', 'abstract']),
  timePeriod: z.string(),
  physicsAnomalies: z.array(z.union([z.string(), PhysicsAnomalySchema])).default([]),
  scale: z.enum(['intimate', 'human', 'epic', 'cosmic']),
  defaultClimate: z.string().optional(),
  techLevel: z.enum(['primitive', 'medieval', 'industrial', 'modern', 'near_future', 'scifi', 'fantasy']).optional(),
})

const ToneBoundarySchema = z.object({
  dimension: z.string(),
  min: z.number().min(0).max(10),
  max: z.number().min(0).max(10),
  autoCorrect: z.enum(['clamp', 'reject', 'warn']).optional(),
  note: z.string().optional(),
})

const ScriptSourceInfoSchema = z.object({
  type: z.enum(['user_input', 'generated', 'imported', 'template', 'unknown']),
  originalLength: z.number(),
  language: z.string(),
  fileName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ============================================================
// Story Constitution — 完整 Schema
// ============================================================

export const StoryConstitutionSchema = z.object({
  schemaVersion: z.string(),
  constitutionVersion: z.string(),
  projectId: z.string(),
  createdAt: z.number(),
  traceId: z.string(),

  coreTheme: z.string(),
  emotionalTrajectory: EmotionalArcSchema,
  visualDoctrine: VisualDoctrineSchema,
  pacingDoctrine: PacingDoctrineSchema,
  cinematicIdentity: CinematicIdentitySchema,
  characterLaws: z.array(CharacterLawSchema).default([]),
  worldPhysics: WorldPhysicsSchema,
  toneBoundaries: z.array(ToneBoundarySchema).default([]),
  forbiddenStyles: z.array(z.string()).default([]),

  source: ScriptSourceInfoSchema,
  confidence: z.number().min(0).max(1),
  degraded: z.boolean(),
  degradeReason: z.string().optional(),
})

// ============================================================
// Validation Result
// ============================================================

export interface ValidationResult {
  /** 整体是否通过 */
  valid: boolean

  /** 验证后的数据（部分修复/类型强制） */
  data: StoryConstitution

  /** 错误列表 */
  errors: ValidationError[]

  /** 警告（非阻塞问题） */
  warnings: ValidationWarning[]

  /** 字段修复数 */
  fixesApplied: number
}

export interface ValidationError {
  path: string
  message: string
  code: 'missing_required' | 'type_mismatch' | 'enum_out_of_range' | 'out_of_bounds' | 'custom'
}

export interface ValidationWarning {
  path: string
  message: string
  code: 'missing_optional' | 'unexpected_value' | 'low_confidence'
}

// ============================================================
// Schema Validator
// ============================================================

export class SchemaValidator {
  /**
   * 验证 LLM 输出是否符合 StoryConstitution Schema
   */
  validate(raw: unknown): ValidationResult {
    const result = StoryConstitutionSchema.safeParse(raw)

    if (result.success) {
      return {
        valid: true,
        data: result.data as StoryConstitution,
        errors: [],
        warnings: [],
        fixesApplied: 0,
      }
    }

    // 解析 ZodError 生成详细报告
    const zodError = result.error as ZodError
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const issue of zodError.issues) {
      const path = issue.path.join('.')

      switch (issue.code) {
        case 'invalid_type':
          errors.push({
            path,
            message: `字段类型错误: 期望 ${issue.expected}，实际 ${issue.received}`,
            code: 'type_mismatch',
          })
          break
        case 'invalid_enum_value':
          errors.push({
            path,
            message: `枚举值不合法: "${issue.received}"，合法值: ${issue.options.join(', ')}`,
            code: 'enum_out_of_range',
          })
          break
        case 'too_small':
          errors.push({
            path,
            message: `值过小: 期望 >= ${issue.minimum}，实际不符合`,
            code: 'out_of_bounds',
          })
          break
        case 'too_big':
          errors.push({
            path,
            message: `值过大: 期望 <= ${issue.maximum}`,
            code: 'out_of_bounds',
          })
          break
        default:
          errors.push({
            path,
            message: issue.message,
            code: 'custom',
          })
      }
    }

    // 尝试用 Partial schema 做部分修复
    const partialResult = StoryConstitutionSchema.partial().safeParse(raw)

    return {
      valid: false,
      data: partialResult.success
        ? (partialResult.data as StoryConstitution)
        : (raw as StoryConstitution),
      errors,
      warnings,
      fixesApplied: 0,
    }
  }

  /**
   * 验证单个子 schema（不要求完整 Constitution）
   */
  validatePartial<T>(schema: ZodSchema<T>, raw: unknown): { valid: boolean; data?: T; errors: ValidationError[] } {
    const result = schema.safeParse(raw)

    if (result.success) {
      return { valid: true, data: result.data, errors: [] }
    }

    const zodError = result.error as ZodError
    const errors: ValidationError[] = zodError.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: 'custom' as const,
    }))

    return { valid: false, errors }
  }
}

/** 全局单例 */
export const schemaValidator = new SchemaValidator()
