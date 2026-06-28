// ============================================================
// Version Runtime — Workspace Version Management
// Supports: create, publish, compare, restore, fork
// ============================================================

import { versionRepository } from '../repositories/version.repository.js'
import { snapshotRepository } from '../repositories/snapshot.repository.js'
import { workspaceRepository } from '../repositories/workspace.repository.js'
import { snapshotSystem } from '../snapshot/snapshot-system.js'
import type { WorkspaceVersionDTO } from '../types.js'

export const versionRuntime = {
  /**
   * Create a new version for a workspace.
   * Optionally links to a snapshot for restore capability.
   */
  async createVersion(
    workspaceId: string,
    label: string,
    description?: string,
    snapshotId?: string,
    parentVersion?: number,
  ): Promise<WorkspaceVersionDTO> {
    return versionRepository.create({
      workspaceId,
      label,
      description,
      snapshotId,
      parentVersion,
    })
  },

  /**
   * Publish a version — marks it as the published release.
   */
  async publishVersion(versionId: string): Promise<WorkspaceVersionDTO> {
    return versionRepository.publish(versionId)
  },

  /**
   * Compare two versions of a workspace by their version numbers.
   */
  async compareVersions(
    workspaceId: string,
    v1: number,
    v2: number,
  ): Promise<{
    version1: WorkspaceVersionDTO | null
    version2: WorkspaceVersionDTO | null
    changes: string[]
  }> {
    const allVersions = await versionRepository.findByWorkspaceId(workspaceId)
    const version1 = allVersions.find(v => v.version === v1) ?? null
    const version2 = allVersions.find(v => v.version === v2) ?? null

    const changes: string[] = []
    if (version1 && version2) {
      if (version1.snapshotId !== version2.snapshotId) {
        changes.push('snapshot changed')
      }
      if (version1.published !== version2.published) {
        changes.push(`published status: ${version1.published} → ${version2.published}`)
      }
      if (version1.label !== version2.label) {
        changes.push(`label: "${version1.label}" → "${version2.label}"`)
      }
    }

    return { version1, version2, changes }
  },

  /**
   * Restore a workspace to a specific version.
   * If the version has a linked snapshot, restores from that snapshot.
   */
  async restoreVersion(versionId: string): Promise<{
    version: WorkspaceVersionDTO
    workspace: any
  }> {
    const version = await versionRepository.findById(versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    // If linked to a snapshot, restore from snapshot
    if (version.snapshotId) {
      const result = await snapshotSystem.restoreSnapshot(version.snapshotId)
      return { version, workspace: result.workspace }
    }

    // Otherwise just return the current workspace state
    const workspace = await workspaceRepository.findById(version.workspaceId)
    if (!workspace) {
      throw new Error(`Workspace not found: ${version.workspaceId}`)
    }
    return { version, workspace }
  },

  /**
   * Fork a workspace from a specific version.
   * Creates a new version that references the parent version.
   * (Reserved for future branching support)
   */
  async forkWorkspace(
    workspaceId: string,
    versionId: string,
    forkLabel?: string,
  ): Promise<WorkspaceVersionDTO> {
    const version = await versionRepository.findById(versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    return versionRepository.fork(
      workspaceId,
      forkLabel ?? `fork-v${version.version}`,
      version.version,
    )
  },

  /**
   * List all versions for a workspace.
   */
  async listVersions(workspaceId: string): Promise<WorkspaceVersionDTO[]> {
    return versionRepository.findByWorkspaceId(workspaceId)
  },

  /**
   * Get the published version of a workspace.
   */
  async getPublishedVersion(
    workspaceId: string,
  ): Promise<WorkspaceVersionDTO | null> {
    return versionRepository.findPublished(workspaceId)
  },
}
