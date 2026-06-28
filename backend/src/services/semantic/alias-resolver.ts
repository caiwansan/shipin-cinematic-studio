// ============================================================
// Alias Resolver — alias deduplication & canonical name resolution
// ============================================================

import { aliasRepository } from './repositories/alias.repository.js'
import { entityRepository } from './repositories/entity.repository.js'
import type { SemanticAliasData } from './types.js'

export const aliasResolver = {
  /**
   * Resolve a name to its canonical entity, trying alias matching
   */
  async resolve(projectId: string, nameOrAlias: string) {
    return entityRepository.resolveByName(projectId, nameOrAlias)
  },

  /**
   * Register an alias for an entity, with deduplication
   */
  async registerAlias(data: SemanticAliasData) {
    // Check if alias already exists
    const existing = await aliasRepository.findByAlias(data.alias)
    if (existing) {
      // If same entity, just update
      if (existing.entityId === data.entityId) {
        return aliasRepository.update(existing.id, { confidence: data.confidence })
      }
      // Different entity — keep the one with higher confidence
      if (existing.confidence >= (data.confidence ?? 1.0)) {
        return existing
      }
      // Replace: delete old, create new
      await aliasRepository.delete(existing.id)
    }

    return aliasRepository.create(data)
  },

  /**
   * Merge aliases: point all aliases from source entity to target entity
   */
  async mergeAliases(sourceEntityId: string, targetEntityId: string) {
    const aliases = await aliasRepository.listByEntity(sourceEntityId)
    const results: any[] = []

    for (const alias of aliases) {
      try {
        const result = await this.registerAlias({
          entityId: targetEntityId,
          alias: alias.alias,
          language: alias.language,
          confidence: alias.confidence,
        })
        results.push(result)
      } catch {
        // Skip duplicate aliases
      }
    }

    // Delete all source aliases
    await aliasRepository.deleteByEntity(sourceEntityId)
    return results
  },

  /**
   * Normalize a name by finding its canonical form
   */
  async normalize(projectId: string, name: string): Promise<string> {
    const resolved = await this.resolve(projectId, name)
    if (resolved) {
      return resolved.entity.name
    }
    return name
  },
}
