/**
 * Director Trace Event Types
 * 导演追踪事件类型定义 — 贯穿五根支柱的标准化事件模型
 */

export type TraceLayer =
  | 'shot'      // 单镜头电影感
  | 'grammar'   // 镜头语法结构
  | 'motion'    // 运动规划
  | 'character' // 角色一致性
  | 'temporal'  // 时间连续性

export type DirectorTraceEvent = {
  traceId: string
  timestamp: number
  layer: TraceLayer
  type: string
  payload: any
  /** 可选：该事件对应的 shot 索引 */
  shotIndex?: number
  /** 可选：事件序列号，用于重放排序 */
  seq: number
}

export type TraceStateSnapshot = {
  timeline: any[]
  emotionalCurve: any[]
  motionEnergyFlow: number[]
  grammarGraph: any
  characterStates: any
  temporalContinuity: number[]
}

/**
 * Replay Status — 传递给前端的状态摘要
 */
export type ReplayStatus = {
  traceId: string
  totalEvents: number
  currentSeq: number
  progress: number // 0-1
  layers: TraceLayer[]
  timestamps: {
    start: number
    end: number
  }
}
