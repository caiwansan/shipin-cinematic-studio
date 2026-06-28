// ============================================================
// ShotGraph.ts — 导演级镜头语言图结构
// Phase 3: IRBeat → ShotNode（Cinematic Primitive）
//
// 铁律：
// 1. ShotGraph 不依赖 NarrativeIR 结构（只消费 beat）
// 2. 不存 prompt/image/video 结果
// 3. camera movement 由 intent graph 驱动
// ============================================================

// ─── Camera 语义 ────────────────────────────────────
export type CameraType =
  | 'wide'
  | 'medium'
  | 'closeup'
  | 'macro'
  | 'extreme-wide'
  | 'cowboy'
  | 'italian'
  | 'dutch'

export type CameraMovement =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'push-in'
  | 'pull-out'
  | 'tracking'
  | 'dolly-zoom'
  | 'crane-up'
  | 'crane-down'
  | 'handheld-shake'
  | 'whip-pan'
  | 'steady-cam'

export type FramingStyle =
  | 'center'
  | 'rule-of-thirds'
  | 'leading-lines'
  | 'symmetrical'
  | 'frame-within-frame'
  | 'negative-space'
  | 'dutch-angle'

export type LightingMood =
  | 'natural'
  | 'high-key'
  | 'low-key'
  | 'chiaroscuro'
  | 'silhouette'
  | 'practical'
  | 'neon-noir'
  | 'golden-hour'
  | 'moonlight'
  | 'overcast'

// ─── ShotNode（最小镜头单元）─────────────────────────
export interface ShotCamera {
  type: CameraType
  movement: CameraMovement
  /** 强度 0-1（手持晃动程度、推镜速度等） */
  intensity: number
}

export interface ShotComposition {
  framing: FramingStyle
  /** 视觉焦点描述，如 "protagonist's eyes" */
  focus: string
  /** 景深 0-1（0=浅景深, 1=全景深） */
  depth: number
}

export interface ShotLighting {
  mood: LightingMood
  /** 对比度 0-1 */
  contrast: number
  /** 色温倾向：warm/cool/neutral */
  colorTint: 'warm' | 'cool' | 'neutral'
}

export interface ShotTiming {
  /** 持续时长（秒） */
  duration: number
  /** 入点（毫秒，来自 IRBeat.t） */
  inPoint: number
  /** 出点（毫秒） */
  outPoint: number
  /** 剪辑节奏建议：fast/medium/slow */
  pacing: 'fast' | 'medium' | 'slow'
}

export interface ShotNode {
  id: string
  /** 来源 IRBeat（NarrativeIR 不必须，但保持 traceability） */
  sourceBeatId: string
  /** 所在 segment ID */
  segmentId: string
  camera: ShotCamera
  composition: ShotComposition
  lighting: ShotLighting
  timing: ShotTiming
  /** 情绪色标（供后续色彩分级用） */
  emotionColor: string
}

// ─── ShotTransition（镜头间过渡）────────────────────
export type TransitionType =
  | 'cut'
  | 'fade-in'
  | 'fade-out'
  | 'crossfade'
  | 'dissolve'
  | 'wipe'
  | 'iris'
  | 'match-cut'
  | 'jump-cut'
  | 'smash-cut'
  | 'L-cut'
  | 'J-cut'

export interface ShotTransition {
  fromShotId: string
  toShotId: string
  type: TransitionType
  /** 过渡时长（秒） */
  duration: number
  /** 过渡意图描述 */
  narrativePurpose: string
}

// ─── ShotGraph（顶层容器）───────────────────────────
export interface ShotGraph {
  id: string
  projectId: string
  shots: ShotNode[]
  transitions: ShotTransition[]
  entryShotId: string
  /** 元数据 */
  meta: {
    totalDuration: number      // 总时长（秒）
    shotCount: number
    avgShotDuration: number
    cameraMovementHistogram: Record<CameraMovement, number>
    lightingDistribution: Record<LightingMood, number>
  }
}
