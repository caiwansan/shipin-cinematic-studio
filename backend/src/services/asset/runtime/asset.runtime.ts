// ============================================================
// Asset Runtime — full lifecycle management
// import → normalize → extract → store → version → index → publish
// Events: AssetCreated, AssetUpdated, AssetDeleted, AssetVersioned
// ============================================================

import { normalizer } from '../normalizer/index.js'
import { assetExtractor } from '../extractor/index.js'
import { assetService, onAssetEvent, offAssetEvent } from '../asset.service.js'
import { assetVersionService } from '../asset-version.service.js'
import { createRawDocument, rawDocumentRepository } from '../scanner/raw-document.js'
import type { AssetEvent, AssetEventType } from '../types.js'

export class AssetRuntime {
  private initialized = false

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    console.log('[AssetRuntime] Runtime initialized')
  }

  /**
   * Full pipeline: raw HTML → Asset
   */
  async importFromHtml(projectId: string, url: string, html: string, headers?: Record<string, string>): Promise<unknown> {
    // 1. Create raw document
    const rawDoc = createRawDocument(projectId, url, html, headers)
    const savedDoc = await rawDocumentRepository.create(rawDoc)

    // 2. Normalize
    const { blocks, title, summary, contentType } = normalizer.normalize(html, url)

    // 3. Extract → Asset
    const asset = await assetExtractor.extract(projectId, url, blocks, contentType, title, summary)

    return { rawDocument: savedDoc, asset }
  }

  /**
   * Normalize only (no store)
   */
  normalize(html: string, url: string) {
    return normalizer.normalize(html, url)
  }

  /**
   * Store raw document only
   */
  async storeRawDocument(projectId: string, url: string, html: string, headers?: Record<string, string>) {
    const rawDoc = createRawDocument(projectId, url, html, headers)
    return rawDocumentRepository.create(rawDoc)
  }

  /**
   * Extract → store asset
   */
  async extractAndStore(projectId: string, url: string, blocks: ReturnType<typeof normalizer.normalize>) {
    return assetExtractor.extract(projectId, url, blocks.blocks, blocks.contentType, blocks.title, blocks.summary)
  }

  /**
   * Create a new version
   */
  async version(assetId: string, content: string, hash?: string) {
    return assetVersionService.createVersion(assetId, content, hash)
  }

  /**
   * Subscribe to asset events
   */
  on(eventType: AssetEventType, listener: (event: AssetEvent) => void) {
    onAssetEvent(eventType, listener)
  }

  /**
   * Unsubscribe from asset events
   */
  off(eventType: AssetEventType, listener: (event: AssetEvent) => void) {
    offAssetEvent(eventType, listener)
  }

  /**
   * Get assets by project
   */
  async listByProject(projectId: string, filter?: Record<string, unknown>) {
    return assetService.listByProject(projectId, filter as any)
  }

  /**
   * Get asset by ID
   */
  async getAsset(id: string) {
    return assetService.getAsset(id)
  }

  /**
   * Get project asset stats
   */
  async getProjectStats(projectId: string) {
    return assetService.getProjectStats(projectId)
  }

  /**
   * Delete asset
   */
  async deleteAsset(id: string) {
    return assetService.deleteAsset(id)
  }
}

// Singleton
export const assetRuntime = new AssetRuntime()
