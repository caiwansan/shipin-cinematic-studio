// ============================================================
// Manifest Service — Workspace Manifest 生成/导出/导入
// 每个 Workspace 自动生成完整 Manifest
// ============================================================

import { workspaceRepository } from '../repositories/workspace.repository.js'
import { snapshotRepository } from '../repositories/snapshot.repository.js'
import { versionRepository } from '../repositories/version.repository.js'
import { assetRepository } from '../repositories/asset.repository.js'
import { conversationRepository } from '../repositories/conversation.repository.js'
import { operationRepository } from '../repositories/operation.repository.js'
import type {
  WorkspaceManifest,
  ManifestCapability,
  ManifestExecutionGraph,
  ManifestResourceContract,
  ManifestAsset,
  ManifestPrompt,
  ManifestOutputVersion,
  ManifestCostSummary,
  ManifestAuditEntry,
} from '../types.js'

export const manifestService = {
  /**
   * Generate a complete manifest for a workspace.
   * Aggregates: capabilities, execution graph, resources, assets, prompts, outputs, cost, audit
   */
  async generateManifest(workspaceId: string): Promise<WorkspaceManifest> {
    const workspace = await workspaceRepository.findById(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)

    const [snapshots, versions, assets, operations] = await Promise.all([
      snapshotRepository.findByWorkspaceId(workspaceId),
      versionRepository.findByWorkspaceId(workspaceId),
      assetRepository.findByWorkspaceId(workspaceId),
      operationRepository.findByWorkspaceId(workspaceId, 500),
    ])

    // Build capabilities from workspace type
    const capabilities: ManifestCapability[] = [
      {
        id: `${workspaceId}-cap-1`,
        name: `workspace-${workspace.type}`,
        version: '1.0.0',
        category: workspace.type,
      },
    ]

    // Build execution graph from snapshots
    const executionGraph: ManifestExecutionGraph = {
      steps: snapshots.map(s => ({
        id: s.id,
        type: 'snapshot',
        name: s.label || `snapshot-${s.version}`,
      })),
      dependencies: {},
    }

    // Build resource contracts (placeholder — actual contracts from Resource Runtime)
    const resourceContracts: ManifestResourceContract[] = []

    // Build assets
    const manifestAssets: ManifestAsset[] = assets.map(a => ({
      id: a.id,
      type: a.type,
      path: a.path,
      size: a.size ?? 0,
      hash: a.hash,
    }))

    // Build prompts from conversation history
    const prompts: ManifestPrompt[] = [] // Would aggregate from conversation repository

    // Build output versions
    const outputVersions: ManifestOutputVersion[] = versions.map(v => ({
      version: `v${v.version}`,
      label: v.label,
      published: v.published,
      createdAt: v.createdAt.toISOString(),
    }))

    // Build cost summary
    const costSummary: ManifestCostSummary = {
      totalEstimatedCost: 0,
      currency: 'USD',
      resourceCount: resourceContracts.length,
    }

    // Build audit trail from operations
    const auditTrail: ManifestAuditEntry[] = operations.map(op => ({
      operation: op.type,
      userId: op.userId,
      timestamp: op.createdAt.toISOString(),
    }))

    const manifest: WorkspaceManifest = {
      workspaceId,
      name: workspace.name,
      type: workspace.type,
      capabilities,
      executionGraph,
      resourceContracts,
      assets: manifestAssets,
      prompts,
      outputVersions,
      costSummary,
      auditTrail,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    // Persist manifest to workspace
    await workspaceRepository.saveManifest(workspaceId, JSON.stringify(manifest))

    return manifest
  },

  /**
   * Export a workspace with its manifest.
   * Returns a portable bundle: { manifest, data }
   */
  async exportWorkspace(workspaceId: string): Promise<{
    manifest: WorkspaceManifest
    data: {
      snapshots: any[]
      versions: any[]
      assets: any[]
    }
  }> {
    const manifest = await this.generateManifest(workspaceId)

    const [snapshots, versions, assets] = await Promise.all([
      snapshotRepository.findByWorkspaceId(workspaceId),
      versionRepository.findByWorkspaceId(workspaceId),
      assetRepository.findByWorkspaceId(workspaceId),
    ])

    return {
      manifest,
      data: {
        snapshots,
        versions,
        assets,
      },
    }
  },

  /**
   * Import a workspace from a manifest and data bundle.
   */
  async importWorkspace(
    tenantId: string,
    manifest: WorkspaceManifest,
    data: {
      snapshots?: any[]
      versions?: any[]
      assets?: any[]
    },
  ): Promise<{ workspaceId: string }> {
    // Create the workspace
    const workspace = await workspaceRepository.create({
      type: manifest.type,
      tenantId,
      name: `${manifest.name} (imported)`,
    })

    // Store manifest
    await workspaceRepository.saveManifest(workspace.id, JSON.stringify(manifest))

    return { workspaceId: workspace.id }
  },

  /**
   * Get the current manifest for a workspace (cached or regenerated).
   */
  async getManifest(workspaceId: string): Promise<WorkspaceManifest | null> {
    const workspace = await workspaceRepository.findById(workspaceId)
    if (!workspace) return null

    if (workspace.manifest) {
      try {
        return JSON.parse(workspace.manifest) as WorkspaceManifest
      } catch {
        // Stale manifest, regenerate
      }
    }

    return this.generateManifest(workspaceId)
  },
}
