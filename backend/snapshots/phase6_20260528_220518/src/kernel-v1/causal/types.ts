// causal/types.ts — Causal Layer type definitions

export interface CausalLink {
  eventId: string
  parentEventId?: string
  triggeredBy: string  // KernelSource compatible
  affects: {
    entityIds: string[]
    timelineIds: string[]
  }
  diffId?: string
}
