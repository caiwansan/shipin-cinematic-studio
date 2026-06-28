/**
 * Character Law — 角色法则
 *
 * 角色一致性和视觉锁定规则。
 * 这是 Character Director Agent 的宪法输出，下游 Continuity Engine 强制执行。
 */

export interface CharacterLaw {
  /** 角色 ID */
  characterId: string

  /** 角色名 */
  name: string

  /** 角色类型 */
  role: CharacterRole

  /** 视觉锁定 — 最终渲染时使用的固定描述 */
  visualLock: VisualLock

  /** 肢体语言模式 */
  bodyLanguageProfile?: string

  /** 声音特征（TTS 用） */
  voiceProfile?: VoiceProfile

  /** 情绪 → 视觉表现映射 */
  emotionToVisual: EmotionVisualMap[]

  /** 禁止使用的描述/风格（防止 prompt 污染） */
  forbiddenDescriptors: string[]
}

export type CharacterRole =
  | 'protagonist'
  | 'antagonist'
  | 'supporting'
  | 'minor'
  | 'extra'

// ============================================================
// Visual Lock — 视觉锁定（不可变）
// ============================================================

export interface VisualLock {
  /** 面部特征（最终渲染用） */
  faceFeatures: string

  /** 体型 */
  bodyType: string

  /** 身高 */
  height: string

  /** 发型 */
  hairStyle: string

  /** 发色 */
  hairColor: string

  /** 眼睛特征 */
  eyeFeatures: string

  /** 肤色 */
  skinTone: string

  /** 独特辨识特征 */
  distinguishingFeatures: string[]

  /** 视觉签名（让角色一眼可识别的元素） */
  visualSignature: string

  /** 一致性关键词（注入 prompt 用） */
  consistentKeywords: string[]
}

// ============================================================
// Voice Profile
// ============================================================

export interface VoiceProfile {
  style: string
  pitch: 'low' | 'medium' | 'high'
  speed: 'slow' | 'normal' | 'fast'
  accent?: string
}

// ============================================================
// Emotion → Visual Mapping
// ============================================================

export interface EmotionVisualMap {
  emotion: string
  expressionDescription: string
  bodyLanguage: string
  intensity: number
}
