// ============================================================
// Frontend Workspace Types — KMKI-PLAT-009
// ============================================================

export type WorkspaceType = 'short_drama' | 'novel' | 'ppt' | 'geo' | 'asset'
export type WorkspaceStatus = 'active' | 'archived' | 'published'

export interface Workspace {
  id: string
  type: WorkspaceType
  tenantId: string
  name: string
  description?: string
  status: WorkspaceStatus
  runtimeState?: Record<string, unknown>
  manifest?: string
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
  schemaVersion: number
  createdAt: string
  updatedAt: string
  activatedAt?: string
  archivedAt?: string
  snapshotCount?: number
  versionCount?: number
  assetCount?: number
}

export interface WorkspaceSnapshot {
  id: string
  workspaceId: string
  version: number
  label?: string
  runtimeState?: Record<string, unknown>
  assetState?: Record<string, unknown>
  graphState?: Record<string, unknown>
  variables?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
  autoSave: boolean
}

export interface WorkspaceVersion {
  id: string
  workspaceId: string
  version: number
  label: string
  description?: string
  snapshotId?: string
  published: boolean
  parentVersion?: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface WorkspaceOperation {
  id: string
  workspaceId: string
  type: string
  target?: string
  targetId?: string
  description?: string
  diff?: Record<string, unknown>
  reverseDiff?: Record<string, unknown>
  userId?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface WorkspaceAsset {
  id: string
  workspaceId: string
  type: string
  path: string
  mimeType?: string
  size?: number
  hash?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface WorkspaceConversationMessage {
  id: string
  workspaceId: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  context?: Record<string, unknown>
  summary?: string
  tokenCount?: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface WorkspaceManifest {
  workspaceId: string
  name: string
  type: WorkspaceType
  capabilities: Array<{ id: string; name: string; version: string; category: string }>
  executionGraph: { steps: Array<{ id: string; type: string; name: string }>; dependencies: Record<string, string[]> }
  resourceContracts: Array<{ id: string; type: string; provider: string; estimatedCost: number }>
  assets: Array<{ id: string; type: string; path: string; size: number; hash?: string }>
  prompts: Array<{ id: string; role: string; summary: string; tokenCount: number }>
  outputVersions: Array<{ version: string; label: string; published: boolean; createdAt: string }>
  costSummary: { totalEstimatedCost: number; currency: string; resourceCount: number }
  auditTrail: Array<{ operation: string; userId?: string; timestamp: string }>
  generatedAt: string
  schemaVersion: number
}

export interface AutoSaveConfig {
  interval: number
  maxSnapshots: number
  debounceMs: number
}

export interface CreateWorkspacePayload {
  type: WorkspaceType
  tenantId: string
  name: string
  description?: string
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface UndoRedoState {
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
}
