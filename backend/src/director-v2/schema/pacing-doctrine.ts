/**
 * Pacing Doctrine — 节奏教义
 *
 * 定义整部作品的节奏控制宪章。
 * Story Rhythm Agent 以此为蓝图设计具体的节拍和钩子。
 * Review Engine 以此为标准评估节奏质量。
 */

// ============================================================
// Pacing Doctrine
// ============================================================

export interface PacingDoctrine {
  /** 叙事结构类型 */
  structureType: NarrativeStructure

  /** 钩子密度 */
  hookDensity: 'sparse' | 'moderate' | 'dense' | 'intense'

  /** 节奏节拍蓝图 */
  beatMap: PacingBeat[]

  /** 高潮放置位置（0-1，相对进度百分比） */
  climaxPlacement: number

  /** 节奏曲线类型 */
  pacingCurve: PacingCurve

  /** 平均钩子间隔（秒，供 agent 参考） */
  targetHookInterval?: number

  /** 总目标时长（秒） */
  targetDuration?: number
}

export type NarrativeStructure =
  | 'three_act'
  | 'five_act'
  | 'episodic'
  | 'non_linear'
  | 'circular'
  | 'kyo_genshi'   // 起承转合

export type PacingCurve =
  | 'crescendo'
  | 'wave'
  | 'staccato'
  | 'sustained'
  | 'erratic'
  | 'roller_coaster'

// ============================================================
// Pacing Beat
// ============================================================

export interface PacingBeat {
  /** 节拍编号 */
  beatNumber: number

  /** 节拍名称 */
  name: string

  /** 叙事阶段 */
  phase: PacingPhase

  /** 目标强度（1-10） */
  intensity: number

  /** 持续时间（秒） */
  duration: number

  /** 是否能在此阶段放置钩子 */
  allowsHooks: boolean

  /** 钩子数量下限 */
  minHooks?: number

  /** 钩子数量上限 */
  maxHooks?: number

  /** 可选：推荐镜头类型 */
  preferredShotTypes?: string[]

  /** 描述 */
  description: string
}

export type PacingPhase =
  | 'setup'
  | 'tension'
  | 'escalation'
  | 'climax'
  | 'release'
