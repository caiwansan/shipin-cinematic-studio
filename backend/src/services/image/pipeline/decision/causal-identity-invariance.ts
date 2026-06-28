// ============================================================
// decision/causal-identity-invariance.ts
//
// 职责：Causal Identity Invariance (CII) — Phase 4.10
//   在 trajectory identity 之上叠加因果同一性验证
//
// 核心问题：
//   系统可能「看起来是同一个系统」（trajectory stable），
//   但内部因果路径已经重组（graph lane 换道 / bias 漂移）
//
// 三层同一性：
//   L1 Trajectory — attractor + drift + radius（已由 Phase Portrait 覆盖）
//   L2 Structural — DOL mode 分布、lockedNodes 模式、fusion 裁决结构
//   L3 Causal     — 相同输入 → 相同因果推理路径分布
//
// 设计原则：
//   - 纯观测层（不改变 D2 / DOL / DIE）
//   - 消费 ctx.telemetry 中已有的 dcvl / dsb / die 数据
//   - CII report 输出 identity_confidence: 0-1
// ============================================================

import type { ConsistencyReport } from './decision-consistency-validation.js'
import type { DirectorIntent, IntentType } from './director-intent-engine.js'
import type { CanonicalMode } from './decision-ontology-layer.js'

// ─── 因果路径指纹 ──────────────────────────────────────

export interface CausalPathFingerprint {
  /** 指纹类型 */
  type: 'single' | 'dual' | 'graph-only'
  /** DOL mode */
  canonicalMode: CanonicalMode
  /** fusion 裁决方式 */
  fusionResolution: 'agreement' | 'mode-priority' | 'blocked'
  /** 结果意图 */
  intent: IntentType
}

// ─── 结构同构报告 ──────────────────────────────────────

export interface StructuralIsomorphism {
  /** mode 指纹分布（最近 20 次） */
  modeDistribution: Record<string, number>
  /** intent 指纹分布 */
  intentDistribution: Record<string, number>
  /** 拓扑熵（mode 多样性，越低越稳定，但太低可能僵化） */
  topologicalEntropy: number
}

// ─── 因果同一性报告 ────────────────────────────────────

export interface CausalIdentityReport {
  /** L2 结构同构 */
  structural: StructuralIsomorphism
  /** L3 因果路径一致性 */
  causalPathConsistency: number   // 0-1
  /** 综合同一性置信度 */
  identityConfidence: number      // 0-1
  /** 告警 */
  alerts: string[]
  /** 可读摘要 */
  summary: string
}

// ─── 熵计算 ────────────────────────────────────────────

function entropy(values: string[]): number {
  if (values.length === 0) return 0
  const freq = new Map<string, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  let H = 0
  const n = values.length
  for (const count of freq.values()) {
    const p = count / n
    H -= p * Math.log2(p)
  }
  return H
}

// ─── CII 引擎 ──────────────────────────────────────────

export class CausalIdentityLayer {
  private fingerprints: CausalPathFingerprint[] = []
  private readonly MAX_HISTORY = 50

  /**
   * 记录一次决策的因果路径指纹
   */
  record(
    consistency: ConsistencyReport,
    intent: DirectorIntent,
    fusionResolution: 'agreement' | 'mode-priority' | 'blocked',
  ): void {
    // 从 consistency report 推断 canonical mode（简化：从 collision 信号反推）
    let canonicalMode = 'SCORE_CONFIRMED' as CanonicalMode
    if (consistency.ontologyHealth.collapsed) canonicalMode = 'FALLBACK' as CanonicalMode
    else if (consistency.forcedDecisionAudit.blocked > 0) canonicalMode = 'BLOCKED' as CanonicalMode
    else if (consistency.forcedDecisionAudit.forced > 0) canonicalMode = 'PATH_FORCED' as CanonicalMode
    else if (consistency.divergenceRate > 0.3) canonicalMode = 'PATH_PREFERRED' as CanonicalMode

    // 推断路径类型
    const pathType = consistency.forcedDecisionAudit.total >= 2
      ? 'dual'
      : consistency.forcedDecisionAudit.total === 1
        ? 'single'
        : 'graph-only' as CausalPathFingerprint['type']

    this.fingerprints.push({
      type: pathType,
      canonicalMode: canonicalMode as CanonicalMode,
      fusionResolution,
      intent: intent.primary,
    })

    if (this.fingerprints.length > this.MAX_HISTORY) {
      this.fingerprints = this.fingerprints.slice(-this.MAX_HISTORY)
    }
  }

  /**
   * 生成因果同一性报告
   */
  generateReport(): CausalIdentityReport {
    const total = this.fingerprints.length
    const alerts: string[] = []

    if (total === 0) {
      return {
        structural: { modeDistribution: {}, intentDistribution: {}, topologicalEntropy: 0 },
        causalPathConsistency: 0,
        identityConfidence: 0,
        alerts: ['无数据'],
        summary: '[CII] 无数据',
      }
    }

    // ── L2: Structural ──

    const modes = this.fingerprints.map(f => f.canonicalMode)
    const modeDist: Record<string, number> = {}
    for (const m of modes) modeDist[m] = (modeDist[m] ?? 0) + 1

    const intentValues = this.fingerprints.map(f => f.intent)
    const intentDist: Record<string, number> = {}
    for (const i of intentValues) intentDist[i] = (intentDist[i] ?? 0) + 1

    const topoEntropy = Math.round(entropy(modes) * 1000) / 1000

    // L2 异常检测
    if (topoEntropy < 0.3 && total > 10) {
      alerts.push(`模式过度收敛: topo_entropy=${topoEntropy}（可能僵化）`)
    }
    if (topoEntropy > 1.5 && total > 10) {
      alerts.push(`模式过度发散: topo_entropy=${topoEntropy}（可能不稳定）`)
    }

    // ── L3: Causal ──

    // 因果一致性 = 最近 10 次指纹的类型稳定性
    const recent = this.fingerprints.slice(-10)
    const identical = recent.filter(
      f => f.type === recent[0].type && f.canonicalMode === recent[0].canonicalMode && f.fusionResolution === recent[0].fusionResolution
    ).length
    const causalConsistency = Math.round((identical / Math.max(1, recent.length)) * 100) / 100

    if (causalConsistency < 0.5) {
      alerts.push(`因果路径不一致: consistency=${(causalConsistency * 100).toFixed(0)}%`)
    }

    // ⚠️ 关键告警：trajectory stable 但因果路径已变
    const modeCollapsed = topoEntropy < 0.3
    if (modeCollapsed && recent.length >= 5) {
      const recentModes = recent.map(f => f.canonicalMode)
      const uniqueModes = new Set(recentModes).size
      if (uniqueModes <= 1) {
        alerts.push(`【关键】轨迹稳定但因果路径已坍缩为单模式（${recentModes[0]}）`)
      }
    }

    // ── 综合置信度 ──

    // 结构分：topo entropy 接近 0.5-1.0 为健康
    const structureScore = Math.max(0, 1 - Math.abs(topoEntropy - 0.7) * 1.5)
    // 因果分：越高越好
    const causalScore = causalConsistency
    // 多样性惩罚：有一种模式占 > 80% 减分
    const dominantModeRatio = Math.max(...Object.values(modeDist)) / total
    const diversityPenalty = dominantModeRatio > 0.8 ? 0.1 : 0

    const identityConfidence = Math.round(
      (structureScore * 0.3 + causalScore * 0.5 + (1 - diversityPenalty) * 0.2) * 100
    ) / 100

    if (identityConfidence < 0.5) {
      alerts.push(`综合同一性置信度低: ${(identityConfidence * 100).toFixed(0)}%`)
    }

    return {
      structural: {
        modeDistribution: modeDist,
        intentDistribution: intentDist,
        topologicalEntropy: topoEntropy,
      },
      causalPathConsistency: causalConsistency,
      identityConfidence,
      alerts,
      summary: this.buildSummary(identityConfidence, topoEntropy, causalConsistency, alerts),
    }
  }

  /**
   * 获取原始指纹（供 Phase Portrait 消费）
   */
  getFingerprints(): CausalPathFingerprint[] {
    return [...this.fingerprints]
  }

  private buildSummary(
    confidence: number,
    topoEntropy: number,
    causalConsistency: number,
    alerts: string[],
  ): string {
    const statusLabel = confidence >= 0.7 ? '✅' : confidence >= 0.5 ? '⚠️' : '🔴'
    const alertText = alerts.length > 0 ? ` | ${alerts.join('; ')}` : ''
    return `[CII] ${statusLabel} identity=${(confidence * 100).toFixed(0)}% entropy=${topoEntropy.toFixed(2)} causal=${(causalConsistency * 100).toFixed(0)}%${alertText}`
  }

  reset(): void {
    this.fingerprints = []
  }
}
