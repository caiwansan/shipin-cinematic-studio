/**
 * causal-types.ts — Phase A-0.7 Causal Link Builder
 *
 * ============================================================
 * 最小因果边类型定义
 * ============================================================
 *
 * 不是"因果推断"——只是"执行顺序的语义关系形式化"。
 * 每一条 CausalEdge 代表两个事件之间的因果类型。
 *
 * 宪法约束：
 *   1. 不引入因果发现/挖掘/推断算法
 *   2. 不引入概率图模型
 *   3. 边的关系类型是有限枚举，不可扩展
 *   4. 置信度在 [0.7, 1.0] 范围——小于 0.7 说明因果关系存疑
 */

// ============================================================
// 1. 因果边关系类型
// ============================================================

export type CausalRelation =
  /** A 的输出直接作为 B 的输入（最强因果） */
  | 'derives'
  /** A 的完成是 B 的前提条件 */
  | 'conditions'
  /** B 在 A 的基础上进行精化/细化 */
  | 'refines'
  /** B 对 A 的输出进行评估/评分 */
  | 'evaluates'
  /** B 从 A 的多个选项中选择了当前路径 */
  | 'selects'

// ============================================================
// 2. 因果边
// ============================================================

export interface CausalEdge {
  /** 所属 trace */
  traceId: string
  /** 源事件 */
  from: {
    /** 事件类型（eventType） */
    event: string
    /** Agent 名称 */
    agent: string
    /** Pipeline 步骤序号 */
    stepIndex: number
  }
  /** 目标事件 */
  to: {
    event: string
    agent: string
    stepIndex: number
  }
  /** 因果类型 */
  relation: CausalRelation
  /**
   * 因果置信度 [0.7, 1.0]
   * 0.9 = 直接派生或先后条件
   * 0.85 = 精化关系
   * 0.8 = 评估关系
   * 0.75 = 选择关系（可有多条备选）
   */
  confidence: number
}

// ============================================================
// 3. 因果图（完整 trace 的因果结构）
// ============================================================

export interface CausalGraph {
  /** 所属 traceId */
  traceId: string
  /** 所有因果边 */
  edges: CausalEdge[]
  /** 所有事件节点（去重） */
  nodes: Set<string>
  /** 入度为 0 的节点（根事件） */
  rootEvents: string[]
  /** 出度为 0 的节点（叶子事件） */
  leafEvents: string[]
}

// ============================================================
// 4. 因果链接收器接口
// ============================================================

/**
 * 因果链接收器——谁来消费 CausalGraph
 */
export interface CausalGraphConsumer {
  consume(causalGraph: CausalGraph): void
}

// ============================================================
// 5. 预设关系映射（根据 eventType 对自动推断）
// ============================================================

/**
 * 事件类型对之间的默认因果关系和置信度
 *
 * 来源：对 10 步 Pipeline 的手动拓扑分析
 */
export const DEFAULT_CAUSAL_MAP: Record<string, Record<string, { relation: CausalRelation; confidence: number }>> = {
  requirement_analyzed: {
    world_view_constructed: { relation: 'derives', confidence: 0.95 },
    reasoning_frame_created: { relation: 'derives', confidence: 0.95 },
  },
  world_view_constructed: {
    reasoning_frame_created: { relation: 'refines', confidence: 0.9 },
  },
  reasoning_frame_created: {
    evidence_collected: { relation: 'conditions', confidence: 0.9 },
  },
  evidence_collected: {
    scoring_completed: { relation: 'evaluates', confidence: 0.9 },
  },
  scoring_completed: {
    recommendation_computed: { relation: 'selects', confidence: 0.85 },
  },
  recommendation_computed: {
    report_generated: { relation: 'derives', confidence: 0.95 },
    decision_completed: { relation: 'derives', confidence: 0.95 },
  },
  signal_orchestration_completed: {
    grounding_applied: { relation: 'refines', confidence: 0.9 },
  },
  grounding_applied: {
    scoring_completed: { relation: 'refines', confidence: 0.85 },
  },
}
