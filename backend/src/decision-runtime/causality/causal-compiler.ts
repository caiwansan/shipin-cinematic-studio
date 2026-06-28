/**
 * causal-compiler.ts — Phase A-0.7 Causal Link Builder
 *
 * ============================================================
 * Event Stream → Causal Graph 编译器
 * ============================================================
 *
 * 职责：将 A-0.6 产生的 Trace Event Stream 编译为最小因果图。
 *
 * 三阶段：
 *   1. index — 索引事件流
 *   2. link — 生成最小因果边
 *   3. validate — 验证因果图完整性
 *
 * 宪法约束：
 *   - 不改 Agent 逻辑
 *   - 不改 Telemetry
 *   - 只消费事件流 → 生成因果图
 *   - 不引入因果推断算法
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'
import { indexEvents, generateMinimalEdges, validateCausalEdges } from './event-indexer.js'
import type { CausalGraph } from './causal-types.js'

// ============================================================
// 1. Causal Compiler
// ============================================================

export class CausalCompiler {
  /**
   * 从 DecisionTrace 编译因果图
   *
   * 输入：原始 DecisionTrace（含事件流）
   * 输出：CausalGraph（含最小因果边 + 根/叶节点）
   */
  compile(trace: DecisionTrace): CausalGraph {
    const traceId = trace.traceId

    // Phase 1: 索引事件流
    const index = indexEvents(traceId, trace.events)

    // Phase 2: 生成最小因果边
    const edges = generateMinimalEdges(traceId, index.events)

    // Phase 3: 验证因果图完整性
    const validation = validateCausalEdges(edges, index.events)

    // 构造节点集合
    const nodeSet = new Set<string>()
    const rootEvents: string[] = []
    const leafEvents: string[] = []

    for (const ev of index.events) {
      nodeSet.add(ev.eventType)
    }

    const fromSet = new Set(edges.map(e => e.from.event))
    const toSet = new Set(edges.map(e => e.to.event))

    for (const ev of index.events) {
      if (!toSet.has(ev.eventType) && fromSet.has(ev.eventType)) {
        rootEvents.push(ev.eventType)
      }
      if (toSet.has(ev.eventType) && !fromSet.has(ev.eventType)) {
        leafEvents.push(ev.eventType)
      }
    }

    return {
      traceId,
      edges,
      nodes: nodeSet,
      rootEvents,
      leafEvents,
    }
  }

  /**
   * 验证因果图是否满足 B-0 Proof Engine 的最低要求
   */
  validateForProof(causalGraph: CausalGraph): {
    usable: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // 1. Frame 必须至少有 1 条 inbound 和 1 条 outbound
    const frameEdges = causalGraph.edges.filter(
      e => e.from.event === 'reasoning_frame_created' || e.to.event === 'reasoning_frame_created'
    )
    const frameInbound = frameEdges.filter(e => e.to.event === 'reasoning_frame_created').length
    const frameOutbound = frameEdges.filter(e => e.from.event === 'reasoning_frame_created').length
    if (frameInbound < 1) issues.push('Frame 无入边')
    if (frameOutbound < 1) issues.push('Frame 无出边')

    // 2. Evaluation 必须有 evidence → score 的边
    const evalEdge = causalGraph.edges.find(
      e => e.from.event === 'evidence_collected' && e.to.event === 'scoring_completed'
    )
    if (!evalEdge) issues.push('Evaluation 缺少 evidence → score 因果边')

    // 3. Decision 必须可回溯到 Frame + Evidence（路径长度 ≤ 3）
    const hasDecisionToReport = causalGraph.edges.find(
      e => e.from.event === 'recommendation_computed' && e.to.event === 'report_generated'
    )
    if (!hasDecisionToReport) issues.push('Decision 无到 Report 的因果边')

    return {
      usable: issues.length === 0,
      issues,
    }
  }
}

/**
 * 单例编译器实例
 */
export const causalCompiler = new CausalCompiler()
