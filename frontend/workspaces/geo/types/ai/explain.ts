/**
 * AI Presentation Layer — Explain Types
 *
 * Strictly follows AI Interaction Guideline:
 * Explain must answer: What → Why → Why Now → Evidence → Impact → Recommendation
 *
 * @file explain.ts
 */

import type { Confidence } from './ai-result'

/** 单个证据条目 */
export interface ExplainEvidence {
  id: string
  type: 'scan' | 'knowledge' | 'timeline' | 'verification'
  summary: string
  detail?: string
  source?: string        // 数据来源说明
}

/** Explain 的完整数据模型 */
export interface ExplainModel {
  what: string              // "发生了什么"
  why: string               // "为什么"
  whyNow?: string           // "为什么现在"
  evidence: ExplainEvidence[]
  impact: string            // "对品牌的影响"
  recommendation: string    // "建议下一步"
  confidence?: Confidence
}
