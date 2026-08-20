/**
 * ★ P0-3: Unified MissionControl DTO
 *
 * SSOT for all Dashboard data. Only ONE definition allowed across the entire project.
 * Frontend and backend MUST import from this file — no duplicate interfaces.
 */

/** 引擎状态枚举 */
export type EngineStatus = 'idle' | 'running' | 'completed' | 'failed' | 'queued' | 'collecting'

/** 引擎状态 — 产品层命名（非技术命名） */
export interface EngineStateDTO {
  name: string
  /** 产品层显示名，例如"品牌识别"而非"Discovery" */
  label: string
  status: EngineStatus
  detail: string
  updatedAt: string | null
}

/** 队列深度 */
export interface QueuesDTO {
  mission: number
  verification: number
  publishing: number
  learning: number
}

/** 最后一次执行信息 */
export interface LastExecutionDTO {
  id: string | null
  durationMs: number
  timestamp: string | null
}

/** 活动/任务事件 */
export interface TimelineEventDTO {
  id: string
  title: string
  detail: string
  level: 'info' | 'warning' | 'error' | 'success'
  route?: string
  timestamp: string
}

/** ★ P0-5: Runtime Health Gate */
export interface RuntimeHealthDTO {
  status: 'healthy' | 'initializing' | 'uninitialized'
  scoreSnapshot: boolean
  timeline: boolean
  project: boolean
  message: string
}

/** AI 可见度探测结果摘要 */
export interface AIVisibilitySummaryDTO {
  /** 综合 AI 可见度评分 (0-100) */
  overall: number
  /** 探测过的 AI 引擎列表 */
  engines: { engine: string; label: string; mentionRate: number; mentionCount: number; totalQuestions: number }[]
  /** 内容质量评分 */
  contentQuality: number
  /** 探测时间 */
  probedAt: string | null
}

/** 知识质量摘要 */
export interface KnowledgeQualitySummaryDTO {
  overallScore: number
  totalKnowledge: number
  qualifiedKnowledge: number
  topIssues: { type: string; message: string }[]
}

/**
 * MissionControl — Dashboard 唯一数据合约
 *
 * 前后端共用此 DTO。禁止任何一方单独扩展字段。
 */
export interface MissionControlDTO {
  projectId: string | null
  entityName: string | null
  aiVisibility: number
  /** AI 实测可见度（真实 AI 引用率） */
  aiVisibilityReal?: AIVisibilitySummaryDTO
  /** 知识内容质量检测 */
  knowledgeQuality?: KnowledgeQualitySummaryDTO
  todayGoal: number
  engines: EngineStateDTO[]
  lastExecution: LastExecutionDTO | null
  queues: QueuesDTO
  recentActivity: TimelineEventDTO[]
  actionableItems: TimelineEventDTO[]
  runtimeHealth: RuntimeHealthDTO
}
