/**
 * Outcome Truth Layer — Type Definitions
 * OI-01 Schema Foundation: 类型定义
 */

// ── OutcomeRecord ──

export type OutcomeType =
  | 'OPERATIONAL'
  | 'STRATEGIC'
  | 'LEAD_CONVERTED'
  | 'ISSUE_RESOLVED'
  | 'CONTENT_PUBLISHED'
  | 'CUSTOMER_ACQUIRED'
  | 'REVENUE_GENERATED'
  | 'EFFICIENCY_GAINED'
  | string // 允许未来扩展

export type OutcomeStatus =
  | 'PENDING_VERIFY'
  | 'VERIFIED'
  | 'DISPUTED'
  | 'ARCHIVED'

export interface EvidenceItem {
  source: string
  dealId?: string
  verified?: boolean
  data?: Record<string, unknown>
}

export interface CreateOutcomeInput {
  organizationId: string
  actionId?: string
  agentId?: string
  type?: OutcomeType
  description?: string
  evidence?: EvidenceItem[]
  occurredAt?: Date
}

export interface OutcomeRecord {
  id: string
  organizationId: string
  actionId?: string | null
  agentId?: string | null
  type: string
  status: string
  description?: string | null
  evidence: EvidenceItem[]
  occurredAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

// ── ImpactMeasurement ──

export type ImpactMetricType =
  | 'REVENUE'
  | 'COST_SAVED'
  | 'TIME_SAVED'
  | 'LEADS_GENERATED'
  | 'CONVERSION_RATE'
  | 'CUSTOMER_SATISFACTION'
  | 'EFFICIENCY_GAIN'
  | 'TASKS_COMPLETED'
  | string // 允许未来扩展

export interface RecordImpactInput {
  organizationId: string
  outcomeId: string
  metricType: ImpactMetricType
  metricValue: string
  unit?: string
  metadata?: Record<string, unknown>
  source?: string
  verifiedAt?: Date
}

export interface ImpactMeasurement {
  id: string
  organizationId: string
  outcomeId: string
  metricType: string
  metricValue: string
  unit: string
  metadata: Record<string, unknown>
  source?: string | null
  verifiedAt?: Date | null
  createdAt: Date
}

// ── DecisionFeedback ──

export type FeedbackType =
  | 'SUCCESS'
  | 'FAILURE'
  | 'PARTIAL'
  | 'UNKNOWN'

export interface CreateFeedbackInput {
  organizationId: string
  decisionId?: string
  actionId?: string
  outcomeId?: string
  feedbackType?: FeedbackType
  feedbackData?: Record<string, unknown>
}

export interface DecisionFeedback {
  id: string
  organizationId: string
  decisionId?: string | null
  actionId?: string | null
  outcomeId?: string | null
  feedbackType: string
  feedbackData: Record<string, unknown>
  createdAt: Date
}
