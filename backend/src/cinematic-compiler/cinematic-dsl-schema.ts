/**
 * Cinematic DSL Schema
 * Shot Prompt Compiler — 电影语法编译器
 *
 * 核心结构：将自然语言镜头描述编译为结构化摄影指令。
 * 每一帧画面都由以下维度构成一个 CinematicShot：
 *
 * camera    — 摄影机类型/镜头/运镜
 * framing   — 构图/景深
 * lighting  — 光照
 * motion    — 运动
 * scene     — 场景文字（保留原始描述）
 */

export interface CinematicCamera {
  /** 摄影机运动类型 */
  type: 'handheld' | 'drone' | 'static' | 'tracking' | 'dolly' | 'crane' | 'gimbal' | 'shoulder' | 'whip_pan'
  /** 镜头焦距（电影级） */
  lens: '16mm' | '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | '100mm' | '135mm' | '200mm'
  /** 运镜方向 */
  movement: 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'dolly_in' | 'dolly_out' | 'track_left' | 'track_right' | 'crane_up' | 'crane_down' | 'push' | 'pull' | 'static' | 'zoom_in' | 'zoom_out' | 'whip_left' | 'whip_right'
  /** 摄影高度（主观/俯视/仰视等） */
  height: 'eye_level' | 'high_angle' | 'low_angle' | 'bird_eye' | 'worm_eye' | 'over_shoulder'
}

export interface CinematicComposition {
  /** 景别 */
  framing: 'extreme_wide' | 'wide' | 'full' | 'medium_wide' | 'medium' | 'medium_close' | 'close_up' | 'extreme_close' | 'insert'
  /** 景深 */
  depth: 'shallow' | 'medium' | 'deep'
  /** 构图对称性 */
  symmetry: 'symmetrical' | 'asymmetrical' | 'rule_of_thirds' | 'golden_ratio' | 'dynamic'
  /** 画面引导线（可选） */
  leadingLines?: string[]
}

export interface CinematicLighting {
  /** 光照类型 */
  type: 'natural' | 'neon' | 'low_key' | 'high_key' | 'high_contrast' | 'chiaroscuro' | 'golden_hour' | 'practical' | 'motivated' | 'ambient' | 'silhouette'
  /** 光照方向 */
  direction: 'front' | 'side' | 'back' | 'top' | 'under' | 'three_quarter_front' | 'three_quarter_back'
  /** 色温氛围 */
  colorTone: 'warm' | 'cool' | 'neutral' | 'teal_orange' | 'monochrome'
}

export interface CinematicMotion {
  /** 画面内运动速度 */
  speed: 'slow' | 'normal' | 'fast' | 'hyper'
  /** 画面外运动（被摄体） */
  subjectMotion: 'static' | 'walking' | 'running' | 'driving' | 'drifting' | 'falling' | 'jumping' | 'flying'
  /** 是否手持震感 */
  handheld: boolean
}

export interface CinematicShot {
  /** 原始自然语言描述 */
  raw: string
  /** 摄影机 */
  camera: CinematicCamera
  /** 构图 */
  composition: CinematicComposition
  /** 光照 */
  lighting: CinematicLighting
  /** 运动 */
  motion: CinematicMotion
  /** 情绪基调（AI 推断） */
  mood: 'dramatic' | 'light' | 'tense' | 'melancholy' | 'epic' | 'intimate' | 'chaotic' | 'serene'
}

/**
 * 镜头语言分类（用于统计分析）
 */
export type CinematicLensCategory = 'ultra_wide' | 'wide' | 'standard' | 'portrait' | 'tele'
export function categorizeLens(lens: CinematicCamera['lens']): CinematicLensCategory {
  const mm = parseInt(lens)
  if (mm <= 18) return 'ultra_wide'
  if (mm <= 24) return 'wide'
  if (mm <= 50) return 'standard'
  if (mm <= 85) return 'portrait'
  return 'tele'
}

/**
 * 运镜能量等级（从静态到高动态）
 */
export function movementEnergy(movement: CinematicCamera['movement']): number {
  const energyMap: Record<string, number> = {
    static: 0,
    tilt_up: 1, tilt_down: 1, pan_left: 1, pan_right: 1,
    zoom_in: 2, zoom_out: 2, dolly_in: 2, dolly_out: 2,
    track_left: 3, track_right: 3, push: 3, pull: 3,
    crane_up: 4, crane_down: 4,
    whip_left: 5, whip_right: 5,
  }
  return energyMap[movement] ?? 1
}
