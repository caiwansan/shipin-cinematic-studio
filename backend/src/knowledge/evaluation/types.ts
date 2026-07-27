/**
 * Phase 4-D: Agent Evaluation Runtime
 * 
 * 建立昆仑镜 Agent 的自动质量评估系统，让每一个 Agent 都具备"自我检测、自我优化、持续进化"的能力。
 * 
 * 核心理念：
 *   Agent = 会工作 + 知道自己工作质量 + 可以持续优化 + 可以企业级运营
 * 
 * 架构：
 *   Agent Request → Agent Execution → Canonical Output → Evaluation Runtime → Score
 * 
 * 约束：
 *   不修改 Agent 核心逻辑
 *   不绕过 Canonical Output
 *   不直接调用 LLM Provider
 *   不创建新的知识来源
 */

import type { AgentResponse, Evidence, UICard, NextAction } from '../output/canonical-output-runtime'
import type { PromptExecutionLog } from '../prompt/prompt-runtime'

// ═══════════════════════════════════════════════════════════════
// 1. Evaluation Types（评估类型）
// ═══════════════════════════════════════════════════════════════

export interface EvaluationResult {
  id: string
  agent: string
  promptId?: string
  promptVersion?: string
  timestamp: number
  scores: ScoreBreakdown
  overallScore: number        // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  passed: boolean
  issues: EvaluationIssue[]
  recommendations: string[]
}

export interface ScoreBreakdown {
  accuracy: number           // 准确性（0-100）
  evidence: number           // 证据质量（0-100）
  reasoning: number          // 推理质量（0-100）
  schema: number             // 输出合规（0-100）
  safety: number             // 安全性（0-100）
  cost: number               // 成本效率（0-100）
}

export interface EvaluationIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  suggestion?: string
}

export interface EvaluationConfig {
  accuracyWeight: number
  evidenceWeight: number
  reasoningWeight: number
  schemaWeight: number
  safetyWeight: number
  costWeight: number
  passingScore: number        // 及格线
}

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  accuracyWeight: 0.30,
  evidenceWeight: 0.25,
  reasoningWeight: 0.20,
  schemaWeight: 0.10,
  safetyWeight: 0.10,
  costWeight: 0.05,
  passingScore: 70,
}

// ═══════════════════════════════════════════════════════════════
// 2. Evaluator Interface（评估器接口）
// ═══════════════════════════════════════════════════════════════

export interface Evaluator {
  id: string
  name: string
  target: string            // career_agent | resume_agent | interview_agent | jd_agent
  description: string
  evaluate(params: EvaluationInput): Promise<EvaluatorResult>
}

export interface EvaluationInput {
  response: AgentResponse<unknown>
  context?: {
    userMessage?: string
    expectedOutput?: unknown
    forbiddenOutputs?: string[]
    goldenCase?: GoldenCase
  }
}

export interface EvaluatorResult {
  evaluatorId: string
  score: number             // 0-100
  issues: EvaluationIssue[]
  details: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════
// 3. Golden Case（黄金测试用例）
// ═══════════════════════════════════════════════════════════════

export interface GoldenCase {
  id: string
  agent: string
  category: string
  input: {
    userMessage: string
    skills?: string[]
    currentRole?: string
    targetRole?: string
  }
  expected: {
    shouldContain?: string[]      // 输出应包含的内容
    shouldNotContain?: string[]   // 输出不应包含的内容
    minScore?: number             // 最低分数
    maxCost?: number              // 最高成本（元）
    requiredEvidence?: string[]   // 必须引用的证据来源
    schemaType?: string           // 期望的 Schema 类型
  }
  metadata: {
    difficulty: 'easy' | 'medium' | 'hard'
    tags: string[]
    createdAt: number
  }
}

export interface GoldenDataset {
  agent: string
  cases: GoldenCase[]
  version: string
  totalCases: number
}

// ═══════════════════════════════════════════════════════════════
// 4. Benchmark Result（基准测试结果）
// ═══════════════════════════════════════════════════════════════

export interface BenchmarkResult {
  agent: string
  dataset: string
  timestamp: number
  totalCases: number
  passedCases: number
  failedCases: number
  avgScore: number
  minScore: number
  maxScore: number
  passRate: number            // 0-100
  details: BenchmarkCaseResult[]
}

export interface BenchmarkCaseResult {
  caseId: string
  passed: boolean
  score: number
  issues: string[]
}

// ═══════════════════════════════════════════════════════════════
// 5. Regression Result（回归测试结果）
// ═══════════════════════════════════════════════════════════════

export interface RegressionResult {
  agent: string
  baselineVersion: string
  candidateVersion: string
  timestamp: number
  baselineScore: number
  candidateScore: number
  delta: number               // 分数变化
  improved: boolean
  degraded: boolean
  significantChange: boolean  // 显著变化（>5分）
  recommendation: 'promote' | 'hold' | 'rollback'
  details: RegressionCaseResult[]
}

export interface RegressionCaseResult {
  caseId: string
  baselineScore: number
  candidateScore: number
  delta: number
}

// ═══════════════════════════════════════════════════════════════
// 6. Agent Score Report（Agent 评分报告）
// ═══════════════════════════════════════════════════════════════

export interface AgentScoreReport {
  agent: string
  period: 'day' | 'week' | 'month'
  generatedAt: number
  overallScore: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  scores: ScoreBreakdown
  trend: {
    direction: 'up' | 'down' | 'stable'
    delta: number
    history: Array<{ date: string; score: number }>
  }
  benchmarks: BenchmarkResult[]
  topIssues: EvaluationIssue[]
  recommendations: string[]
}
