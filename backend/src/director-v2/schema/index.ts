/**
 * Schema Index — 统一导出所有 schema 类型
 *
 * 所有下游 agent 通过此文件导入类型：
 *   import type { StoryConstitution, VisualDoctrine } from '../director-v2/schema/index.js'
 *
 * 注意：只导出 TS 类型，不包含 Zod 校验器。
 * Zod 校验器在 runtime/schema-validator.ts 中。
 */

export type { StoryConstitution } from './story-constitution.js'
export { createDefaultConstitution } from './story-constitution.js'

export type { ScriptSourceInfo } from './script-source.js'

export type {
  EmotionalArc,
  EmotionalArcSegment,
  EmotionalArcType,
} from './emotional-arc.js'

export type {
  VisualDoctrine,
  ColorDoctrine,
  LightingDoctrine,
  CameraDoctrine,
  CompositionDoctrine,
  LightingApproach,
  SceneLightingException,
} from './visual-doctrine.js'

export type {
  PacingDoctrine,
  PacingBeat,
  PacingPhase,
  NarrativeStructure,
  PacingCurve,
} from './pacing-doctrine.js'

export type {
  CinematicIdentity,
  SignatureElement,
  EraTag,
} from './cinematic-identity.js'

export type {
  CharacterLaw,
  CharacterRole,
  VisualLock,
  VoiceProfile,
  EmotionVisualMap,
} from './character-law.js'

export type {
  WorldPhysics,
  EnvironmentType,
  WorldScale,
  PhysicsAnomaly,
} from './world-physics.js'

export type {
  ToneBoundary,
} from './tone-boundary.js'
