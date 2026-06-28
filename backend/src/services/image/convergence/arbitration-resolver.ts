// ============================================================
// convergence/arbitration-resolver.ts
//
// 职责：D4 Arbitration Resolver
//   收集 context + conflicts + loss estimates，
//   最终裁决跨 domain 决策冲突，输出统一执行指令
//
// 核心仲裁逻辑：
//   1. 无冲突 → 通过所有 D2 决策
//   2. 有冲突 → 比较 accept loss vs retry loss → 选择损失更小的路径
//   3. 全局一致性严重影响 → 强制最差 domain 重试
//   4. 无法裁决 → escalate
//
// 输出：ArbitrationVerdict — 统一执行指令
// ============================================================

import type { DomainProposal, ArbiterContext, ArbitrationVerdict, SoftLossEstimate } from './types.js'
import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import { collectConflicts } from './conflict-collector.js'
import { estimateAcceptLoss, estimateRetryLoss } from './soft-loss-estimator.js'
import { getDomainWeights } from './context-selector.js'

// ─── 仲裁结果 ──────────────────────────────────────────

export interface ArbitrationResult {
  verdict: ArbitrationVerdict
  /** 仲裁后的执行建议 */
  executionProposal: {
    /** 应该怎么做 */
    action: 'accept' | 'retry' | 'regenerate' | 'escalate'
    /** 针对哪个 domain */
    targetDomain?: QualityDomain
    /** 如果有重试，用哪个 domain 的 retry policy */
    retryPolicy?: 'standard' | 'aggressive'
    /** 仲裁置信度 */
    confidence: number
  }
}

// ─── 仲裁器 ────────────────────────────────────────────

export class ArbitrationResolver {
  /**
   * 核心仲裁入口
   *
   * @param proposals  多 domain 的 D2 decision
   * @param context    当前制作上下文
   */
  resolve(
    proposals: DomainProposal[],
    context: ArbiterContext,
  ): ArbitrationResult {
    const timestamp = new Date().toISOString()

    // ── Step 1: 检测冲突 ──
    const report = collectConflicts(proposals)

    // ── Step 2: 无冲突 → 允许各自 D2 决策 ──
    if (report.conflicts.length === 0) {
      // 聚合最终动作：如果有任何一个 domains reject，整体 reject
      const allAccept = proposals.every(p => p.action.type === 'accept')

      if (allAccept) {
        const loss = estimateAcceptLoss(proposals, context)
        return {
          verdict: {
            decision: 'accept',
            originalDecisions: proposals,
            contextUsed: context,
            lossComparison: { accepted: loss, retried: loss },
            rationale: `无 domain 冲突，全局一致性 ${(report.globalConsistencyScore * 100).toFixed(0)}%，全部接受`,
            timestamp,
          },
          executionProposal: { action: 'accept', confidence: 0.95 },
        }
      }

      // 无冲突但有个别 reject：找最低分 domain 做 retry
      const worst = [...proposals].sort((a, b) => a.calibratedScore - b.calibratedScore)[0]
      return this.decideRetry(proposals, context, worst.domain, report.globalConsistencyScore, timestamp)
    }

    // ── Step 3: 有冲突 → 仲裁 ──
    const weights = getDomainWeights(context)

    // 找出权重最高的冲突 domain
    const weightedProposals = proposals
      .map(p => ({ ...p, weight: weights.weights[p.domain] ?? 0.5 }))
      .sort((a, b) => b.weight - a.weight)
    const highestWeightDomain = weightedProposals[0]

    // 估算损失
    const acceptLoss = estimateAcceptLoss(proposals, context)
    const retryLoss = estimateRetryLoss(proposals, context, highestWeightDomain.domain)

    // ── Step 4a: accept loss < retry loss → accept（即使有冲突）──
    if (acceptLoss.totalLoss < retryLoss.totalLoss) {
      const rationale = `仲裁：接受损失 (${acceptLoss.totalLoss}) < 重试损失 (${retryLoss.totalLoss})，即便存在 ${report.conflicts.length} 个冲突（${report.conflicts.map(c => c.type).join(', ')}）`
      return {
        verdict: {
          decision: 'accept',
          originalDecisions: proposals,
          contextUsed: context,
          lossComparison: { accepted: acceptLoss, retried: retryLoss },
          rationale,
          timestamp,
        },
        executionProposal: {
          action: 'accept',
          confidence: Math.max(0.4, 1 - acceptLoss.totalLoss),
        },
      }
    }

    // ── Step 4b: 重试损失 < 接受损失 → 重试 ──
    const rationale = `仲裁：重试损失 (${retryLoss.totalLoss}) < 接受损失 (${acceptLoss.totalLoss})，优先重试 ${highestWeightDomain.domain}（当前权重最高 domain）`
    return {
      verdict: {
        decision: 'retry',
        overrideDomain: highestWeightDomain.domain,
        originalDecisions: proposals,
        contextUsed: context,
        lossComparison: { accepted: acceptLoss, retried: retryLoss },
        rationale,
        timestamp,
      },
      executionProposal: {
        action: 'retry',
        targetDomain: highestWeightDomain.domain,
        retryPolicy: context.riskMode === 'conservative' ? 'aggressive' : 'standard',
        confidence: Math.max(0.3, retryLoss.expectedGain),
      },
    }
  }

  /**
   * 决定重试：专精版
   */
  private decideRetry(
    proposals: DomainProposal[],
    context: ArbiterContext,
    targetDomain: QualityDomain,
    globalConsistencyScore: number,
    timestamp: string,
  ): ArbitrationResult {
    const acceptLoss = estimateAcceptLoss(proposals, context)
    const retryLoss = estimateRetryLoss(proposals, context, targetDomain)

    if (acceptLoss.totalLoss < retryLoss.totalLoss && globalConsistencyScore > 0.6) {
      return {
        verdict: {
          decision: 'accept',
          originalDecisions: proposals,
          contextUsed: context,
          lossComparison: { accepted: acceptLoss, retried: retryLoss },
          rationale: `无冲突但有低分 domain：接受损失 (${acceptLoss.totalLoss}) < 重试损失 (${retryLoss.totalLoss})，全局一致性 ${(globalConsistencyScore * 100).toFixed(0)}%，接受`,
          timestamp,
        },
        executionProposal: { action: 'accept', confidence: 0.8 },
      }
    }

    return {
      verdict: {
        decision: 'retry',
        overrideDomain: targetDomain,
        originalDecisions: proposals,
        contextUsed: context,
        lossComparison: { accepted: acceptLoss, retried: retryLoss },
        rationale: `无冲突但有低分 domain：重试 ${targetDomain}`,
        timestamp,
      },
      executionProposal: {
        action: 'retry',
        targetDomain,
        retryPolicy: 'standard',
        confidence: Math.max(0.4, retryLoss.expectedGain),
      },
    }
  }
}
