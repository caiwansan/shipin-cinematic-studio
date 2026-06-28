// ============================================================
// Snapshot System — 平台的唯一恢复机制
// Snapshot 是 Undo/Redo/Crash Recovery 的统一入口
// ============================================================

import { snapshotRepository } from '../repositories/snapshot.repository.js'
import { workspaceRepository } from '../repositories/workspace.repository.js'
import type { WorkspaceSnapshotDTO, CreateSnapshotInput } from '../types.js'

export const snapshotSystem = {
  /**
   * Create a snapshot of a workspace's full runtime state.
   * This is the single entry point for all state capture needs.
   */
  async createSnapshot(
    workspaceId: string,
    input: CreateSnapshotInput,
  ): Promise<WorkspaceSnapshotDTO> {
    const snapshot = await snapshotRepository.create(workspaceId, input)

    // If auto-saving and we exceed max snapshots, prune oldest
    // (AutoSaveService handles explicit max configuration)
    return snapshot
  },

  /**
   * Restore a workspace to the state captured in a snapshot.
   * This applies: runtimeState → workspace, assetState, graphState, variables
   */
  async restoreSnapshot(snapshotId: string): Promise<{
    snapshot: WorkspaceSnapshotDTO
    workspace: any
  }> {
    const snapshot = await snapshotRepository.findById(snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    // Restore runtime state into workspace
    if (snapshot.runtimeState) {
      await workspaceRepository.saveRuntimeState(
        snapshot.workspaceId,
        snapshot.runtimeState,
      )
    }

    // Reload workspace
    const workspace = await workspaceRepository.findById(snapshot.workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${snapshot.workspaceId}`)
    }

    return { snapshot, workspace }
  },

  /**
   * List all snapshots for a workspace, newest first.
   */
  async listSnapshots(workspaceId: string): Promise<WorkspaceSnapshotDTO[]> {
    return snapshotRepository.findByWorkspaceId(workspaceId)
  },

  /**
   * Get the count of snapshots for a workspace.
   */
  async countSnapshots(workspaceId: string): Promise<number> {
    return snapshotRepository.countByWorkspaceId(workspaceId)
  },

  /**
   * Get the latest snapshot for a workspace.
   */
  async getLatestSnapshot(workspaceId: string): Promise<WorkspaceSnapshotDTO | null> {
    return snapshotRepository.findLatest(workspaceId)
  },

  /**
   * Delete old snapshots beyond the keep count.
   * Used by AutoSaveService to maintain max snapshot limits.
   */
  async pruneSnapshots(workspaceId: string, keepCount: number): Promise<void> {
    await snapshotRepository.deleteOldest(workspaceId, keepCount)
  },

  /**
   * Delete a specific snapshot.
   */
  async deleteSnapshot(id: string): Promise<void> {
    await snapshotRepository.delete(id)
  },
}
