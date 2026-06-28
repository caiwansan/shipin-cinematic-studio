/**
 * event-types.ts — Phase A-0.6 Observability Enrichment
 *
 * ============================================================
 * 统一 Trace Event 类型定义
 * ============================================================
 *
 * 所有 Pipeline 步骤的中间事件类型集中定义。
 * 不约束 payload 的具体形状——只约束事件名称和语义角色。
 * 具体 payload 结构由各 Agent 的输出决定。
 *
 * 宪法约束：
 *   1. 不是"日志"——每个事件代表一次语义转换
 *   2. 事件顺序 = 执行顺序 = 因果关系
 *   3. 事件不可逆——不会出现"撤回"语义
 */

// ============================================================
// 1. 事件类型枚举
// ============================================================

export enum StepEventType {
  /** 用户需求分析完成 */
  REQUIREMENT_ANALYZED = 'requirement_analyzed',
  /** 世界观测视图构造完成 */
  WORLD_VIEW_CONSTRUCTED = 'world_view_constructed',
  /** 推理框架创建完成（最重要的 Frame 等价类事件） */
  REASONING_FRAME_CREATED = 'reasoning_frame_created',
  /** 证据收集完成 */
  EVIDENCE_COLLECTED = 'evidence_collected',
  /** 评分完成 */
  SCORING_COMPLETED = 'scoring_completed',
  /** 推荐策略计算完成 */
  RECOMMENDATION_COMPUTED = 'recommendation_computed',
  /** 报告生成完成 */
  REPORT_GENERATED = 'report_generated',
}

// ============================================================
// 2. 事件类型映射（每个事件标明语义角色）
// ============================================================

/**
 * 每类事件的"语义角色"——等价类判定器根据角色消费事件
 */
export const STEP_EVENT_ROLES: Record<StepEventType, string> = {
  [StepEventType.REQUIREMENT_ANALYZED]: 'user_intent',
  [StepEventType.WORLD_VIEW_CONSTRUCTED]: 'world_observation',
  [StepEventType.REASONING_FRAME_CREATED]: 'frame',              // B-0 Frame 等价类来源
  [StepEventType.EVIDENCE_COLLECTED]: 'evidence',
  [StepEventType.SCORING_COMPLETED]: 'evaluation',              // B-0 Evaluation 等价类来源
  [StepEventType.RECOMMENDATION_COMPUTED]: 'recommendation',    // B-0 Decision 等价类来源
  [StepEventType.REPORT_GENERATED]: 'report',
} as const

// ============================================================
// 3. 事件结构
// ============================================================

export interface StepEvent {
  /** 事件类型 */
  type: StepEventType
  /** 事件载荷 */
  payload: Record<string, unknown>
  /** 时间戳 */
  ts: number
  /** 步骤序号（Pipeline 中的位置） */
  stepIndex: number
}

// ============================================================
// 4. 事件载荷类型提示（供语义等价类判定器引用）
// ============================================================

/** `reasoning_frame_created` 的期望 payload 结构 */
export interface ReasoningFrameCreatedPayload {
  domain: string
  axes: Array<{ name: string; weight: number }>
  candidates: Array<{ id: string; name: string; type: string }>
}

/** `scoring_completed` 的期望 payload 结构 */
export interface ScoringCompletedPayload {
  scores: Array<{
    candidateId: string
    totalScore: number
    axisScores: Record<string, number>
  }>
}

/** `recommendation_computed` 的期望 payload 结构 */
export interface RecommendationComputedPayload {
  ranking: Array<{ candidateId: string; rank: number; reason: string }>
  primaryFactor: string
  factorWeights: Record<string, number>
}
