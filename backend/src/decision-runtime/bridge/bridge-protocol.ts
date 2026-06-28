/**
 * bridge-protocol.ts — Phase B → Phase C Minimal Bridge Protocol
 *
 * ============================================================
 * 语义接口契约（Semantic Interface Contract）
 * ============================================================
 *
 * 这不是系统设计。
 * 不是 Phase C 的起点。
 * 不是 Phase B 的扩展。
 *
 * 这是：
 *   frozen proof universe 对外暴露的"唯一 API"
 *
 * 宪法（不可违反）：
 *   RULE 1: No new proof generation allowed
 *   RULE 2: No modification of frozen universe
 *   RULE 3: All outputs must reference SemanticAnchor
 *   RULE 4: All truth values must originate from B-4.5 logic layer
 *   RULE 5: All structure must be traceable to FrameInvariant
 *
 * Phase Boundary:
 *   Phase B (Frozen Universe): deterministic, closed, immutable, self-consistent
 *   Phase C (Interface Layer):  projection only, no structural mutation,
 *                                no proof generation, no logic extension
 */

import type { ProofKernel } from '../proofs/b1/proof-kernel.js'
import type { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import type { TruthValue } from '../proofs/b45/proposition.js'

// ============================================================
// 1. Query Interface — 入口契约
// ============================================================
//
// query ≠ execution
// query ≠ proof
// query = projection into proof space
//
// 现实问题通过 Query 嵌入到 frozen universe
// 不要求"完整映射"，只要求"可定位到 proof space"

export type EmbeddingType =
  /** 精确匹配签名 */
  | 'exact_signature'
  /** 等价类匹配 */
  | 'equivalence_class'
  /** 部分框架提示（带缺省域） */
  | 'partial_frame'
  /** 意图类（基于 domain + intent） */
  | 'intent_class'

export interface QueryEmbedding {
  type: EmbeddingType
  /** 具体嵌入值 */
  value: string
  /** 若为 partial_frame，此处携带的不变量 */
  frameHints?: string[]
}

export interface QueryContext {
  /** 业务领域（如 tech_review / market_intel / risk_assessment） */
  domain?: string
  /** 约束条件（如 time_decay / source_filter） */
  constraints?: string[]
  /** 预期输出类型 */
  expectedOutput?: 'decision' | 'truth' | 'structure'
}

export interface QueryContract {
  /** 查询唯一标识 */
  queryId: string
  /** 自然语言问题（仅溯源用，不进 proof space） */
  naturalInput: string
  /** 问题到 proof space 的嵌入 */
  embedding: QueryEmbedding
  /** 查询上下文 */
  context?: QueryContext
}

// 不变量：QueryContract 不包含任何执行指令
// 不变量：QueryContract.embedding 必须是 frozen universe 中可识别的

// ============================================================
// 2. Universe Lookup Interface — 核心契约
// ============================================================
//
// 这是唯一允许"访问 frozen universe"的接口。
// 访问方式只有两种：
//   a) 精确匹配（exact signature lookup）
//   b) 范畴定位（category morphism / isomorphism lookup）
//
// 不生成新 proof。
// 不修改 frozen state。
// 不重新计算逻辑。

export interface EntailmentResult {
  /** 前件 proof 签名 */
  from: string
  /** 后件 proof 签名 */
  to: string
  /** 蕴含是否成立 */
  holds: boolean
  /** 蕴含理由（identity / isomorphism / truth_transfer / ex_falso / false / unknown） */
  reason: string
  /** 来源的 SemanticAnchor 签名 */
  anchorSignature: string
}

export interface CategoryAlignment {
  /** 与查询最匹配的 proof 签名 */
  bestMatch: string
  /** 范畴态射类型 */
  morphismType: 'identity' | 'reversible' | 'partial' | 'degenerate'
  /** 是否同构 */
  isIsomorphic: boolean
  /** 所属同构群 */
  isomorphismGroup?: string
}

export interface LookupResult {
  /** 对应 QueryContract.queryId */
  queryId: string
  /** 匹配到的 proof 列表 */
  matchedProofs: ProofKernel[]
  /** 蕴含结果 */
  entailment: EntailmentResult
  /** 范畴对齐信息 */
  categoryAlignment: CategoryAlignment
  /** 来源的 SemanticAnchor 签名 */
  anchorSignature: string
}

// 不变量：LookupResult.matchedProofs 是 frozen universe 中的现有 proof
// 不变量：LookupResult.entailment 来自 B-4.5 logic layer
// 不变量：LookupResult.categoryAlignment 来自 B-4 category layer

// ============================================================
// 3. Decision Projection Interface — 输出契约
// ============================================================
//
// 把 proof 结果翻译回人类可理解、runtime 可执行的决策。
//
// decision ≠ new proof
// decision = projection of existing proof
//
// 所有输出必须能溯源到 SemanticAnchor。

export interface Provenance {
  /** 来源的 FrameInvariant 签名 */
  frameInvariantSignature: string
  /** 来源的 proof 签名 */
  proofSignature: string
  /** 因果追踪路径 */
  causalTrace: string[]
  /** 来源的 SemanticAnchor 签名 */
  anchorSignature: string
}

export interface Explainability {
  /** 蕴含链（P ⊢ Q ⊢ R ...） */
  entailmentChain: string[]
  /** 范畴定位 */
  categoryPosition: string
  /** 真值来源 */
  truthOrigin: string
}

export interface DecisionArtifact {
  /** 对应 QueryContract.queryId */
  queryId: string
  /** 决策值 */
  value: string
  /** 置信度（从逻辑真值推导，非概率） */
  confidence: number
  /** 逻辑真值 */
  truth: TruthValue
  /** 溯源信息 */
  provenance: Provenance
  /** 可解释性 */
  explainability: Explainability
  /** 生成时间 */
  createdAt: number
}

// 不变量：DecisionArtifact.value 必须可溯源到 LookupResult
// 不变量：DecisionArtifact.confidence 从 truth + entailment 推导，不含概率模型
// 不变量：DecisionArtifact.provenance 必须包含 anchorSignature

// ============================================================
// 4. Bridge API — 桥接口（类型定义，非实现）
// ============================================================
//
// 这是 bridge 对外暴露的"形状"。
// 只有类型签名，没有实现体。
// Phase C 负责填充实现。

export interface BridgeAPI {
  /**
   * 查询入口
   * 现实问题 → embedding into frozen universe
   */
  query(contract: QueryContract): LookupResult

  /**
   * 决策投影
   * proof result → decision artifact
   */
  project(result: LookupResult): DecisionArtifact

  /**
   * 桥健康检查
   * 验证 frozen universe 仍然可用
   */
  health(): BridgeHealth
}

export interface BridgeHealth {
  /** frozen universe 是否完整 */
  universeIntact: boolean
  /** SemanticAnchor 数量 */
  anchorCount: number
  /** 最后一个 anchor 签名 */
  latestAnchorSignature: string
}

// ============================================================
// 5. Bridge Constitution — 桥宪法（运行时不可违反）
// ============================================================

export const BRIDGE_CONSTITUTION = {
  NO_NEW_PROOF:    'RULE_1: No new proof generation allowed',
  NO_MUTATION:     'RULE_2: No modification of frozen universe',
  ANCHOR_REF:      'RULE_3: All outputs must reference SemanticAnchor',
  TRUTH_FROM_LOGIC:'RULE_4: All truth values must originate from B-4.5 logic layer',
  TRACEABLE:       'RULE_5: All structure must be traceable to FrameInvariant',
} as const

export type BridgeConstitutionRule = keyof typeof BRIDGE_CONSTITUTION

// ============================================================
// 6. Phase Boundary 声明（防漂移锚）
// ============================================================

export const PHASE_BOUNDARY = {
  phaseB: {
    label: 'Frozen Proof Universe',
    properties: ['deterministic', 'closed', 'immutable', 'self-consistent'],
    mutable: false,
  },
  phaseC: {
    label: 'Interface Layer',
    properties: ['projection only', 'no structural mutation', 'no proof generation', 'no logic extension'],
    mutable: false,
  },
  bridge: {
    label: 'Phase B → C Semantic Interface Contract',
    purpose: 'define how frozen universe is called, not how it works',
    mutable: false,
  },
} as const
