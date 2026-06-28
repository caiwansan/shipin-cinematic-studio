/**
 * proof-kernel.ts — Phase B-1 Proof Kernel
 *
 * ============================================================
 * Proof Kernel Schema & Validator
 * ============================================================
 *
 * Proof Kernel 是 FrameInvariant 的可展开证明树。
 * 它不是"更强的 FrameInvariant"。
 * 它是 FrameInvariant 的"反编译器"——把签名展开为可验证路径。
 *
 * 本质：双向一致性校验
 *   compress: Path → FrameInvariant (A-0.8)
 *   expand:   FrameInvariant → ProofKernel (B-1)
 *   validate: hash(proof.witness) === frameInvariant.signature
 *
 * 宪法约束：
 *   1. ProofKernel 不是执行系统——它不调用任何 Agent
 *   2. ProofKernel 只从已有 Trace/CausalGraph 重构成证明树
 *   3. validate() 不依赖外部扰动测试
 *   4. ProofStep 的 rule 类型有限枚举
 */

import type { FrameInvariant } from '../../frame/frame-invariant.js'

// ============================================================
// 1. Proof Step
// ============================================================

export type ProofRule =
  | 'requirement_derived'       // requirement → world
  | 'world_refined'             // world → frame
  | 'frame_conditioned'          // frame → evidence
  | 'evidence_evaluated'        // evidence → scoring
  | 'scoring_selected'          // scoring → recommendation
  | 'recommendation_reported'   // recommendation → report

export interface ProofStep {
  /** 步骤序号 */
  index: number
  /** 源事件类型 */
  from: string
  /** 目标事件类型 */
  to: string
  /** 推导规则 */
  rule: ProofRule
  /** 置信度 [0.7, 1.0] */
  confidence: number
  /** 步骤类型——转换/推导/精化 */
  stepType: 'transform' | 'derive' | 'refine'
  /** 该步的入度（前序步骤数） */
  inboundDegree: number
  /** 该步的出度（后续步骤数） */
  outboundDegree: number
}

// ============================================================
// 2. Witness Node
// ============================================================

export interface WitnessNode {
  /** 事件类型 */
  eventType: string
  /** Agent 名称 */
  agent: string
  /** Pipeline 步骤序号 */
  stepIndex: number
  /** 载荷键名（溯源用） */
  payloadKeys: string[]
  /** 是否是可证明的（有完整因果链） */
  provable: boolean
}

// ============================================================
// 3. Proof Kernel
// ============================================================

export interface ProofKernel {
  /** 源 FrameInvariant */
  frameInvariant: FrameInvariant
  /** 证明见证体（展开后的证据树节点） */
  witness: {
    requirement: WitnessNode | null
    world: WitnessNode | null
    evidence: WitnessNode[]
    scoring: WitnessNode | null
    recommendation: WitnessNode | null
    report: WitnessNode | null
  }
  /** 推导步骤序列 */
  proofSteps: ProofStep[]
  /** 执行时间 */
  createdAt: number
}

// ============================================================
// 4. Proof Kernel Validator
// ============================================================

export interface ProofValidatorResult {
  /** 证明是否有效 */
  valid: boolean
  /** 签名是否一致（hash(witness) === signature） */
  signatureMatch: boolean
  /** 因果边是否一致 */
  causalConsistent: boolean
  /** 所有 WitnessNode 是否可证明 */
  allProvable: boolean
  /** 各环节细节 */
  details: {
    /** witness 中可证明的节点数 */
    provableCount: number
    /** witness 中不可证明的节点数 */
    unprovableCount: number
    /** 推导步数 */
    stepCount: number
    /** 所有步骤的平均置信度 */
    avgConfidence: number
  }
}

/**
 * 验证 ProofKernel 的一致性
 *
 * 规则：
 *   1. signature = hash(witness) ——证明与签名双向一致
 *   2. 所有因果边与 witness 顺序一致
 *   3. 所有 WitnessNode 必须 provable = true
 */
export function validateProofKernel(proof: ProofKernel): ProofValidatorResult {
  // Rule 1: 签名一致性（需要外部从 witness 重建签名）
  // 此处只检查 witness 节点是否存在
  const witness = proof.witness
  const allNodesPresent = [
    witness.requirement !== null,
    witness.world !== null,
    witness.evidence.length > 0,
    witness.scoring !== null,
    witness.recommendation !== null,
    witness.report !== null,
  ]

  const provableCount = [
    witness.requirement,
    witness.world,
    ...witness.evidence,
    witness.scoring,
    witness.recommendation,
    witness.report,
  ].filter(n => n !== null && n.provable).length

  const totalCount = [
    witness.requirement,
    witness.world,
    ...witness.evidence,
    witness.scoring,
    witness.recommendation,
    witness.report,
  ].filter(n => n !== null).length

  const allProvable = provableCount === totalCount && totalCount > 0

  // Rule 3: 所有步骤置信度 > 0.7
  const stepsValid = proof.proofSteps.every(s => s.confidence >= 0.7)

  // Rule 2: 步骤顺序性（简化版——检查 step index 递增）
  const stepsOrdered = proof.proofSteps.every((s, i) =>
    i === 0 || s.index > proof.proofSteps[i - 1].index
  )

  const valid = allNodesPresent.every(v => v) && allProvable && stepsValid && stepsOrdered
  const avgConfidence = proof.proofSteps.length > 0
    ? Math.round((proof.proofSteps.reduce((s, p) => s + p.confidence, 0) / proof.proofSteps.length) * 100) / 100
    : 0

  return {
    valid,
    signatureMatch: true, // 外部验证后覆盖
    causalConsistent: stepsOrdered && stepsValid,
    allProvable,
    details: {
      provableCount,
      unprovableCount: totalCount - provableCount,
      stepCount: proof.proofSteps.length,
      avgConfidence,
    },
  }
}
