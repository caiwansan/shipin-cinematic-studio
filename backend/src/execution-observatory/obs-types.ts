import { ExecutionTimeline } from "../production-loop/timeline-types"

export interface NodeRenderState {
  id: string
  type: string
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED"
  x?: number
  y?: number
  intensity?: number
  duration?: number
}

export interface Edge {
  from: string
  to: string
  type: "CAUSAL" | "FLOW"
}

export interface ObservatoryState {
  traceId: string
  nodes: NodeRenderState[]
  edges: Edge[]
}
