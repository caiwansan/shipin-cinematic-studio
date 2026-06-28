// ============================================================
// Asset Runtime — full lifecycle management
// import → normalize → extract → store → version → index → publish
// Events: Created, Updated, Deleted (via PlatformEventBus)
// Lifecycle: RuntimeLifecycle (Init → Load → Validate → Execute → Update → Dispose)
// ============================================================

import { PlatformContext, createContext } from '@platform/context/platform-context.js'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle.js'
import { IEventBus, platformEventBus } from '@platform/events/event-bus.js'
import { NotFoundError, ValidationError } from '@platform/errors/platform-errors.js'
import { normalizer } from '../normalizer/index.js'
import { assetExtractor } from '../extractor/index.js'
import { assetService } from '../asset.service.js'
import { assetVersionService } from '../asset-version.service.js'
import { createRawDocument, rawDocumentRepository } from '../scanner/raw-document.js'

export interface AssetInput {
  projectId: string
  url?: string
  html?: string
  headers?: Record<string, string>
  assetId?: string
  content?: string
  hash?: string
}

export interface AssetOutput {
  asset?: any
  rawDocument?: any
  version?: any
}

export class AssetRuntime implements RuntimeLifecycle<AssetInput, AssetOutput> {
  private initialized = false
  private eventBus: IEventBus

  constructor(eventBus: IEventBus = platformEventBus) {
    this.eventBus = eventBus
  }

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    console.log('[AssetRuntime] Runtime initialized')
  }

  async load(ctx: PlatformContext, id: string): Promise<AssetInput> {
    const asset: any = await assetService.getAsset(id)
    if (!asset) {
      throw new NotFoundError('Asset not found', { assetId: id })
    }
    return { assetId: id, projectId: asset.projectId, content: asset.content || undefined }
  }

  async validate(ctx: PlatformContext, input: AssetInput): Promise<boolean> {
    if (!input.projectId) return false
    if (input.assetId) {
      const existing = await assetService.getAsset(input.assetId)
      if (!existing) return false
    }
    return true
  }

  async execute(ctx: PlatformContext, input: AssetInput): Promise<AssetOutput> {
    if (!input.html) {
      throw new ValidationError('html content is required for execution')
    }
    const url = input.url || ''
    const html = input.html
    const headers = input.headers

    // 1. Create raw document
    const rawDoc = createRawDocument(input.projectId, url, html, headers)
    const savedDoc = await rawDocumentRepository.create(rawDoc)

    // 2. Normalize
    const { blocks, title, summary, contentType } = normalizer.normalize(html, url)

    // 3. Extract → Asset
    const asset: any = await assetExtractor.extract(input.projectId, url, blocks, contentType, title, summary)

    // Emit event
    this.eventBus.emit({
      type: 'asset:Created',
      source: 'asset',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: asset?.id,
      projectId: input.projectId,
      payload: { title, summary, contentType },
    })

    return { rawDocument: savedDoc, asset }
  }

  async update(ctx: PlatformContext, id: string, data: Partial<AssetInput>): Promise<AssetOutput> {
    const updated = await assetService.updateAsset(id, data as any)
    this.eventBus.emit({
      type: 'asset:Updated',
      source: 'asset',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: id,
      projectId: data.projectId,
      payload: { updates: Object.keys(data) },
    })
    return { asset: updated }
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    console.log('[AssetRuntime] Disposed')
  }

  // ─── Legacy Methods (maintain backward compat) ───

  async initialize() {
    return this.init(createContext())
  }

  /**
   * Full pipeline: raw HTML → Asset
   */
  async importFromHtml(projectId: string, url: string, html: string, headers?: Record<string, string>): Promise<unknown> {
    const ctx = createContext({ projectId })
    await this.init(ctx)
    const result = await this.execute(ctx, { projectId, url, html, headers })
    return result
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
    await assetService.deleteAsset(id)
    const ctx = createContext()
    this.eventBus.emit({
      type: 'asset:Deleted',
      source: 'asset',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: id,
    })
  }
}

// Singleton
export const assetRuntime = new AssetRuntime()
