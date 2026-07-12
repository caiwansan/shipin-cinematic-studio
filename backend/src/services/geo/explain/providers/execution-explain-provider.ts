// ============================================================
// ExecutionExplainProvider — type: 'execution'
// RC4-1: ExecutionTrace → ExplainDocument
//
// 读取 ExecutionTrace（Graph + Events + Assignments），
// 使用 ExplainDocumentBuilder 组装为统一 ExplainDocument。
//
// 数据来源：
//   - ExecutionTraceRepository: Graph 和 Events
//   - 可选的 AssignmentsRepository: 资源分配记录
//
// Zero Computation: 只组装，不计算 confidence/delta/expectedScore
// ============================================================

import type { ExplainProvider } from '../types.js'
import { ExplainDocumentBuilder } from '../builder.js'
import type { ExplainDocument, ExplainSectionType } from '../explain-document.js'
import type {
  ExecutionEvent,
  ExecutionEventType,
  ExecutionGraph,
} from '../../execution/types.js'
import type { ExecutionAssignment } from '../../execution/resource/resource.types.js'
import { TimelineBuilder } from '../builders/timeline-builder.js'

/**
 * 用于读取 ExecutionAssignment 的接口。
 * 独立于 ExecutionTraceRepository（该接口无 getAssignments 方法），
 * 且不修改已冻结的 execution/ 文件。
 */
export interface IAssignmentRepository {
  getAssignments(executionId: string): Promise<ExecutionAssignment[]>
}

export class ExecutionExplainProvider implements ExplainProvider {
  readonly type = 'execution'

  private timelineBuilder: TimelineBuilder

  constructor(
    private traceRepo: {
      getGraph(executionId: string): Promise<ExecutionGraph | null>
      getEvents(executionId: string): Promise<ExecutionEvent[]>
    },
    private assignmentRepo?: IAssignmentRepository,
    timelineBuilder?: TimelineBuilder,
  ) {
    this.timelineBuilder = timelineBuilder ?? new TimelineBuilder()
  }

  canHandle(type: string, _id: string): boolean {
    return type === 'execution'
  }

  async getExplain(_type: string, id: string): Promise<ExplainDocument> {
    // 1. 读取 ExecutionTrace
    const graph = await this.traceRepo.getGraph(id)
    const events = await this.traceRepo.getEvents(id)
    const assignments = this.assignmentRepo
      ? await this.assignmentRepo.getAssignments(id)
      : []

    const builder = new ExplainDocumentBuilder()

    // --- Section: timeline（基于 Event 时间线）---
    this.buildTimelineSection(builder, events)

    // --- Section: evidence（Node Artifact 证据）---
    this.buildEvidenceSection(builder, graph, events)

    // --- Section: metric（耗时/数量指标）---
    this.buildMetricSection(builder, graph, events, assignments)

    // --- Section: resource allocation（资源分配）---
    this.buildResourceSection(builder, assignments)

    // --- Section: retry/fallback summary ---
    this.buildRetrySection(builder, events)

    // 5. 组装 ExplainDocument
    const nodeCount = graph?.nodes?.length ?? 0
    const eventCount = events.length
    const assignmentCount = assignments.length

    return builder.build({
      id: `execution-explain-${id}`,
      title: `Execution Explain — ${id.slice(0, 8)}`,
      summary: `Execution ${id.slice(0, 8)}: ${nodeCount} nodes, ${eventCount} events, ${assignmentCount} provider assignments.`,
      confidence: null, // Zero Computation: 不计算 confidence
      metadata: {
        type: 'execution',
        sourceId: id,
        sourceType: 'execution',
        provider: 'ExecutionExplainProvider',
      },
    })
  }

  // ─── Timeline Section ───
  // 委托给 TimelineBuilder，Provider 只负责组装

  private buildTimelineSection(
    builder: ExplainDocumentBuilder,
    events: ExecutionEvent[],
  ): void {
    // 1. 过滤相关事件（TimelineBuilder 负责过滤逻辑）
    const relevantEvents = this.timelineBuilder.filterRelevantEvents(events)

    // 2. 构建 timeline section（TimelineBuilder 负责转换）
    const timelineSection = this.timelineBuilder.build(relevantEvents)

    // 3. 将 TimelineBuilder 输出的 items 逐个添加到 ExplainDocumentBuilder
    builder.addSection('timeline', timelineSection.title)
    for (const item of timelineSection.items) {
      builder.addItem('timeline', item)
    }
  }

  // ─── Evidence Section ───

  private buildEvidenceSection(
    builder: ExplainDocumentBuilder,
    graph: ExecutionGraph | null,
    events: ExecutionEvent[],
  ): void {
    builder.addSection('evidence', 'Execution Evidence')

    if (!graph || graph.nodes.length === 0) {
      builder.addItem('evidence', {
        id: 'no-graph',
        label: 'Execution Graph',
        value: 'No graph data available',
        status: 'neutral',
      })
      return
    }

    // 提取有 artifact 的节点
    const nodesWithArtifacts = graph.nodes.filter(n => n.artifact)

    if (nodesWithArtifacts.length === 0) {
      builder.addItem('evidence', {
        id: 'no-artifact',
        label: 'Node Artifacts',
        value: 'No node artifacts found',
        source: `totalNodes=${graph.nodes.length}`,
        status: 'neutral',
      })
      return
    }

    for (const node of nodesWithArtifacts) {
      const artifact = node.artifact!
      builder.addItem('evidence', {
        id: artifact.id,
        label: `Node: ${node.label} (${node.id})`,
        value: `Artifact: ${artifact.type}`,
        detail: JSON.stringify(artifact.payload).slice(0, 300),
        source: artifact.metadata.provider,
      })
    }
  }

  // ─── Metric Section ───

  private buildMetricSection(
    builder: ExplainDocumentBuilder,
    graph: ExecutionGraph | null,
    events: ExecutionEvent[],
    assignments: ExecutionAssignment[],
  ): void {
    builder.addSection('metric', 'Execution Metrics')

    const totalDuration = this.calculateDuration(events)
    const nodeCount = graph?.nodes?.length ?? 0

    builder.addItem('metric', {
      id: 'duration',
      label: 'Total Duration',
      value: `${totalDuration}ms`,
      status: 'neutral',
    })
    builder.addItem('metric', {
      id: 'nodes',
      label: 'Total Nodes',
      value: nodeCount,
      status: 'neutral',
    })
    builder.addItem('metric', {
      id: 'events',
      label: 'Events',
      value: events.length,
      status: 'neutral',
    })
    builder.addItem('metric', {
      id: 'assignments',
      label: 'Provider Assignments',
      value: assignments.length,
      status: 'neutral',
    })

    // Completed/Failed node counts
    if (graph?.nodes) {
      const completed = graph.nodes.filter(n => n.status === 'completed').length
      const failed = graph.nodes.filter(n => n.status === 'failed').length
      const running = graph.nodes.filter(n =>
        ['running', 'queued', 'pending'].includes(n.status),
      ).length
      builder.addItem('metric', {
        id: 'node-status',
        label: 'Nodes: Completed / Failed / Active',
        value: `${completed} / ${failed} / ${running}`,
        status: failed > 0 ? 'negative' : 'positive',
      })
    }
  }

  // ─── Resource Section ───

  private buildResourceSection(
    builder: ExplainDocumentBuilder,
    assignments: ExecutionAssignment[],
  ): void {
    builder.addSection('evidence', 'Resource Allocation')

    if (assignments.length === 0) {
      builder.addItem('evidence', {
        id: 'no-assignments',
        label: 'Resource Assignments',
        value: 'No assignment data available',
        status: 'neutral',
      })
      return
    }

    for (const a of assignments) {
      builder.addItem('evidence', {
        id: `assign-${a.nodeId}-${a.assignedTo}`,
        label: `Node ${a.nodeId} → ${a.assignedTo}`,
        value: `Capability: ${a.capability}`,
        detail: `ResourceType: ${a.resourceType}, Priority: ${a.priority}`,
        source: a.reason,
      })
    }
  }

  // ─── Retry / Fallback Section ───

  private buildRetrySection(
    builder: ExplainDocumentBuilder,
    events: ExecutionEvent[],
  ): void {
    builder.addSection('recommendation', 'Retry / Fallback Summary')

    const retryEvents = events.filter(e =>
      e.type.includes('retry') ||
      e.type.includes('fallback') ||
      e.type.includes('dead_letter') ||
      e.type.includes('timeout'),
    )

    if (retryEvents.length === 0) {
      builder.addItem('recommendation', {
        id: 'no-retry',
        label: 'Retry Status',
        value: 'No retry, fallback, or timeout events',
        status: 'positive',
      })
      return
    }

    for (const event of retryEvents) {
      const isDeadLetter = event.type.includes('dead_letter')
      builder.addItem('recommendation', {
        id: event.id,
        label: event.type,
        value: event.nodeId ?? 'graph',
        detail: event.data ? JSON.stringify(event.data).slice(0, 200) : undefined,
        status: isDeadLetter ? 'negative' : 'action_required',
      })
    }
  }

  // ─── Helpers ───

  private inferStatus(
    type: ExecutionEventType,
  ): 'positive' | 'negative' | 'neutral' | 'action_required' {
    if (type.includes('failed') || type.includes('timeout') || type.includes('dead_letter')) {
      return 'negative'
    }
    if (type.includes('retry') || type.includes('fallback') || type.includes('cancelled') || type.includes('circuit_breaker_open')) {
      return 'action_required'
    }
    if (type.includes('completed')) {
      return 'positive'
    }
    return 'neutral'
  }

  private calculateDuration(events: ExecutionEvent[]): number {
    if (events.length < 2) return 0
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    const start = new Date(sorted[0].timestamp).getTime()
    const end = new Date(sorted[sorted.length - 1].timestamp).getTime()
    return end - start
  }
}
