// ============================================================
// Asset Runtime — Frontend runtime abstraction
// ============================================================

import { assetService, assetProvider } from '../services/asset.service'
import type { UnifiedAsset, AssetFilter, AssetListResult } from '../types/index'

export interface AssetRuntimeEvents {
  onCreated?: (asset: UnifiedAsset) => void
  onUpdated?: (asset: UnifiedAsset) => void
  onDeleted?: (id: string) => void
}

export function createAssetRuntime() {
  const listeners: { created: Array<(asset: UnifiedAsset) => void>; updated: Array<(asset: UnifiedAsset) => void>; deleted: Array<(id: string) => void> } = {
    created: [],
    updated: [],
    deleted: [],
  }

  return {
    provider: assetProvider,

    on(event: 'created' | 'updated' | 'deleted', handler: (...args: any[]) => void) {
      listeners[event].push(handler as any)
    },

    async list(projectId: string, filter?: AssetFilter): Promise<AssetListResult> {
      return assetService.list(projectId, filter)
    },

    async get(id: string): Promise<UnifiedAsset | null> {
      return assetService.getById(id)
    },

    async create(data: Partial<UnifiedAsset> & { projectId: string; type: string; title: string }): Promise<UnifiedAsset | null> {
      const asset = await assetService.create(data)
      if (asset) {
        for (const fn of listeners.created) fn(asset)
      }
      return asset
    },

    async update(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset | null> {
      const asset = await assetService.update(id, data)
      if (asset) {
        for (const fn of listeners.updated) fn(asset)
      }
      return asset
    },

    async delete(id: string): Promise<boolean> {
      const success = await assetService.delete(id)
      if (success) {
        for (const fn of listeners.deleted) fn(id)
      }
      return success
    },

    async getStats(projectId: string) {
      return assetService.getStats(projectId)
    },

    async search(query: string, filter?: AssetFilter) {
      return assetService.search(query, filter)
    },
  }
}

export type AssetRuntime = ReturnType<typeof createAssetRuntime>
