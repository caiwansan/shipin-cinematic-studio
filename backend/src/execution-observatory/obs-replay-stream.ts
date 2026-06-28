import { ExecutionTimeline } from "../production-loop/timeline-types"

/**
 * 用于 UI slider 时间轴回放的帧查询
 */
export class ReplayStream {
  frame(timeline: ExecutionTimeline, t: number) {
    const nodes = Object.values(timeline.nodes)
    return nodes.map(n => ({
      id: n.id,
      visible: this.isVisible(n, t),
      status: n.status,
    }))
  }

  private isVisible(node: any, t: number): boolean {
    if (!node.startedAt) return true
    if (!node.endedAt) return t >= node.startedAt
    return t >= node.startedAt && t <= node.endedAt
  }
}
