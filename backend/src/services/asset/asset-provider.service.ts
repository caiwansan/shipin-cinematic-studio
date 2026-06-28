// ============================================================
// Asset Provider Service — cross-workspace interface
// Import, Export, Get, List, Update, Delete
// ============================================================

import { assetService } from './asset.service.js'
import type { AssetData, AssetFilter } from './types.js'

export interface AssetProvider {
  importAsset(source: string, type: string, projectId: string): Promise<unknown>
  exportAsset(id: string): Promise<unknown>
  getAsset(id: string): Promise<unknown>
  listAssets(projectId: string, filter?: AssetFilter): Promise<{ items: unknown[]; total: number }>
  updateAsset(id: string, data: Partial<AssetData>): Promise<unknown>
  deleteAsset(id: string): Promise<void>
}

export const assetProviderService: AssetProvider = {
  async importAsset(source: string, type: string, projectId: string) {
    return assetService.createAsset({
      projectId,
      type,
      title: source.split('/').pop() || source,
      source: 'import',
      sourceUrl: source,
    })
  },

  async exportAsset(id: string) {
    return assetService.getAsset(id)
  },

  async getAsset(id: string) {
    return assetService.getAsset(id)
  },

  async listAssets(projectId: string, filter?: AssetFilter) {
    return assetService.listByProject(projectId, filter)
  },

  async updateAsset(id: string, data: Partial<AssetData>) {
    return assetService.updateAsset(id, data)
  },

  async deleteAsset(id: string) {
    await assetService.deleteAsset(id)
  },
}
