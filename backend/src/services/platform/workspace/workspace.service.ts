// ============================================================
// Workspace Service — 业务编排
// create, open, save, snapshot, restore, fork, publish, archive, delete, list, search
// ============================================================

import { workspaceRepository } from './repositories/workspace.repository.js'
import { snapshotSystem } from './snapshot/snapshot-system.js'
import { versionRuntime } from './version/version-runtime.js'
import { runtimeStateManager } from './state/runtime-state.js'
import { manifestService } from './manifest/manifest-service.js'
import { undoRedoService } from './history/undo-redo.js'
import { autoSaveService } from './autosave/autosave-service.js'
import type {
  WorkspaceDTO,
  WorkspaceSnapshotDTO,
  WorkspaceVersionDTO,
  WorkspaceManifest,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  AutoSaveConfig,
  DEFAULT_AUTOSAVE_CONFIG,
} from './types.js'

export const workspaceService = {
  // ─── Lifecycle ───

  async create(input: CreateWorkspaceInput): Promise<WorkspaceDTO> {
    const workspace = await workspaceRepository.create(input)

    // Create initial snapshot
    await snapshotSystem.createSnapshot(workspace.id, {
      label: 'initial',
      runtimeState: { createdAt: workspace.createdAt.toISOString() },
    })

    // Create initial version
    await versionRuntime.createVersion(
      workspace.id,
      'v1',
      'Initial version',
    )

    return workspace
  },

  async open(workspaceId: string): Promise<{
    workspace: WorkspaceDTO
    state: Record<string, unknown> | null
  }> {
    const workspace = await workspaceRepository.findById(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)

    // Load undo/redo cursor
    await undoRedoService.loadCursor(workspaceId)

    // Load runtime state
    const state = await runtimeStateManager.loadState(workspaceId)

    return { workspace, state }
  },

  async save(workspaceId: string, state?: Record<string, unknown>): Promise<void> {
    if (state) {
      await runtimeStateManager.saveState(workspaceId, state)
    }
  },

  async snapshot(
    workspaceId: string,
    label?: string,
    runtimeState?: Record<string, unknown>,
  ): Promise<WorkspaceSnapshotDTO> {
    return snapshotSystem.createSnapshot(workspaceId, {
      label,
      runtimeState,
    })
  },

  async restore(snapshotId: string): Promise<{
    snapshot: WorkspaceSnapshotDTO
    workspace: WorkspaceDTO
  }> {
    const result = await snapshotSystem.restoreSnapshot(snapshotId)

    // Record the restore operation for undo
    await undoRedoService.recordOperation(
      result.workspace.id,
      'restore',
      'snapshot',
      snapshotId,
      undefined,
      undefined,
      `Restored to snapshot ${result.snapshot.version}`,
    )

    return result as any
  },

  async fork(
    workspaceId: string,
    versionId: string,
    forkLabel?: string,
  ): Promise<WorkspaceVersionDTO> {
    return versionRuntime.forkWorkspace(workspaceId, versionId, forkLabel)
  },

  async publish(workspaceId: string): Promise<WorkspaceVersionDTO> {
    // Create a new version and publish it
    const version = await versionRuntime.createVersion(
      workspaceId,
      `published-${new Date().toISOString().slice(0, 10)}`,
      'Published version',
    )
    await versionRuntime.publishVersion(version.id)

    // Update workspace status
    await workspaceRepository.updateStatus(workspaceId, 'published')

    await undoRedoService.recordOperation(
      workspaceId,
      'publish',
      'version',
      version.id,
      undefined,
      undefined,
      `Published version ${version.version}`,
    )

    return version
  },

  async archive(workspaceId: string): Promise<void> {
    await workspaceRepository.updateStatus(workspaceId, 'archived')

    await undoRedoService.recordOperation(
      workspaceId,
      'archive',
      'workspace',
      workspaceId,
    )

    // Stop auto-save if running
    autoSaveService.stopAutoSave(workspaceId)
  },

  async delete(workspaceId: string): Promise<void> {
    await undoRedoService.clearHistory(workspaceId)
    autoSaveService.stopAutoSave(workspaceId)
    await workspaceRepository.delete(workspaceId)
  },

  // ─── Query ───

  async list(filter?: {
    type?: string
    status?: string
    tenantId?: string
    search?: string
  }): Promise<WorkspaceDTO[]> {
    return workspaceRepository.list(filter)
  },

  async get(workspaceId: string): Promise<WorkspaceDTO | null> {
    return workspaceRepository.findById(workspaceId)
  },

  async search(query: string): Promise<WorkspaceDTO[]> {
    return workspaceRepository.list({ search: query })
  },

  // ─── Manifest ───

  async getManifest(workspaceId: string): Promise<WorkspaceManifest | null> {
    return manifestService.getManifest(workspaceId)
  },

  async exportWorkspace(workspaceId: string): Promise<any> {
    return manifestService.exportWorkspace(workspaceId)
  },

  async importWorkspace(
    tenantId: string,
    manifest: WorkspaceManifest,
    data: any,
  ): Promise<{ workspaceId: string }> {
    return manifestService.importWorkspace(tenantId, manifest, data)
  },

  // ─── Undo/Redo ───

  async undo(workspaceId: string): Promise<boolean> {
    const result = await undoRedoService.undo(workspaceId)
    return result !== null
  },

  async redo(workspaceId: string): Promise<boolean> {
    const result = await undoRedoService.redo(workspaceId)
    return result !== null
  },

  getUndoRedoState(workspaceId: string) {
    return undoRedoService.getState(workspaceId)
  },

  // ─── AutoSave ───

  startAutoSave(workspaceId: string, config: AutoSaveConfig): void {
    autoSaveService.startAutoSave(workspaceId, config)
  },

  stopAutoSave(workspaceId: string): void {
    autoSaveService.stopAutoSave(workspaceId)
  },

  markDirty(workspaceId: string): void {
    autoSaveService.onDirty(workspaceId)
  },

  // ─── Update ───

  async update(
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceDTO> {
    return workspaceRepository.update(workspaceId, input)
  },
}
