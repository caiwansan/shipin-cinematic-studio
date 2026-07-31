// ─── Sprint-09E-02.5 Data Quality Status ─────
// 职业档案数据质量状态

export const DataQualityStatus = {
  /** 数据可信，无风险（新创建或已验证） */
  VALID: 'valid',
  /** 对话中收集的最低阈值草稿，等待补充 */
  DRAFT: 'draft',
  /** 历史数据，来源不明，需要人工审查 */
  REVIEW_REQUIRED: 'review_required',
  /** 旧系统遗留数据，来源和规则不再可信 */
  LEGACY_UNKNOWN: 'legacy_unknown',
} as const

export type DataQualityStatus = (typeof DataQualityStatus)[keyof typeof DataQualityStatus]

/**
 * 判断数据是否需要审查
 */
export function needsReview(status: DataQualityStatus): boolean {
  return status === DataQualityStatus.REVIEW_REQUIRED || status === DataQualityStatus.LEGACY_UNKNOWN
}
