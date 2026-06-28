// ============================================================
// Asset Version Service — version lifecycle orchestration
// ============================================================

import { assetVersionRepository } from './repositories/asset-version.repository.js'
import type { AssetEvent } from './types.js'
import { onAssetEvent } from './asset.service.js'

export const assetVersionService = {
  async createVersion(assetId: string, content: string | null, hash?: string) {
    return assetVersionRepository.createVersion(assetId, content, hash)
  },

  async listVersions(assetId: string) {
    return assetVersionRepository.listVersions(assetId)
  },

  async getVersion(assetId: string, version: number) {
    return assetVersionRepository.getVersion(assetId, version)
  },

  async restoreVersion(assetId: string, version: number) {
    return assetVersionRepository.restoreVersion(assetId, version)
  },

  // Auto-version on content update
  initAutoVersioning() {
    onAssetEvent('updated', (event: AssetEvent) => {
      if (event.data?.contentChanged) {
        // Version is created in assetService.updateAsset already
      }
    })
  },
}
