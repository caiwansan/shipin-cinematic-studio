/**
 * Visual Doctrine — 视觉教义
 *
 * 整部作品的视觉风格宪章。
 * 所有场景/镜头设计必须服从此教义，越界会触发 Tone Boundary 检查。
 */

// ============================================================
// Visual Doctrine
// ============================================================

export interface VisualDoctrine {
  /** 色彩教义 */
  colorDoctrine: ColorDoctrine

  /** 灯光教义 */
  lightingDoctrine: LightingDoctrine

  /** 运镜教义 */
  cameraDoctrine: CameraDoctrine

  /** 构图教义 */
  compositionDoctrine: CompositionDoctrine
}

// ============================================================
// Color Doctrine
// ============================================================

export interface ColorDoctrine {
  /** 主色调色板（十六进制色值） */
  primaryPalette: string[]

  /** 强调色色板 */
  accentPalette: string[]

  /** 色彩象征映射（如 红色 → 危险, 蓝色 → 冷静） */
  colorSymbolism: Record<string, string>

  /** 色温偏好 */
  temperatureBias: 'warm' | 'cool' | 'neutral' | 'contrast_driven'

  /** 饱和度范围（0-100） */
  saturationRange?: [number, number]

  /** 色彩一致性要求 */
  consistencyLevel?: 'loose' | 'moderate' | 'strict'
}

// ============================================================
// Lighting Doctrine
// ============================================================

export interface LightingDoctrine {
  /** 基础灯光风格 */
  baseApproach: LightingApproach

  /** 关键场景的灯光例外（允许突破 baseApproach） */
  keySceneExceptions: SceneLightingException[]

  /** 自然光/人工光偏好 */
  lightSourceBias?: 'natural' | 'practical' | 'stylized'
}

export type LightingApproach =
  | 'natural'
  | 'high_key'
  | 'low_key'
  | 'noir'
  | 'chiaroscuro'
  | 'dramatic'
  | 'soft_diffused'
  | 'hard_edged'
  | 'mixed'

export interface SceneLightingException {
  sceneId: string
  override: LightingApproach
  reason: string
}

// ============================================================
// Camera Doctrine
// ============================================================

export interface CameraDoctrine {
  /** 默认焦段倾向 */
  defaultLensBias: string

  /** 偏好的运镜类型 */
  preferredMotions: string[]

  /** 运动强度范围（1-10） */
  motionIntensityRange: [number, number]

  /** 手持/稳定偏好 */
  stabilityBias?: 'fluid' | 'grounded' | 'raw' | 'mixed'
}

// ============================================================
// Composition Doctrine
// ============================================================

export interface CompositionDoctrine {
  /** 默认构图 */
  defaultComposition: string

  /** 景深偏好 */
  depthBias: 'shallow' | 'medium' | 'deep' | 'mixed'

  /** 构图忠诚度（严格按规则 vs 灵活应对） */
  compositionDiscipline?: 'strict' | 'moderate' | 'loose'
}
