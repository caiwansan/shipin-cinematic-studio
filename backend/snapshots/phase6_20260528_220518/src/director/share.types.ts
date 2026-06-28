/**
 * Director Intelligence Layer — 共享类型
 */

// ============================================================
// 镜头描述 — 标准化镜头语言单元
// ============================================================

export type ShotType =
  | 'extreme_wide' | 'wide' | 'full' | 'medium'
  | 'medium_close_up' | 'close_up' | 'extreme_close_up'
  | 'over_shoulder' | 'two_shot' | 'insert'

export type LensFocalLength =
  | '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | '135mm' | '200mm'

export type CameraMotion =
  | 'static' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down'
  | 'dolly_in' | 'dolly_out' | 'tracking_left' | 'tracking_right'
  | 'crane_up' | 'crane_down' | 'handheld' | 'steadicam' | 'jib' | 'drone'

export type CompositionStyle =
  | 'rule_of_thirds' | 'centered' | 'dutch' | 'symmetry'
  | 'leading_lines' | 'frame_within_frame' | 'golden_ratio'
  | 'deep_space' | 'shallow_space'

export type LightingStyle =
  | 'high_key' | 'low_key' | 'natural' | 'dramatic'
  | 'silhouette' | 'rim_light' | 'practical' | 'motivated' | 'chiaroscuro'

export type DepthOfField = 'shallow' | 'medium' | 'deep'

export type AspectRatio = '16:9' | '2.35:1' | '4:3' | '1:1' | '9:16'

export interface CinematicShotDescriptor {
  shotType: ShotType
  lens: LensFocalLength
  cameraMotion: CameraMotion
  composition: CompositionStyle
  lighting: LightingStyle
  depthOfField: DepthOfField
  aspectRatio: AspectRatio
  duration: number
  description: string
  narrativePurpose: string
}

// ============================================================
// Prompt 编译产物 — 最终送给生成模型的 Prompt
// ============================================================

export interface CompiledPrompt {
  modelId: string
  prompt: string
  negativePrompt?: string
  parameters: {
    width: number
    height: number
    duration: number
    fps: number
    seed?: number
    stylePreset?: string
  }
  shotInfo: {
    shotType: ShotType
    cameraMotion: CameraMotion
    composition: CompositionStyle
    lighting: LightingStyle
    lensInfo: string
  }
}
