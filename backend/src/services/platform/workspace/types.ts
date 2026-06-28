// ============================================================
// Workspace Types — KMKI-PLAT-009
// AI 创作工作空间内核：Single Source of Truth for all workbenches
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'

// ─── Workspace ───

export interface WorkspaceDTO {
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
  createdAt: Date
  updatedAt: Date
  activatedAt?: Date
  archivedAt?: Date
}

export type WorkspaceType = 'short_drama' | 'novel' | 'ppt' | 'geo' | 'asset'

export type WorkspaceStatus = 'active' | 'archived' | 'published'

// ─── Snapshot ───

export interface WorkspaceSnapshotDTO {
  id: string
  workspaceId: string
  version: number
  label?: string
  runtimeState?: Record<string, unknown>
  assetState?: Record<string, unknown>
  graphState?: Record<string, unknown>
  variables?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: Date
  autoSave: boolean
}

export interface CreateSnapshotInput {
  runtimeState?: Record<string, unknown>
  assetState?: Record<string, unknown>
  graphState?: Record<string, unknown>
  variables?: Record<string, unknown>
  label?: string
  autoSave?: boolean
}

// ─── Version ───

export interface WorkspaceVersionDTO {
  id: string
  workspaceId: string
  version: number
  label: string
  description?: string
  snapshotId?: string
  published: boolean
  parentVersion?: number
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ─── Operation (for Undo/Redo) ───

export interface WorkspaceOperationDTO {
  id: string
  workspaceId: string
  type: OperationType
  target?: string
  targetId?: string
  description?: string
  diff?: Record<string, unknown>
  reverseDiff?: Record<string, unknown>
  userId?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export type OperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'publish'
  | 'archive'
  | 'execute'

// ─── Asset ───

export interface WorkspaceAssetDTO {
  id: string
  workspaceId: string
  type: AssetType
  path: string
  mimeType?: string
  size?: number
  hash?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'script'
  | 'prompt'
  | 'pdf'
  | 'doc'
  | 'json'
  | 'output'

// ─── Conversation ───

export interface WorkspaceConversationDTO {
  id: string
  workspaceId: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  context?: Record<string, unknown>
  summary?: string
  tokenCount?: number
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ─── Checkpoint ───

export interface WorkspaceCheckpointDTO {
  id: string
  workspaceId: string
  name: string
  description?: string
  snapshotId?: string
  versionId?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ─── Execution Binding ───

export interface WorkspaceExecutionDTO {
  id: string
  workspaceId: string
  executionId: string
  planVersion: string
  status: ExecutionStatus
  result?: Record<string, unknown>
  runtimeState?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: Date
  completedAt?: Date
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ─── Draft ───

export interface WorkspaceDraftDTO {
  id: string
  workspaceId: string
  draftNumber: number
  contentState?: Record<string, unknown>
  runtimeState?: Record<string, unknown>
  autoSave: boolean
  createdAt: Date
}

// ─── Manifest ───

export interface WorkspaceManifest {
  workspaceId: string
  name: string
  type: WorkspaceType
  capabilities: ManifestCapability[]
  executionGraph: ManifestExecutionGraph
  resourceContracts: ManifestResourceContract[]
  assets: ManifestAsset[]
  prompts: ManifestPrompt[]
  outputVersions: ManifestOutputVersion[]
  costSummary: ManifestCostSummary
  auditTrail: ManifestAuditEntry[]
  generatedAt: string // ISO date
  schemaVersion: number
}

export interface ManifestCapability {
  id: string
  name: string
  version: string
  category: string
}

export interface ManifestExecutionGraph {
  steps: Array<{ id: string; type: string; name: string }>
  dependencies: Record<string, string[]>
}

export interface ManifestResourceContract {
  id: string
  type: string
  provider: string
  estimatedCost: number
}

export interface ManifestAsset {
  id: string
  type: string
  path: string
  size: number
  hash?: string
}

export interface ManifestPrompt {
  id: string
  role: string
  summary: string
  tokenCount: number
}

export interface ManifestOutputVersion {
  version: string
  label: string
  published: boolean
  createdAt: string
}

export interface ManifestCostSummary {
  totalEstimatedCost: number
  currency: string
  resourceCount: number
}

export interface ManifestAuditEntry {
  operation: string
  userId?: string
  timestamp: string
}

// ─── AutoSave Config ───

export interface AutoSaveConfig {
  interval: number       // ms between auto-save checks
  maxSnapshots: number   // max snapshots to keep
  debounceMs: number     // debounce window before saving
  onSaveCallback?: (workspaceId: string, snapshotId: string) => void | Promise<void>
}

export const DEFAULT_AUTOSAVE_CONFIG: AutoSaveConfig = {
  interval: 30_000,
  maxSnapshots: 50,
  debounceMs: 5_000,
}

// ─── Create / Update Inputs ───

export interface CreateWorkspaceInput {
  type: WorkspaceType
  tenantId: string
  name: string
  description?: string
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string
  status?: WorkspaceStatus
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
