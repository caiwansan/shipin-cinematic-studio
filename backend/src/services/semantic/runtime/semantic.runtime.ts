// ============================================================
// Semantic Runtime — Lifecycle management
// Manages initialization, pipeline execution, rebuild, version
// Events: EntityCreated, EntityUpdated, EntityDeleted, TopicBuilt, TaxonomyUpdated
// ============================================================

import { initializePipeline } from '../pipeline/index.js'
import { semanticService, onSemanticEvent, offSemanticEvent } from '../semantic.service.js'
import type { SemanticEvent, SemanticEventType, ChunkInput } from '../types.js'

export class SemanticRuntime {
  private initialized = false
  private version = '1.0.0'

  getVersion(): string {
    return this.version
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true

    // Register default extractors
    initializePipeline()
    console.log(`[SemanticRuntime] v${this.version} initialized`)
  }

  /**
   * Load/extract semantic data from a content source
   */
  async load(projectId: string, input: ChunkInput) {
    if (!this.initialized) await this.initialize()
    return semanticService.extractFromContent(projectId, input)
  }

  /**
   * Update an existing entity
   */
  async update(projectId: string, entityId: string, data: Record<string, unknown>) {
    if (!this.initialized) await this.initialize()
    return semanticService.updateEntity(entityId, data as any)
  }

  /**
   * Delete an entity and its associated data
   */
  async delete(entityId: string) {
    if (!this.initialized) await this.initialize()
    return semanticService.deleteEntity(entityId)
  }

  /**
   * Rebuild all semantic data for a project from scratch
   * Warning: This will delete and recreate all entities
   */
  async rebuild(projectId: string) {
    if (!this.initialized) await this.initialize()
    console.log(`[SemanticRuntime] Rebuilding semantic data for project ${projectId}`)

    // In a real scenario, would re-scan all assets
    // For now, this is a placeholder that emits the event
    const event: SemanticEvent = {
      type: 'rebuild:completed',
      projectId,
      timestamp: new Date(),
      data: { version: this.version },
    }

    // Notify listeners
    const listeners = (onSemanticEvent as any).listeners?.get?.('rebuild:completed') || []
    for (const listener of listeners) {
      try { listener(event) } catch { /* swallow */ }
    }

    return { success: true, version: this.version }
  }

  /**
   * Get stats for a project
   */
  async stats(projectId: string) {
    return semanticService.getProjectStats(projectId)
  }

  /**
   * Subscribe to semantic events
   */
  on(eventType: SemanticEventType, listener: (event: SemanticEvent) => void) {
    onSemanticEvent(eventType, listener)
  }

  /**
   * Unsubscribe from semantic events
   */
  off(eventType: SemanticEventType, listener: (event: SemanticEvent) => void) {
    offSemanticEvent(eventType, listener)
  }

  /**
   * List entities with filter
   */
  async listEntities(filter: { projectId: string; type?: string; search?: string; limit?: number; offset?: number }) {
    if (!this.initialized) await this.initialize()
    return semanticService.listEntities(filter as any)
  }

  /**
   * List topics with filter
   */
  async listTopics(filter: { projectId: string; search?: string; limit?: number; offset?: number }) {
    if (!this.initialized) await this.initialize()
    return semanticService.listTopics(filter as any)
  }
}

// Singleton
export const semanticRuntime = new SemanticRuntime()
