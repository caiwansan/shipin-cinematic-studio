// ============================================================
// convergence/soft-loss-estimator.ts
//
// 职责：D4 Soft Loss Estimator
//   轻量启发式损失计算，不做 full reward model
//   核心逻辑：用 context 和 domain weight 估算"接受"vs"重试"的预期损失
//
// 损失维度：
//   - qualityLoss：接受低 quality 带来的损失
//   - driftLoss：跨 domain 一致性损失
//   - temporalLoss：时序断裂损失
//   - costLoss：重试的成本
//
// 设计原则：
//   - 所有估值在 0-1 之间
//   - 只用现有数据（无需训练/预定义 reward）
//   - 可组合：不同 phase 对各维度的敏感度不同
// ============================================================

import type { DomainProposal, ArbiterContext, SoftLossEstimate } from './types.js'
import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import { getDomainWeights } from './context-selector.js'

// ─── 成本系数 ──────────────────────────────────────────

const RETRY_COST_BY_DOMAIN: Record<QualityDomain, number> = {
  character: 0.6,      // 角色重试成本中等（4 张图）
  scene: 0.4,          // 场景成本最低（1 张图）
  storyboard: 0.3,     // 分镜成本低（多帧中仅 1 帧）
  frame: 0.2,
  video: 0.9,          // 视频重试成本最高
}

// ─── 损失估算 ──────────────────────────────────────────

export function estimateAcceptLoss(
  proposals: DomainProposal[],
  context: ArbiterContext,
): SoftLossEstimate {
  const weights = getDomainWeights(context)

  // qualityLoss：加权平均的（1 - score）
  let qualityLossSum = 0
  let weightSum = 0
  for (const prop of proposals) {
    const w = weights.weights[prop.domain] ?? 0.5
    qualityLossSum += (1 - prop.calibratedScore) * w
    weightSum += w
  }
  const qualityLoss = weightSum > 0 ? qualityLossSum / weightSum : 0.5

  // driftLoss：domain 评分方差（方差越大 = 一致性越差）
  const scores = proposals.map(p => p.calibratedScore)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  const driftLoss = Math.min(1, Math.sqrt(variance))

  // temporalLoss：基于 generationIndex 的退火损失
  // 生成越靠后，容忍度越低（因为前面的质量在积累）
  const temporalDecay = Math.min(1, context.generationIndex / 20)
  const temporalLoss = (1 - qualityLoss) * temporalDecay * 0.3

  // costLoss：如果这就是接受，不花额外成本
  const costLoss = 0

  const totalLoss = Math.min(1,
    qualityLoss * 0.5 +
    driftLoss * 0.25 +
    temporalLoss * 0.15 +
    costLoss * 0.1
  )

  // 重试预期收益
  const expectedGain = Math.max(0, (1 - totalLoss) * 0.7)

  return {
    totalLoss: Math.round(totalLoss * 100) / 100,
    breakdown: {
      qualityLoss: Math.round(qualityLoss * 100) / 100,
      driftLoss: Math.round(driftLoss * 100) / 100,
      temporalLoss: Math.round(temporalLoss * 100) / 100,
      costLoss: Math.round(costLoss * 100) / 100,
    },
    expectedGain: Math.round(expectedGain * 100) / 100,
  }
}

export function estimateRetryLoss(
  proposals: DomainProposal[],
  context: ArbiterContext,
  retryTarget: QualityDomain,
): SoftLossEstimate {
  const weights = getDomainWeights(context)

  // 如果不重试，质量损失同上
  const acceptLoss = estimateAcceptLoss(proposals, context)

  // costLoss：重试的经济成本
  const costLoss = RETRY_COST_BY_DOMAIN[retryTarget] ?? 0.5

  // qualityLoss：重试对目标 domain 的预期质量提升
  const targetWeight = weights.weights[retryTarget] ?? 0.5
  const qualityLoss = Math.max(0, acceptLoss.breakdown.qualityLoss - targetWeight * 0.2)

  // driftLoss：重试可能降低跨 domain 一致性
  const driftLoss = Math.min(1, acceptLoss.breakdown.driftLoss + 0.1)

  // temporalLoss：重试花费时间，可能产生时序断裂
  const temporalLoss = Math.min(1, acceptLoss.breakdown.temporalLoss + 0.15)

  const totalLoss = Math.min(1,
    qualityLoss * 0.35 +
    driftLoss * 0.25 +
    temporalLoss * 0.15 +
    costLoss * 0.25       // 重试成本权重上升
  )

  // 重试预期收益：接受损失 - 重试总损失
  const expectedGain = Math.max(0, acceptLoss.totalLoss - totalLoss)

  return {
    totalLoss: Math.round(totalLoss * 100) / 100,
    breakdown: {
      qualityLoss: Math.round(qualityLoss * 100) / 100,
      driftLoss: Math.round(driftLoss * 100) / 100,
      temporalLoss: Math.round(temporalLoss * 100) / 100,
      costLoss: Math.round(costLoss * 100) / 100,
    },
    expectedGain: Math.round(expectedGain * 100) / 100,
  }
}
