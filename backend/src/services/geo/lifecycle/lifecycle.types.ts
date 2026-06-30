// ============================================================
// Lifecycle Types — Unified Timeline Aggregator (GEO v4 Sprint 5)
// ============================================================

export interface LifecycleEvent {
  id: string
  projectId: string
  phase: 'optimize' | 'verify' | 'publish' | 'observe' | 'indexed' | 'drift' | 'recommend'
  timestamp: Date
  status: string
  detail: Record<string, any>
}

export interface LifecycleTimeline {
  projectId: string
  events: LifecycleEvent[]
  summary: {
    totalEvents: number
    currentPhase: string
    lastEventTime?: Date
    phases: Record<string, number>
  }
}
