// ============================================================
// convergence/index.ts
//
// 职责：D4 Convergence Arbiter — 统一入口
//   暴露唯一的 `arbitrate()` 函数
//   在 pipeline 的 decision 阶段之后调用
//
// 调用链：
//   D2 Decision (per domain) →
//   D4 Arbitration (cross domain) →
//   Final execution action
// ============================================================

import { ArbitrationResolver } from './arbitration-resolver.js'
import type { DomainProposal, ArbiterContext, ArbitrationVerdict } from './types.js'

export type { DomainProposal, ArbiterContext, ArbitrationVerdict }
export { ArbitrationResolver }
export { collectConflicts } from './conflict-collector.js'
export { getDomainWeights } from './context-selector.js'
export { estimateAcceptLoss, estimateRetryLoss } from './soft-loss-estimator.js'

/**
 * D4 仲裁入口 — 最简调用
 *
 * @param proposals  多 domain 的 D2 决策
 * @param context    当前制作上下文
 */
export function arbitrate(
  proposals: DomainProposal[],
  context: ArbiterContext,
) {
  const resolver = new ArbitrationResolver()
  return resolver.resolve(proposals, context)
}
