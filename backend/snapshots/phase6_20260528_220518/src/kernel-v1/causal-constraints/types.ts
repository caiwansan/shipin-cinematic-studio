// causal-constraints/types.ts

export interface CausalEventContext {
  eventId: string
  source: 'UI' | 'Agent' | 'Timeline' | 'Snapshot'
  timestamp: number
  affectedEntityIds: string[]
  affectedTimelineIds: string[]
  parentEventId?: string
}

export interface CausalViolation {
  type: 'ORDER_VIOLATION' | 'DEPENDENCY_VIOLATION' | 'MISSING_CAUSE'
  message: string
  eventId: string
}

export type ValidationResult = {
  valid: true
} | {
  valid: false
  error: string
}
