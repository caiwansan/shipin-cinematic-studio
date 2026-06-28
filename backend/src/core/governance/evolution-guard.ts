/**
 * P7-GOV — EvolutionGuard（进化闸门）
 *
 * 所有 P7 进化操作必须通过此闸门。
 * 检查策略符合性后才允许应用。
 *
 * ═══ 宪法 ═══
 * PatternLearner → EvolutionGuard → Apply（禁止绕过）
 * 任何被拒绝的进化必须有日志记录。
 */

import { policyEngine } from './policy-engine.js'
import { learningAuditLog } from './learning-audit-log.js'

export interface EvolutionProposal {
  type: 'weight_adjustment' | 'cluster_scaling' | 'routing_policy'
  capability?: string
  previousValue: any
  proposedValue: any
  reason: string
  triggeredBy: string
}

export interface EvolutionDecision {
  approved: boolean
  proposal: EvolutionProposal
  violations: string[]
  timestamp: number
}

class EvolutionGuard {
  private totalProposals = 0
  private rejectedCount = 0

  /**
   * 审核进化提案
   */
  async review(proposal: EvolutionProposal): Promise<EvolutionDecision> {
    this.totalProposals++
    const violations: string[] = []

    // 1. 权重调整检查
    if (proposal.type === 'weight_adjustment') {
      const weightViolation = policyEngine.checkWeightChange(
        proposal.previousValue,
        proposal.proposedValue,
        proposal.type,
      )
      if (weightViolation) violations.push(weightViolation.rule + ': ' + weightViolation.actual)
    }

    // 2. 集群扩缩检查
    if (proposal.type === 'cluster_scaling') {
      if (proposal.proposedValue > policyEngine.getPolicy().maxClusterNodes) {
        violations.push(`maxClusterNodes: 提议 ${proposal.proposedValue} > 上限 ${policyEngine.getPolicy().maxClusterNodes}`)
      }
    }

    const approved = violations.length === 0

    // 3. 记录审计
    await learningAuditLog.record({
      timestamp: Date.now(),
      type: proposal.type,
      capability: proposal.capability,
      previousValue: proposal.previousValue,
      proposedValue: proposal.proposedValue,
      reason: proposal.reason,
      approved,
      violations,
    })

    if (!approved) {
      this.rejectedCount++
      console.warn(`[EvolutionGuard] ❌ 拒绝进化: ${proposal.type} (${violations.join('; ')})`)
    } else {
      console.log(`[EvolutionGuard] ✅ 批准进化: ${proposal.type}`)
    }

    return { approved, proposal, violations, timestamp: Date.now() }
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      totalProposals: this.totalProposals,
      rejectedCount: this.rejectedCount,
      approveRate: this.totalProposals > 0 ? (this.totalProposals - this.rejectedCount) / this.totalProposals : 1,
    }
  }
}

export const evolutionGuard = new EvolutionGuard()
