// ============================================================
// convergence/types.ts
//
// 职责：D4 Convergence Arbiter — 共享类型定义
//
// 设计原则：
//   - 清晰区分"context 权重"和"loss 评估"
//   - Context 决定权力分配
//   - Soft Loss 决定冲突裁决
// ============================================================

import type { DecisionAction } from '../pipeline/decision/decision-engine.js'
import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'

// ─── 制作阶段 ──────────────────────────────────────────

export type ProductionPhase =
  | 'draft'           // 初稿阶段 — 容忍中等质量，追求覆盖率
  | 'polish'          // 精修阶段 — 质量优先，节奏放慢
  | 'final'           // 终审阶段 — 严格质量门禁
  | 'production'      // 发布生产 — 最高标准

// ─── Context 权重空间 ──────────────────────────────────

export interface ArbiterContext {
  /** 当前制作阶段 */
  phase: ProductionPhase
  /** 当前考虑的所有 domain */
  domains: QualityDomain[]
  /** 该任务的语义意图 */
  intent: 'visual_coherence' | 'identity_preserve' | 'narrative_flow' | 'general'
  /** 风险模式 */
  riskMode: 'conservative' | 'normal' | 'exploratory'
  /** 该任务在整个项目中的序号（用于退火） */
  generationIndex: number
}

// ─── Domain 提案 ──────────────────────────────────────

export interface DomainProposal {
  domain: QualityDomain
  /** D2 决策动作 */
  action: DecisionAction
  /** D1 校准评分 */
  calibratedScore: number
  /** 决策置信度 */
  confidence: number
  /** 该 domain 的质量 issues */
  issues: string[]
}

// ─── Soft Loss 评估 ────────────────────────────────────

export interface SoftLossEstimate {
  /** 总体损失值（0-1，1=最高损失） */
  totalLoss: number
  /** 各损失分项 */
  breakdown: {
    qualityLoss: number      // 接受低质量带来的损失
    driftLoss: number        // 跨 domain 一致性损失
    temporalLoss: number     // 时序断裂损失
    costLoss: number         // 重试成本损失
  }
  /** 如果 retry 或 regenerate，预期收益 */
  expectedGain: number
}

// ─── 仲裁结果 ──────────────────────────────────────────

export interface ArbitrationVerdict {
  /** 裁决动作 */
  decision: 'accept' | 'retry' | 'regenerate' | 'escalate'
  /** 覆盖的 domain */
  overrideDomain?: QualityDomain
  /** 原始 D2 决策 */
  originalDecisions: DomainProposal[]
  /** 仲裁上下文 */
  contextUsed: ArbiterContext
  /** 损失估算 */
  lossComparison: {
    accepted: SoftLossEstimate
    retried: SoftLossEstimate
  }
  /** 裁决理由 */
  rationale: string
  /** 时间戳 */
  timestamp: string
}
