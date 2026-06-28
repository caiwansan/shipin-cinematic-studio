/**
 * CEE — Capability Evaluation Engine v1.0
 *
 * 整个 PQL 的判定内核。统一四层架构：
 *   Layer 1: Evidence Resolver — 每个 Capability 需要哪些 Evidence
 *   Layer 2: Capability Evaluator — 单能力评分
 *   Layer 3: Deviation Analyzer — Expected vs Observed 偏差分析
 *   Layer 4: Recommendation Builder — 分析与建议生成
 *
 * 后续新增 Capability（Wave 3/4）只增加 Evaluator，不改 Engine。
 *
 * CEE 的数据来源：
 *   - Expected: CIR（经 CCP 编译后的结构化期望）
 *   - Observed: VEP（Evidence Package）
 *   - 输出: CapabilityReport + EvaluationSummary
 */

import type { EvidencePackage } from './vep-types.js'
import type { SurveillanceZone } from './cee-evaluators.js'

// ─── Layer 1: Evidence Resolver ───────────

export interface EvidenceRequirement {
  /** Capability 名称（对应 Registry 中的 key） */
  capability: string
  /** 需要哪些 Evidence 字段 */
  requires: string[]
  /** 可选的 Evidence 字段 */
  optional?: string[]
  /** Evidence 的最低置信度要求 */
  minConfidence?: number
}

export type EvidenceResolver = Record<string, EvidenceRequirement>

// ─── Layer 3: Deviation ──────────────────

export interface DeviationDetail {
  /** 偏差的维度 */
  dimension: string
  /** 期望值 */
  expected: string | number
  /** 观测值 */
  observed: string | number
  /** 偏差量（数值化，0 = 无偏差） */
  delta: number
  /** 严重程度 */
  severity: 'info' | 'minor' | 'medium' | 'major' | 'critical'
  /** 偏差描述 */
  description: string
}

export const SEVERITY_ORDER: Record<string, number> = {
  info: 0,
  minor: 1,
  medium: 2,
  major: 3,
  critical: 4,
}

// ─── Layer 4: Recommendation ──────────────

export interface Recommendation {
  /** 推荐类型 */
  type: 'adjust' | 'regen' | 'add_constraint' | 'remove_constraint' | 'toggle_capability'
  /** 目标 Capability */
  capability: string
  /** 推荐描述 */
  description: string
  /** 建议修改的 CIR 字段路径（如 "shots[0].camera.scale"） */
  cirFieldPath?: string
  /** 建议的修改值 */
  suggestedValue?: string
  /** 优先级 */
  priority: 'low' | 'medium' | 'high'
}

// ─── CapabilityReport（每项能力一个）─────

export interface CapabilityReport {
  /** 能力名称（Registry key） */
  capability: string
  /** 是否已评估 */
  evaluated: boolean
  /** 评等 */
  score?: number
  /** 置信度 (0-1) */
  confidence?: number
  /** 严重程度 */
  severity?: 'pass' | 'minor' | 'medium' | 'major' | 'critical'
  /** Expected 转译 */
  expected?: string | number
  /** Observed 提取 */
  observed?: string | number
  /** 偏差详情 */
  deviations: DeviationDetail[]
  /** 自动修复建议 */
  recommendations: Recommendation[]
  /** 评估依据的 evidence keys */
  evidenceUsed: string[]
  /** 未通过原因 */
  reason?: string
}

// ─── EvaluationSummary（全局汇总）────────

export interface EvaluationSummary {
  /** 各能力评分 */
  scores: Record<string, number>
  /** 各能力置信度 */
  confidence: Record<string, number>
  /** 四维评分 */
  dimensions: {
    worldConsistency: number
    cinematicQuality: number
    physicsReality: number
    storyAlignment: number
  }
  /** 总体评分 */
  overall: number
  /** 评估时间 */
  evaluatedAt: string
  /** 评估的 evidence ID */
  evidenceId: string
}

// ─── CEE 完整输出 ─────────────────────────

export interface CapabilityEvaluationResult {
  /** 逐能力报告 */
  reports: CapabilityReport[]
  /** 全局汇总 */
  summary: EvaluationSummary
  /** 评估配置 */
  config: {
    capabilitiesEvaluated: string[]
    capabilitiesSkipped: string[]
    version: string
  }
}

// ─── Evaluator 接口 ───────────────────────

export interface CapabilityEvaluator {
  /** 能力名称 */
  capabilityName: string
  /** 依赖的 Evidence 字段 */
  requires: string[]
  /** 评估 */
  evaluate(
    expected: Record<string, unknown>,
    observed: EvidencePackage,
  ): CapabilityReport
}

// ─── CEE Engine 接口 ──────────────────────

export interface CeeEngine {
  /** 注册 Evaluator */
  register(evaluator: CapabilityEvaluator): void
  /** 执行完整评估 */
  evaluateAll(
    expected: Record<string, unknown>,
    observed: EvidencePackage,
  ): CapabilityEvaluationResult
  /** 按能力名称评估 */
  evaluate(
    capabilityName: string,
    expected: Record<string, unknown>,
    observed: EvidencePackage,
  ): CapabilityReport | undefined
}
