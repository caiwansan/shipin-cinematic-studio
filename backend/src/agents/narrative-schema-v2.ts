/**
 * Narrative Constitution V2
 *
 * 全系统唯一导演语言 Schema。
 * Character Runtime
 * Scene Runtime
 * Storyboard Runtime
 * Video Runtime
 * 全部引用该 Schema。
 *
 * 禁止重新定义。
 * 禁止 Partial。
 * 禁止类型逃逸。
 */

// ─── Story Arc ────────────────────────────────────────

export interface StoryArc {
  setup: string
  conflict: string
  climax: string
  resolution: string
}

// ─── Runtime ID ──────────────────────────────────────

export type CharacterId = string // "char_001"
export type SceneId = string // "scene_001"
export type SegmentId = string // "seg_001"
export type PropId = string // "prop_001"

// ─── Character ────────────────────────────────────────

export interface CharacterSpecV2 {
  id: CharacterId
  name: string
  alias: string
  age: string
  appearance: string
  personality: string[]
  emotionState: string
  motivation: string
  goal: string
  arc: string
}

// ─── Scene ────────────────────────────────────────────

export interface SceneSpecV2 {
  id: SceneId
  sceneName: string
  sceneAlias: string
  environment: string
  colorPalette: string
  lighting: string
  dramaticFunction: string
  emotion: string
  narrativePurpose: string
}

// ─── Segment ──────────────────────────────────────────

export interface SegmentSpecV2 {
  id: SegmentId
  segmentNumber: number
  sceneId: SceneId
  visualDesc: string
  action: string
  dialogue: string
  emotion: string
  emotionIntensity: number
  duration: number
}

// ─── Emotion Curve ────────────────────────────────────

export interface EmotionCurveItem {
  segmentId: SegmentId
  emotion: string
  intensity: number
}

// ─── Camera Language ──────────────────────────────────

export interface CameraLanguageItem {
  segmentId: SegmentId
  shot: string // ECU | CU | MCU | MS | MLS | LS | ELS
  movement: string // fixed | push-in | pull-out | pan | tilt | tracking | crane | handheld
  angle: string // eye-level | low-angle | high-angle | dutch | overhead
  lens: string // 24mm | 35mm | 50mm | 85mm | 135mm | zoom
}

// ─── Sound Design ─────────────────────────────────────

export interface SoundDesignItem {
  segmentId: SegmentId
  ambient: string
  music: string
  effect: string
}

// ─── Effects Design ────────────────────────────────────

export interface EffectsDesignItem {
  segmentId: SegmentId
  visualEffect: string
  transition: string
}

// ─── Voice ────────────────────────────────────────────

export interface VoiceSpecV2 {
  characterId: CharacterId
  voiceType: string
  timbre: string
  speed: string
  speakingStyle: string
}

// ─── Prop ─────────────────────────────────────────────

export interface PropSpecV2 {
  id: PropId
  name: string
  category: string
  description: string
  function: string
  designNotes: string
}

// ─── Top-Level Schema ─────────────────────────────────

export interface NarrativeConstitutionV2 {
  title: string
  storyArc: StoryArc
  characters: CharacterSpecV2[]
  scenes: SceneSpecV2[]
  segments: SegmentSpecV2[]
  emotionCurve: EmotionCurveItem[]
  cameraLanguage: CameraLanguageItem[]
  soundDesign: SoundDesignItem[]
  effectsDesign: EffectsDesignItem[]
  voices: VoiceSpecV2[]
  props: PropSpecV2[]
}
