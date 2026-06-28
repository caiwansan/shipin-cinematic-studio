// ============================================================
// Workspace Events — KMKI-PLAT-009
// Event-based architecture for workspace lifecycle
// ============================================================

export const WorkspaceEventTypes = {
  CREATED: 'workspace:created',
  OPENED: 'workspace:opened',
  SAVED: 'workspace:saved',
  SNAPSHOT_CREATED: 'workspace:snapshot:created',
  VERSION_PUBLISHED: 'workspace:version:published',
  AUTO_SAVED: 'workspace:autosaved',
  ARCHIVED: 'workspace:archived',
  RESTORED: 'workspace:restored',
  CRASHED: 'workspace:crashed',
  DELETED: 'workspace:deleted',
  STATE_CHANGED: 'workspace:state:changed',
  UNDO: 'workspace:undo',
  REDO: 'workspace:redo',
} as const

// ─── Event Payloads ───

export interface WorkspaceCreatedEvent {
  workspaceId: string
  type: string
  name: string
  tenantId: string
  timestamp: string
}

export interface WorkspaceOpenedEvent {
  workspaceId: string
  timestamp: string
}

export interface WorkspaceSavedEvent {
  workspaceId: string
  hasState: boolean
  timestamp: string
}

export interface WorkspaceSnapshotCreatedEvent {
  workspaceId: string
  snapshotId: string
  version: number
  autoSave: boolean
  timestamp: string
}

export interface WorkspaceVersionPublishedEvent {
  workspaceId: string
  versionId: string
  version: number
  label: string
  timestamp: string
}

export interface WorkspaceAutoSavedEvent {
  workspaceId: string
  snapshotId: string
  version: number
  timestamp: string
}

export interface WorkspaceArchivedEvent {
  workspaceId: string
  timestamp: string
}

export interface WorkspaceRestoredEvent {
  workspaceId: string
  snapshotId: string
  version: number
  timestamp: string
}

export interface WorkspaceCrashedEvent {
  workspaceId: string
  error: string
  lastState: Record<string, unknown> | null
  timestamp: string
}

export interface WorkspaceStateChangedEvent {
  workspaceId: string
  previousState: Record<string, unknown> | null
  newState: Record<string, unknown>
  timestamp: string
}

// ─── Event Creators ───

export function createWorkspaceCreatedEvent(
  workspaceId: string,
  type: string,
  name: string,
  tenantId: string,
): WorkspaceCreatedEvent {
  return { workspaceId, type, name, tenantId, timestamp: new Date().toISOString() }
}

export function createWorkspaceSnapshotCreatedEvent(
  workspaceId: string,
  snapshotId: string,
  version: number,
  autoSave: boolean,
): WorkspaceSnapshotCreatedEvent {
  return { workspaceId, snapshotId, version, autoSave, timestamp: new Date().toISOString() }
}

export function createWorkspaceAutoSavedEvent(
  workspaceId: string,
  snapshotId: string,
  version: number,
): WorkspaceAutoSavedEvent {
  return { workspaceId, snapshotId, version, timestamp: new Date().toISOString() }
}

export function createWorkspaceCrashedEvent(
  workspaceId: string,
  error: string,
  lastState: Record<string, unknown> | null,
): WorkspaceCrashedEvent {
  return { workspaceId, error, lastState, timestamp: new Date().toISOString() }
}
