/**
 * witness-builder.ts — Phase B-1 Proof Kernel
 *
 * ============================================================
 * Witness Reconstruction Engine
 * ============================================================
 *
 * 职责：从 FrameInvariant + Trace Event + CausalGraph
 * 重构可验证的 Proof Witness Tree。
 *
 * 不是"重新执行"——只是"从已有数据反构造"。
 *
 * 宪法约束：
 *   1. 不调用任何 Agent
 *   2. 不执行任何决策逻辑
 *   3. 只从已有数据重构
 *   4. 每个 WitnessNode 必须声明是否可证明
 */

import type { DecisionTrace } from '../../telemetry/decision-trace.js'
import type { CausalGraph as CausalGraphType } from '../../causality/causal-types.js'
import type { FrameInvariant } from '../../frame/frame-invariant.js'
import type { WitnessNode } from './proof-kernel.js'

// ============================================================
// 1. Witness Builder
// ============================================================

export class WitnessBuilder {
  /**
   * 从 FrameInvariant + Trace + CausalGraph 重构 Witness
   */
  build(
    frameInvariant: FrameInvariant,
    trace: DecisionTrace,
    causalGraph: CausalGraphType,
  ): {
    witness: {
      requirement: WitnessNode | null
      world: WitnessNode | null
      evidence: WitnessNode[]
      scoring: WitnessNode | null
      recommendation: WitnessNode | null
      report: WitnessNode | null
    }
    proofSteps: ReturnType<typeof buildProofSteps>
  } {
    // Step 1: 从事件流重构每个 WitnessNode
    const requirement = this.reconstructNode(trace, 'requirement_analyzed')
    const world = this.reconstructNode(trace, 'world_view_constructed')
    const evidence = this.reconstructAllNodes(trace, 'evidence_collected')
    const scoring = this.reconstructNode(trace, 'scoring_completed')
    const recommendation = this.reconstructNode(trace, 'recommendation_computed')
    const report = this.reconstructNode(trace, 'report_generated')

    // Step 2: 检查每个节点是否有因果边连接（可证明性）
    const nodes = {
      requirement: markProvable(requirement, causalGraph),
      world: markProvable(world, causalGraph),
      evidence: evidence.map(n => markProvable(n, causalGraph)),
      scoring: markProvable(scoring, causalGraph),
      recommendation: markProvable(recommendation, causalGraph),
      report: markProvable(report, causalGraph),
    }

    // Step 3: 从因果图构建证明步骤
    const proofSteps = buildProofSteps(causalGraph)

    return {
      witness: nodes,
      proofSteps,
    }
  }

  /**
   * 从 Trace 事件流中重构单个节点
   */
  private reconstructNode(trace: DecisionTrace, eventType: string): WitnessNode | null {
    const event = trace.events.find(e => e.eventType === eventType)
    if (!event) return null

    const stepIndex = trace.events.indexOf(event)

    return {
      eventType,
      agent: event.agentName,
      stepIndex,
      payloadKeys: Object.keys(event.payload ?? {}),
      provable: false, // 在 markProvable 中更新
    }
  }

  /**
   * 从 Trace 事件流中重构所有同类节点
   */
  private reconstructAllNodes(trace: DecisionTrace, eventType: string): WitnessNode[] {
    return trace.events
      .filter(e => e.eventType === eventType)
      .map(event => {
        const stepIndex = trace.events.indexOf(event)
        return {
          eventType,
          agent: event.agentName,
          stepIndex,
          payloadKeys: Object.keys(event.payload ?? {}),
          provable: false,
        }
      })
  }
}

/**
 * 标记节点是否可证明（有因果边连接）
 */
function markProvable(node: WitnessNode | null, causalGraph: CausalGraphType): WitnessNode | null {
  if (!node) return null
  const hasCausalEdge = causalGraph.edges.some(
    e => e.from.event === node.eventType || e.to.event === node.eventType
  )
  return { ...node, provable: hasCausalEdge }
}

// ============================================================
// 2. Proof Steps Builder
// ============================================================

import type { ProofStep, ProofRule } from './proof-kernel.js'

const EVENT_TO_RULE: Record<string, Record<string, ProofRule>> = {
  requirement_analyzed: {
    world_view_constructed: 'requirement_derived',
    reasoning_frame_created: 'requirement_derived',
  },
  world_view_constructed: {
    reasoning_frame_created: 'world_refined',
  },
  reasoning_frame_created: {
    evidence_collected: 'frame_conditioned',
  },
  evidence_collected: {
    scoring_completed: 'evidence_evaluated',
  },
  scoring_completed: {
    recommendation_computed: 'scoring_selected',
  },
  recommendation_computed: {
    report_generated: 'recommendation_reported',
    decision_completed: 'recommendation_reported',
  },
}

export function buildProofSteps(causalGraph: CausalGraphType): ProofStep[] {
  return causalGraph.edges.map((edge, index) => {
    const ruleMap = EVENT_TO_RULE[edge.from.event]
    const rule = ruleMap?.[edge.to.event] ?? 'requirement_derived'

    // 推导 stepType
    let stepType: 'transform' | 'derive' | 'refine'
    if (edge.relation === 'derives') stepType = 'derive'
    else if (edge.relation === 'refines') stepType = 'refine'
    else stepType = 'transform'

    // 入度/出度
    const inboundDegree = causalGraph.edges.filter(e => e.to.event === edge.to.event).length
    const outboundDegree = causalGraph.edges.filter(e => e.from.event === edge.from.event).length

    return {
      index: index + 1,
      from: edge.from.event,
      to: edge.to.event,
      rule,
      confidence: edge.confidence,
      stepType,
      inboundDegree,
      outboundDegree,
    }
  })
}

/**
 * 单例 Builder
 */
export const witnessBuilder = new WitnessBuilder()
