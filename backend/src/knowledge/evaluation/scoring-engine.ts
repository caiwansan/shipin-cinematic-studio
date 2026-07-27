/**
 * Phase 4-D: Evaluator Registry + Scoring Engine
 */

import type {
  Evaluator,
  EvaluationInput,
  EvaluatorResult,
  EvaluationResult,
  ScoreBreakdown,
  EvaluationIssue,
  EvaluationConfig,
  GoldenCase,
} from './types'
import { DEFAULT_EVALUATION_CONFIG } from './types'
import type { AgentResponse } from '../output/canonical-output-runtime'

// ═══════════════════════════════════════════════════════════════
// 1. Evaluator Registry（评估器注册中心）
// ═══════════════════════════════════════════════════════════════

export class EvaluatorRegistry {
  private evaluators = new Map<string, Evaluator>()

  register(evaluator: Evaluator): void {
    this.evaluators.set(evaluator.id, evaluator)
  }

  get(id: string): Evaluator | null {
    return this.evaluators.get(id) || null
  }

  getByTarget(target: string): Evaluator[] {
    return Array.from(this.evaluators.values()).filter(e => e.target === target)
  }

  getAll(): Evaluator[] {
    return Array.from(this.evaluators.values())
  }

  unregister(id: string): boolean {
    return this.evaluators.delete(id)
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. Built-in Evaluators（内置评估器）
// ═══════════════════════════════════════════════════════════════

/**
 * Accuracy Evaluator — 准确性评估
 * 检查输出是否包含期望内容、不包含禁止内容
 */
export class AccuracyEvaluator implements Evaluator {
  id = 'accuracy_evaluator'
  name = '准确性评估器'
  target = '*'
  description = '评估 Agent 输出的准确性'

  async evaluate(params: EvaluationInput): Promise<EvaluatorResult> {
    const { response, context } = params
    const issues: EvaluationIssue[] = []
    let score = 100

    if (!context) {
      return { evaluatorId: this.id, score: 50, issues: [], details: {} }
    }

    const dataStr = JSON.stringify(response.data).toLowerCase()

    // 检查应包含的内容
    if (context.expectedOutput && typeof context.expectedOutput === 'object') {
      const expected = context.expectedOutput as { shouldContain?: string[] }
      if (expected.shouldContain) {
        for (const item of expected.shouldContain) {
          if (!dataStr.includes(item.toLowerCase())) {
            score -= 15
            issues.push({
              severity: 'warning',
              category: 'accuracy',
              message: `缺少期望内容: "${item}"`,
              suggestion: `输出应包含 "${item}"`,
            })
          }
        }
      }
    }

    // 检查禁止内容
    if (context.forbiddenOutputs) {
      for (const item of context.forbiddenOutputs) {
        if (dataStr.includes(item.toLowerCase())) {
          score -= 20
          issues.push({
            severity: 'critical',
            category: 'accuracy',
            message: `包含禁止内容: "${item}"`,
            suggestion: `输出不应包含 "${item}"`,
          })
        }
      }
    }

    // 检查 Golden Case
    if (context.goldenCase) {
      const gc = context.goldenCase
      if (gc.expected.shouldContain) {
        for (const item of gc.expected.shouldContain) {
          if (!dataStr.includes(item.toLowerCase())) {
            score -= 10
            issues.push({
              severity: 'warning',
              category: 'accuracy',
              message: `[Golden] 缺少: "${item}"`,
            })
          }
        }
      }
      if (gc.expected.shouldNotContain) {
        for (const item of gc.expected.shouldNotContain) {
          if (dataStr.includes(item.toLowerCase())) {
            score -= 15
            issues.push({
              severity: 'critical',
              category: 'accuracy',
              message: `[Golden] 包含禁止项: "${item}"`,
            })
          }
        }
      }
    }

    return {
      evaluatorId: this.id,
      score: Math.max(0, score),
      issues,
      details: { checkedAt: Date.now() },
    }
  }
}

/**
 * Evidence Evaluator — 证据质量评估
 * 检查证据覆盖率、置信度
 */
export class EvidenceEvaluator implements Evaluator {
  id = 'evidence_evaluator'
  name = '证据质量评估器'
  target = '*'
  description = '评估证据的覆盖率和置信度'

  async evaluate(params: EvaluationInput): Promise<EvaluatorResult> {
    const { response, context } = params
    const issues: EvaluationIssue[] = []
    const evidence = response.evidence

    if (!evidence || evidence.length === 0) {
      return {
        evaluatorId: this.id,
        score: 0,
        issues: [{
          severity: 'critical',
          category: 'evidence',
          message: '无证据引用',
          suggestion: '所有结论必须有证据支持',
        }],
        details: { evidenceCount: 0 },
      }
    }

    // 平均置信度
    const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
    let score = Math.round(avgConfidence * 100)

    // 证据来源多样性
    const sources = new Set(evidence.map(e => e.source))
    if (sources.size < 2) {
      score -= 10
      issues.push({
        severity: 'warning',
        category: 'evidence',
        message: '证据来源单一',
        suggestion: '引用多个来源的证据',
      })
    }

    // 检查 Golden Case 要求的证据来源
    if (context?.goldenCase?.expected.requiredEvidence) {
      const requiredSources = context.goldenCase.expected.requiredEvidence
      const actualSources = Array.from(sources)
      for (const req of requiredSources) {
        if (!actualSources.some(s => s.includes(req))) {
          score -= 10
          issues.push({
            severity: 'warning',
            category: 'evidence',
            message: `缺少要求证据来源: ${req}`,
          })
        }
      }
    }

    return {
      evaluatorId: this.id,
      score: Math.max(0, score),
      issues,
      details: {
        evidenceCount: evidence.length,
        avgConfidence,
        sources: Array.from(sources),
      },
    }
  }
}

/**
 * Schema Evaluator — 输出合规评估
 * 检查输出是否符合 Canonical Schema
 */
export class SchemaEvaluator implements Evaluator {
  id = 'schema_evaluator'
  name = 'Schema 合规评估器'
  target = '*'
  description = '评估输出是否符合 Canonical Output Schema'

  async evaluate(params: EvaluationInput): Promise<EvaluatorResult> {
    const { response } = params
    const issues: EvaluationIssue[] = []
    let score = 100

    // 检查必需字段
    if (!response.id) {
      score -= 20
      issues.push({ severity: 'critical', category: 'schema', message: '缺少响应 ID' })
    }
    if (!response.agent) {
      score -= 20
      issues.push({ severity: 'critical', category: 'schema', message: '缺少 Agent 标识' })
    }
    if (!response.status) {
      score -= 15
      issues.push({ severity: 'critical', category: 'schema', message: '缺少状态字段' })
    }
    if (!response.metrics) {
      score -= 15
      issues.push({ severity: 'warning', category: 'schema', message: '缺少指标数据' })
    }

    // 检查 nextActions 格式
    if (response.nextActions && Array.isArray(response.nextActions)) {
      for (const action of response.nextActions) {
        if (!action.type || !action.title) {
          score -= 5
          issues.push({
            severity: 'warning',
            category: 'schema',
            message: 'NextAction 格式不完整',
          })
        }
      }
    }

    // 检查 confidence 范围
    if (response.confidence < 0 || response.confidence > 1) {
      score -= 10
      issues.push({
        severity: 'warning',
        category: 'schema',
        message: 'Confidence 超出范围（应为 0-1）',
      })
    }

    return {
      evaluatorId: this.id,
      score: Math.max(0, score),
      issues,
      details: { schemaVersion: '1.0.0' },
    }
  }
}

/**
 * Cost Evaluator — 成本效率评估
 * 检查 Token 成本和延迟
 */
export class CostEvaluator implements Evaluator {
  id = 'cost_evaluator'
  name = '成本效率评估器'
  target = '*'
  description = '评估 Agent 调用的成本效率'

  async evaluate(params: EvaluationInput): Promise<EvaluatorResult> {
    const { response, context } = params
    const issues: EvaluationIssue[] = []
    let score = 100

    const cost = response.metrics?.cost || 0
    const latency = response.metrics?.latency || 0
    const tokens = response.metrics?.tokens || 0

    // 成本检查
    if (context?.goldenCase?.expected.maxCost) {
      if (cost > context.goldenCase.expected.maxCost) {
        score -= 20
        issues.push({
          severity: 'warning',
          category: 'cost',
          message: `成本超标: ¥${cost} > ¥${context.goldenCase.expected.maxCost}`,
        })
      }
    }

    // 延迟检查
    if (latency > 5000) {
      score -= 15
      issues.push({
        severity: 'warning',
        category: 'cost',
        message: `延迟过高: ${latency}ms`,
        suggestion: '优化 Prompt 或使用更快的模型',
      })
    }

    // Token 检查
    if (tokens > 4000) {
      score -= 10
      issues.push({
        severity: 'info',
        category: 'cost',
        message: `Token 用量偏高: ${tokens}`,
      })
    }

    return {
      evaluatorId: this.id,
      score: Math.max(0, score),
      issues,
      details: { cost, latency, tokens },
    }
  }
}

/**
 * Safety Evaluator — 安全性评估
 * 检查输出是否包含敏感/危险内容
 */
export class SafetyEvaluator implements Evaluator {
  id = 'safety_evaluator'
  name = '安全性评估器'
  target = '*'
  description = '评估输出安全性'

  private sensitivePatterns = [
    /暴力/, /色情/, /赌博/, /毒品/,
    /歧视/, /仇恨/, /违法/,
  ]

  async evaluate(params: EvaluationInput): Promise<EvaluatorResult> {
    const { response } = params
    const issues: EvaluationIssue[] = []
    let score = 100

    const content = JSON.stringify(response.data)

    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(content)) {
        score -= 30
        issues.push({
          severity: 'critical',
          category: 'safety',
          message: `检测到敏感内容: ${pattern.source}`,
          suggestion: '移除敏感内容',
        })
      }
    }

    return {
      evaluatorId: this.id,
      score: Math.max(0, score),
      issues,
      details: { checkedAt: Date.now() },
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. Scoring Engine（评分引擎）
// ═══════════════════════════════════════════════════════════════

export class ScoringEngine {
  constructor(private config: EvaluationConfig = DEFAULT_EVALUATION_CONFIG) {}

  /**
   * 计算加权总分
   */
  calculate(scores: ScoreBreakdown): number {
    const weighted =
      scores.accuracy * this.config.accuracyWeight +
      scores.evidence * this.config.evidenceWeight +
      scores.reasoning * this.config.reasoningWeight +
      scores.schema * this.config.schemaWeight +
      scores.safety * this.config.safetyWeight +
      scores.cost * this.config.costWeight

    return Math.round(weighted)
  }

  /**
   * 分数转等级
   */
  toGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    if (score >= 90) return 'S'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    return 'D'
  }

  /**
   * 合并多个评估器结果
   */
  mergeResults(results: EvaluatorResult[]): {
    scores: ScoreBreakdown
    overallScore: number
    issues: EvaluationIssue[]
  } {
    const issues = results.flatMap(r => r.issues)
    
    const findScore = (id: string) => results.find(r => r.evaluatorId === id)?.score || 50

    const scores: ScoreBreakdown = {
      accuracy: findScore('accuracy_evaluator'),
      evidence: findScore('evidence_evaluator'),
      reasoning: findScore('reasoning_evaluator'),
      schema: findScore('schema_evaluator'),
      safety: findScore('safety_evaluator'),
      cost: findScore('cost_evaluator'),
    }

    const overallScore = this.calculate(scores)

    return { scores, overallScore, issues }
  }
}
