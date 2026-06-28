// ============================================================
// Semantic Service — Business orchestrator for Semantic Runtime
// Coordinates repositories, pipeline, alias resolution
// ============================================================

import { entityRepository } from './repositories/entity.repository.js'
import { topicRepository } from './repositories/topic.repository.js'
import { relationRepository } from './repositories/relation.repository.js'
import { aliasRepository } from './repositories/alias.repository.js'
import { taxonomyRepository } from './repositories/taxonomy.repository.js'
import { keywordRepository } from './repositories/keyword.repository.js'
import { runPipeline } from './pipeline/index.js'
import type {
  SemanticEntityData,
  SemanticTopicData,
  SemanticRelationData,
  SemanticAliasData,
  SemanticTaxonomyData,
  SemanticKeywordData,
  EntityFilter,
  TopicFilter,
  RelationFilter,
  TaxonomyFilter,
  KeywordFilter,
  SemanticPipelineConfig,
  SemanticEvent,
  SemanticEventType,
  ChunkInput,
} from './types.js'
import { DEFAULT_PIPELINE_CONFIG } from './types.js'

// Simple event bus for semantic events
const eventListeners: Map<SemanticEventType, Array<(event: SemanticEvent) => void>> = new Map()

function emitEvent(type: SemanticEventType, projectId: string, data?: Record<string, unknown>) {
  const event: SemanticEvent = { type, projectId, timestamp: new Date(), data }
  const listeners = eventListeners.get(type) || []
  for (const listener of listeners) {
    try { listener(event) } catch { /* swallow */ }
  }
}

export function onSemanticEvent(type: SemanticEventType, listener: (event: SemanticEvent) => void) {
  if (!eventListeners.has(type)) eventListeners.set(type, [])
  eventListeners.get(type)!.push(listener)
}

export function offSemanticEvent(type: SemanticEventType, listener: (event: SemanticEvent) => void) {
  const listeners = eventListeners.get(type)
  if (listeners) {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

export const semanticService = {
  // ─── Pipeline ───

  async extractFromContent(projectId: string, input: ChunkInput, config?: SemanticPipelineConfig) {
    const result = await runPipeline(projectId, input, config || DEFAULT_PIPELINE_CONFIG)
    emitEvent('extraction:completed', projectId, {
      entityCount: result.entities.length,
      topicCount: result.topics.length,
      keywordCount: result.keywords.length,
    })
    return result
  },

  // ─── Entities ───

  async createEntity(data: SemanticEntityData) {
    const entity = await entityRepository.create(data)
    emitEvent('entity:created', data.projectId, { entityId: entity.id, type: data.type, name: data.name })
    return entity
  },

  async getEntity(id: string) {
    return entityRepository.findById(id)
  },

  async listEntities(filter: EntityFilter) {
    return entityRepository.list(filter)
  },

  async updateEntity(id: string, data: Partial<SemanticEntityData>) {
    const entity = await entityRepository.update(id, data)
    emitEvent('entity:updated', data.projectId || '', { entityId: id })
    return entity
  },

  async deleteEntity(id: string) {
    // Clean up related data
    await aliasRepository.deleteByEntity(id)
    await keywordRepository.deleteByEntity(id)
    await relationRepository.deleteByEntity(id)
    await entityRepository.softDelete(id)
    emitEvent('entity:deleted', '', { entityId: id })
    return { success: true }
  },

  async resolveEntity(projectId: string, name: string) {
    return entityRepository.resolveByName(projectId, name)
  },

  async getEntityStats(projectId: string) {
    return entityRepository.getTypeStats(projectId)
  },

  // ─── Topics ───

  async createTopic(data: SemanticTopicData) {
    const topic = await topicRepository.create(data)
    emitEvent('topic:built', data.projectId, { topicId: topic.id, name: data.name })
    return topic
  },

  async getTopic(id: string) {
    return topicRepository.findById(id)
  },

  async listTopics(filter: TopicFilter) {
    return topicRepository.list(filter)
  },

  async updateTopic(id: string, data: Partial<SemanticTopicData>) {
    const topic = await topicRepository.update(id, data)
    emitEvent('topic:updated', data.projectId || '', { topicId: id })
    return topic
  },

  async deleteTopic(id: string) {
    return topicRepository.delete(id)
  },

  async linkEntityToTopic(entityId: string, topicId: string) {
    return topicRepository.linkEntity(entityId, topicId)
  },

  async getTopicEntities(topicId: string) {
    return topicRepository.getEntities(topicId)
  },

  // ─── Relations ───

  async createRelation(data: SemanticRelationData) {
    const relation = await relationRepository.create(data)
    emitEvent('relation:created', data.projectId, { relationId: relation.id, relation: data.relation })
    return relation
  },

  async listRelations(filter: RelationFilter) {
    return relationRepository.list(filter)
  },

  async deleteRelation(id: string) {
    await relationRepository.delete(id)
    emitEvent('relation:deleted', '', { relationId: id })
    return { success: true }
  },

  // ─── Aliases ───

  async createAlias(data: SemanticAliasData) {
    return aliasRepository.create(data)
  },

  async listAliases(projectId: string) {
    return aliasRepository.listByProject(projectId)
  },

  async getEntityAliases(entityId: string) {
    return aliasRepository.listByEntity(entityId)
  },

  async deleteAlias(id: string) {
    return aliasRepository.delete(id)
  },

  async resolveAlias(alias: string, projectId?: string) {
    return aliasRepository.findByAlias(alias, projectId)
  },

  // ─── Taxonomy ───

  async createTaxonomyNode(data: SemanticTaxonomyData) {
    return taxonomyRepository.create(data)
  },

  async getTaxonomyNode(id: string) {
    return taxonomyRepository.findById(id)
  },

  async listTaxonomy(filter: TaxonomyFilter) {
    return taxonomyRepository.list(filter)
  },

  async getTaxonomyTree(projectId: string) {
    return taxonomyRepository.getTree(projectId)
  },

  async getTaxonomyRoots(projectId: string) {
    return taxonomyRepository.getRoots(projectId)
  },

  async getTaxonomyChildren(parentId: string) {
    return taxonomyRepository.getChildren(parentId)
  },

  async updateTaxonomyNode(id: string, data: Partial<SemanticTaxonomyData>) {
    const node = await taxonomyRepository.update(id, data)
    emitEvent('taxonomy:updated', data.projectId || '', { taxonomyId: id })
    return node
  },

  async deleteTaxonomyNode(id: string) {
    return taxonomyRepository.delete(id)
  },

  // ─── Keywords ───

  async createKeyword(data: SemanticKeywordData) {
    return keywordRepository.create(data)
  },

  async listKeywords(filter: KeywordFilter) {
    return keywordRepository.list(filter)
  },

  async deleteKeyword(id: string) {
    return keywordRepository.delete(id)
  },

  async getTopKeywords(projectId: string, limit = 50) {
    return keywordRepository.getTopKeywords(projectId, limit)
  },

  // ─── Stats ───

  async getProjectStats(projectId: string) {
    const [entities, topics, relations, aliases, taxonomies, keywords] = await Promise.all([
      entityRepository.countByProject(projectId),
      topicRepository.countByProject(projectId),
      relationRepository.countByProject(projectId),
      aliasRepository.countByProject(projectId),
      taxonomyRepository.countByProject(projectId),
      keywordRepository.countByProject(projectId),
    ])

    return {
      entityCount: entities,
      topicCount: topics,
      relationCount: relations,
      aliasCount: aliases,
      taxonomyCount: taxonomies,
      keywordCount: keywords,
    }
  },
}
