import { ExecutionTimeline } from "../production-loop/timeline-types"
import { ObservatoryState, NodeRenderState, Edge } from "./obs-types"

export class ObservatoryMapper {
  build(timeline: ExecutionTimeline): ObservatoryState {
    const nodes: NodeRenderState[] = []
    const edges: Edge[] = []

    const raw = Object.values(timeline.nodes)

    for (const n of raw) {
      nodes.push({
        id: n.id,
        type: n.type,
        status: n.status,
        intensity: this.computeHeat(n),
        duration: this.computeDuration(n),
      })

      if (n.parentId) {
        edges.push({
          from: n.parentId,
          to: n.id,
          type: "CAUSAL",
        })
      }
    }

    return {
      traceId: timeline.traceId,
      nodes,
      edges,
    }
  }

  private computeHeat(node: any): number {
    if (node.status === "FAILED") return 1
    if (node.status === "RUNNING") return 0.7
    if (node.status === "DONE") return 0.4
    return 0.1
  }

  private computeDuration(node: any): number {
    if (!node.startedAt || !node.endedAt) return 0
    return node.endedAt - node.startedAt
  }
}
