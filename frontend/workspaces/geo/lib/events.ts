/**
 * GEO Event Bus — Event payload type definitions
 *
 * Single Source of Truth for all event names and their payloads.
 * Convention: DOMAIN:VERB (uppercase, no lowercase, no mixed case)
 *
 * Payload Contract:
 *   Every event payload extends BaseEventPayload.
 *   { projectId, entityId, timestamp, source, payload }
 *
 * All events emitted must:
 *   - Use DOMAIN:VERB convention
 *   - Include all BaseEventPayload fields
 *   - Be declared in this file before first emit
 *
 * Producer Registry: see lib/event-producers.ts
 */

// ── Base Payload Contract ──
// All event payloads must include these base fields.
export interface BaseEventPayload {
  projectId: string
  entityId: string
  timestamp: string
  source: string
  metadata?: Record<string, unknown>
}

// ── Mission Events ──
export interface MissionLoadingPayload extends BaseEventPayload {}
export interface MissionLoadedPayload extends BaseEventPayload {
  missionId: string
  title: string
  verifyStatus?: string
  taskCount?: number
}
export interface MissionErrorPayload extends BaseEventPayload {
  code: string
  message: string
  fatal?: boolean
}
export interface MissionAppendPayload extends BaseEventPayload {
  icon: string
  title: string
  description?: string
  status: string
}
export interface MissionCompletedPayload extends BaseEventPayload {
  missionId: string
  title: string
  type: string
  verifiedCount: number
}

// ── Discovery Events ──
export interface DiscoveryCompletedPayload extends BaseEventPayload {
  reportId: string
  entityCount: number
  providerCount: number
}

// ── Recommendation Events ──
export interface RecommendationGeneratedPayload extends BaseEventPayload {
  projectId: string
  recommendationCount: number
  confidence: number
}

// ── Verification Events ──
export interface VerifyCompletedPayload extends BaseEventPayload {
  status: 'verified' | 'failed'
  evidenceCount: number
  confidence?: number
  beforeAdi?: number
  afterAdi?: number
}

// ── Learn Events (Sprint 4-4: Discovery → Learn) ──
export interface LearnGeneratedPayload extends BaseEventPayload {
  roundId: string
  signalCount: number
  nextActionTitle: string
  summary: string
}

// ── Flow Control Events (Sprint 4-2: Execute → Verify chain) ──
export interface VerificationReadyPayload extends BaseEventPayload {
  status: 'pending' | 'verified'
  evidenceCount: number
  beforeAdi?: number
  afterAdi?: number
}

export interface ExecutionCompletedPayload extends BaseEventPayload {
  executionId: string
  missionId: string
  status: string
  completedAt: string
  optimizedType?: string
}

// ── Task Events ──
export interface TaskStartedPayload extends BaseEventPayload {
  taskId: string
  type: string
}
export interface TaskUpdatedPayload extends BaseEventPayload {
  taskId: string
  progress: number
  status: string
  eta?: string
  currentStep?: string
}
export interface TaskFinishedPayload extends BaseEventPayload {
  taskId: string
  type: string
  result: string
  confidence?: number
  durationMs: number
}

// ── Project Events ──
export interface ProjectCreatedPayload extends BaseEventPayload {
  projectId: string
  projectName: string
}

// ── System Events ──
export interface SystemReadyPayload extends BaseEventPayload {}
export interface SystemErrorPayload extends BaseEventPayload {
  code: string
  message: string
  fatal?: boolean
}

// ── Event Payload Map ──
// SSOT — every event must be listed here before emission.
export interface EventPayloads {
  // Project
  'PROJECT:CREATED': ProjectCreatedPayload

  // System
  'SYSTEM:READY': SystemReadyPayload
  'SYSTEM:ERROR': SystemErrorPayload

  // Discovery
  'DISCOVERY:COMPLETED': DiscoveryCompletedPayload

  // Recommendation
  'RECOMMENDATION:GENERATED': RecommendationGeneratedPayload

  // Mission
  'MISSION:LOADING': MissionLoadingPayload
  'MISSION:LOADED': MissionLoadedPayload
  'MISSION:ERROR': MissionErrorPayload
  'MISSION:APPEND': MissionAppendPayload
  'MISSION:COMPLETED': MissionCompletedPayload

  // Task
  'TASK:STARTED': TaskStartedPayload
  'TASK:UPDATED': TaskUpdatedPayload
  'TASK:FINISHED': TaskFinishedPayload

  // Verification
  'VERIFY:COMPLETED': VerifyCompletedPayload

  // Flow Control (Sprint 4-2)
  'VERIFICATION:READY': VerificationReadyPayload
  'EXECUTION:COMPLETED': ExecutionCompletedPayload

  // Learn (Sprint 4-4)
  'LEARN:GENERATED': LearnGeneratedPayload
}
