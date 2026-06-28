// ============================================================
// Semantic Runtime — Lifecycle management
// Lifecycle: RuntimeLifecycle (Init → Load → Validate → Execute → Update → Dispose)
// Events: Created, Updated, Deleted (via PlatformEventBus)
// ============================================================

import { PlatformContext, createContext } from '@platform/context/platform-context.js'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle.js'
import { IEventBus, platformEventBus } from '@platform/events/event-bus.js'
import { initializePipeline } from '../pipeline/index.js'
import { semanticService } from '../semantic.service.js'

export interface SemanticInput {
  projectId: string
  content?: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
  entityId?: string
  type?: string
  name?: string
}

export interface SemanticOutput {
  entities?: any[]
  topics?: any[]
  stats?: any
  success?: boolean
  version?: string
}

export class SemanticRuntime implements RuntimeLifecycle<SemanticInput, SemanticOutput> {
  private initialized = false
  private version = '1.0.0'
  private eventBus: IEventBus

  constructor(eventBus: IEventBus = platformEventBus) {
    this.eventBus = eventBus
  }

  getVersion(): string {
    return this.version
  }

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    initializePipeline()
    console.log(`[SemanticRuntime] v${this.version} initialized`)
  }

  async load(ctx: PlatformContext, id: string): Promise<SemanticInput> {
    const entity = await semanticService.listEntities({ projectId: '', search: id } as any)
    return { projectId: id, entityId: id }
  }

  async validate(ctx: PlatformContext, input: SemanticInput): Promise<boolean> {
    if (!input.projectId) return false
    if (input.entityId && !input.content) {
      // Check if entity exists
      const stats = await semanticService.getProjectStats(input.projectId)
      if (!stats) return false
    }
    return true
  }

  async execute(ctx: PlatformContext, input: SemanticInput): Promise<SemanticOutput> {
    if (!this.initialized) await this.init(ctx)
    const result = await semanticService.extractFromContent(input.projectId, {
      content: input.content || '',
      sourceUrl: input.sourceUrl,
      metadata: input.metadata,
    } as any)

    this.eventBus.emit({
      type: 'semantic:Created',
      source: 'semantic',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      projectId: input.projectId,
      payload: { sourceUrl: input.sourceUrl },
    })

    return { entities: result as any }
  }

  async update(ctx: PlatformContext, id: string, data: Partial<SemanticInput>): Promise<SemanticOutput> {
    if (!this.initialized) await this.init(ctx)
    const result = await semanticService.updateEntity(id, data as any)

    this.eventBus.emit({
      type: 'semantic:Updated',
      source: 'semantic',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId: id,
      projectId: data.projectId,
    })

    return { entities: [result] }
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    console.log('[SemanticRuntime] Disposed')
  }

  // ─── Legacy Methods (maintain backward compat) ───

  async initialize() {
    return this.init(createContext())
  }

  /**
   * Load/extract semantic data from a content source (legacy compat)
   */
  async loadFromContent(projectId: string, input: { content: string; sourceUrl?: string; metadata?: Record<string, unknown> }) {
    const ctx = createContext({ projectId })
    await this.init(ctx)
    return this.execute(ctx, { projectId, ...input })
  }

  /**
   * Update an existing entity (legacy compat)
   */
  async updateEntity(projectId: string, entityId: string, data: Record<string, unknown>) {
    const ctx = createContext({ projectId })
    if (!this.initialized) await this.init(ctx)
    return semanticService.updateEntity(entityId, data as any)
  }

  /**
   * Delete an entity and its associated data (legacy compat)
   */
  async deleteEntity(entityId: string) {
    const ctx = createContext()
    if (!this.initialized) await this.init(ctx)
    const result = await semanticService.deleteEntity(entityId)
    this.eventBus.emit({
      type: 'semantic:Deleted',
      source: 'semantic',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      entityId,
    })
    return result
  }

  /**
   * Rebuild all semantic data for a project from scratch
   */
  async rebuild(projectId: string) {
    const ctx = createContext({ projectId })
    if (!this.initialized) await this.init(ctx)
    console.log(`[SemanticRuntime] Rebuilding semantic data for project ${projectId}`)

    this.eventBus.emit({
      type: 'semantic:RebuildCompleted',
      source: 'semantic',
      timestamp: new Date().toISOString(),
      traceId: ctx.traceId,
      projectId,
      payload: { version: this.version },
    })

    return { success: true, version: this.version }
  }

  /**
   * Get stats for a project
   */
  async stats(projectId: string) {
    return semanticService.getProjectStats(projectId)
  }

  /**
   * List entities with filter
   */
  async listEntities(filter: { projectId: string; type?: string; search?: string; limit?: number; offset?: number }) {
    if (!this.initialized) await this.init(createContext())
    return semanticService.listEntities(filter as any)
  }

  /**
   * List topics with filter
   */
  async listTopics(filter: { projectId: string; search?: string; limit?: number; offset?: number }) {
    if (!this.initialized) await this.init(createContext())
    return semanticService.listTopics(filter as any)
  }
}

// Singleton
export const semanticRuntime = new SemanticRuntime()
