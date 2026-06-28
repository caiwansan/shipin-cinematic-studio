export type TimelineNodeType =
  | "DIRECTOR"
  | "SCENE"
  | "SHOT"
  | "RENDER"

export interface TimelineNode {
  id: string
  type: TimelineNodeType
  traceId: string
  parentId?: string
  children?: string[]
  payload: any
  startedAt?: number
  endedAt?: number
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED"
}

export interface ExecutionTimeline {
  traceId: string
  nodes: Record<string, TimelineNode>
}
