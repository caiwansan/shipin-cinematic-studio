// ============================================================
// TimelineGraph.ts — 时间轴图结构（Temporal Director Layer）
// Phase 4: Shot 从独立单元 → 节奏事件
//
// 铁律：
// 1. 不修改 ShotGraph 结构
// 2. 不引用 NarrativeIR（只从 ShotGraph 消费数据）
// 3. 情绪曲线 + 张力曲线 = 时间组织核心
// ============================================================

// ─── Cut 类型 ─────────────────────────────────────────
export type CutType =
  | 'hard-cut'
  | 'fade'
  | 'match-cut'
  | 'jump-cut'
  | 'smash-cut'
  | 'L-cut'
  | 'J-cut'
  | 'invisible-cut'
  | 'wipe'

// ─── 节奏节拍（Phase 4 核心单元）────────────────────
export interface RhythmBeat {
  shotId: string
  /** 该节拍持续时长（秒） */
  duration: number
  cutType: CutType
  /** 节奏权重 0-1（高=紧张急促，低=舒缓） */
  rhythmWeight: number
  /** 该节拍的情绪值 0-1 */
  emotionValue: number
  /** 张力值 0-1 */
  tensionValue: number
}

// ─── 序列（节奏结构的最小组织单位）─────────────────
export interface Sequence {
  id: string
  /** 序列名称，如 "opening", "climax-build", "resolution" */
  name: string
  beats: RhythmBeat[]
  /** 情绪曲线（每 beat 一个采样点） */
  emotionCurve: number[]
  /** 张力曲线（每 beat 一个采样点） */
  tensionCurve: number[]
  /** 序列整体节奏：slow / medium / fast / alternating */
  overallRhythm: 'slow' | 'medium' | 'fast' | 'alternating'
  /** 序列持续时间（秒） */
  totalDuration: number
}

// ─── TimelineGraph（顶层容器）───────────────────────
export interface TimelineGraph {
  projectId: string
  sequences: Sequence[]
  /** 全局情绪曲线（所有序列串联） */
  globalEmotionCurve: number[]
  /** 全局张力曲线（所有序列串联） */
  globalTensionCurve: number[]
  /** 元数据 */
  meta: {
    totalDuration: number
    sequenceCount: number
    totalBeats: number
    cutTypeDistribution: Record<CutType, number>
    /** 节奏变化幅度 0-1（高=节奏丰富，低=平淡） */
    rhythmRange: number
  }
}
