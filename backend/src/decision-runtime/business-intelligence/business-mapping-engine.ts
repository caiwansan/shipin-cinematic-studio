/**
 * business-mapping-engine.ts — 业务语义映射引擎
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.1: Business Intelligence Constrained Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此引擎将 A-1.5 的 ReasoningFrame 映射到 A-3.1 的业务语义 EvaluationSchema。
 *
 * 规则：
 *   1. 只做 Frame → 固定轴映射 → 数值归一化
 *   2. 禁止 LLM 评分
 *   3. 禁止模糊权重
 *   4. 禁止自学习权重
 *   5. 禁止推荐偏好
 *
 * 映射过程：
 *   ReasoningFrame.evaluationAxes (通用名称)
 *      ↓
 *   domainRegistry 映射为业务轴名+权重
 *      ↓
 *   EvaluationSchema (带业务语义的评分结构)
 *
 * @phase decision-runtime
 */

import type { ReasoningFrame } from '../cognition/reasoning-frame.js'
import type { EvaluationScoreCard, AxisScore } from '../cognition/evaluation-schema.js'
import { Confidence, determineScoreLevel, calculateWeightedTotal } from '../cognition/evaluation-schema.js'
import { DomainType, domainRegistry } from './domain-classifier.js'

// ============================================================
// 1. 业务映射引擎
// ============================================================

export const businessMappingEngine = {
  /**
   * 将 ReasoningFrame 映射为业务语义的 EvaluationSchema
   *
   * 步骤：
   *   1. 根据 domain 获取注册的 axes + 默认权重
   *   2. 将通用框架映射为业务轴
   *   3. 生成空的 ScoreCard 骨架（等待 ScoringAgent 填充实际分数）
   */
  mapFrameToSchema(frame: ReasoningFrame, domain: DomainType): {
    weightMap: Record<string, number>
    axes: Array<{
      name: string
      label: string
      description: string
      weight: number
      dataSource: 'search' | 'evidence' | 'computed'
    }>
  } {
    const domainAxes = domainRegistry.getAxes(domain)
    const weightMap = domainRegistry.getDefaultWeights(domain)

    const axes = domainAxes.map(ax => ({
      name: ax.name,
      label: ax.label,
      description: ax.description,
      weight: weightMap[ax.name] ?? ax.defaultWeight,
      dataSource: ax.dataSource,
    }))

    return { weightMap, axes }
  },

  /**
   * 从业务轴映射生成空的 ScoreCard 骨架
   * 分数由 ScoringAgent 填充
   */
  createEmptyScoreCard(
    candidateId: string,
    candidateName: string,
    domain: DomainType,
  ): EvaluationScoreCard {
    // 先获取业务层定义的 axes
    const { weightMap, axes: definedAxes } = businessMappingEngine.mapFrameToSchema({
      facts: [],
      assumptions: [],
      uncertainties: [],
      evaluationAxes: [],
    }, domain)

    const axisScores: AxisScore[] = definedAxes.map(ax => ({
      axisName: ax.name,
      score: 0, // 空白，等待填充
      level: 'poor' as any,
      confidence: Confidence.LOW,
      rationale: '',
      evidenceSources: [],
    }))

    return {
      candidateId,
      candidateName,
      axes: axisScores,
      total: 0,
      overallConfidence: Confidence.LOW,
      evaluatedAt: '',
      weightMap,
    }
  },

  /**
   * 检查 ReasoningFrame 的 evaluationAxes 是否与注册的 domain axes 一致
   * 验证用：确保 ScoringAgent 使用了正确的轴名
   */
  validateFrameAxes(frame: ReasoningFrame, domain: DomainType): string[] {
    const errors: string[] = []
    const registeredAxes = domainRegistry.getAxisNames(domain)

    for (const ax of frame.evaluationAxes) {
      if (!registeredAxes.includes(ax.name)) {
        errors.push(`轴 "${ax.name}" 不在 ${domain} 的注册表中`)
      }
    }

    // 检查是否有注册的轴未被覆盖
    for (const name of registeredAxes) {
      const found = frame.evaluationAxes.find(a => a.name === name)
      if (!found) {
        errors.push(`领域 ${domain} 的注册轴 "${name}" 未在 Frame 中找到`)
      }
    }

    return errors
  },
}
