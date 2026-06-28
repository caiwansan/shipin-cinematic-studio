import { ExecutionTimeline } from "./timeline-types"

const TYPE_ORDER: Record<string, number> = {
  DIRECTOR: 0,
  SCENE: 1,
  SHOT: 2,
  RENDER: 3,
}

export class ReplayEngine {
  linearize(timeline: ExecutionTimeline) {
    return Object.values(timeline.nodes).sort((a, b) => {
      if (a.type !== b.type) {
        return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
      }
      return a.id.localeCompare(b.id)
    })
  }

  tracePath(nodeId: string, timeline: ExecutionTimeline) {
    const path: string[] = []
    let current: TimelineNode | undefined = timeline.nodes[nodeId]
    while (current) {
      path.push(current.id)
      current = current.parentId ? timeline.nodes[current.parentId] : undefined
    }
    return path.reverse()
  }
}
