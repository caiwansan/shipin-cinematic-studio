/**
 * benchmark/types/index.ts — Benchmark 领域核心类型
 *
 * 遵循 GEO Benchmark Spec v1.0，作为所有 Benchmark 模块的唯一类型来源。
 * Runner / Judge / Calculator / Provider / Dataset 全部依赖此文件。
 * 禁止在 Runner 中写 if(provider==="deepseek") 等类型判断。
 */
import type { Prisma } from '@prisma/client'

// ============================================================
// 供应商无关的 Provider 接口
// ============================================================

export interface BenchmarkProvider {
  readonly name: string
  readonly model: string
  readonly version: string

  /** 统一的调用入口 */
  invoke(request: BenchmarkRequest): Promise<BenchmarkResponse>
}

export interface BenchmarkRequest {
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
  timeout: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface BenchmarkResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// ============================================================
// Dataset 类型
// ============================================================

export type QuestionCategory =
  | 'general'
  | 'industry'
  | 'product'
  | 'comparison'
  | 'recommendation'
  | 'trust'
  | 'freshness'
  | 'multi_turn'

export type Difficulty = 1 | 2 | 3

export type BIIDimension =
  | 'visibility'
  | 'understanding'
  | 'accuracy'
  | 'citation'
  | 'recommendation'
  | 'comparative_preference'
  | 'freshness'
  | 'consistency'

export type ClaimType = 'fact' | 'opinion' | 'recommendation'
export type ScoringRuleType = 'exact' | 'semantic' | 'evidence_required' | 'comparative'

export interface EvidenceSource {
  type: string
  description: string
}

export interface ExpectedClaim {
  claim: string
  type: ClaimType
  required: boolean
  weight: number
  evidence?: EvidenceSource[]
}

export interface BenchmarkQuestion {
  id: string
  category: QuestionCategory
  difficulty: Difficulty
  intent: string
  prompt: {
    system?: string
    user: string
  }
  expectedClaims: ExpectedClaim[]
  evaluation: {
    dimension: BIIDimension
    scoringRule: ScoringRuleType
    weight: number
  }
  tags: string[]
  lastUpdated: string
}

export interface BenchmarkDataset {
  meta: {
    version: string
    name: string
    description: string
    totalQuestions: number
  }
  questions: BenchmarkQuestion[]
}

// ============================================================
// EntityRef 类型 — 全链路引用实体
// ============================================================

export interface EntityRef {
  entityId: string
  brandName?: string
  brandIndustry?: string
}

// ============================================================
// Runner 类型
// ============================================================

export interface BenchmarkJob {
  id: string
  entityId: string
  brandName: string
  brandIndustry?: string
  datasetVersion: string
  promptPackVersion: string
  providerName: string
  model: string
  status: JobStatus
  progress: {
    total: number
    completed: number
    failed: number
  }
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'

// ============================================================
// Judge / Evaluation 类型
// ============================================================

export interface ClaimEvaluation {
  questionId: string
  claim: string
  expected: string | null
  actual: string | null
  score: number          // 0 | 0.5 | 1.0
  reason: string
  impact: string
}

export interface DimensionScore {
  dimension: BIIDimension
  score: number          // 0-100
  weight: number
  weightedScore: number
  keyFindings: string[]
  evaluations: ClaimEvaluation[]
}

export interface BIIResult {
  biiScore: number       // 0-100
  biiGrade: string       // A+ / A / B+ / B / C+ / C
  confidence: number     // 0-1
  dimensions: DimensionScore[]
}

// ============================================================
// Report 类型
// ============================================================

export interface BenchmarkReport {
  meta: {
    reportId: string
    entityId: string
    brandName: string
    brandIndustry?: string
    benchmarkVersion: string
    datasetVersion: string
    promptPackVersion: string
    judgeVersion: string
    biiFormulaVersion: string
    provider: string
    model: string
    runAt: string
    duration: number
  }
  overall: {
    biiScore: number
    biiGrade: string
    confidence: number
  }
  dimensions: {
    [key in BIIDimension]?: {
      score: number
      weight: number
      weightedScore: number
      keyFindings: string[]
      deductionReasons: ClaimEvaluation[]
    }
  }
  recommendations: BenchmarkRecommendation[]
}

export interface BenchmarkRecommendation {
  priority: 'P0' | 'P1' | 'P2'
  dimension: BIIDimension
  category: string
  what: string
  why: string
  how: string
  expectedImpact: {
    dimension: string
    delta: number
  }
  confidence: number
}
