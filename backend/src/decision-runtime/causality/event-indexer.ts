/**
 * event-indexer.ts — Phase A-0.7 Causal Link Builder
 *
 * ============================================================
 * Event Stream 索引器
 * ============================================================
 *
 * 职责：按 traceId 收集事件，按 step 顺序排序，提取最小依赖键。
 *
 * 规则：
 *   1. 只连接相邻或语义依赖节点（禁止全连接）
 *   2. 每个事件已知其 Pipeline stepIndex（由 TelemetryHook 注入）
 *   3. 入度为 0 的事件 = 该 trace 的根事件
 *   4. 出度为 0 的事件 = 该 trace 的叶子事件
 *
 * 宪法约束：
 *   - 不改事件 payload
 *   - 不改事件顺序
 *   - 不进行任何因果推断——只建立"执行先后"的拓扑关系
 */

import type { CausalEdge, CausalRelation } from './causal-types.js'

// ============================================================
// 1. 事件索引结构
// ============================================================

export interface IndexedEvent {
  /** 事件类型 */
  eventType: string
  /** Agent 名称 */
  agentName: string
  /** Pipeline 步骤（由 TelemetryHook.stepIndex 注入） */
  stepIndex: number
  /** 简化的 payload 键名（用于判断依赖关系） */
  payloadKeys: string[]
}

/**
 * 事件索引——按 stepIndex 排序的事件列表
 */
export interface EventIndex {
  traceId: string
  events: IndexedEvent[]
  rawEventCount: number
  indexedAt: number
}

// ============================================================
// 2. 事件索引器
// ============================================================

/**
 * 将原始 Trace 事件流索引为按 step 排序的事件表
 */
export function indexEvents(
  traceId: string,
  rawEvents: Array<{ eventType: string; agentName: string; payload?: Record<string, unknown>; ts?: number }>,
): EventIndex {
  const events: IndexedEvent[] = rawEvents.map((e, idx) => ({
    eventType: e.eventType,
    agentName: e.agentName ?? 'unknown',
    stepIndex: idx, // 事件在数组中的位置 = 自然执行顺序
    payloadKeys: Object.keys(e.payload ?? {}),
  }))

  return {
    traceId,
    events,
    rawEventCount: rawEvents.length,
    indexedAt: Date.now(),
  }
}

// ============================================================
// 3. 最小因果边生成（基于默认关系映射）
// ============================================================

const DEFAULT_CAUSAL_MAP: Record<string, Record<string, { relation: CausalRelation; confidence: number }>> = {
  requirement_analyzed: {
    world_view_constructed: { relation: 'derives', confidence: 0.95 },
    reasoning_frame_created: { relation: 'derives', confidence: 0.95 },
  },
  world_view_constructed: {
    reasoning_frame_created: { relation: 'refines', confidence: 0.9 },
  },
  reasoning_frame_created: {
    evidence_collected: { relation: 'conditions', confidence: 0.9 },
  },
  evidence_collected: {
    scoring_completed: { relation: 'evaluates', confidence: 0.9 },
  },
  scoring_completed: {
    recommendation_computed: { relation: 'selects', confidence: 0.85 },
  },
  recommendation_computed: {
    report_generated: { relation: 'derives', confidence: 0.95 },
    decision_completed: { relation: 'derives', confidence: 0.95 },
  },
}

/**
 * 基于索引和默认关系映射生成最小因果边
 *
 * 规则：只生成相邻事件之间的边，且只生成有映射关系的事件对。
 *   - 有映射 → 使用映射中的 relation + confidence
 *   - 无映射 → 跳过（保留自然顺序但不建立因果断言）
 */
export function generateMinimalEdges(
  traceId: string,
  indexedEvents: IndexedEvent[],
): CausalEdge[] {
  const edges: CausalEdge[] = []

  for (let i = 0; i < indexedEvents.length; i++) {
    const current = indexedEvents[i]
    const next = indexedEvents[i + 1]
    if (!next) break

    // 检查是否有预定义的因果映射
    const fromMap = DEFAULT_CAUSAL_MAP[current.eventType]
    if (!fromMap) continue

    const causalDef = fromMap[next.eventType]
    if (!causalDef) continue

    edges.push({
      traceId,
      from: {
        event: current.eventType,
        agent: current.agentName,
        stepIndex: current.stepIndex,
      },
      to: {
        event: next.eventType,
        agent: next.agentName,
        stepIndex: next.stepIndex,
      },
      relation: causalDef.relation,
      confidence: causalDef.confidence,
    })
  }

  return edges
}

// ============================================================
// 4. 验证条件
// ============================================================

/**
 * 验证因果图完整性
 */
export function validateCausalEdges(edges: CausalEdge[], allEvents: IndexedEvent[]): {
  valid: boolean
  orphanEvents: IndexedEvent[]
  rootEvents: IndexedEvent[]
  leafEvents: IndexedEvent[]
  issues: string[]
} {
  const eventTypes = new Set(allEvents.map(e => e.eventType))
  const fromSet = new Set(edges.map(e => e.from.event))
  const toSet = new Set(edges.map(e => e.to.event))

  const orphanEvents: IndexedEvent[] = []
  const rootEvents: IndexedEvent[] = []
  const leafEvents: IndexedEvent[] = []
  const issues: string[] = []

  for (const ev of allEvents) {
    const hasInbound = toSet.has(ev.eventType)
    const hasOutbound = fromSet.has(ev.eventType)

    if (!hasInbound && !hasOutbound) {
      orphanEvents.push(ev)
      issues.push(`孤儿事件: ${ev.eventType}`)
    }
    if (!hasInbound && hasOutbound) {
      rootEvents.push(ev)
    }
    if (hasInbound && !hasOutbound) {
      leafEvents.push(ev)
    }
  }

  return {
    valid: orphanEvents.length === 0,
    orphanEvents,
    rootEvents,
    leafEvents,
    issues,
  }
}
