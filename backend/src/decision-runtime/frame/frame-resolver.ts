/**
 * frame-resolver.ts — Phase A-0.8 Proof Invariant Compression
 *
 * ============================================================
 * Frame Resolver（核心）
 * ============================================================
 *
 * 职责：从事件流 + 因果图 → FrameInvariant（不可变证明对象）
 *
 * 这层不是"改造"Frame，而是"压缩"Frame 的生成路径
 * 为不可分割的证明原子。
 *
 * 宪法约束：
 *   1. 不改 Agent 输出
 *   2. 不改 Event 结构
 *   3. 只读取事件 → 构造 Invariant
 *   4. Invariant 一旦构造，不可修改
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { CausalGraph } from '../causality/causal-types.js'
import type { FrameInvariant } from './frame-invariant.js'
import { computeFrameSignature, deriveEquivalenceClass } from './frame-invariant.js'

// ============================================================
// 1. Frame Resolver
// ============================================================

export class FrameResolver {
  /**
   * 从 DecisionTrace 和 CausalGraph 解析 FrameInvariant
   *
   * 步骤：
   *   1. 从事件中提取 FrameEvent
   *   2. 跟踪 lineage（requirement → world → evidence → scoring）
   *   3. 计算确定性签名
   *   4. 推导等价类标识
   */
  resolve(trace: DecisionTrace, causalGraph: CausalGraph): FrameInvariant {
    // Step 1: 定位 frame_created 事件
    const frameEvent = trace.events.find(e => e.eventType === 'reasoning_frame_created')
    const frameId = frameEvent?.payload?.frameId
      ? String(frameEvent.payload.frameId)
      : `frame_${trace.traceId}`

    // Step 2: 提取 lineage 输入
    const lineage = this.extractLineage(trace)

    // Step 3: 计算签名
    const signature = computeFrameSignature({
      requirementClass: String(lineage.requirement),
      worldViewClass: String(lineage.world),
      evidenceSet: lineage.evidence,
      scoringOrder: String(lineage.scoring),
    })

    // Step 4: 推导等价类
    const causalSpan = causalGraph.edges.map(e => `${e.from.event}→${e.to.event}`)
    const equivalenceClass = deriveEquivalenceClass(causalSpan)

    return {
      frameId,
      signature,
      lineage: {
        requirement: String(lineage.requirement),
        world: String(lineage.world),
        evidence: lineage.evidence,
        scoring: String(lineage.scoring),
      },
      causalSpan,
      equivalenceClass,
      stable: true,
    }
  }

  /**
   * 从事件流中提取 lineage 信息
   */
  private extractLineage(trace: DecisionTrace): {
    requirement: string
    world: string
    evidence: string[]
    scoring: string
  } {
    const reqEvent = trace.events.find(e => e.eventType === 'requirement_analyzed')
    const worldEvent = trace.events.find(e => e.eventType === 'world_view_constructed')
    const evidenceEvents = trace.events.filter(e => e.eventType === 'evidence_collected')
    const scoreEvent = trace.events.find(e => e.eventType === 'scoring_completed')

    return {
      requirement: reqEvent?.payload?.domain
        ? String(reqEvent.payload.domain)
        : 'unknown',
      world: worldEvent?.payload?.completeness
        ? `world_${String(worldEvent.payload.completeness)}`
        : 'unknown',
      evidence: evidenceEvents.map((_, i) => `evidence_${i}`),
      scoring: scoreEvent?.payload?.scores
        ? 'scored'
        : 'unknown',
    }
  }

  /**
   * 比较两个 FrameInvariant 是否等价
   *
   * 等价判定唯一依据：signature 相等
   * 不需要扰动验证，不需要图同构检查
   */
  areEquivalent(a: FrameInvariant, b: FrameInvariant): boolean {
    return a.signature === b.signature
  }
}

/**
 * 单例 Resolver
 */
export const frameResolver = new FrameResolver()
