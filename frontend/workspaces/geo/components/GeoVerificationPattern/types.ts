/**
 * GeoVerificationPattern — Data Contract Types
 *
 * Uses `meta + payload` structure, consistent with GeoReportViewer architecture.
 *
 * @see docs/reviews/RC1-T004-GEO-VERIFICATION-PATTERN.md
 */

/** 验证元信息 */
export interface VerificationMeta {
  entityName: string
  entityType: 'brand' | 'entity' | 'keyword'
  reportId: string
  generatedAt: string
  duration: number
  source: 'manual' | 'scheduled' | 'api'
}

/** 子维度变化 */
export interface VerificationDimensionChanges {
  coverage: { before: number; after: number; delta: number }
  share: { before: number; after: number; delta: number }
  position: { before: number; after: number; delta: number }
}

/** 已验证条目 */
export interface VerifiedItem {
  id: string
  title: string
  status: 'completed' | 'pending' | 'skipped'
  adiContribution: number
  details: string
}

/** 剩余问题 */
export interface RemainingIssue {
  scenarioId: string
  scenarioName: string
  gap: number
  priority: 'high' | 'medium' | 'low'
}

/** BreakDown 类型 */
export type BreakdownType = 'waterfall' | 'pie' | 'table' | 'timeline' | 'heatmap'

/** BreakDown Section */
export interface BreakdownSection {
  type: BreakdownType
  label: string
  data: unknown
}

/** 验证数据 Payload（可增量更新，Meta 保持不变） */
export interface VerificationPayload {
  beforeAdi: number
  afterAdi: number
  deltaAdi: number
  improvementRate: number

  /** 完成情况 */
  completionRate: number
  totalActions: number
  completedActions: number
  pendingActions: number
  skippedActions: number

  /** 子维度变化 */
  dimensionChanges: VerificationDimensionChanges

  /** 可扩展的改进 Breakdown 数组 */
  breakdowns: BreakdownSection[]

  /** 已验证条目列表 */
  verifiedItems: VerifiedItem[]

  /** 剩余问题 */
  remainingIssues: RemainingIssue[]

  /** 置信度 */
  confidence: number
}

/** 完整验证报告 */
export interface VerificationReport {
  meta: VerificationMeta
  payload: VerificationPayload
}

/** GeoVerificationPattern Props */
export interface GeoVerificationPatternProps {
  report?: VerificationReport | null
  loading: boolean
  error?: string | null
}
