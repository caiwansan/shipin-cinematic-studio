// ============================================================
// Workflow Events (KMKI-PLAT-011)
// Event type constants and helpers for the Workflow Runtime
// ============================================================

import { platformEventBus } from '@platform/events/event-bus'
import { workflowEventRepository } from '../repositories/event.repository.js'

// ─── Workflow Event Types ───

export const WorkflowEventTypes = {
  // Instance lifecycle
  WorkflowCreated: 'workflowCreated',
  WorkflowStarted: 'workflowStarted',
  WorkflowPaused: 'workflowPaused',
  WorkflowResumed: 'workflowResumed',
  WorkflowCancelled: 'workflowCancelled',
  WorkflowFinished: 'workflowFinished',
  WorkflowFailed: 'workflowFailed',

  // Node lifecycle
  NodeStarted: 'nodeStarted',
  NodeCompleted: 'nodeCompleted',
  NodeFailed: 'nodeFailed',
  NodeSkipped: 'nodeSkipped',

  // Human-in-the-Loop
  HumanPendingApproval: 'humanPendingApproval',
  HumanApproved: 'humanApproved',
  HumanRejected: 'humanRejected',
  HumanPendingEdit: 'humanPendingEdit',
  HumanEdited: 'humanEdited',
  HumanPendingReview: 'humanPendingReview',
  HumanReviewed: 'humanReviewed',
  HumanPendingUpload: 'humanPendingUpload',
  HumanUploaded: 'humanUploaded',
  HumanPendingDecision: 'humanPendingDecision',
  HumanDecided: 'humanDecided',
  HumanExpired: 'humanExpired',

  // Replay
  ReplayStarted: 'replayStarted',
  ReplayFromNode: 'replayFromNode',
  ReplayFailedNodes: 'replayFailedNodes',
  ReplayBranch: 'replayBranch',

  // Checkpoint
  CheckpointSaved: 'checkpointSaved',
  CheckpointRestored: 'checkpointRestored',
} as const

export type WorkflowEventType = typeof WorkflowEventTypes[keyof typeof WorkflowEventTypes]

// ─── Platform Event Type Mappings ───

/**
 * Map Workflow event types to platform event bus event types.
 */
export function mapToPlatformEventType(eventType: string): string {
  const prefix = 'workflow:'

  switch (eventType) {
    case 'workflowStarted':
      return `${prefix}Started`
    case 'workflowPaused':
      return `${prefix}Paused`
    case 'workflowResumed':
      return `${prefix}Resumed`
    case 'workflowCancelled':
      return `${prefix}Cancelled`
    case 'workflowFinished':
      return `${prefix}Finished`
    case 'workflowFailed':
      return `${prefix}Failed`
    case 'nodeStarted':
      return `${prefix}NodeStarted`
    case 'nodeCompleted':
      return `${prefix}NodeCompleted`
    case 'nodeFailed':
      return `${prefix}NodeFailed`
    default:
      return `${prefix}${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`
  }
}

// ─── Event Emitter Helper ───

export async function emitWorkflowEvent(
  instanceId: string,
  eventType: string,
  data?: Record<string, any>,
  nodeId?: string,
): Promise<void> {
  // Persist to DB
  await workflowEventRepository.create({
    instanceId,
    type: eventType,
    nodeId,
    data: data || {},
    timestamp: new Date(),
  })

  // Emit to platform event bus
  const platformType = mapToPlatformEventType(eventType)
  platformEventBus.emit({
    type: platformType as any,
    source: 'workflow',
    timestamp: new Date().toISOString(),
    entityId: instanceId,
    payload: { nodeId, ...data },
  })
}

// ─── Event Handler Subscriptions ───

export function subscribeWorkflowEvents(handlers?: {
  onStart?: (instanceId: string) => void
  onComplete?: (instanceId: string, output?: any) => void
  onFail?: (instanceId: string, error?: string) => void
  onPause?: (instanceId: string) => void
  onNodeComplete?: (instanceId: string, nodeId: string) => void
  onHumanAction?: (instanceId: string, humanType: string, action: string) => void
}): () => void {
  const unsubscribers: (() => void)[] = []

  if (handlers?.onStart) {
    unsubscribers.push(
      platformEventBus.on('workflow:Started' as any, (event) => {
        if (event.entityId) handlers.onStart!(event.entityId)
      }),
    )
  }

  if (handlers?.onComplete) {
    unsubscribers.push(
      platformEventBus.on('workflow:Finished' as any, (event) => {
        if (event.entityId) handlers.onComplete!(event.entityId, event.payload)
      }),
    )
  }

  if (handlers?.onFail) {
    unsubscribers.push(
      platformEventBus.on('workflow:Failed' as any, (event) => {
        if (event.entityId) handlers.onFail!(event.entityId, event.payload?.error)
      }),
    )
  }

  if (handlers?.onNodeComplete) {
    unsubscribers.push(
      platformEventBus.on('workflow:NodeCompleted' as any, (event) => {
        if (event.entityId && event.payload?.nodeId) {
          handlers.onNodeComplete!(event.entityId, event.payload.nodeId)
        }
      }),
    )
  }

  return () => {
    unsubscribers.forEach(off => off())
  }
}
