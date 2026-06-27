/**
 * V3 Normalizer — 术语统一层
 *
 * Normalizer 不做结构映射，只做术语统一（Terminology Normalization）。
 * 位于 V3 output 和 Compiler 之间：
 *
 *   V3（LLM 输出，术语不统一）
 *   │
 *   └── normalizeV3() — 统一 shot/movement/angle/emotion 等术语
 *       │
 *       ▼
 *   Normalized V3（术语统一，结构不变）
 *       │
 *       └── compileFromV3() — 结构映射到 FilmLanguageIR
 *
 * 性质：
 *   - 纯函数（不访问外部状态）
 *   - 只做精确替换，不做语义推理
 *   - 每次新增术语只需扩展词典
 */

import type {
  NarrativeConstitutionV3,
  V3SegmentSpec,
  V3CameraState,
  V3EnvironmentState,
  V3CharacterPresence,
  V3EmotionState,
  V3ActionState,
  V3CharacterSpec,
  V3SceneSpec,
  V3SoundDesignItem,
  V3EffectsDesignItem,
  V3PropSpec,
  V3VoiceSpec,
} from '../agents/narrative-schema-v3.js'

// ─── 术语词典（只做精确替换，不做推理） ──────────────────

/** 运镜中文别名 → V3 标准值 */
const MOVEMENT_ALIASES: Record<string, string> = {
  '推镜': 'push_in',
  '拉镜': 'pull_out',
  '推': 'push_in',
  '拉': 'pull_out',
  '摇镜': 'pan',
  '移镜': 'tilt',
  '跟拍': 'tracking',
  '固定机位': 'static',
  '固定': 'static',
  '手持': 'handheld',
  '呼吸感': 'handheld',
  '升降': 'crane',
  '推轨': 'dolly',
}

/** 景别中文别名 → V3 标准值 */
const SHOT_ALIASES: Record<string, string> = {
  '特写': 'close_up',
  '大特写': 'extreme_close_up',
  '中景': 'medium',
  '中近景': 'medium_close_up',
  '中全景': 'medium_wide',
  '全景': 'wide',
  '远景': 'wide',
  '全身': 'full',
}

/** 角度中文别名 → V3 标准值 */
const ANGLE_ALIASES: Record<string, string> = {
  '平视': 'eye_level',
  '仰拍': 'low_angle',
  '俯拍': 'high_angle',
  '鸟瞰': 'overhead',
  '过肩': 'over_shoulder',
  '倾斜': 'dutch',
}

/** 情绪中文别名 → V3 标准值 */
const EMOTION_ALIASES: Record<string, string> = {
  '开心': 'joy',
  '快乐': 'joy',
  '高兴': 'joy',
  '愤怒': 'anger',
  '生气': 'anger',
  '悲伤': 'sadness',
  '难过': 'sadness',
  '害怕': 'fear',
  '恐惧': 'fear',
  '厌恶': 'disgust',
  '讨厌': 'disgust',
  '惊讶': 'surprise',
  '震惊': 'shock',
  '惊喜': 'surprise',
  '平静': 'calm',
  '冷静': 'calm',
  '淡定': 'calm',
  '中性': 'neutral',
}

// ─── Normalize 函数 ──────────────────────────────────────

function normalizeCamera(camera: V3CameraState): V3CameraState {
  return {
    shot: normalizeEnum(camera.shot, SHOT_ALIASES),
    movement: normalizeEnum(camera.movement, MOVEMENT_ALIASES),
    angle: normalizeEnum(camera.angle, ANGLE_ALIASES),
    lens: camera.lens,
  }
}

function normalizePresence(p: V3CharacterPresence): V3CharacterPresence {
  return {
    ...p,
    emotion: normalizeEnum(p.emotion, EMOTION_ALIASES),
  }
}

function normalizeEmotion(e: V3EmotionState): V3EmotionState {
  return {
    type: normalizeEnum(e.type, EMOTION_ALIASES),
    intensity: e.intensity,
  }
}

function normalizeEnum(value: string, aliases: Record<string, string>): string {
  if (!value) return value
  // 已经是标准值（英文）也不处理
  const lower = value.toLowerCase()
  const alias = aliases[lower] || aliases[value]
  return alias || value
}

// ─── 顶层 Normalizer ──────────────────────────────────────

/**
 * 对 NarrativeConstitutionV3 做术语标准化。
 *
 * 只修改：
 *   - segment.camera.shot / movement / angle
 *   - segment.characters.emotion
 *   - segment.emotion.type
 *
 * 不修改：
 *   - 结构（不增删字段）
 *   - 数值（不改变 duration / focus / intensity 等）
 *   - 文本内容（不修改 narrative / visualDesc / dialogue）
 *
 * @param v3 原始 V3（不会被修改，操作的是深拷贝）
 * @returns normalized V3
 */
export function normalizeV3(v3: NarrativeConstitutionV3): NarrativeConstitutionV3 {
  // 深拷贝以避免修改原对象
  const normalized: NarrativeConstitutionV3 = JSON.parse(JSON.stringify(v3))

  // 遍历所有 segments 进行归一
  for (const seg of normalized.segments) {
    if (seg.camera) {
      seg.camera = normalizeCamera(seg.camera)
    }
    if (seg.characters) {
      seg.characters = seg.characters.map(normalizePresence)
    }
    if (seg.emotion) {
      seg.emotion = normalizeEmotion(seg.emotion)
    }
  }

  return normalized
}

// ─── 导出 ────────────────────────────────────────

export { compileFromV3 } from './film-ir-compiler.js'
