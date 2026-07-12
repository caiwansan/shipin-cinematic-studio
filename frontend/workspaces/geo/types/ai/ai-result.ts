/**
 * AI Presentation Layer — Core Types
 *
 * These types define the unified ViewModel for all AI output in GEO.
 * Every Engine (Discovery, Knowledge, Packaging, etc.) MUST output these types.
 * Every AI Component MUST consume these types.
 *
 * @file ai-result.ts
 */

/** 置信度等级 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unavailable'

/** 置信度展示 */
export interface Confidence {
  level: ConfidenceLevel
  label: string       // "可靠" / "中等" / "参考"
  score?: number      // 0-100，仅后端传递时可用，前端不计算
}

/** 单个发现 */
export interface Finding {
  id: string
  summary: string             // 一句话发现
  detail?: string             // 详细说明
  impact?: string             // 对品牌的影响
  evidenceIds?: string[]      // 关联证据 ID
  confidence?: Confidence
}

/** AI 输出标准结构 */
export interface AIResultModel {
  summary: string             // 一句话总结 "发生了什么"
  findings: Finding[]         // 2-3 个核心发现
  impact?: string             // 整体影响
  recommendation?: string     // 建议下一步
  recommendationAction?: string // CTA 文案（如"开始优化"）
  confidence?: Confidence
}
