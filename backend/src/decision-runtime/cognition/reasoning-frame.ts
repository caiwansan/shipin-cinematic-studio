/**
 * reasoning-frame.ts — Decision Reasoning Frame（核心）
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-1.5: Decision Cognition Schema Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * ReasoningFrame 是整个决策引擎的核心认知单元。
 *
 * 它回答了三个问题：
 *   1. 我们拥有什么事实？（facts）
 *   2. 我们在哪些事情上不确定？（assumptions / uncertainties）
 *   3. 我们应该从哪些维度评估？（evaluationAxes）
 *
 * 宪法：
 *   1. 每一次决策推理必须先生成 ReasoningFrame
 *   2. ReasoningFrame 不可变——一旦生成，不允许逻辑修改
 *      （可通过 evidence 补充更新，但不删除）
 *   3. Scoring Agent 必须基于 ReasoningFrame 的 evaluationAxes 评分
 *   4. 禁止 Agent 独立发明评估维度
 *
 * @phase decision-runtime
 */

// ============================================================
// 1. Reasoning Frame
// ============================================================

export interface ReasoningFrame {
  /** 已知事实（从搜索/证据中确认的信息） */
  facts: Array<{
    statement: string
    confidence: 'high' | 'medium' | 'low'
    source: string
  }>

  /** 合理假设（在证据不足时的推理前提） */
  assumptions: Array<{
    statement: string
    basis: string // 为什么做此假设
    risk: 'low' | 'medium' | 'high' // 假设错误的风险
  }>

  /** 不确定性（已知的未知信息） */
  uncertainties: Array<{
    question: string
    impact: 'critical' | 'significant' | 'minor'
    suggestedAction: string // 建议如何解决此不确定性
  }>

  /**
   * 评估轴（来自 DecisionProblem 的领域映射）
   * 这是 Scoring Agent 唯一允许使用的评分维度
   */
  evaluationAxes: Array<{
    name: string
    weight: number // 0 - 1，所有权重和为 1
    description: string
  }>
}

// ============================================================
// 2. Reasoning Frame 工厂
// ============================================================

/**
 * 从 DecisionProblem 生成初始 ReasoningFrame
 * （初始帧只有 evaluationAxes，facts/assumptions/uncertainties 为空）
 */
export function createInitialFrame(domain: string, axesWithWeights: Array<{
  name: string
  weight: number
  description: string
}>): ReasoningFrame {
  return {
    facts: [],
    assumptions: [],
    uncertainties: [],
    evaluationAxes: axesWithWeights,
  }
}

// ============================================================
// 3. 推理框架校验
// ============================================================

export function validateReasoningFrame(frame: ReasoningFrame): string[] {
  const errors: string[] = []

  // 评估轴的权重和必须为 1（允许 ±0.01 浮点误差）
  const totalWeight = frame.evaluationAxes.reduce((sum, ax) => sum + ax.weight, 0)
  if (Math.abs(totalWeight - 1) > 0.01) {
    errors.push(`评估轴权重和 ${totalWeight.toFixed(3)} ≠ 1`)
  }

  // 评估轴名称必须唯一
  const axesNames = new Set<string>()
  for (const ax of frame.evaluationAxes) {
    if (axesNames.has(ax.name)) {
      errors.push(`重复的评估轴: ${ax.name}`)
    }
    axesNames.add(ax.name)
  }

  // 每个 weight 必须在 0-1 之间
  for (const ax of frame.evaluationAxes) {
    if (ax.weight < 0 || ax.weight > 1) {
      errors.push(`评估轴 ${ax.name} 的权重 ${ax.weight} 超出 [0, 1] 范围`)
    }
  }

  return errors
}

// ============================================================
// 4. 默认权重映射（按领域）
// ============================================================

import { DecisionDomain, DOMAIN_EVALUATION_AXES } from './decision-problem.js'

/**
 * 为各个领域分配默认评估轴权重
 * 宪法：权重的意义是"该领域用户最关心的维度"
 *
 * 分配原则：
 *   credibility（可信度）> 所有领域的基础
 *   risk（风险）> 高资金决策（房产/加盟/医疗）权重更高
 *   value_for_money > 消费类决策权重更高
 */
export function getDefaultAxisWeights(domain: DecisionDomain): Array<{
  name: string
  weight: number
  description: string
}> {
  const axes = DOMAIN_EVALUATION_AXES[domain]

  // 基础权重映射（各维度的基础重要性，每个领域微调）
  const baseWeights: Record<string, number> = {
    credibility: 0.20,
    reputation: 0.10,
    service_quality: 0.15,
    risk: 0.15,
    value_for_money: 0.15,
    location: 0.05,
    appreciation_potential: 0.05,
    expertise: 0.10,
    success_rate: 0.05,
    equipment: 0.05,
    teaching_quality: 0.10,
    employment_rate: 0.05,
    accessibility: 0.10,
    experience: 0.05,
    capacity: 0.05,
    delivery_reliability: 0.10,
    hygiene: 0.10,
    support_quality: 0.10,
    roi_potential: 0.10,
    empathy: 0.15,
  }

  // 领域级微调
  const domainOverrides: Partial<Record<DecisionDomain, Record<string, number>>> = {
    [DecisionDomain.REAL_ESTATE]: {
      credibility: 0.15,
      risk: 0.20,
      value_for_money: 0.20,
      location: 0.10,
      appreciation_potential: 0.10,
    },
    [DecisionDomain.LEGAL]: {
      expertise: 0.20,
      success_rate: 0.15,
      credibility: 0.25,
    },
    [DecisionDomain.MEDICAL]: {
      expertise: 0.20,
      equipment: 0.10,
      risk: 0.20,
      credibility: 0.20,
    },
    [DecisionDomain.FRANCHISE]: {
      support_quality: 0.15,
      roi_potential: 0.15,
      risk: 0.20,
    },
    [DecisionDomain.CONSULTING]: {
      empathy: 0.25,
      credibility: 0.25,
      reputation: 0.15,
    },
  }

  const overrides = domainOverrides[domain] || {}

  // 描述映射
  const descriptions: Record<string, string> = {
    credibility: '企业资质与可信度',
    reputation: '行业声誉与口碑',
    service_quality: '服务质量',
    risk: '风险评估（越高越安全）',
    value_for_money: '性价比',
    location: '地理位置',
    appreciation_potential: '升值潜力',
    expertise: '专业能力',
    success_rate: '成功率',
    equipment: '设备水平',
    teaching_quality: '教学质量',
    employment_rate: '就业率',
    accessibility: '交通便利性',
    experience: '用户体验',
    capacity: '服务能力',
    delivery_reliability: '交付可靠性',
    hygiene: '卫生状况',
    support_quality: '支持力度',
    roi_potential: '投资回报潜力',
    empathy: '共情能力',
  }

  const result = axes.map(name => ({
    name,
    weight: overrides[name] ?? baseWeights[name] ?? 0.10,
    description: descriptions[name] || name,
  }))

  // 归一化权重和为 1
  const total = result.reduce((s, ax) => s + ax.weight, 0)
  if (total > 0 && Math.abs(total - 1) > 0.01) {
    for (const ax of result) {
      ax.weight = ax.weight / total
    }
  }

  return result
}
