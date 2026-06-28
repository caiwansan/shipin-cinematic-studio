/**
 * decision-event.ts — Decision Runtime Event Contract
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0: Decision Runtime Contract Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义 Decision Runtime 产生的所有事件类型。
 *
 * 宪法：
 *   1. 每个 Agent 完成一个阶段后必须 emit 对应事件
 *   2. 事件用于 Event Log / 可观测性 / 回放
 *   3. 新增事件类型必须同步 Manifest
 *
 * @phase decision-runtime
 */

import { DecisionNodeType } from './decision-ontology.js'

export enum DecisionEventType {
  /** RequirementAgent 完成需求分析 */
  REQUIREMENT_PARSED = 'REQUIREMENT_PARSED',

  /** SearchAgent 完成搜索 */
  SEARCH_COMPLETED = 'SEARCH_COMPLETED',

  /** EvidenceAgent 完成证据提取 */
  EVIDENCE_EXTRACTED = 'EVIDENCE_EXTRACTED',

  /** ScoringAgent 完成候选对象评估 */
  CANDIDATE_CREATED = 'CANDIDATE_CREATED',

  /** ScoringAgent 完成评分 */
  SCORE_CALCULATED = 'SCORE_CALCULATED',

  /** RecommendationAgent 完成推荐排序 */
  RECOMMENDATION_GENERATED = 'RECOMMENDATION_GENERATED',

  /** ReportAgent 完成报告生成 */
  REPORT_GENERATED = 'REPORT_GENERATED',

  /** ExecutionValidator 完成验证（A-3.0.5 新增） */
  VALIDATION_COMPLETED = 'VALIDATION_COMPLETED',

  /** ExecutionValidator 验证失败 */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

// ============================================================
// Event 载荷定义
// ============================================================

/**
 * 所有 Decision Event 载荷的联合类型
 * 每个事件类型对应一个字段，null 表示该事件无附加数据
 */
export type DecisionEventPayload = {
  [DecisionEventType.REQUIREMENT_PARSED]: {
    requirement: {
      domain: string
      city?: string
      budget?: string
      constraints: string[]
      goals: string[]
    }
    rawInput: string
  }

  [DecisionEventType.SEARCH_COMPLETED]: {
    query: string
    resultCount: number
    sources: string[]
  }

  [DecisionEventType.EVIDENCE_EXTRACTED]: {
    evidenceCount: number
    sourcesReliedUpon: string[]
  }

  [DecisionEventType.CANDIDATE_CREATED]: {
    candidateCount: number
    candidateNames: string[]
  }

  [DecisionEventType.SCORE_CALCULATED]: {
    candidateId: string
    dimensions: {
      credibility: number
      reputation: number
      serviceQuality: number
      risk: number
      valueForMoney: number
    }
    total: number
  }

  [DecisionEventType.RECOMMENDATION_GENERATED]: {
    topCount: number
    topIds: string[]
  }

  [DecisionEventType.REPORT_GENERATED]: {
    reportLength: number
    format: 'markdown' | 'json' | 'html'
  }

  [DecisionEventType.VALIDATION_COMPLETED]: {
    isValid: boolean
    errors: number
    warnings: number
    healthScore: number
  }

  [DecisionEventType.VALIDATION_FAILED]: {
    errors: string[]
    healthScore: number
  }
}

// ============================================================
// Event 到 NodeType 的映射
// ============================================================

/**
 * 每个事件类型对应的 DecisionGraph 节点类型
 */
export const EVENT_TO_NODE_TYPE: Record<DecisionEventType, DecisionNodeType> = {
  [DecisionEventType.REQUIREMENT_PARSED]: DecisionNodeType.REQUIREMENT,
  [DecisionEventType.SEARCH_COMPLETED]: DecisionNodeType.SEARCH,
  [DecisionEventType.EVIDENCE_EXTRACTED]: DecisionNodeType.EVIDENCE,
  [DecisionEventType.CANDIDATE_CREATED]: DecisionNodeType.CANDIDATE,
  [DecisionEventType.SCORE_CALCULATED]: DecisionNodeType.SCORE,
  [DecisionEventType.RECOMMENDATION_GENERATED]: DecisionNodeType.RECOMMENDATION,
  [DecisionEventType.REPORT_GENERATED]: DecisionNodeType.REPORT,
  [DecisionEventType.VALIDATION_COMPLETED]: DecisionNodeType.VALIDATION,
  [DecisionEventType.VALIDATION_FAILED]: DecisionNodeType.VALIDATION,
}
