// ============================================================
// Semantic Runtime — Frontend runtime abstraction
// ============================================================

import { semanticService } from '../services/semantic.service'
import type {
  SemanticEntity, SemanticTopic, SemanticAlias, SemanticTaxonomy,
  SemanticKeyword, SemanticStats, EntityFilter,
} from '../types/index'

export interface SemanticRuntimeEvents {
  onEntityCreated?: (entity: SemanticEntity) => void
  onEntityUpdated?: (entity: SemanticEntity) => void
  onEntityDeleted?: (id: string) => void
}

export function createSemanticRuntime() {
  const listeners: {
    entityCreated: Array<(entity: SemanticEntity) => void>
    entityUpdated: Array<(entity: SemanticEntity) => void>
    entityDeleted: Array<(id: string) => void>
  } = {
    entityCreated: [],
    entityUpdated: [],
    entityDeleted: [],
  }

  return {
    on(event: 'entityCreated' | 'entityUpdated' | 'entityDeleted', handler: (...args: any[]) => void) {
      listeners[event].push(handler as any)
    },

    // Entities
    async listEntities(projectId: string, filter?: EntityFilter) {
      return semanticService.listEntities(projectId, filter)
    },

    async getEntity(id: string) {
      return semanticService.getEntity(id)
    },

    async createEntity(data: { projectId: string; type: string; name: string }) {
      const entity = await semanticService.createEntity(data)
      if (entity) {
        for (const fn of listeners.entityCreated) fn(entity)
      }
      return entity
    },

    async resolveEntity(projectId: string, name: string) {
      return semanticService.resolveEntity(projectId, name)
    },

    // Topics
    async listTopics(projectId: string) {
      return semanticService.listTopics(projectId)
    },

    // Taxonomy
    async getTaxonomyTree(projectId: string) {
      return semanticService.getTaxonomyTree(projectId)
    },

    // Alias
    async listAliases(projectId: string) {
      return semanticService.listAliases(projectId)
    },

    async resolveAlias(alias: string, projectId?: string) {
      return semanticService.resolveAlias(alias, projectId)
    },

    // Keywords
    async listKeywords(projectId: string) {
      return semanticService.listKeywords(projectId)
    },

    async getTopKeywords(projectId: string, limit?: number) {
      return semanticService.getTopKeywords(projectId, limit)
    },

    // Stats
    async getStats(projectId: string) {
      return semanticService.getStats(projectId)
    },

    // Pipeline
    async extract(projectId: string, content: string, sourceUrl?: string) {
      return semanticService.extract(projectId, content, sourceUrl)
    },

    async extractAsset(assetId: string, projectId: string) {
      return semanticService.extractAsset(assetId, projectId)
    },

    async rebuild(projectId: string) {
      return semanticService.rebuild(projectId)
    },
  }
}

export type SemanticRuntime = ReturnType<typeof createSemanticRuntime>
