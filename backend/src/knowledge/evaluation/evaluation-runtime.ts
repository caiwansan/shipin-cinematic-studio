/**
 * Phase 4-D: Evaluation Runtime + Benchmark + Regression + Report
 */

import type {
  Evaluator,
  EvaluationInput,
  EvaluatorResult,
  EvaluationResult,
  ScoreBreakdown,
  EvaluationIssue,
  GoldenCase,
  GoldenDataset,
  BenchmarkResult,
  BenchmarkCaseResult,
  RegressionResult,
  RegressionCaseResult,
  AgentScoreReport,
  EvaluationConfig,
} from './types'
import { DEFAULT_EVALUATION_CONFIG } from './types'
import { EvaluatorRegistry, ScoringEngine } from './scoring-engine'
import type { AgentResponse } from '../output/canonical-output-runtime'

// ═══════════════════════════════════════════════════════════════
// 1. Evaluation Runtime（评估运行时）— 主类
// ═══════════════════════════════════════════════════════════════

export interface EvaluationRuntimeConfig {
  evaluatorRegistry: EvaluatorRegistry
  scoringEngine: ScoringEngine
  config?: EvaluationConfig
}

export class EvaluationRuntime {
  private benchmarkDatasets = new Map<string, GoldenDataset>()
  private evaluationHistory = new Map<string, EvaluationResult[]>()
  private regressionHistory = new Map<string, RegressionResult[]>()

  constructor(private config: EvaluationRuntimeConfig) {}

  /**
   * 评估单个 Agent 响应
   */
  async evaluate(params: {
    response: AgentResponse<unknown>
    agent: string
    context?: EvaluationInput['context']
  }): Promise<EvaluationResult> {
    const { response, agent, context } = params

    // 获取该 Agent 的所有评估器
    const evaluators = this.config.evaluatorRegistry.getByTarget(agent)
    const allEvaluators = evaluators.length > 0 ? evaluators : this.config.evaluatorRegistry.getAll()

    // 执行所有评估器
    const evaluatorResults: EvaluatorResult[] = []
    for (const evaluator of allEvaluators) {
      try {
        const result = await evaluator.evaluate({ response, context })
        evaluatorResults.push(result)
      } catch (error) {
        evaluatorResults.push({
          evaluatorId: evaluator.id,
          score: 0,
          issues: [{
            severity: 'critical',
            category: 'system',
            message: `评估器 ${evaluator.id} 执行失败: ${error}`,
          }],
          details: {},
        })
      }
    }

    // 合并评分
    const { scores, overallScore, issues } = this.config.scoringEngine.mergeResults(evaluatorResults)
    const grade = this.config.scoringEngine.toGrade(overallScore)
    const passed = overallScore >= (this.config.config?.passingScore || DEFAULT_EVALUATION_CONFIG.passingScore)

    const result: EvaluationResult = {
      id: this.generateId(),
      agent,
      promptId: response.promptId,
      promptVersion: response.promptVersion,
      timestamp: Date.now(),
      scores,
      overallScore,
      grade,
      passed,
      issues,
      recommendations: this.generateRecommendations(scores, issues),
    }

    // 记录历史
    const history = this.evaluationHistory.get(agent) || []
    history.push(result)
    this.evaluationHistory.set(agent, history)

    return result
  }

  /**
   * 批量评估
   */
  async evaluateBatch(items: Array<{
    response: AgentResponse<unknown>
    agent: string
    context?: EvaluationInput['context']
  }>): Promise<EvaluationResult[]> {
    return Promise.all(items.map(item => this.evaluate(item)))
  }

  /**
   * 注册 Golden Dataset
   */
  registerDataset(dataset: GoldenDataset): void {
    this.benchmarkDatasets.set(dataset.agent, dataset)
  }

  /**
   * 获取 Golden Dataset
   */
  getDataset(agent: string): GoldenDataset | null {
    return this.benchmarkDatasets.get(agent) || null
  }

  /**
   * 运行 Benchmark
   */
  async runBenchmark(agent: string): Promise<BenchmarkResult> {
    const dataset = this.benchmarkDatasets.get(agent)
    if (!dataset) {
      return this.emptyBenchmark(agent, 'no_dataset')
    }

    const caseResults: BenchmarkCaseResult[] = []

    for (const gc of dataset.cases) {
      // 构建模拟响应
      const mockResponse = this.buildMockResponse(agent, gc)
      
      // 评估
      const evalResult = await this.evaluate({
        response: mockResponse,
        agent,
        context: {
          userMessage: gc.input.userMessage,
          goldenCase: gc,
          expectedOutput: gc.expected,
          forbiddenOutputs: gc.expected.shouldNotContain,
        },
      })

      const passed = evalResult.passed && 
        (!gc.expected.minScore || evalResult.overallScore >= gc.expected.minScore)

      caseResults.push({
        caseId: gc.id,
        passed,
        score: evalResult.overallScore,
        issues: evalResult.issues.map(i => i.message),
      })
    }

    const scores = caseResults.map(c => c.score)
    const passedCases = caseResults.filter(c => c.passed).length

    return {
      agent,
      dataset: dataset.version,
      timestamp: Date.now(),
      totalCases: dataset.cases.length,
      passedCases,
      failedCases: dataset.cases.length - passedCases,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      passRate: Math.round((passedCases / dataset.cases.length) * 100),
      details: caseResults,
    }
  }

  /**
   * 运行回归测试
   */
  async runRegression(params: {
    agent: string
    baselineVersion: string
    candidateVersion: string
    baselineScores: number[]
    candidateScores: number[]
  }): Promise<RegressionResult> {
    const { agent, baselineVersion, candidateVersion, baselineScores, candidateScores } = params

    const baselineAvg = Math.round(baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length)
    const candidateAvg = Math.round(candidateScores.reduce((a, b) => a + b, 0) / candidateScores.length)
    const delta = candidateAvg - baselineAvg

    const details: RegressionCaseResult[] = baselineScores.map((score, i) => ({
      caseId: `case_${i + 1}`,
      baselineScore: score,
      candidateScore: candidateScores[i] || 0,
      delta: (candidateScores[i] || 0) - score,
    }))

    const result: RegressionResult = {
      agent,
      baselineVersion,
      candidateVersion,
      timestamp: Date.now(),
      baselineScore: baselineAvg,
      candidateScore: candidateAvg,
      delta,
      improved: delta > 0,
      degraded: delta < 0,
      significantChange: Math.abs(delta) > 5,
      recommendation: delta > 5 ? 'promote' : delta < -5 ? 'rollback' : 'hold',
      details,
    }

    const history = this.regressionHistory.get(agent) || []
    history.push(result)
    this.regressionHistory.set(agent, history)

    return result
  }

  /**
   * 生成 Agent 评分报告
   */
  generateReport(agent: string, period: 'day' | 'week' | 'month' = 'week'): AgentScoreReport {
    const history = this.evaluationHistory.get(agent) || []
    
    // 过滤时间范围
    const cutoff = this.getPeriodCutoff(period)
    const recent = history.filter(h => h.timestamp >= cutoff)

    if (recent.length === 0) {
      return this.emptyReport(agent, period)
    }

    const scores: ScoreBreakdown = {
      accuracy: this.avg(recent.map(r => r.scores.accuracy)),
      evidence: this.avg(recent.map(r => r.scores.evidence)),
      reasoning: this.avg(recent.map(r => r.scores.reasoning)),
      schema: this.avg(recent.map(r => r.scores.schema)),
      safety: this.avg(recent.map(r => r.scores.safety)),
      cost: this.avg(recent.map(r => r.scores.cost)),
    }

    const overallScore = this.config.scoringEngine.calculate(scores)
    const grade = this.config.scoringEngine.toGrade(overallScore)

    // 趋势
    const previous = history.filter(h => h.timestamp < cutoff && h.timestamp >= cutoff * 2)
    const prevAvg = previous.length > 0
      ? previous.reduce((sum, r) => sum + r.overallScore, 0) / previous.length
      : overallScore
    const delta = overallScore - Math.round(prevAvg)

    // Top issues
    const allIssues = recent.flatMap(r => r.issues)
    const criticalIssues = allIssues.filter(i => i.severity === 'critical')
    const topIssues = criticalIssues.slice(0, 5)

    return {
      agent,
      period,
      generatedAt: Date.now(),
      overallScore,
      grade,
      scores,
      trend: {
        direction: delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable',
        delta,
        history: recent.slice(-10).map(r => ({
          date: new Date(r.timestamp).toLocaleDateString(),
          score: r.overallScore,
        })),
      },
      benchmarks: [],
      topIssues,
      recommendations: this.generateReportRecommendations(scores, topIssues),
    }
  }

  /**
   * 获取评估历史
   */
  getHistory(agent: string): EvaluationResult[] {
    return this.evaluationHistory.get(agent) || []
  }

  /**
   * 获取回归历史
   */
  getRegressionHistory(agent: string): RegressionResult[] {
    return this.regressionHistory.get(agent) || []
  }

  // ─── 私有方法 ───

  private generateRecommendations(scores: ScoreBreakdown, issues: EvaluationIssue[]): string[] {
    const recommendations: string[] = []

    if (scores.accuracy < 70) recommendations.push('提升输出准确性：增加更多训练数据或优化 Prompt')
    if (scores.evidence < 70) recommendations.push('提升证据质量：确保所有结论都有证据支持')
    if (scores.reasoning < 70) recommendations.push('提升推理质量：优化推理链和逻辑严谨性')
    if (scores.schema < 80) recommendations.push('修复 Schema 合规问题')
    if (scores.safety < 80) recommendations.push('加强安全检查')
    if (scores.cost < 60) recommendations.push('降低成本：优化 Prompt 或使用更便宜的模型')

    for (const issue of issues.filter(i => i.severity === 'critical')) {
      recommendations.push(`修复关键问题: ${issue.message}`)
    }

    return recommendations.slice(0, 5)
  }

  private generateReportRecommendations(scores: ScoreBreakdown, issues: EvaluationIssue[]): string[] {
    return this.generateRecommendations(scores, issues)
  }

  private buildMockResponse(agent: string, gc: GoldenCase): AgentResponse<unknown> {
    return {
      id: `eval_${gc.id}`,
      agent,
      version: '1.0.0',
      status: 'success',
      data: { recommendations: gc.expected.shouldContain?.map(name => ({ name, score: 80, reason: 'mock' })) },
      evidence: gc.expected.requiredEvidence?.map(src => ({
        id: `ev_${src}`,
        source: src,
        type: 'fact',
        confidence: 0.85,
        payload: {},
      })) || [],
      confidence: 0.8,
      nextActions: [],
      metrics: { latency: 2000, tokens: 1500, cost: 0.002 },
    }
  }

  private emptyBenchmark(agent: string, reason: string): BenchmarkResult {
    return {
      agent,
      dataset: reason,
      timestamp: Date.now(),
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      avgScore: 0,
      minScore: 0,
      maxScore: 0,
      passRate: 0,
      details: [],
    }
  }

  private emptyReport(agent: string, period: 'day' | 'week' | 'month'): AgentScoreReport {
    return {
      agent,
      period,
      generatedAt: Date.now(),
      overallScore: 0,
      grade: 'D',
      scores: { accuracy: 0, evidence: 0, reasoning: 0, schema: 0, safety: 0, cost: 0 },
      trend: { direction: 'stable', delta: 0, history: [] },
      benchmarks: [],
      topIssues: [],
      recommendations: ['暂无评估数据'],
    }
  }

  private getPeriodCutoff(period: 'day' | 'week' | 'month'): number {
    const now = Date.now()
    switch (period) {
      case 'day': return now - 86400000
      case 'week': return now - 604800000
      case 'month': return now - 2592000000
    }
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
  }

  private generateId(): string {
    return `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}
