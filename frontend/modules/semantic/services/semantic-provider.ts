// ============================================================
// Semantic Provider — Cross-Workspace Interface
// Interface for any workspace to consume semantic services
// ============================================================

import { semanticService } from './semantic.service'
import type {
  SemanticEntity, SemanticTopic, SemanticAlias, SemanticTaxonomy,
  SemanticKeyword, SemanticStats,
} from '../types/index'

export interface SemanticProvider {
  extractFromAsset(assetId: string, projectId: string): Promise<any>
  listEntities(projectId: string, filter?: { type?: string; search?: string; limit?: number }): Promise<{ items: SemanticEntity[]; total: number }>
  listTopics(projectId: string, filter?: { search?: string; limit?: number }): Promise<{ items: SemanticTopic[]; total: number }>
  resolveAlias(alias: string, projectId?: string): Promise<SemanticAlias | null>
  searchSemantic(projectId: string, query: string, type?: string): Promise<SemanticEntity[]>
  buildGraph(projectId: string): Promise<any>
  getStats(projectId: string): Promise<SemanticStats>
  getTaxonomyTree(projectId: string): Promise<SemanticTaxonomy[]>
  rebuild(projectId: string): Promise<any>
}

export const defaultSemanticProvider: SemanticProvider = {
  async extractFromAsset(assetId, projectId) {
    return semanticService.extractAsset(assetId, projectId)
  },

  async listEntities(projectId, filter) {
    return semanticService.listEntities(projectId, filter)
  },

  async listTopics(projectId, filter) {
    return semanticService.listTopics(projectId, filter)
  },

  async resolveAlias(alias, projectId) {
    return semanticService.resolveAlias(alias, projectId)
  },

  async searchSemantic(projectId, query, type) {
    const result = await semanticService.listEntities(projectId, { search: query, type, limit: 20 })
    return result.items
  },

  async buildGraph(_projectId) {
    // Graph building is done server-side via geo/graph.service.ts
    // This is a placeholder for frontend trigger
    return { success: true }
  },

  async getStats(projectId) {
    return semanticService.getStats(projectId)
  },

  async getTaxonomyTree(projectId) {
    return semanticService.getTaxonomyTree(projectId)
  },

  async rebuild(projectId) {
    return semanticService.rebuild(projectId)
  },
}

export function createProjectSemanticProvider(projectId: string): SemanticProvider {
  return {
    async extractFromAsset(assetId) {
      return defaultSemanticProvider.extractFromAsset(assetId, projectId)
    },
    async listEntities(_projectId, filter) {
      return defaultSemanticProvider.listEntities(projectId, filter)
    },
    async listTopics(_projectId, filter) {
      return defaultSemanticProvider.listTopics(projectId, filter)
    },
    async resolveAlias(alias, _projectId) {
      return defaultSemanticProvider.resolveAlias(alias, projectId)
    },
    async searchSemantic(_projectId, query, type) {
      return defaultSemanticProvider.searchSemantic(projectId, query, type)
    },
    async buildGraph(_projectId) {
      return defaultSemanticProvider.buildGraph(projectId)
    },
    async getStats(_projectId) {
      return defaultSemanticProvider.getStats(projectId)
    },
    async getTaxonomyTree(_projectId) {
      return defaultSemanticProvider.getTaxonomyTree(projectId)
    },
    async rebuild(_projectId) {
      return defaultSemanticProvider.rebuild(projectId)
    },
  }
}
