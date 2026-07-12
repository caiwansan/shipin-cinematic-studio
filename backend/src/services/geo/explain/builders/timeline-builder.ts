// ============================================================
// TimelineBuilder — ExecutionEvent → ExplainSection (timeline)
//
// 纯转换：只做 Event → Item 映射，不推理。
// 不计算 duration / critical path / success rate。
//
// 输入：ExecutionEvent[]
// 输出：ExplainSection (type: 'timeline')
//
// 约束：
//   - 不修改 execution/ 已冻结文件（ADR-003/004）
//   - 不修改 explain-document.ts / builder.ts（ADR-001）
//   - TimelineBuilder 独立，不作为 Provider 的方法
//   - 继续使用既有的 'timeline' ExplainSectionType
// ============================================================

import type { ExecutionEvent } from '../../execution/types.js'
import type { ExplainSection, ExplainItem } from '../explain-document.js'

/**
 * 事件类型 → 可读标签映射
 */
const EVENT_LABELS: Record<string, string> = {
  node_queued: 'Node Queued',
  node_started: 'Node Started',
  node_completed: 'Node Completed',
  node_retry: 'Node Retry',
  node_failed: 'Node Failed',
  node_timeout: 'Node Timeout',
  node_fallback: 'Fallback Triggered',
  node_dead_lettered: 'Dead Lettered',
  graph_started: 'Execution Started',
  graph_completed: 'Execution Completed',
  graph_failed: 'Execution Failed',
  breaker_open: 'Circuit Breaker Opened',
  breaker_half_open: 'Circuit Breaker Half-Open',
  breaker_closed: 'Circuit Breaker Closed',
  dlq_replayed: 'DLQ Replayed',
  dlq_archived: 'DLQ Archived',
}

/**
 * 事件类型映射规则（兼容现有 ExecutionEventType 和 扩展事件）
 */
function normalizeEventLabel(type: string): string {
  return EVENT_LABELS[type] || type
}

/**
 * 事件类型 → ExplainItem status
 * 使用 ExplainDocument 定义的 status 枚举：
 *   'positive' | 'negative' | 'neutral' | 'action_required'
 */
function inferItemStatus(type: string): ExplainItem['status'] {
  const errorTypes = ['node_failed', 'node_timeout', 'node_dead_lettered', 'graph_failed', 'breaker_open']
  const warningTypes = ['node_retry', 'node_fallback', 'breaker_half_open', 'dlq_replayed']
  const successTypes = ['node_completed', 'graph_completed', 'breaker_closed']

  if (errorTypes.includes(type)) return 'negative'
  if (warningTypes.includes(type)) return 'action_required'
  if (successTypes.includes(type)) return 'positive'
  return 'neutral'
}

/**
 * 相关事件前缀列表（用于 filterRelevantEvents）
 */
const RELEVANT_PREFIXES = [
  'node_queued',
  'node_started',
  'node_completed',
  'node_retry',
  'node_failed',
  'node_timeout',
  'node_fallback',
  'node_dead_lettered',
  'graph_started',
  'graph_completed',
  'graph_failed',
  'breaker_open',
  'breaker_half_open',
  'breaker_closed',
  'dlq_replayed',
  'dlq_archived',
]

export class TimelineBuilder {
  /**
   * 构建 Timeline Section
   *
   * ExecutionEvent → TimelineItem
   * 只转换，不推理。不计算 duration/critical path/success rate。
   *
   * 每个 TimelineItem 包含：
   *   - id: 事件 ID
   *   - label: 可读标签（如 "Node Queued"）
   *   - value: 节点 ID 或 executionId
   *   - detail: 事件数据摘要（JSON 截断）
   *   - source: 时间戳引用
   *   - status: positive/negative/neutral/action_required
   */
  build(events: ExecutionEvent[]): ExplainSection {
    // 按时间升序排序
    const sorted = this.sortByTimestamp(events)

    const items = sorted.map(event => {
      const status = inferItemStatus(event.type)
      return {
        id: event.id,
        label: normalizeEventLabel(event.type),
        value: event.nodeId ?? event.executionId,
        detail: this.extractDetail(event),
        source: `timestamp=${event.timestamp}`,
        status,
      } satisfies ExplainItem
    })

    return {
      type: 'timeline',
      title: 'Execution Timeline',
      order: 0,
      items,
    }
  }

  /**
   * 过滤与 Timeline 相关的事件
   *
   * 只保留以下事件类型：
   *   node_queued / node_started / node_completed
   *   node_retry / node_failed / node_timeout
   *   node_fallback / node_dead_lettered
   *   graph_started / graph_completed / graph_failed
   *   breaker_open / breaker_half_open / breaker_closed
   *   dlq_replayed / dlq_archived
   *
   * 过滤掉 graph_created / graph_cancelled / node_cancelled / dependency_met 等
   */
  filterRelevantEvents(events: ExecutionEvent[]): ExecutionEvent[] {
    return events.filter(e =>
      RELEVANT_PREFIXES.some(prefix => e.type === prefix || e.type.startsWith(prefix)),
    )
  }

  // ─── Private Helpers ───

  /**
   * 按 timestamp 升序排列事件的副本
   */
  private sortByTimestamp(events: ExecutionEvent[]): ExecutionEvent[] {
    return [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
  }

  /**
   * 从事件中提取 detail 文本
   */
  private extractDetail(event: ExecutionEvent): string | undefined {
    if (!event.data) return undefined
    const str = JSON.stringify(event.data)
    return str.length > 300 ? str.slice(0, 300) + '...' : str
  }
}
