/**
 * VEP — Visual Evidence Pipeline
 *
 * 职责：视频 → 标准化的 Evidence Package
 *
 * Evidence Package 是 Capability Benchmark 的唯一输入（SSOT）。
 * 所有 Capability Evaluator 只读取 Evidence Package，不直接分析视频。
 *
 * 双向 Evidence 系统：
 *   - Expected Evidence: 来自 CIR（导演期望）
 *   - Observed Evidence: 来自视频分析（实际生成结果）
 *
 * Evidence Diff: Expected vs Observed → Capability Score + Deviation
 */

// ─── 时间戳（秒）───────────────────────────

export type Seconds = number

// ─── 镜头（Shot）证据 ─────────────────────

export interface EvidenceShot {
  /** 镜头 ID（与 CIR 中的 shot.id 对应） */
  shotId: string
  /** 镜头起始时间 */
  startTime: Seconds
  /** 镜头结束时间 */
  endTime: Seconds
  /** 镜头时长 */
  duration: Seconds
  /** 景别估计 */
  estimatedScale?: 'extreme_close_up' | 'close_up' | 'medium' | 'wide' | 'establishing'
  /** 机位角度估计 */
  estimatedAngle?: 'eye' | 'low' | 'high' | 'dutch' | 'overhead'
}

// ─── 关键帧证据 ───────────────────────────

export interface EvidenceKeyframe {
  /** 时间戳 */
  timestamp: Seconds
  /** 关键帧 ID */
  id: string
  /** 场景 ID（与 CIR 对应） */
  shotId: string
  /** 图片路径/URL */
  imageUrl: string

  // ── 帧级别证据 ──

  /** 检测到的主体位置（归一化 0-1） */
  subjectPosition?: { x: number; y: number; w: number; h: number }
  /** 主光方向估计 */
  estimatedKeyLightDirection?: string
  /** 色温估计 */
  estimatedColorTemperature?: 'warm' | 'neutral' | 'cool'
  /** 曝光估计 */
  estimatedExposure?: 'normal' | 'overexposed' | 'underexposed'
  /** 焦点主体 */
  focusSubject?: string
  /** 景深估计 */
  estimatedDepthOfField?: 'shallow' | 'medium' | 'deep'
  /** 主体遮挡情况 */
  occlusion?: { hasOcclusion: boolean; occludedPart?: string }
  /** headroom 估计（% of frame height） */
  estimatedHeadroomPercent?: number
  /** look room 估计（% of frame width ahead of gaze） */
  estimatedLookRoomPercent?: number
  /** 构图规则估计 */
  estimatedCompositionRule?: string
}

// ─── 对象轨迹证据 ─────────────────────────

export interface EvidenceObjectTrack {
  /** 跟踪对象 ID */
  trackId: string
  /** 对应 CIR 角色 ID */
  characterId?: string
  /** 对象标签 */
  label: string
  /** 各帧位置 */
  frames: Array<{
    timestamp: Seconds
    bbox: { x: number; y: number; w: number; h: number }
    confidence: number
  }>
  /** 是否在所有帧中都持续追踪到 */
  persistent: boolean
  /** 身份变化次数 */
  identityChanges: number
}

// ─── 镜头运动证据 ─────────────────────────

export interface EvidenceCameraMotion {
  shotId: string
  /** 检测到的运动类型 */
  motionType: string
  /** 运动平滑度 */
  smoothnessScore: number // 0-100
  /** 路径类型 */
  pathType?: string
  /** 运动方向向量 */
  directionVectors?: Array<{ x: number; y: number }>
}

// ─── 灯光证据 ─────────────────────────────

export interface EvidenceLightingProfile {
  shotId: string
  /** 各帧主光方向 */
  keyLightDirectionFrames: Array<{ timestamp: Seconds; direction: string; confidence: number }>
  /** 各帧色温 */
  colorTemperatureFrames: Array<{ timestamp: Seconds; temperature: string; confidence: number }>
  /** 各帧曝光 */
  exposureFrames: Array<{ timestamp: Seconds; exposure: string; confidence: number }>
  /** 各帧阴影一致性 */
  shadowConsistencyFrames: Array<{ timestamp: Seconds; consistent: boolean }>
}

// ─── 主体位置证据（构图）──────────────────

export interface EvidenceCompositionProfile {
  shotId: string
  /** 各帧主体位置 */
  subjectPositionFrames: Array<{
    timestamp: Seconds
    position: { x: number; y: number; w: number; h: number }
    rule: string
  }>
  /** 各帧 headroom */
  headroomFrames: Array<{ timestamp: Seconds; percent: number }>
  /** 各帧 look room */
  lookRoomFrames: Array<{ timestamp: Seconds; percent: number; gazeDirection: string }>
}

// ─── 主 Evidence Package ──────────────────

export interface EvidencePackage {
  /** 产生证据的视频 ID */
  videoId: string
  /** 对应 CIR 的 metadata.sourceStoryId */
  sourceStoryId?: string
  /** 证据产生时间 */
  generatedAt: string

  /** 镜头分割 */
  shots: EvidenceShot[]
  /** 关键帧 */
  keyframes: EvidenceKeyframe[]
  /** 对象轨迹 */
  objectTracks: EvidenceObjectTrack[]
  /** 镜头运动 */
  cameraMotions: EvidenceCameraMotion[]
  /** 灯光 */
  lightingProfiles: EvidenceLightingProfile[]
  /** 构图 */
  compositionProfiles: EvidenceCompositionProfile[]

  /** 场景时间线 */
  sceneTimeline?: Array<{
    sceneId: string
    startTime: Seconds
    endTime: Seconds
    shotIds: string[]
  }>

  /** 元信息 */
  metadata: {
    videoDuration: Seconds
    fps: number
    resolution: { width: number; height: number }
    evidenceProviders: string[]
    /** 证据版本号 */
    version: string
  }
}

// ─── Evidence Registry 接口 ───────────────

export interface EvidenceRegistryEntry {
  evidenceId: string
  package: EvidencePackage
  /** 对应的 CIR（Expected） */
  expectedCirId?: string
  /** 缓存时间戳 */
  cachedAt: string
  /** 来源 Provider */
  providerName: string
}

// ─── Evidence Diff（Expected vs Observed）─

export interface EvidenceDeviation {
  capability: string
  expected: string
  observed: string
  deviation: number // 0-100 (0=perfect match)
  score: number     // 0-100 (100=perfect match)
  reason: string
}

export interface EvidenceDiff {
  /** 各能力的 Evidence Diff */
  deviations: EvidenceDeviation[]
  /** 各能力综合评分 */
  scores: Record<string, number>
  /** 未产生偏差的能力列表 */
  matchedCapabilities: string[]
  /** 生成方式 */
  generatedAt: string
  /** 原始 CIR ID */
  expectedCirId: string
  /** Evidence Package ID */
  evidenceId: string
}
