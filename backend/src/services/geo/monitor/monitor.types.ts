// ============================================================
// Monitor Types — Observation Runtime (GEO v4 Sprint 5)
// ============================================================

// Probe 接口
export interface Probe {
  name: string
  type: string
  supports(targetType: string): boolean
  execute(target: ProbeTarget): Promise<ProbeResult>
}

// 探测目标
export interface ProbeTarget {
  url?: string
  projectId: string
  publishId?: string
  executionId?: string
  platform?: string
}

// 探测结果
export interface ProbeResult {
  success: boolean
  statusCode?: number
  latency?: number
  error?: string
  details?: Record<string, any>
  checkedAt: Date
}

// 观测记录 DTO
export interface ObservationRecordDTO {
  id: string
  projectId: string
  publishId?: string
  probeType: string
  targetUrl?: string
  statusCode?: number
  latency?: number
  success: boolean
  error?: string
  details?: Record<string, any>
  checkedAt: Date
}

// 漂移检测结果
export interface DriftCheckResult {
  projectId: string
  currentScore: number
  previousScore: number
  delta: number
  isDrift: boolean
  threshold: number
  dimensions: Record<string, number>
  checkedAt: Date
}

// 观测状态
export const ObservationStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified_online',
  INDEXED: 'indexed',
  LOST: 'lost',
  RECOVERED: 'recovered',
} as const
export type ObservationStatus = (typeof ObservationStatus)[keyof typeof ObservationStatus]

// 告警规则
export interface AlertRule {
  id: string
  projectId: string
  ruleType: 'drift' | 'downtime' | 'index_lost' | 'score_drop'
  enabled: boolean
  threshold?: number
  notificationType: 'email' | 'webhook' | 'slack' | 'notification'
  notificationTarget?: string
  cooldownMinutes: number
  lastTriggeredAt?: Date
}
