// ============================================================
// AssetProvider — Cross-Workspace Interface
// Interface for any workspace to consume asset services
// ============================================================

import type { UnifiedAsset, AssetFilter, AssetListResult } from '../types/index'
import { assetProvider } from '../services/asset.service'

export type { AssetProvider } from '../types/index'

/**
 * Singleton provider instance for cross-workspace usage
 */
export const defaultAssetProvider = assetProvider

/**
 * Create a bound provider scoped to a specific project
 */
export function createProjectAssetProvider(projectId: string) {
  return {
    async importAsset(source: string, type: string): Promise<UnifiedAsset | null> {
      return assetProvider.importAsset(source, type)
    },

    async exportAsset(id: string): Promise<UnifiedAsset | null> {
      return assetProvider.exportAsset(id)
    },

    async getAsset(id: string): Promise<UnifiedAsset | null> {
      return assetProvider.getAsset(id)
    },

    async listAssets(filter?: AssetFilter): Promise<AssetListResult> {
      return assetProvider.listAssets(projectId, { ...filter, projectId })
    },

    async updateAsset(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset | null> {
      return assetProvider.updateAsset(id, data)
    },

    async deleteAsset(id: string): Promise<boolean> {
      return assetProvider.deleteAsset(id)
    },
  }
}
